import { revalidateTag } from 'next/cache';
import { client, ready, getSetting as getSettingRaw, sanitizeText } from './db';
import { nowUTC } from './time';

/**
 * Site content layer — everything the storefront renders from the database.
 *
 * - Settings and content blocks are cached with the 'site-content' tag;
 *   admin writes call revalidateSite() → pages refresh immediately.
 * - Schedules are evaluated on the SERVER at request time (isLive),
 *   so expired items disappear with no manual action.
 */

export const SITE_TAG = 'site-content';

export function revalidateSite() {
  revalidateTag(SITE_TAG);
}

export async function getSiteSetting(key) {
  await ready();
  return getSettingRaw(key);
}

export async function getSiteSettings(keys) {
  const out = {};
  await Promise.all(keys.map(async (k) => { out[k] = await getSiteSetting(k); }));
  return out;
}

/** Is a content block currently live? (active + status + schedule window) */
export function isLive(block, now = null) {
  if (!block) return false;
  if (Number(block.active) !== 1) return false;
  const status = block.status || 'published';
  if (status === 'draft') return false;
  const t = (now || nowUTC());
  if (block.starts_at && block.starts_at > t) return false;
  if (block.ends_at && block.ends_at <= t) return false;
  return true;
}

function parseBlock(row) {
  if (!row) return null;
  let data = {};
  try { data = JSON.parse(row.data || '{}'); } catch { /* keep {} */ }
  return { ...row, data };
}

async function getBlocks(type) {
  await ready();
  const r = await client().execute({
    sql: 'SELECT * FROM content_blocks WHERE type = ? ORDER BY priority ASC, id ASC',
    args: [type],
  });
  return r.rows.map(parseBlock);
}

/** All blocks of a type (for admin). */
export async function getAllBlocks(type) {
  return getBlocks(type);
}

/** Only currently-live blocks of a type (for storefront). */
export async function getLiveBlocks(type, now = null) {
  const all = await getBlocks(type);
  return all.filter((b) => isLive(b, now));
}

/** First live block of a type+name (nav_menu/main, footer/main, page_seo//shop...). */
export async function getLiveBlock(type, name, now = null) {
  const all = await getLiveBlocks(type, now);
  return all.find((b) => b.name === name) || null;
}

/** Single block by id (admin editing). */
export async function getBlockById(id) {
  await ready();
  const r = await client().execute({
    sql: 'SELECT * FROM content_blocks WHERE id = ?',
    args: [id],
  });
  return parseBlock(r.rows[0] || null);
}

/** Validate + normalize a content_blocks write payload. Returns { ok, data } or { ok:false, error }. */
export function cleanBlockInput(b) {
  const type = sanitizeText(b.type, 40);
  if (!type) return { ok: false, error: 'type is required.' };
  const name = sanitizeText(b.name, 120);
  if (!name) return { ok: false, error: 'name is required.' };
  let data = b.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { return { ok: false, error: 'data must be valid JSON.' }; }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'data must be an object.' };
  }
  const status = ['draft', 'published', 'scheduled'].includes(b.status) ? b.status : 'published';
  const active = b.active === 0 || b.active === false ? 0 : 1;
  const starts_at = b.starts_at ? String(b.starts_at) : null;
  const ends_at = b.ends_at ? String(b.ends_at) : null;
  if (starts_at && Number.isNaN(Date.parse(starts_at))) return { ok: false, error: 'starts_at is not a valid date.' };
  if (ends_at && Number.isNaN(Date.parse(ends_at))) return { ok: false, error: 'ends_at is not a valid date.' };
  if (starts_at && ends_at && starts_at >= ends_at) {
    return { ok: false, error: 'End must be after start.' };
  }
  const priority = Number.isInteger(b.priority) ? b.priority : parseInt(b.priority, 10) || 0;
  return {
    ok: true,
    data: {
      type, name,
      data: JSON.stringify(data),
      status, active,
      starts_at, ends_at, priority,
    },
  };
}

/** Activity log — who changed what, when. Fire-and-forget (never breaks the write). */
export async function logActivity(action, entity, entity_id, detail) {
  try {
    await ready();
    await client().execute({
      sql: 'INSERT INTO activity_log (actor, action, entity, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['admin', sanitizeText(action, 40), sanitizeText(entity, 40),
        entity_id != null ? String(entity_id).slice(0, 80) : null,
        detail != null ? sanitizeText(String(detail), 500) : null, nowUTC()],
    });
  } catch (e) {
    console.error('activity log failed', e);
  }
}

/** Admin-managed collections, falling back to hardcoded defaults.
 *  A collection the admin switched off / deleted in the panel has a
 *  non-live block — it must stay hidden and NOT be resurrected by the
 *  hardcoded fallback below. The fallback only fills collections that
 *  have no block at all. */
export async function getCollections() {
  const { COLLECTIONS } = await import('./db.js');
  const blocks = await getLiveBlocks('collection').catch(() => []);
  const all = await getBlocks('collection').catch(() => []);
  if (!all.length) return COLLECTIONS;
  const out = {};
  for (const b of blocks) {
    const d = b.data || {};
    const id = d.id || b.name;
    out[id] = {
      id,
      name: d.name || (COLLECTIONS[id] && COLLECTIONS[id].name) || id,
      tagline: d.tagline || (COLLECTIONS[id] && COLLECTIONS[id].tagline) || '',
      image: d.image || (COLLECTIONS[id] && COLLECTIONS[id].image) || '',
      description: d.description || '',
    };
  }
  const suppressed = new Set(
    all.map((b) => (b.data && b.data.id) || b.name).filter((id) => id && !out[id]),
  );
  for (const id of Object.keys(COLLECTIONS)) {
    if (!out[id] && !suppressed.has(id)) out[id] = COLLECTIONS[id];
  }
  return out;
}
