import { NextResponse } from 'next/server';
import { client, ready, resolveCollection, sanitizeText, slugify } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

/** Minimal CSV parser (handles quoted fields). */
function parseCSV(text) {
  const rows = [];
  let cur = [], val = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { val += '"'; i++; }
        else inQ = false;
      } else val += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { cur.push(val); val = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cur.push(val); val = '';
      if (cur.length > 1 || cur[0] !== '') rows.push(cur);
      cur = [];
    } else val += ch;
  }
  if (val !== '' || cur.length) { cur.push(val); rows.push(cur); }
  return rows;
}

/**
 * POST → import products from CSV (multipart `file`).
 * Matches by SKU: existing → update, new → create. Max 500 rows.
 */
export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!checkRate(req, { windowMs: 60_000, max: 10, scope: 'admin-import' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  let text;
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (!f) return NextResponse.json({ error: 'No file.' }, { status: 400 });
    text = await f.text();
  } catch {
    return NextResponse.json({ error: 'Bad upload.' }, { status: 400 });
  }
  if (text.length > 2_000_000) return NextResponse.json({ error: 'File too large (2MB max).' }, { status: 400 });

  const rows = parseCSV(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2) return NextResponse.json({ error: 'Empty CSV.' }, { status: 400 });
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const si = (n) => header.indexOf(n);
  if (si('sku') < 0 || si('name') < 0) {
    return NextResponse.json({ error: 'CSV needs sku and name columns.' }, { status: 400 });
  }

  await ready();
  const c = client();
  const { logActivity } = await import('@/lib/content');
  let created = 0, updated = 0, skipped = 0;
  const now = new Date().toISOString();

  for (const r of rows.slice(1, 501)) {
    const g = (n) => (si(n) >= 0 ? (r[si(n)] || '').trim() : '');
    const sku = sanitizeText(g('sku'), 40);
    const name = sanitizeText(g('name'), 200);
    if (!sku || !name) { skipped++; continue; }
    const collection = (await resolveCollection(g('collection'))) || 'everyday';
    const price = parseInt(g('price'), 10);
    if (!Number.isInteger(price) || price <= 0) { skipped++; continue; }
    const old_price = parseInt(g('old_price'), 10);
    const stock = parseInt(g('stock'), 10);
    const active = g('active') === '0' ? 0 : 1;

    const ex = await c.execute({ sql: 'SELECT id FROM products WHERE sku = ?', args: [sku] });
    if (ex.rows.length) {
      await c.execute({
        sql: `UPDATE products SET name = ?, slug = ?, collection = ?, price = ?, old_price = ?,
              material = ?, description = ?, tags = ?, badge = ?, stock = ?, active = ? WHERE sku = ?`,
        args: [
          name, slugify(g('slug') || name), collection, price,
          Number.isInteger(old_price) && old_price > 0 ? old_price : null,
          sanitizeText(g('material'), 120) || null,
          sanitizeText(g('description'), 2000) || null,
          sanitizeText(g('tags'), 200) || '',
          sanitizeText(g('badge'), 20) || null,
          Number.isInteger(stock) && stock >= 0 ? stock : 50,
          active, sku,
        ],
      });
      updated++;
    } else {
      await c.execute({
        sql: `INSERT INTO products (sku, name, slug, collection, price, old_price, colors, material,
                description, tags, badge, stock, active, created_at)
              VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          sku, name, slugify(g('slug') || name), collection, price,
          Number.isInteger(old_price) && old_price > 0 ? old_price : null,
          sanitizeText(g('material'), 120) || null,
          sanitizeText(g('description'), 2000) || null,
          sanitizeText(g('tags'), 200) || '',
          sanitizeText(g('badge'), 20) || null,
          Number.isInteger(stock) && stock >= 0 ? stock : 50,
          active, now,
        ],
      });
      created++;
    }
  }
  await logActivity('csv_import', 'product', null, `${created} created, ${updated} updated, ${skipped} skipped`);
  return NextResponse.json({ ok: true, created, updated, skipped });
}
