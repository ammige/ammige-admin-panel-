'use strict';

/**
 * JSON-LD builders (schema.org) for SEO / GEO.
 * Keep markup in sync with visible page content — Google strips rich
 * results when price/availability in markup mismatches the page.
 * All strings are sanitized against </script> breakout.
 */

function safeJsonLd(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

function absUrl(siteUrl, path) {
  if (!path) return siteUrl;
  if (/^https?:\/\//i.test(path)) return path;
  return siteUrl.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`);
}

function organizationJsonLd(siteUrl, opts = {}) {
  const whatsapp = opts.whatsapp || '';
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AMMIGE',
    url: siteUrl,
    slogan: 'Carry Grace Everywhere',
    logo: absUrl(siteUrl, '/images/hero-model.jpg'),
    foundingDate: '2026',
    sameAs: [
      'https://instagram.com/ammige012',
      'https://tiktok.com/@ammige012',
      'https://facebook.com/ammige012',
    ],
    ...(whatsapp
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: `+${String(whatsapp).replace(/^\+/, '')}`,
            contactType: 'customer service',
            areaServed: 'PK',
            availableLanguage: ['en', 'ur'],
          },
        }
      : {}),
  };
}

function websiteJsonLd(siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AMMIGE',
    url: siteUrl,
  };
}

/**
 * items: [{ name, path }] — path is site-relative, e.g. '/shop'.
 */
function breadcrumbJsonLd(siteUrl, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absUrl(siteUrl, it.path),
    })),
  };
}

/** product: parsed product row; urlPath e.g. `/product/123`. */
function productJsonLd(siteUrl, product, urlPath) {
  const inStock = product.stock > 0;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: [absUrl(siteUrl, product.image)],
    description: product.description || product.name,
    sku: product.sku,
    brand: { '@type': 'Brand', name: 'AMMIGE' },
    material: product.material || undefined,
    offers: {
      '@type': 'Offer',
      url: absUrl(siteUrl, urlPath),
      priceCurrency: 'PKR',
      price: String(product.price),
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'AMMIGE' },
    },
  };
  // Only include aggregateRating when ratings are real + visible on page.
  if (product.reviews > 0 && product.rating > 0) {
    ld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(product.rating),
      reviewCount: String(product.reviews),
    };
  }
  return ld;
}

function faqJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((qa) => ({
      '@type': 'Question',
      name: qa.q,
      acceptedAnswer: { '@type': 'Answer', text: qa.a },
    })),
  };
}

module.exports = {
  safeJsonLd,
  absUrl,
  organizationJsonLd,
  websiteJsonLd,
  breadcrumbJsonLd,
  productJsonLd,
  faqJsonLd,
};
