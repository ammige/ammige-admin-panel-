import { NextResponse } from 'next/server';
import { createOrder } from '@/lib/orders';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

/**
 * Manual order creation (WhatsApp / phone sales taken by the team).
 * POST /api/admin/orders/manual
 * { customer:{name,phone,address,city}, items:[{id,qty}], notes, payment, couponCode }
 */
export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  try {
    const res = await createOrder({
      customer: body && body.customer,
      items: body && body.items,
      notes: body && body.notes,
      payment: body && body.payment,
      couponCode: body && body.couponCode,
      source: 'manual',
    });
    return NextResponse.json(res, { status: 201 });
  } catch (e) {
    if (e && e.status) {
      return NextResponse.json({ error: e.error || 'Could not create order.' }, { status: e.status });
    }
    console.error('manual order failed', e);
    return NextResponse.json({ error: 'Could not create order. Please try again.' }, { status: 500 });
  }
}
