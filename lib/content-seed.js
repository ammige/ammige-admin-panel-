'use strict';

/**
 * Phase-1 content seed — migrates the previously-hardcoded site chrome
 * (navigation, footer, per-page SEO) into content_blocks so the live site
 * looks IDENTICAL after migration, but everything becomes admin-editable.
 *
 * Idempotent: each block is inserted only when no block with the same
 * (type, name) exists.
 */

const NAV_MENU = {
  items: [
    { label: 'Shop All', href: '/shop', visible: true, children: [] },
    { label: 'Everyday', href: '/shop?collection=everyday', visible: true, children: [] },
    { label: 'Signature', href: '/shop?collection=signature', visible: true, children: [] },
    { label: 'Leather', href: '/shop?collection=leather', visible: true, children: [] },
    { label: 'Track Order', href: '/track', visible: true, children: [] },
    { label: 'Wishlist', href: '/wishlist', visible: true, children: [] },
    { label: 'FAQs', href: '/faq', visible: true, children: [] },
    { label: 'Contact', href: '/contact', visible: true, children: [] },
  ],
};

const FOOTER = {
  columns: [
    {
      title: 'Shop',
      links: [
        { label: 'Everyday Collection', href: '/shop?collection=everyday' },
        { label: 'Signature Collection', href: '/shop?collection=signature' },
        { label: 'Leather Collection', href: '/shop?collection=leather' },
        { label: 'All Products', href: '/shop' },
      ],
    },
    {
      title: 'Help',
      links: [
        { label: 'About Us', href: '/about' },
        { label: 'Contact Us', href: '/contact' },
        { label: 'FAQs', href: '/faq' },
        { label: 'Track Your Order', href: '/track' },
      ],
    },
    {
      title: 'Policies',
      links: [
        { label: 'Shipping & Exchange', href: '/shipping' },
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Checkout', href: '/checkout' },
      ],
    },
  ],
  bottom_text: '© {year} AMMIGE. All rights reserved.',
  payment_icons: ['cod'],
  newsletter: true,
};

const SOCIAL_LINKS = {
  instagram: 'https://www.instagram.com/ammige012',
  tiktok: 'https://www.tiktok.com/@ammige012',
  facebook: 'https://www.facebook.com/share/1KZiNXEgJi/',
  youtube: '',
};

const PAGE_SEO = {
  '/': {
    title: 'AMMIGE — Premium Women\'s Handbags in Pakistan',
    description: 'AMMIGE is a Pakistani women\'s handbags brand. Everyday, Signature and Leather collections. Prices in PKR, Cash on Delivery nationwide, 7-day easy exchange.',
    image: '',
  },
  '/shop': {
    title: 'Shop All Handbags — AMMIGE',
    description: 'Browse the full AMMIGE collection of premium women\'s handbags. Cash on Delivery across Pakistan.',
    image: '',
  },
  '/about': {
    title: 'About Us — AMMIGE',
    description: 'The story behind AMMIGE — handcrafted premium handbags from Pakistan.',
    image: '',
  },
  '/contact': {
    title: 'Contact Us — AMMIGE',
    description: 'Get in touch with the AMMIGE team.',
    image: '',
  },
  '/faq': {
    title: 'FAQs — AMMIGE',
    description: 'Frequently asked questions about AMMIGE orders, shipping and exchanges.',
    image: '',
  },
};

async function seedPhase1Content(c) {  const now = new Date().toISOString();
  const blocks = [
    { type: 'nav_menu', name: 'main', data: NAV_MENU },
    { type: 'footer', name: 'main', data: FOOTER },
    ...Object.entries(PAGE_SEO).map(([path, seo]) => ({
      type: 'page_seo', name: path, data: seo,
    })),
  ];
  for (const b of blocks) {
    const ex = await c.execute({
      sql: 'SELECT id FROM content_blocks WHERE type = ? AND name = ? LIMIT 1',
      args: [b.type, b.name],
    });
    if (ex.rows.length) continue;
    await c.execute({
      sql: `INSERT INTO content_blocks
            (type, name, data, status, active, starts_at, ends_at, priority, created_at, updated_at)
            VALUES (?, ?, ?, 'published', 1, NULL, NULL, 0, ?, ?)`,
      args: [b.type, b.name, JSON.stringify(b.data), now, now],
    });
  }
  // Seed social links into settings (only if empty/unset)
  const s = await c.execute({
    sql: "SELECT value FROM settings WHERE key = 'social_links'",
  });
  const cur = s.rows[0] && s.rows[0].value;
  if (!cur || cur === '{}') {
    await c.execute({
      sql: "UPDATE settings SET value = ? WHERE key = 'social_links'",
      args: [JSON.stringify(SOCIAL_LINKS)],
    });
  }
}

