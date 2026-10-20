import { NextResponse } from 'next/server';
import { client, ready, parseProduct } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { checkOrigin } from '@/lib/csrf';
import { offerApplies } from '@/lib/offers';

/** Admin: preview which products an (unsaved) offer would affect. */
export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  let body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad JSON.' }, { status: 400 }); }
  const data = body.data || {};
  const fakeOffer = { data };
  await ready();
  const r = await client().execute({ sql: 'SELECT * FROM products WHERE active = 1 ORDER BY id LIMIT 500' });
  const products = r.rows.map(parseProduct).filter((p) => offerApplies(fakeOffer, p));

  const val = Number(data.discount_value) || 0;
  const items = products.slice(0, 20).map((p) => {
    const base = Number(p.price) || 0;
    let now = base;
    if (data.discount_type === 'percent') now = base * (1 - val / 100);
    else now = base - val;
    now = Math.max(0, Math.round(now));
    return { id: p.id, name: p.name, was: base, now };
  });
  return NextResponse.json({ count: products.length, items });
}
