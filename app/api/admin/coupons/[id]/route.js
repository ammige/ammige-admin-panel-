import { NextResponse } from 'next/server';
import { client, ready, parseCoupon } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

function writeLimit(req) {
  return checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' });
}

function validatePayload(b) {
  const out = {};
  if (b.type !== undefined) {
    if (b.type !== 'percent' && b.type !== 'flat') {
      return { error: 'type must be "percent" or "flat".' };
    }
    out.type = b.type;
  }
  if (b.value !== undefined) {
    const v = Number(b.value);
    if (!Number.isInteger(v) || v <= 0) return { error: 'value must be a positive integer.' };
    if (v > 100 && (out.type === 'percent' || b.type === 'percent')) {
      return { error: 'percent value cannot exceed 100.' };
    }
    out.value = v;
  }
  if (b.min_order !== undefined) {
    const v = Number(b.min_order);
    if (!Number.isInteger(v) || v < 0) return { error: 'min_order must be a non-negative integer.' };
    out.min_order = v;
  }
  if (b.usage_limit !== undefined) {
    if (b.usage_limit === null || b.usage_limit === '') {
      out.usage_limit = null;
    } else {
      const v = Number(b.usage_limit);
      if (!Number.isInteger(v) || v <= 0) return { error: 'usage_limit must be a positive integer or empty.' };
      out.usage_limit = v;
    }
  }
  if (b.expires_at !== undefined) {
    if (b.expires_at === null || b.expires_at === '') {
      out.expires_at = null;
    } else {
      const d = new Date(b.expires_at);
      if (Number.isNaN(d.getTime())) return { error: 'expires_at must be a valid date.' };
      out.expires_at = d.toISOString();
    }
  }
  if (b.active !== undefined) {
    out.active = b.active ? 1 : 0;
  }
  return { out };
}

const ALLOWED_COLS = ['type', 'value', 'min_order', 'usage_limit', 'expires_at', 'active'];

export async function PATCH(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!writeLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid coupon id.' }, { status: 400 });
  }
  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const { error, out } = validatePayload(b || {});
  if (error) return NextResponse.json({ error }, { status: 400 });
  const cols = Object.keys(out).filter((k) => ALLOWED_COLS.includes(k));
  if (cols.length === 0) {
    return NextResponse.json({ error: `Nothing to update. Allowed: ${ALLOWED_COLS.join(', ')}.` }, { status: 400 });
  }
  // If switching to percent, ensure existing value <= 100.
  await ready();
  const c = client();
  const cur = await c.execute({ sql: 'SELECT * FROM coupons WHERE id = ?', args: [id] });
  if (!cur.rows.length) return NextResponse.json({ error: 'Coupon not found.' }, { status: 404 });
  const curType = out.type || cur.rows[0].type;
  const curValue = out.value !== undefined ? out.value : cur.rows[0].value;
  if (curType === 'percent' && curValue > 100) {
    return NextResponse.json({ error: 'percent value cannot exceed 100.' }, { status: 400 });
  }
  const setSQL = cols.map((k) => `${k} = ?`).join(', ');
  try {
    await c.execute({ sql: `UPDATE coupons SET ${setSQL} WHERE id = ?`, args: [...cols.map((k) => out[k]), id] });
  } catch (e) {
    console.error('coupon update failed', e);
    return NextResponse.json({ error: 'Could not update coupon.' }, { status: 500 });
  }
  const row = await c.execute({ sql: 'SELECT * FROM coupons WHERE id = ?', args: [id] });
  return NextResponse.json(parseCoupon(row.rows[0]));
}

export async function DELETE(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!writeLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid coupon id.' }, { status: 400 });
  }
  await ready();
  const r = await client().execute({ sql: 'DELETE FROM coupons WHERE id = ?', args: [id] });
  if (r.rowsAffected === 0) return NextResponse.json({ error: 'Coupon not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