module.exports = { seedPhase1Content, seedPhase2Content, seedPhase3Content, seedPhase4Content, seedFaqs, seedCollections, seedViewerSettings };

/**
 * Phase-2 seed — migrates the old simple announcement/marquee settings
 * into content blocks. Idempotent.
 */
async function seedPhase2Content(c) {
  const now = new Date().toISOString();
  const get = async (k) => {
    const r = await c.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [k] });
    return r.rows[0] ? r.rows[0].value : '';
  };

  // Announcement bar from settings.announcement
  const annText = await get('announcement');
  const annEx = await c.execute({
    sql: "SELECT id FROM content_blocks WHERE type = 'announcement' LIMIT 1",
  });
  if (!annEx.rows.length && annText) {
    await c.execute({
      sql: `INSERT INTO content_blocks
            (type, name, data, status, active, starts_at, ends_at, priority, created_at, updated_at)
            VALUES ('announcement', 'main', ?, 'published', 1, NULL, NULL, 0, ?, ?)`,
      args: [JSON.stringify({
        text: annText, link: '', bg_color: '#111111', text_color: '#FFFFFF', dismissible: true,
      }), now, now],
    });
  }

  // Marquee from settings.marquee_*
  const mqEx = await c.execute({
    sql: "SELECT id FROM content_blocks WHERE type = 'marquee' LIMIT 1",
  });
  if (!mqEx.rows.length) {
    const enabled = (await get('marquee_enabled')) !== '0';
    const raw = await get('marquee_items');
    const items = raw.split('|').map((t) => t.trim()).filter(Boolean)
      .map((text) => ({ text, icon: '', link: '' }));
    await c.execute({
      sql: `INSERT INTO content_blocks
            (type, name, data, status, active, starts_at, ends_at, priority, created_at, updated_at)
            VALUES ('marquee', 'main', ?, 'published', ?, NULL, NULL, 0, ?, ?)`,
      args: [JSON.stringify({
        items, speed: 30, direction: 'left', pause_on_hover: true,
        bg_color: '#111111', text_color: '#FFFFFF', position: 'top',
      }), enabled ? 1 : 0, now, now],
    });
  }
}

/**
 * Phase-3 seed — migrates the old single OfferPopup settings
 * into a popup content block. Idempotent.
 */
async function seedPhase3Content(c) {
  const now = new Date().toISOString();
  const get = async (k) => {
    const r = await c.execute({ sql: 'SELECT value FROM settings WHERE key = ?', args: [k] });
    return r.rows[0] ? r.rows[0].value : '';
  };

  const ex = await c.execute({ sql: "SELECT id FROM content_blocks WHERE type = 'popup' LIMIT 1" });
  if (ex.rows.length) return;

  const enabled = (await get('popup_enabled')) === '1';
  const title = await get('popup_title');
  const text = await get('popup_text');
  const cta = await get('popup_cta');
  const delay = parseInt(await get('popup_delay'), 10) || 8;

  await c.execute({
    sql: `INSERT INTO content_blocks
          (type, name, data, status, active, starts_at, ends_at, priority, created_at, updated_at)
          VALUES ('popup', 'welcome-offer', ?, 'published', ?, NULL, NULL, 0, ?, ?)`,
    args: [JSON.stringify({
      popup_type: 'offer',
      title: title || 'Special Offer',
      text: text || 'Sign up for exclusive deals and new arrivals.',
      image_url: '', image_alt: '',
      cta_text: cta || 'Shop Now', cta_link: '/shop', secondary_text: 'No thanks',
      coupon_code: '', countdown_ends_at: '',
      trigger: 'delay', trigger_value: String(delay),
      frequency: 'once_session', frequency_days: 7,
      pages: 'all', page_urls: '',
      device: 'all', audience: 'all',
      newsletter_enabled: false,
    }), enabled ? 1 : 0, now, now],
  });
}

