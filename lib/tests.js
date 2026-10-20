/**
 * Phase 7 automated tests: schedule logic (isLive), PKT conversion,
 * offer price calculation. Run: node lib/tests.js
 */
const assert = require('assert');

// ---- PKT conversion (mirrors lib/time.js + admin helpers) ----
function toPKTInput(utcISO) {
  if (!utcISO) return '';
  const d = new Date(utcISO);
  if (Number.isNaN(d.getTime())) return '';
  const p = new Date(d.getTime() + 5 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.getUTCFullYear()}-${pad(p.getUTCMonth() + 1)}-${pad(p.getUTCDate())}T${pad(p.getUTCHours())}:${pad(p.getUTCMinutes())}`;
}
function fromPKTInput(local) {
  if (!local) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim());
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 5 * 3600 * 1000).toISOString();
}

// ---- isLive (mirrors lib/content.js) ----
function isLive(block, nowISO) {
  if (!block) return false;
  if (Number(block.active) !== 1) return false;
  if (block.status === 'draft') return false;
  const now = nowISO || new Date().toISOString();
  if (block.starts_at && block.starts_at > now) return false;
  if (block.ends_at && block.ends_at <= now) return false;
  return true;
}

// ---- offer price (mirrors lib/offers.js) ----
function offerApplies(offer, product) {
  const d = offer.data || {};
  switch (d.applies_to) {
    case 'all': return true;
    case 'collection': return d.collection && product.collection === d.collection;
    case 'products': return Array.isArray(d.product_ids) && d.product_ids.includes(Number(product.id));
    case 'tag': {
      if (!d.tag) return false;
      const tags = String(product.tags || '').split(',').map((t) => t.trim().toLowerCase());
      return tags.includes(String(d.tag).toLowerCase());
    }
    default: return false;
  }
}
function applyOffers(product, offers) {
  if (!product || !offers || !offers.length) return product;
  const base = Number(product.price) || 0;
  if (base <= 0) return product;
  let best = null;
  for (const offer of offers) {
    if (!offerApplies(offer, product)) continue;
    const d = offer.data || {};
    const val = Number(d.discount_value) || 0;
    if (val <= 0) continue;
    let sale = d.discount_type === 'percent' ? base * (1 - val / 100) : base - val;
    sale = Math.max(0, Math.round(sale));
    if (!best || sale < best.salePrice) best = { offer, salePrice: sale };
  }
  if (!best || best.salePrice >= base) return product;
  return { ...product, price: best.salePrice, original_price: base };
}

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.log(`  ✗ ${name}: ${e.message}`); }
}

console.log('\nPKT conversion:');
t('UTC midnight → 05:00 PKT', () => {
  assert.strictEqual(toPKTInput('2026-10-19T00:00:00.000Z'), '2026-10-19T05:00');
});
t('PKT input → UTC', () => {
  assert.strictEqual(fromPKTInput('2026-10-19T05:00'), '2026-10-19T00:00:00.000Z');
});
t('Day boundary: 19 Oct 00:30 PKT = 18 Oct 19:30 UTC', () => {
  assert.strictEqual(fromPKTInput('2026-10-19T00:30'), '2026-10-18T19:30:00.000Z');
});
t('Round-trip', () => {
  const utc = '2026-12-31T18:45:00.000Z';
  assert.strictEqual(fromPKTInput(toPKTInput(utc)), utc);
});
t('Invalid input → null', () => {
  assert.strictEqual(fromPKTInput('not-a-date'), null);
  assert.strictEqual(fromPKTInput(''), null);
});

console.log('\nisLive schedule:');
const NOW = '2026-10-19T12:00:00.000Z';
t('Active + published, no schedule → live', () => {
  assert.strictEqual(isLive({ active: 1, status: 'published' }, NOW), true);
});
t('Inactive → not live', () => {
  assert.strictEqual(isLive({ active: 0, status: 'published' }, NOW), false);
});
t('Draft → not live', () => {
  assert.strictEqual(isLive({ active: 1, status: 'draft' }, NOW), false);
});
t('Future start → not live', () => {
  assert.strictEqual(isLive({ active: 1, status: 'published', starts_at: '2026-10-20T00:00:00.000Z' }, NOW), false);
});
t('Start exactly now → live (boundary)', () => {
  assert.strictEqual(isLive({ active: 1, status: 'published', starts_at: NOW }, NOW), true);
});
t('End exactly now → NOT live (boundary)', () => {
  assert.strictEqual(isLive({ active: 1, status: 'published', ends_at: NOW }, NOW), false);
});
t('End in future → live', () => {
  assert.strictEqual(isLive({ active: 1, status: 'published', ends_at: '2026-10-20T00:00:00.000Z' }, NOW), true);
});
t('Start in past, end in future → live', () => {
  assert.strictEqual(isLive({ active: 1, status: 'scheduled', starts_at: '2026-10-18T00:00:00.000Z', ends_at: '2026-10-20T00:00:00.000Z' }, NOW), true);
});
t('Null block → not live', () => {
  assert.strictEqual(isLive(null, NOW), false);
});

console.log('\nOffer price calculation:');
const prod = (o) => ({ id: 1, collection: 'everyday', tags: 'tote, sale', price: 1000, ...o });
t('20% off → 800', () => {
  const r = applyOffers(prod(), [{ data: { discount_type: 'percent', discount_value: 20, applies_to: 'all' } }]);
  assert.strictEqual(r.price, 800);
  assert.strictEqual(r.original_price, 1000);
});
t('Fixed Rs 250 off → 750', () => {
  const r = applyOffers(prod(), [{ data: { discount_type: 'fixed', discount_value: 250, applies_to: 'all' } }]);
  assert.strictEqual(r.price, 750);
});
t('Best discount wins (20% vs Rs 100 → 800)', () => {
  const r = applyOffers(prod(), [
    { data: { discount_type: 'fixed', discount_value: 100, applies_to: 'all' } },
    { data: { discount_type: 'percent', discount_value: 20, applies_to: 'all' } },
  ]);
  assert.strictEqual(r.price, 800);
});
t('Collection mismatch → no discount', () => {
  const r = applyOffers(prod(), [{ data: { discount_type: 'percent', discount_value: 50, applies_to: 'collection', collection: 'leather' } }]);
  assert.strictEqual(r.price, 1000);
  assert.strictEqual(r.original_price, undefined);
});
t('Tag match (case-insensitive) → discount', () => {
  const r = applyOffers(prod(), [{ data: { discount_type: 'percent', discount_value: 10, applies_to: 'tag', tag: 'SALE' } }]);
  assert.strictEqual(r.price, 900);
});
t('Product IDs match → discount', () => {
  const r = applyOffers(prod({ id: 5 }), [{ data: { discount_type: 'percent', discount_value: 10, applies_to: 'products', product_ids: [5, 6] } }]);
  assert.strictEqual(r.price, 900);
});
t('100%+ discount clamps to 0, not negative', () => {
  const r = applyOffers(prod(), [{ data: { discount_type: 'fixed', discount_value: 5000, applies_to: 'all' } }]);
  assert.strictEqual(r.price, 0);
});
t('Zero/negative discount ignored', () => {
  const r = applyOffers(prod(), [{ data: { discount_type: 'percent', discount_value: 0, applies_to: 'all' } }]);
  assert.strictEqual(r.price, 1000);
});
t('Rounding: 33% off 999 → 669', () => {
  const r = applyOffers(prod({ price: 999 }), [{ data: { discount_type: 'percent', discount_value: 33, applies_to: 'all' } }]);
  assert.strictEqual(r.price, 669);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
