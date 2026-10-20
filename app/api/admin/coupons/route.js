import { NextResponse } from 'next/server';
import {
  client, ready, parseCoupon, nowISO,
  isNonEmptyString, isPositiveInt, sanitizeText,
} from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

function readLimit(req) {
  return checkRate(req, { windowMs: 60_000, max: 120, scope: 'admin-read' });
}
function writeLimit(req) {
  return checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' });
}

function validatePayload(b, isUpdate = false) {
  const out = {};
  if (b.code !== undefined || !isUpdate) {
    if (!isNonEmptyString(b.code) || !/^[A-Z0-9-]{3,24}$/i.test(b.code.trim())) {
      return { error: 'code must be 3–24 chars, letters/numbers/dashes.' };
    }
    out.code = b.code.trim().toUpperCase();
  }
  if (b.type !== undefined || !isUpdate) {
    if (b.type !== 'percent' && b.type !== 'flat') {
      return { error: 'type must be "percent" or "flat".' };
    }
    out.type = b.type;
  }
  if (b.value !== undefined || !isUpdate) {
    const v = Number(b.value);
    if (!Number.isInteger(v) || v <= 0) return { error: 'value must be a positive integer.' };
    if ((out.type || b.type) === 'percent' && v > 100) {
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

export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!readLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  await ready();
  const r = await client().execute({ sql: 'SELECT * FROM coupons ORDER BY id DESC' });
  return NextResponse.json(r.rows.map(parseCoupon));
}

export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!writeLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const { error, out } = validatePayload(b || {});
  if (error) return NextResponse.json({ error }, { status: 400 });
  await ready();
  try {
    const r = await client().execute({
      sql: `INSERT INTO coupons (code, type, value, min_order, usage_limit, used_count, expires_at, active, created_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?)`,
      args: [
        out.code, out.type, out.value,
        out.min_order ?? 0, out.usage_limit ?? null, out.expires_at ?? null,
        nowISO(),
      ],
    });
    const row = await client().execute({
      sql: 'SELECT * FROM coupons WHERE id = ?',
      args: [Number(r.lastInsertRowid)],
    });
    return NextResponse.json(parseCoupon(row.rows[0]), { status: 201 });
  } catch (e) {
    if (/UNIQUE constraint failed/i.test(String(e && e.message))) {
      return NextResponse.json({ error: 'That coupon code already exists.' }, { status: 409 });
    }
    console.error('coupon create failed', e);
    return NextResponse.json({ error: 'Could not create coupon.' }, { status: 500 });
  }
}