/**
 * Phase-4 seed — homepage layout, hero slide, section copy.
 * Mirrors the current hardcoded homepage so nothing visually changes.
 * Idempotent.
 */
async function seedPhase4Content(c) {
  const now = new Date().toISOString();
  const has = async (type, name) => {
    const r = await c.execute({ sql: 'SELECT id FROM content_blocks WHERE type = ? AND name = ?', args: [type, name] });
    return r.rows.length > 0;
  };
  const insert = async (type, name, data, active = 1) => {
    await c.execute({
      sql: `INSERT INTO content_blocks
            (type, name, data, status, active, starts_at, ends_at, priority, created_at, updated_at)
            VALUES (?, ?, ?, 'published', ?, NULL, NULL, 0, ?, ?)`,
      args: [type, name, JSON.stringify(data), active, now, now],
    });
  };

  // Homepage layout: section order + visibility + copy
  if (!(await has('homepage', 'layout'))) {
    await insert('homepage', 'layout', {
      sections: [
        { id: 'hero', visible: true },
        { id: 'collections', visible: true },
        { id: 'bestsellers', visible: true },
        { id: 'occasion', visible: true },
        { id: 'craft', visible: true },
        { id: 'video', visible: true },
        { id: 'trust', visible: true },
        { id: 'gallery', visible: true },
        { id: 'testimonials', visible: false },
        { id: 'newsletter', visible: true },
      ],
      copy: {
        collections: {
          eyebrow: 'Our Collections',
          title: 'Three worlds, one signature',
          text: 'Structured leather for the boardroom, embellished minis for shaadi season, and totes that survive Karachi traffic — every piece designed in Pakistan, made to be carried for years.',
        },
        bestsellers: {
          eyebrow: 'Most loved', title: 'Bestsellers',
          text: 'The totes, crossbodies and minis that Lahore, Karachi and Islamabad keep reordering.',
          source: 'badge', product_ids: [], collection: '', limit: 10,
        },
        occasion: {
          eyebrow: 'Find your fit', title: "Shop by the day you're having", text: '',
        },
        craft: {
          eyebrow: 'Our Craft', title: 'Wrapped like a gift, because it is one',
          text: 'Every AMMIGE order leaves our studio in a complete premium packaging set — tissue, dust bag, thank-you card and care guide, sealed in a strong corrugated box.',
        },
        video: { eyebrow: 'In motion', title: 'The Craft, In Motion', text: 'Watch how every AMMIGE piece comes to life — from cutting table to your doorstep.' },
        trust: { eyebrow: 'Shop with confidence', title: 'The AMMIGE promise', text: '' },
        gallery: { eyebrow: 'The lookbook', title: 'Carried by women like you', text: '' },
        testimonials: { eyebrow: 'Loved across Pakistan', title: 'Real words, real women' },
        newsletter: {
          eyebrow: 'The Ammige Circle', title: 'First to know, first to carry',
          text: 'New drops, private previews and members-only prices — straight to your inbox.',
        },
      },
      hero_settings: { autoplay: true, autoplay_seconds: 6, show_dots: true, show_arrows: true },
    });
  }

  // Hero slide mirroring MinimalHero
  if (!(await has('hero', 'main'))) {
    await insert('hero', 'main', {
      desktop_image: '/images/hero-cinematic.jpg', mobile_image: '', video_url: '',
      eyebrow: 'New Season · Premium Handbags',
      headline: 'AMMIGE', subheadline: 'Carry grace everywhere.',
      cta1_text: 'Shop Collection', cta1_link: '/shop', cta2_text: '', cta2_link: '',
      align: 'center', overlay: 45, text_color: '#FFFFFF', animation: 'fade',
    });
  }

  // Occasion tiles (banner type)
  if (!(await has('banner', 'occasion-tiles'))) {
    await insert('banner', 'occasion-tiles', {
      items: [
        { title: 'For work days', text: 'Structured totes & satchels that fit a 13-inch laptop and your lunch.', link: '/shop?q=tote' },
        { title: 'For shaadis', text: 'Embellished minis and clutches made for mehndis and baraats.', link: '/shop?q=clutch' },
        { title: 'For every day', text: 'Light crossbodies and hobos for university, errands and chai runs.', link: '/shop?q=crossbody' },
      ],
    });
  }

  // Craft steps
  if (!(await has('banner', 'craft-steps'))) {
    await insert('banner', 'craft-steps', {
      media: '/images/products/packaging.jpg',
      items: [
        { title: 'Wrapped with care', text: 'Your bag is wrapped in tissue with handles and hardware protected.' },
        { title: 'Premium dust bag', text: 'Placed in a re-usable branded dust bag for lifelong storage.' },
        { title: 'Thank-you & care cards', text: 'A hand-feel thank-you card, care guide and brand hang tag inside.' },
        { title: 'Secure shipping box', text: 'Sealed in a strong corrugated box with protective fillers.' },
      ],
    });
  }

  // Gallery items
  if (!(await has('banner', 'gallery'))) {
    await insert('banner', 'gallery', {
      items: [
        { img: '/images/collection-everyday-new.jpg', label: 'Everyday', link: '/shop' },
        { img: '/images/product-mini.jpg', label: 'Mini · Blush', link: '/shop' },
        { img: '/images/collection-signature-new.jpg', label: 'Signature', link: '/shop' },
        { img: '/images/product-crossbody.jpg', label: 'Crossbody · Tan', link: '/shop' },
        { img: '/images/collection-leather-new.jpg', label: 'Leather', link: '/shop' },
        { img: '/images/product-large.jpg', label: 'Large · Noir', link: '/shop' },
      ],
    });
  }
}

