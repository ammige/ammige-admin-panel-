import { NextResponse } from 'next/server';
import { client, ready, parseProduct } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';

const COLS = ['sku', 'name', 'slug', 'collection', 'price', 'old_price', 'material', 'description', 'tags', 'badge', 'stock', 'active'];

function csvEsc(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET → download products as CSV */
export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  await ready();
  const r = await client().execute({ sql: 'SELECT * FROM products ORDER BY id' });
  const lines = [COLS.join(',')];
  for (const row of r.rows) {
    const p = parseProduct(row);
    lines.push(COLS.map((c) => csvEsc(c === 'active' ? (p.active ? 1 : 0) : p[c])).join(','));
  }
  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="ammige-products-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
