import { NextResponse } from 'next/server';
import { client, ready, parseOrder, nowISO, sanitizeText, isNonEmptyString } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { logActivity } from '@/lib/content';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

// Manual advance-payment verification. The admin checks the transaction
// in the real EasyPaisa / bank account first — approving here is the ONLY
// way a payment becomes "verified". Approval applies the promised
// advance discount (never before), records who verified it and when,
// confirms the order into processing, and saves the remaining COD
// balance. Rejection keeps the order pending and stores the reason so
// the customer can resubmit corrected proof from the track page.
export async function POST(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid order id.' }, { status: 400 });
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const action = body && body.action;
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action must be "approve" or "reject".' }, { status: 400 });
  }

  await ready();
  const c = client();
  const r = await c.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  if (!r.rows.length) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  const o = parseOrder(r.rows[0]);
  if (o.advance_status !== 'pending_verification') {
    return NextResponse.json({ error: 'This payment is not pending verification.' }, { status: 400 });
  }

  if (action === 'reject') {
    const reason = isNonEmptyString(body.reason) ? sanitizeText(body.reason, 300) : '';
    if (!reason) {
      return NextResponse.json({ error: 'Give a short reason so the customer knows what to fix.' }, { status: 400 });
    }
    await c.execute({
      sql: `UPDATE orders SET advance_status = 'rejected', advance_reject_reason = ?,
              advance_verified_amount = NULL, advance_verified_by = NULL, advance_verified_at = NULL
            WHERE id = ?`,
      args: [reason, id],
    });
    await logActivity('advance_payment_rejected', 'order', id,
      `Advance payment rejected for order #${id} (txn ${o.advance_txn_id || '—'}): ${reason}`);
    const u = await c.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
    return NextResponse.json(parseOrder(u.rows[0]));
  }

  // Approve — the verified amount defaults to the required advance; the
  // admin may record a different amount if the transfer differs.
  let verifiedAmount = o.advance_amount;
  if (body.verified_amount !== undefined && body.verified_amount !== null && body.verified_amount !== '') {
    const v = Number(body.verified_amount);
    if (!Number.isInteger(v) || v < 0) {
      return NextResponse.json({ error: 'verified_amount must be a non-negative integer (PKR).' }, { status: 400 });
    }
    verifiedAmount = v;
  }
  const newDiscount = o.discount + o.advance_discount;
  const newTotal = o.total - o.advance_discount;
  const codBalance = Math.max(0, newTotal - verifiedAmount);
  await c.execute({
    sql: `UPDATE orders SET advance_status = 'verified', advance_verified_amount = ?,
            advance_verified_by = 'admin', advance_verified_at = ?,
            discount = ?, total = ?, cod_balance = ?, advance_reject_reason = NULL,
            status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END
          WHERE id = ?`,
    args: [verifiedAmount, nowISO(), newDiscount, newTotal, codBalance, id],
  });
  await logActivity('advance_payment_verified', 'order', id,
    `Advance verified for order #${id}: Rs ${verifiedAmount} received (txn ${o.advance_txn_id || '—'}), discount Rs ${o.advance_discount} applied, COD balance Rs ${codBalance}.`);
  const u = await c.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  return NextResponse.json(parseOrder(u.rows[0]));
}