/** Seed the 14 hardcoded FAQs into faq blocks. Idempotent. */
async function seedFaqs(c) {
  const now = new Date().toISOString();
  const ex = await c.execute({ sql: "SELECT id FROM content_blocks WHERE type = 'faq' LIMIT 1" });
  if (ex.rows.length) return;
  const FAQS = [
    ['Do you offer Cash on Delivery?', 'Yes — COD is available all across Pakistan. You pay in cash when your order arrives at your doorstep. No advance payment needed.', 'Orders'],
    ['How long does delivery take?', 'Orders are dispatched within 24 hours (usually the same working day). Delivery takes 2–4 working days in most cities via TCS or Leopards Courier; remote areas may take 5–7 working days.', 'Orders'],
    ['What are the delivery charges?', 'A flat Rs 250 nationwide — and delivery is completely free on all orders over Rs 5,000.', 'Orders'],
    ['Can I exchange or return a bag?', 'We offer a 7-day easy exchange: if the bag is unused with tags attached, message us on WhatsApp with your order ID and we will arrange a replacement in your preferred colour or style. If the item arrived damaged or wrong, we cover all courier charges and offer a free replacement or full refund.', 'Exchanges'],
    ['How do I track my order?', 'Use your order ID on our Track Order page any time. Once dispatched, you will also receive an SMS from the courier with their tracking number.', 'Orders'],
    ['Are the leather bags genuine leather?', 'Our Leather Collection uses genuine top-grain leather that ages beautifully with use. Every product page lists the exact material, so you always know what you are getting.', 'Products'],
    ['What comes in the packaging?', 'Every order arrives gift-ready: your bag wrapped in tissue, a reusable branded dust bag, a thank-you card, a care guide and a brand hang tag — all sealed in a strong corrugated box.', 'Products'],
    ['How can I contact you?', 'The fastest way is WhatsApp at +92 316 2852167 (Mon–Sat, 10am–8pm PKT). You can also use our contact form or DM us on Instagram @ammige012.', 'Contact'],
    ['Do you deliver to my city?', 'We deliver all across Pakistan — Karachi, Lahore, Islamabad, Rawalpindi, Faisalabad, Multan, Peshawar, Quetta and every other city and town served by our courier partners.', 'Orders'],
    ['What payment methods do you accept?', 'Cash on Delivery is our main payment method — you pay in cash when the courier arrives. We also accept advance bank transfer on request via WhatsApp.', 'Orders'],
    ['How do I choose the right size bag?', 'Every product page lists the bag\u2019s dimensions and what fits inside (phone, wallet, makeup pouch and so on). Our Everyday totes fit daily essentials, while Signature and Leather pieces are sized for evenings and events.', 'Products'],
    ['Are your bags good quality?', 'Yes. Every bag is quality-checked before dispatch — stitching, zips, straps and hardware. If anything arrives less than perfect, our 48-hour damage cover gives you a free replacement or full refund.', 'Products'],
    ['Do you offer gift wrapping?', 'Every order already arrives gift-ready at no extra cost: tissue wrap, a reusable branded dust bag, a thank-you card and a care guide, sealed in a strong corrugated box.', 'Products'],
    ['Can I change or cancel my order?', 'Yes — message us on WhatsApp within 12 hours of ordering and we will change or cancel it free of charge, as long as it has not been dispatched yet.', 'Orders'],
  ];
  let pri = 100;
  for (const [q, a, cat] of FAQS) {
    await c.execute({
      sql: `INSERT INTO content_blocks
            (type, name, data, status, active, starts_at, ends_at, priority, created_at, updated_at)
            VALUES ('faq', ?, ?, 'published', 1, NULL, NULL, ?, ?, ?)`,
      args: ['faq-' + pri, JSON.stringify({ question: q, answer: a, category: cat }), pri, now, now],
    });
    pri -= 1;
  }
}

