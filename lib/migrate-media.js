'use strict';

/**
 * One-time migration: move data-URL images OUT of the database into files.
 *
 * Scans products.image, products.image2, products.variant_images (JSON),
 * products.spin_frames (JSON) for `data:image/...;base64,...` values,
 * writes each to UPLOAD_DIR via lib/media.js, and replaces the DB value
 * with the public URL (e.g. /media/products/abc123.webp).
 *
 * Usage:  node lib/migrate-media.js
 * Safe to re-run: values that are already URLs are skipped.
 */

const { client, ready } = require('./db');
const { saveBuffer, saveBufferAs } = require('./media');

const DATA_URL = /^data:(image\/(jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

let migrated = 0;
let skipped = 0;

function migrateValue(v) {
  if (typeof v !== 'string') return { value: v, changed: false };
  const m = DATA_URL.exec(v.trim());
  if (!m) { skipped++; return { value: v, changed: false }; }
  const mime = m[1];
  const buf = Buffer.from(m[3], 'base64');
  if (!buf.length || buf.length > 8 * 1024 * 1024) {
    console.warn(`  skip: suspicious data URL (${buf.length} bytes)`);
    skipped++;
    return { value: v, changed: false };
  }
  let url;
  try {
    if (mime === 'image/gif') {
      url = saveBufferAs(buf, 'image', '.gif'); // keep animation
    } else {
      // Keep the original format for migrated files (sharp conversion
      // applies to new uploads going forward).
      url = saveBufferAs(buf, 'image', mime === 'image/png' ? '.png' : '.jpg');
    }
  } catch (e) {
    console.warn('  skip: write failed', e.message);
    skipped++;
    return { value: v, changed: false };
  }
  migrated++;
  return { value: url, changed: true };
}

function migrateJsonArray(jsonStr) {
  let arr;
  try { arr = JSON.parse(jsonStr || '[]'); } catch { return { value: jsonStr, changed: false }; }
  if (!Array.isArray(arr)) return { value: jsonStr, changed: false };
  let changed = false;
  const out = arr.map((v) => {
    const r = migrateValue(v);
    if (r.changed) changed = true;
    return r.value;
  });
  return { value: JSON.stringify(out), changed };
}

function migrateJsonObject(jsonStr) {
  let obj;
  try { obj = JSON.parse(jsonStr || '{}'); } catch { return { value: jsonStr, changed: false }; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { value: jsonStr, changed: false };
  let changed = false;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const r = migrateValue(v);
    if (r.changed) changed = true;
    out[k] = r.value;
  }
  return { value: JSON.stringify(out), changed };
}

async function main() {
  await ready();
  const c = client();
  const r = await c.execute('SELECT id, image, image2, variant_images, spin_frames FROM products');
  console.log(`Scanning ${r.rows.length} products...`);

  let updated = 0;
  for (const row of r.rows) {
    const sets = [];
    const args = [];

    const im = migrateValue(row.image);
    if (im.changed) { sets.push('image = ?'); args.push(im.value); }

    const im2 = migrateValue(row.image2);
    if (im2.changed) { sets.push('image2 = ?'); args.push(im2.value); }

    const vi = migrateJsonObject(row.variant_images);
    if (vi.changed) { sets.push('variant_images = ?'); args.push(vi.value); }

    const sf = migrateJsonArray(row.spin_frames);
    if (sf.changed) { sets.push('spin_frames = ?'); args.push(sf.value); }

    if (sets.length) {
      args.push(row.id);
      await c.execute({ sql: `UPDATE products SET ${sets.join(', ')} WHERE id = ?`, args });
      updated++;
      if (updated % 25 === 0) console.log(`  ...${updated} products updated`);
    }
  }

  console.log(`\nDone. ${updated} products updated, ${migrated} files written, ${skipped} values skipped (already URLs).`);
  console.log('Verify a few product pages, then this script never needs to run again.');
}

main().catch((e) => { console.error('Migration failed:', e); process.exit(1); });
