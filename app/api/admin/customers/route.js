import { NextResponse } from 'next/server';
import { client, ready, findCustomerByEmail, createCustomer, sanitizeText, cleanCustomerEmail } from '@/lib/db';
import { hashPassword } from '@/lib/customer-auth';
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


const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** POST /api/admin/customers — admin creates a customer account manually. */
export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  await ready();
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = cleanCustomerEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (name.length < 2 || name.length > 60) return NextResponse.json({ error: 'Name must be 2–60 characters.' }, { status: 400 });
  if (!EMAIL_RE.test(email) || email.length > 120) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  if (password.length < 8 || password.length > 128) return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });

  let phone = null;
  const phoneRaw = typeof body?.phone === 'string' ? body.phone.trim() : '';
  if (phoneRaw) {
    const digits = phoneRaw.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 13) return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
    phone = sanitizeText(phoneRaw, 30);
  }
  const address = typeof body?.address === 'string' && body.address.trim() ? sanitizeText(body.address, 200) : null;
  const city = typeof body?.city === 'string' && body.city.trim() ? sanitizeText(body.city, 60) : null;

  if (await findCustomerByEmail(email)) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }
  const password_hash = await hashPassword(password);
  const customer = await createCustomer({ name, email, phone, password_hash, address, city });
  return NextResponse.json({ ok: true, customer: { id: customer.id, name: customer.name, email: customer.email } }, { status: 201 });
}