/** Seed collections as content blocks (admin-manageable). Idempotent. */
async function seedCollections(c) {
  const now = new Date().toISOString();
  const base = [
    ['everyday', 'Everyday Collection', 'Effortless pieces for every day, made to be carried on repeat.', '/images/collection-everyday-new.jpg'],
    ['signature', 'Signature Collection', 'Statement pieces for evenings that matter.', '/images/collection-signature-new.jpg'],
    ['leather', 'Leather Collection', 'Full-grain leather that ages beautifully with you.', '/images/collection-leather-new.jpg'],
  ];
  for (const [id, name, tagline, image] of base) {
    const ex = await c.execute({ sql: "SELECT id FROM content_blocks WHERE type = 'collection' AND name = ?", args: [id] });
    if (ex.rows.length) continue;
    await c.execute({
      sql: `INSERT INTO content_blocks
            (type, name, data, status, active, starts_at, ends_at, priority, created_at, updated_at)
            VALUES ('collection', ?, ?, 'published', 1, NULL, NULL, 0, ?, ?)`,
      args: [id, JSON.stringify({ id, name, tagline, image, description: '' }), now, now],
    });
  }
}

/** Seed 3D viewer global settings. Idempotent. */
async function seedViewerSettings(c) {
  const now = new Date().toISOString();
  const ex = await c.execute({ sql: "SELECT id FROM content_blocks WHERE type = 'viewer_3d' AND name = 'global'" });
  if (ex.rows.length) return;
  await c.execute({
    sql: `INSERT INTO content_blocks
          (type, name, data, status, active, starts_at, ends_at, priority, created_at, updated_at)
          VALUES ('viewer_3d', 'global', ?, 'published', 1, NULL, NULL, 0, ?, ?)`,
    args: [JSON.stringify({
      auto_rotate: false, rotate_speed: 1.0,
      min_zoom: 1, max_zoom: 4,
      bg_transparent: true, bg_color: '#15120e',
      shadow: true, light_intensity: 1.0,
      tone_mapping: 'aces',
      default_mode: 'auto', // auto | glb | frames | box
      show_angle_buttons: true,
      show_ar_button: true,
    }), now, now],
  });
}
