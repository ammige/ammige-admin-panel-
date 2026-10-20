import { NextResponse } from 'next/server';
import { client, ready } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkRate } from '@/lib/rate-limit';

/**
 * Customers auto-built from orders.
 * GET /api/admin/customers?q=  → [{ name, phone, city, orders, total_spent, last_order }]
 * Grouped by normalized phone number.
 */
export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!checkRate(req, { windowMs: 60_000, max: 120, scope: 'admin-read' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  await ready();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();

  const r = await client().execute({
    sql: 'SELECT id, customer, total, status, created_at FROM orders ORDER BY id DESC',
  });
  const map = new Map();
  for (const row of r.rows) {
    let cu = {};
    try { cu = JSON.parse(row.customer); } catch { /* ignore */ }
    const phone = String(cu.phone || '').replace(/[\s-]/g, '');
    if (!phone) continue;
    let e = map.get(phone);
    if (!e) {
      e = {
        phone: cu.phone,
        name: cu.name || '',
        city: cu.city || '',
        orders: 0,
        total_spent: 0,
        last_order: null,
        last_order_id: null,
      };
      map.set(phone, e);
    }
    e.orders += 1;
    if (row.status !== 'cancelled') e.total_spent += Number(row.total) || 0;
    if (!e.last_order || row.created_at > e.last_order) {
      e.last_order = row.created_at;
      e.last_order_id = row.id;
      e.name = cu.name || e.name;
      e.city = cu.city || e.city;
    }
  }
  let list = [...map.values()].sort((a, b) => b.total_spent - a.total_spent);
  if (q) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        String(c.phone).toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }
  return NextResponse.json(list.slice(0, 200));
}
