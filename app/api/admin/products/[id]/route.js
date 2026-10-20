import { NextResponse } from 'next/server';
import {
  client, ready, parseProduct, normalizeCollection,
  isNonEmptyString, isPositiveInt,
  sanitizeText, sanitizeStringArray, isSafeImageUrl, slugify,
} from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

const ALLOWED = ['sku', 'name', 'slug', 'collection', 'price', 'old_price', 'colors', 'material',
  'description', 'description_html', 'tags', 'image', 'image2', 'variant_images', 'sizes', 'spin_frames', 'video_url', 'model_3d', 'rating', 'reviews', 'badge', 'badge_start', 'badge_end', 'stock', 'active',
  'spin_enabled', 'spin_poster', 'spin_mode'];

function adminWriteLimit(req) {
  return checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' });
}

function clean(k, v, existing) {
  switch (k) {
    case 'sku': return sanitizeText(v, 40) || existing.sku;
    case 'name': return sanitizeText(v, 200);
    case 'collection': return v;
    case 'price': return v;
    case 'old_price': return isPositiveInt(v) ? v : null;
    case 'colors': return JSON.stringify(sanitizeStringArray(v));
    case 'material': return sanitizeText(v, 120) || null;
    case 'description': return sanitizeText(v, 2000) || null;
    case 'image':
    case 'image2': {
      const s = sanitizeText(v, 300);
      return s && isSafeImageUrl(s) ? s : null;
    }
    case 'variant_images': {
      if (v == null) return '{}';
      if (typeof v !== 'object' || Array.isArray(v)) return '{}';
      const out = {};
      for (const k of Object.keys(v).slice(0, 12)) {
        const color = sanitizeText(k, 40);
        const url = sanitizeText(v[k], 300);
        if (color && url && isSafeImageUrl(url)) out[color] = url;
      }
      return JSON.stringify(out);
    }
    case 'sizes': return JSON.stringify(sanitizeStringArray(v));
    case 'spin_frames': return JSON.stringify(sanitizeStringArray(v).filter((u) => isSafeImageUrl(u)).slice(0, 36));
    case 'video_url': {
      const s = sanitizeText(v, 500);
      return s || null;
    }
    case 'model_3d': {
      const s = sanitizeText(v, 500);
      if (!s) return null;
      if (!/^(\/media\/models\/[a-zA-Z0-9_-]+\.glb|https?:\/\/.+\.glb)$/i.test(s)) return existing.model_3d || null;
      return s;
    }
    case 'rating': return typeof v === 'number' ? Math.min(5, Math.max(0, v)) : existing.rating;
    case 'reviews': return isPositiveInt(v) ? v : 0;
    case 'badge': return sanitizeText(v, 20) || null;
    case 'badge_start':
    case 'badge_end': {
      if (!v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    case 'slug': {
      const s = slugify(v || existing.name);
      return s || null;
    }
    case 'tags': {
      const t = sanitizeStringArray(String(v || '').split(',').map((s) => s.trim()).filter(Boolean));
      return t.join(', ');
    }
    case 'description_html': {
      // Allow basic formatting tags only; strip scripts/events.
      let h = String(v || '').slice(0, 10000);
      h = h.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
      h = h.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
      h = h.replace(/<(?!p\b|br\b|b\b|strong\b|i\b|em\b|u\b|ul\b|ol\b|li\b|h3\b|h4\b|blockquote\b|\/p\b|\/b\b|\/strong\b|\/i\b|\/em\b|\/u\b|\/ul\b|\/ol\b|\/li\b|\/h3\b|\/h4\b|\/blockquote\b)[a-z][^>]*>/gi, '');
      return h.trim() || null;
    }
    case 'spin_enabled': {
      if (v == null || v === '') return null;
      return v === 1 || v === '1' || v === true ? 1 : 0;
    }
    case 'spin_poster': {
      const s = sanitizeText(v, 500);
      return s && isSafeImageUrl(s) ? s : null;
    }
    case 'spin_mode': {
      const m = String(v || '').toLowerCase();
      return ['auto', 'glb', 'frames', 'box'].includes(m) ? m : null;
    }
    case 'stock': return v;
    case 'active': return v ? 1 : 0;
    default: return v;
  }
}

export async function PATCH(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!adminWriteLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid product id.' }, { status: 400 });
  }
  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  await ready();
  const c = client();
  const ex = await c.execute({ sql: 'SELECT * FROM products WHERE id = ?', args: [id] });
  if (!ex.rows.length) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  const existing = ex.rows[0];

  const updates = {};
  for (const k of ALLOWED) if (k in b) updates[k] = b[k];
  if ('collection' in updates) {
    const slug = normalizeCollection(updates.collection);
    if (!slug) return NextResponse.json({ error: 'collection must be everyday|signature|leather.' }, { status: 400 });
    updates.collection = slug;
  }
  if ('price' in updates && !isPositiveInt(updates.price)) {
    return NextResponse.json({ error: 'price must be a positive integer (PKR).' }, { status: 400 });
  }
  if ('name' in updates && !sanitizeText(updates.name, 200)) {
    return NextResponse.json({ error: 'name cannot be empty.' }, { status: 400 });
  }
  if ('colors' in updates && !Array.isArray(updates.colors)) {
    return NextResponse.json({ error: 'colors must be an array.' }, { status: 400 });
  }
  if ('sizes' in updates && !Array.isArray(updates.sizes)) {
    return NextResponse.json({ error: 'sizes must be an array.' }, { status: 400 });
  }
  if ('variant_images' in updates && updates.variant_images != null &&
      (typeof updates.variant_images !== 'object' || Array.isArray(updates.variant_images))) {
    return NextResponse.json({ error: 'variant_images must be an object.' }, { status: 400 });
  }
  if ('stock' in updates && (!Number.isInteger(updates.stock) || updates.stock < 0)) {
    return NextResponse.json({ error: 'stock must be a non-negative integer.' }, { status: 400 });
  }

  const keys = Object.keys(updates);
  if (keys.length === 0) return NextResponse.json(parseProduct(existing));

  try {
    await c.execute({
      sql: `UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
      args: [...keys.map((k) => clean(k, updates[k], existing)), id],
    });
  } catch (e) {
    if (String(e && e.message).includes('UNIQUE')) {
      return NextResponse.json({ error: 'SKU already exists.' }, { status: 400 });
    }
    console.error('admin product update failed', e);
    return NextResponse.json({ error: 'Could not update product.' }, { status: 500 });
  }
  const r = await c.execute({ sql: 'SELECT * FROM products WHERE id = ?', args: [id] });
  const { logActivity } = await import('@/lib/content');
  await logActivity('update', 'product', id, `Updated: ${keys.join(', ')}`);
  return NextResponse.json(parseProduct(r.rows[0]));
}

export async function DELETE(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!adminWriteLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid product id.' }, { status: 400 });
  }
  await ready();
  const r = await client().execute({ sql: 'UPDATE products SET active = 0 WHERE id = ?', args: [id] });
  if (r.rowsAffected === 0) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  const { logActivity } = await import('@/lib/content');
  await logActivity('delete', 'product', id, 'Soft-deleted (active=0)');
  return NextResponse.json({ ok: true, id });
}
