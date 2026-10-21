import { NextResponse } from 'next/server';
import { client, ready } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkRate } from '@/lib/rate-limit';

/**
 * Registered customers — the accounts created on the storefront.
 * GET /api/admin/customers?q=  → [{
 *   id, name, email, phone, address, city, joined,
 *   orders, total_spent, last_order, last_order_id
 * }]
 * Order stats are aggregated from orders.customer_id (orders can only be
 * placed by signed-in accounts, so every order belongs to a user here).
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

  const rc = await client().execute({
    sql: 'SELECT id, name, email, phone, address, city, created_at FROM customers ORDER BY id DESC',
  });
  const ro = await client().execute({
    sql: 'SELECT id, customer_id, total, status, created_at FROM orders WHERE customer_id IS NOT NULL ORDER BY id DESC',
  });

  const stats = new Map();
  for (const row of ro.rows) {
    const cid = Number(row.customer_id);
    let s = stats.get(cid);
    if (!s) {
      s = { orders: 0, total_spent: 0, last_order: null, last_order_id: null };
      stats.set(cid, s);
    }
    s.orders += 1;
    if (row.status !== 'cancelled') s.total_spent += Number(row.total) || 0;
    if (!s.last_order || row.created_at > s.last_order) {
      s.last_order = row.created_at;
      s.last_order_id = row.id;
    }
  }

  let list = rc.rows.map((c) => {
    const s = stats.get(Number(c.id)) || { orders: 0, total_spent: 0, last_order: null, last_order_id: null };
    return {
      id: c.id,
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      city: c.city || '',
      joined: c.created_at,
      orders: s.orders,
      total_spent: s.total_spent,
      last_order: s.last_order,
      last_order_id: s.last_order_id,
    };
  });

  if (q) {
    list = list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        String(c.phone).toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }
  return NextResponse.json(list.slice(0, 200));
}
