import { NextResponse } from 'next/server';
import { client, ready } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

function adminWriteLimit(req) {
  return checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' });
}

/**
 * POST /api/admin/products/bulk
 * Body variants:
 *  { ids: [1,2,3] } → hard-delete those products
 *  { deleteAllExcept: 1 } → hard-delete everything except that id
 *  { action: 'publish'|'unpublish', ids: [...] }
 *  { action: 'price_percent', ids: [...], percent: -10 } → adjust price by %
 *  { action: 'duplicate', ids: [...] } → copy products (new SKU/slug)
 */
export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!adminWriteLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  let body;
  try { body = await req.json(); } catch { body = {}; }
  await ready();
  const c = client();
  const { logActivity } = await import('@/lib/content');

  if (body.deleteAllExcept != null) {
    const keep = parseInt(body.deleteAllExcept, 10);
    if (!Number.isInteger(keep) || keep <= 0) {
      return NextResponse.json({ error: 'Invalid keep id.' }, { status: 400 });
    }
    const r = await c.execute({ sql: 'DELETE FROM products WHERE id != ?', args: [keep] });
    await logActivity('bulk_delete', 'product', null, `Deleted all except #${keep} (${r.rowsAffected || 0})`);
    return NextResponse.json({ ok: true, deleted: r.rowsAffected || 0, kept: keep });
  }

  const ids = Array.isArray(body.ids) ? body.ids.map((x) => parseInt(x, 10)).filter((x) => Number.isInteger(x) && x > 0) : [];
  if (!ids.length) return NextResponse.json({ error: 'No valid ids.' }, { status: 400 });
  // Safety cap per request
  const batch = ids.slice(0, 500);
  const placeholders = batch.map(() => '?').join(',');

  // Publish / unpublish
  if (body.action === 'publish' || body.action === 'unpublish') {
    const active = body.action === 'publish' ? 1 : 0;
    const r = await c.execute({ sql: `UPDATE products SET active = ? WHERE id IN (${placeholders})`, args: [active, ...batch] });
    await logActivity('bulk_' + body.action, 'product', null, `${r.rowsAffected || 0} products`);
    return NextResponse.json({ ok: true, updated: r.rowsAffected || 0 });
  }

  // Price percent change
  if (body.action === 'price_percent') {
    const pct = Number(body.percent);
    if (!Number.isFinite(pct) || pct <= -100 || pct > 500) {
      return NextResponse.json({ error: 'Percent must be between -99 and 500.' }, { status: 400 });
    }
    const r = await c.execute({
      sql: `UPDATE products SET price = MAX(1, ROUND(price * (1 + ? / 100.0))) WHERE id IN (${placeholders})`,
      args: [pct, ...batch],
    });
    await logActivity('bulk_price', 'product', null, `${pct}% on ${r.rowsAffected || 0} products`);
    return NextResponse.json({ ok: true, updated: r.rowsAffected || 0 });
  }

  // Duplicate
  if (body.action === 'duplicate') {
    const src = await c.execute({ sql: `SELECT * FROM products WHERE id IN (${placeholders})`, args: batch });
    let n = 0;
    const { slugify } = await import('@/lib/db');
    for (const row of src.rows) {
      const sku = `COPY-${row.sku}-${Date.now().toString(36)}`.slice(0, 40);
      await c.execute({
        sql: `INSERT INTO products (sku, name, slug, collection, price, old_price, colors, material,
                description, description_html, tags, image, image2, variant_images, sizes, spin_frames,
                video_url, model_3d, rating, reviews, badge, stock, active, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, 0, ?)`,
        args: [
          sku, `${row.name} (copy)`, slugify(`${row.name}-copy-${Date.now().toString(36)}`),
          row.collection, row.price, row.old_price, row.colors, row.material,
          row.description, row.description_html, row.tags, row.image, row.image2, row.variant_images,
          row.sizes, row.spin_frames, row.video_url, row.model_3d, row.badge, row.stock,
          new Date().toISOString(),
        ],
      });
      n++;
    }
    await logActivity('bulk_duplicate', 'product', null, `${n} products duplicated`);
    return NextResponse.json({ ok: true, duplicated: n });
  }

  // Default: hard delete
  const r = await c.execute({ sql: `DELETE FROM products WHERE id IN (${placeholders})`, args: batch });
  await logActivity('bulk_delete', 'product', null, `${r.rowsAffected || 0} products`);
  return NextResponse.json({ ok: true, deleted: r.rowsAffected || 0 });
}
