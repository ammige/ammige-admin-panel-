import { NextResponse } from 'next/server';
import { client, ready, parseOrder, ORDER_STATUSES, sanitizeText, isNonEmptyString } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

function writeLimit(req) {
  return checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' });
}

function readLimit(req) {
  return checkRate(req, { windowMs: 60_000, max: 120, scope: 'admin-read' });
}

function validId(params) {
  const id = parseInt(params.id, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!readLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  const id = validId(params);
  if (!id) return NextResponse.json({ error: 'Invalid order id.' }, { status: 400 });
  await ready();
  const r = await client().execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  if (!r.rows.length) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  return NextResponse.json(parseOrder(r.rows[0]));
}

const ALLOWED = ['status', 'tracking_number', 'courier', 'admin_notes'];

export async function PATCH(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!writeLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  const id = validId(params);
  if (!id) return NextResponse.json({ error: 'Invalid order id.' }, { status: 400 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const out = {};
  if (body.status !== undefined) {
    if (!ORDER_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of: ${ORDER_STATUSES.join('|')}.` }, { status: 400 });
    }
    out.status = body.status;
  }
  for (const k of ['tracking_number', 'courier', 'admin_notes']) {
    if (body[k] !== undefined) {
      const v = body[k];
      if (v === null || v === '') {
        out[k] = null;
      } else if (isNonEmptyString(v)) {
        out[k] = sanitizeText(v, k === 'admin_notes' ? 1000 : 120);
      } else {
        return NextResponse.json({ error: `${k} must be a string.` }, { status: 400 });
      }
    }
  }
  const cols = Object.keys(out).filter((k) => ALLOWED.includes(k));
  if (cols.length === 0) {
    return NextResponse.json({ error: `Nothing to update. Allowed: ${ALLOWED.join(', ')}.` }, { status: 400 });
  }
  await ready();
  const c = client();
  const setSQL = cols.map((k) => `${k} = ?`).join(', ');
  const r = await c.execute({
    sql: `UPDATE orders SET ${setSQL} WHERE id = ?`,
    args: [...cols.map((k) => out[k]), id],
  });
  if (r.rowsAffected === 0) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  const row = await c.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  return NextResponse.json(parseOrder(row.rows[0]));
}
