/**
 * Offers / sales engine (Phase 3).
 * Offers are content_blocks of type 'offer'. Live offers are cached and
 * applied to products server-side: applyOffers() returns the product with
 * computed sale_price + matched offer info.
 *
 * Offer data shape:
 * {
 *   discount_type: 'percent' | 'fixed',
 *   discount_value: number,
 *   applies_to: 'all' | 'collection' | 'products' | 'tag',
 *   collection: 'everyday' | 'signature' | 'leather',
 *   product_ids: [1, 2, 3],
 *   tag: '...',
 *   badge_text: '-20%',
 *   banner_text: '...',
 *   show_banner: true
 * }
 */
import { getLiveBlocks } from './content';

export async function getLiveOffers() {
  return getLiveBlocks('offer');
}

/** Does this offer apply to this product? */
export function offerApplies(offer, product) {
  const d = offer.data || {};
  switch (d.applies_to) {
    case 'all': return true;
    case 'collection':
      return d.collection && product.collection === d.collection;
    case 'products':
      return Array.isArray(d.product_ids) && d.product_ids.includes(Number(product.id));
    case 'tag': {
      if (!d.tag) return false;
      const tags = String(product.tags || '').split(',').map((t) => t.trim().toLowerCase());
      return tags.includes(String(d.tag).toLowerCase());
    }
    default: return false;
  }
}

/** Compute the sale price for a product given live offers. Highest discount wins. */
export function applyOffers(product, offers) {
  if (!product || !offers || !offers.length) return product;
  const base = Number(product.price) || 0;
  if (base <= 0) return product;

  let best = null; // { offer, salePrice }
  for (const offer of offers) {
    if (!offerApplies(offer, product)) continue;
    const d = offer.data || {};
    const val = Number(d.discount_value) || 0;
    if (val <= 0) continue;
    let sale = base;
    if (d.discount_type === 'percent') sale = base * (1 - val / 100);
    else sale = base - val;
    sale = Math.max(0, Math.round(sale));
    if (!best || sale < best.salePrice) best = { offer, salePrice: sale };
  }

  if (!best || best.salePrice >= base) return product;
  return {
    ...product,
    price: best.salePrice,           // effective price
    original_price: base,            // strikethrough
    offer_id: best.offer.id,
    offer_badge: (best.offer.data.badge_text || '').trim() ||
      (best.offer.data.discount_type === 'percent'
        ? `-${best.offer.data.discount_value}%`
        : 'SALE'),
  };
}

/** Apply offers to a list of products. */
export function applyOffersToList(products, offers) {
  if (!offers || !offers.length) return products;
  return products.map((p) => applyOffers(p, offers));
}
