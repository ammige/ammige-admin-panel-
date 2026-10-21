import { NextResponse } from 'next/server';
import {
  client, ready, parseProduct, normalizeCollection, resolveCollection,
  isNonEmptyString, isPositiveInt,
  sanitizeText, sanitizeStringArray, isSafeImageUrl,
} from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

const SKU_PREFIX = { everyday: 'ED', signature: 'SG', leather: 'LT' };

function adminWriteLimit(req) {
  return checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' });
}

/**
 * Validate + sanitize variant_images: { "Color Name": "/images/..." }.
 * Returns JSON string on success, '{}' for empty, false when invalid.
 */
function cleanVariantImages(v) {
  if (v == null) return '{}';
  if (typeof v !== 'object' || Array.isArray(v)) return false;
  const out = {};
  const keys = Object.keys(v).slice(0, 12);
  for (const k of keys) {
    const color = sanitizeText(k, 40);
    const url = sanitizeText(v[k], 300);
    if (color && url && isSafeImageUrl(url)) out[color] = url;
  }
  return JSON.stringify(out);
}

export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!adminWriteLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  await ready();
  const { searchParams } = new URL(req.url);
  const collection = searchParams.get('collection');
  const q = searchParams.get('q');
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
  const limit = 24;
  const offset = (page - 1) * limit;

  const where = [];
  const args = [];
  if (collection) {
    const slug = await resolveCollection(collection);
    if (!slug) return NextResponse.json({ error: 'Invalid collection.' }, { status: 400 });
    where.push('collection = ?');
    args.push(slug);
  }
  if (q && isNonEmptyString(q)) {
    where.push('(name ILIKE ? OR sku ILIKE ?)');
    args.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }
  const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const totalR = await client().execute({ sql: `SELECT COUNT(*) AS c FROM products ${whereSQL}`, args });
  const rowsR = await client().execute({
    sql: `SELECT * FROM products ${whereSQL} ORDER BY id DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });
  const total = Number(totalR.rows[0].c);
  return NextResponse.json({
    items: rowsR.rows.map(parseProduct),
    total, page,
    pages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!adminWriteLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const name = sanitizeText(b.name, 200);
  if (!name) return NextResponse.json({ error: 'name is required.' }, { status: 400 });
  const collectionSlug = await resolveCollection(b.collection);
  if (!collectionSlug) {
    return NextResponse.json({ error: 'Unknown collection. Create it first in the Collections tab.' }, { status: 400 });
  }
  if (!isPositiveInt(b.price)) {
    return NextResponse.json({ error: 'price must be a positive integer (PKR).' }, { status: 400 });
  }
  const image = sanitizeText(b.image, 300);
  if (image && !isSafeImageUrl(image)) {
    return NextResponse.json({ error: 'image must be a relative path or http(s) URL.' }, { status: 400 });
  }
  const image2 = sanitizeText(b.image2, 300);
  if (image2 && !isSafeImageUrl(image2)) {
    return NextResponse.json({ error: 'image2 must be a relative path or http(s) URL.' }, { status: 400 });
  }
  const variant_images = cleanVariantImages(b.variant_images);
  if (variant_images === false) {
    return NextResponse.json({ error: 'variant_images must be an object of color → image URL (max 12).' }, { status: 400 });
  }
  const sizes = JSON.stringify(sanitizeStringArray(b.sizes));
  const spin_frames = JSON.stringify(sanitizeStringArray(b.spin_frames, 36, 300).filter((u) => isSafeImageUrl(u)).slice(0, 36));
  const video_url = sanitizeText(b.video_url, 500) || null;
  const model_3d = sanitizeText(b.model_3d, 500) || null;
  if (model_3d && !/^(\/media\/models\/[a-zA-Z0-9_-]+\.glb|https?:\/\/.+\.glb)$/i.test(model_3d)) {
    return NextResponse.json({ error: 'model_3d must be an uploaded /media/models/*.glb URL or an https .glb URL.' }, { status: 400 });
  }

  await ready();
  const c = client();
  let sku = sanitizeText(b.sku, 40) || null;
  if (!sku) {
    const m = await c.execute('SELECT COALESCE(MAX(id),0) AS v FROM products');
    const nextId = Number(m.rows[0].v) + 1;
    const prefix = SKU_PREFIX[collectionSlug]
      || collectionSlug.split('-').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
      || 'GN';
    sku = `AM-${prefix}-${String(nextId).padStart(4, '0')}`;
  }

  try {
    const { slugify: _slugify } = await import('@/lib/db');
    const ins = await c.execute({
      sql: `INSERT INTO products (sku, name, slug, collection, price, old_price, colors, material,
              description, description_html, tags, image, image2, variant_images, sizes, spin_frames, video_url, model_3d, rating, reviews, badge, badge_start, badge_end, stock, active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sku,
        name,
        _slugify(b.slug || name),
        collectionSlug,
        b.price,
        isPositiveInt(b.old_price) ? b.old_price : null,
        JSON.stringify(sanitizeStringArray(b.colors)),
        sanitizeText(b.material, 120) || null,
        sanitizeText(b.description, 2000) || null,
        null, // description_html set via PATCH
        sanitizeStringArray(String(b.tags || '').split(',').map((s) => s.trim()).filter(Boolean)).join(', '),
        image || null,
        image2 || null,
        variant_images,
        sizes,
        spin_frames,
        video_url,
        model_3d,
        typeof b.rating === 'number' ? Math.min(5, Math.max(0, b.rating)) : 0,
        isPositiveInt(b.reviews) ? b.reviews : 0,
        sanitizeText(b.badge, 20) || null,
        null, // badge_start via PATCH
        null, // badge_end via PATCH
        Number.isInteger(b.stock) && b.stock >= 0 ? b.stock : 50,
        b.active === 0 || b.active === false ? 0 : 1,
        new Date().toISOString(),
      ],
    });
    const r = await c.execute({ sql: 'SELECT * FROM products WHERE id = ?', args: [Number(ins.lastInsertRowid)] });
    const { logActivity } = await import('@/lib/content');
    await logActivity('create', 'product', Number(ins.lastInsertRowid), name);
    return NextResponse.json(parseProduct(r.rows[0]), { status: 201 });
  } catch (e) {
    if ((e && e.code === '23505') || /unique constraint|duplicate key/i.test(String(e && e.message))) {
      return NextResponse.json({ error: 'SKU already exists.' }, { status: 400 });
    }
    console.error('admin product create failed', e);
    return NextResponse.json({ error: 'Could not create product.' }, { status: 500 });
  }
}
