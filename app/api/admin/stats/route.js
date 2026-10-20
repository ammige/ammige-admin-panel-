import { NextResponse } from 'next/server';
import { client, ready, parseOrder } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkRate } from '@/lib/rate-limit';

const RANGES = {
  today: { days: 1 },
  '7d': { days: 7 },
  '30d': { days: 30 },
};

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!checkRate(req, { windowMs: 60_000, max: 120, scope: 'admin-read' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  await ready();
  const c = client();
  const { searchParams } = new URL(req.url);
  const rangeKey = searchParams.get('range');

  // Legacy shape (no range) — kept for the auth probe & simple widgets.
  if (!rangeKey || !RANGES[rangeKey]) {
    const q = async (sql, args = []) => (await c.execute({ sql, args })).rows[0];
    const revenue = await q("SELECT COALESCE(SUM(total),0) AS v FROM orders WHERE status != 'cancelled'");
    const orders_count = await q('SELECT COUNT(*) AS v FROM orders');
    const products_count = await q('SELECT COUNT(*) AS v FROM products WHERE active = 1');
    const pending_orders = await q("SELECT COUNT(*) AS v FROM orders WHERE status = 'pending'");
    return NextResponse.json({
      revenue: revenue.v,
      orders_count: orders_count.v,
      products_count: products_count.v,
      pending_orders: pending_orders.v,
    });
  }

  const { days } = RANGES[rangeKey];
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  const startISO = start.toISOString();

  const prevEnd = new Date(start);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  const prevStartISO = prevStart.toISOString();
  const prevEndISO = prevEnd.toISOString();

  const sumFor = async (fromISO, toISO) => {
    const r = await c.execute({
      sql: `SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders
            FROM orders WHERE status != 'cancelled' AND created_at >= ? AND created_at < ?`,
      args: [fromISO, toISO],
    });
    return { revenue: Number(r.rows[0].revenue), orders: Number(r.rows[0].orders) };
  };

  const [cur, prev] = await Promise.all([
    sumFor(startISO, now.toISOString()),
    sumFor(prevStartISO, prevEndISO),
  ]);
  const pendingR = await c.execute({
    sql: "SELECT COUNT(*) AS v FROM orders WHERE status = 'pending'",
  });

  // Daily series (oldest → newest), zero-filled.
  const buckets = new Map();
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    buckets.set(dayKey(d), { date: dayKey(d), revenue: 0, orders: 0 });
  }
  const rows = await c.execute({
    sql: `SELECT substr(created_at, 1, 10) AS d, COALESCE(SUM(total),0) AS revenue, COUNT(*) AS orders
          FROM orders WHERE status != 'cancelled' AND created_at >= ?
          GROUP BY d ORDER BY d`,
    args: [startISO],
  });
  for (const r of rows.rows) {
    if (buckets.has(r.d)) {
      buckets.set(r.d, { date: r.d, revenue: Number(r.revenue), orders: Number(r.orders) });
    }
  }

  const statusR = await c.execute({
    sql: `SELECT status, COUNT(*) AS c FROM orders WHERE created_at >= ? GROUP BY status`,
    args: [startISO],
  });
  const statusBreakdown = {};
  for (const r of statusR.rows) statusBreakdown[r.status] = Number(r.c);

  const lowR = await c.execute({
    sql: `SELECT id, name, sku, stock, price FROM products
          WHERE active = 1 AND stock <= 5 ORDER BY stock ASC, id DESC LIMIT 20`,
  });

  const recentR = await c.execute({
    sql: 'SELECT * FROM orders ORDER BY id DESC LIMIT 10',
  });

  // Top products by units sold in the selected range (aggregated from order items).
  const topMap = new Map();
  const rangeOrders = await c.execute({
    sql: `SELECT items FROM orders WHERE status != 'cancelled' AND created_at >= ?`,
    args: [startISO],
  });
  for (const row of rangeOrders.rows) {
    let items = [];
    try { items = JSON.parse(row.items); } catch { /* keep [] */ }
    for (const it of items) {
      const key = it.id != null ? `id:${it.id}` : `name:${it.name}`;
      const cur2 = topMap.get(key) || { id: it.id ?? null, name: it.name || 'Unknown', qty: 0, revenue: 0 };
      cur2.qty += Number(it.qty) || 0;
      cur2.revenue += (Number(it.price) || 0) * (Number(it.qty) || 0);
      topMap.set(key, cur2);
    }
  }
  const topProducts = [...topMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : a > 0 ? 100 : 0);

  return NextResponse.json({
    range: rangeKey,
    kpis: {
      revenue: cur.revenue,
      orders: cur.orders,
      aov: cur.orders ? Math.round((cur.revenue / cur.orders) * 100) / 100 : 0,
      pending: Number(pendingR.rows[0].v),
    },
    change: {
      revenue: pct(cur.revenue, prev.revenue),
      orders: pct(cur.orders, prev.orders),
    },
    series: [...buckets.values()],
    statusBreakdown,
    lowStock: lowR.rows,
    topProducts,
    recentOrders: recentR.rows.map(parseOrder),
  });
}
