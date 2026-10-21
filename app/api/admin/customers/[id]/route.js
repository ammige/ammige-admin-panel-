import { NextResponse } from 'next/server';
import { client, ready, findCustomerByEmail, findCustomerById, sanitizeText, cleanCustomerEmail } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkRate } from '@/lib/rate-limit';
import { hashPassword } from '@/lib/customer-auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validPhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 13 ? sanitizeText(raw, 30) : undefined; // undefined = invalid
}

/** PATCH /api/admin/customers/[id] — edit a registered customer's details. */
export async function PATCH(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  await ready();
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  const existing = await findCustomerById(id);
  if (!existing) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });

  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const name = typeof body?.name === 'string' ? body.name.trim() : existing.name;
  if (name.length < 2 || name.length > 60) return NextResponse.json({ error: 'Name must be 2–60 characters.' }, { status: 400 });

  const email = body?.email !== undefined ? cleanCustomerEmail(body.email) : existing.email;
  if (!EMAIL_RE.test(email) || email.length > 120) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  if (email !== existing.email) {
    const dupe = await findCustomerByEmail(email);
    if (dupe && Number(dupe.id) !== id) return NextResponse.json({ error: 'Another account already uses this email.' }, { status: 409 });
  }

  let phone = existing.phone;
  if (body?.phone !== undefined) {
    const v = validPhone(String(body.phone || '').trim());
    if (v === undefined) return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
    phone = v;
  }
  const address = body?.address !== undefined ? (String(body.address || '').trim() ? sanitizeText(body.address, 200) : null) : existing.address;
  const city = body?.city !== undefined ? (String(body.city || '').trim() ? sanitizeText(body.city, 60) : null) : existing.city;

  await client().execute({
    sql: 'UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, city = ? WHERE id = ?',
    args: [sanitizeText(name, 60), email, phone, address, city, id],
  });

  if (typeof body?.password === 'string' && body.password) {
    if (body.password.length < 8 || body.password.length > 128) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    const password_hash = await hashPassword(body.password);
    await client().execute({ sql: 'UPDATE customers SET password_hash = ? WHERE id = ?', args: [password_hash, id] });
  }

  const updated = await findCustomerById(id);
  return NextResponse.json({ ok: true, customer: { id: updated.id, name: updated.name, email: updated.email } });
}

/** DELETE /api/admin/customers/[id] — remove the account; orders stay (unlinked). */
export async function DELETE(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  await ready();
  const id = parseInt(params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  const existing = await findCustomerById(id);
  if (!existing) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  await client().execute({ sql: 'UPDATE orders SET customer_id = NULL WHERE customer_id = ?', args: [id] });
  await client().execute({ sql: 'DELETE FROM customers WHERE id = ?', args: [id] });
  return NextResponse.json({ ok: true, deleted: id });
}
