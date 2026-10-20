'use strict';

/**
 * Catalog data + seedCatalog(c, wipe) — shared by lib/seed.js and lib/db.js auto-seed.
 */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261011);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const price99 = (min, max) => Math.floor(randInt(min, max) / 100) * 100 + 99;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const COLORS = [
  'Sand Beige', 'Cognac', 'Classic Black', 'Ivory White', 'Taupe', 'Blush Pink',
  'Olive Green', 'Navy Blue', 'Camel', 'Burgundy', 'Charcoal Grey', 'Tan',
  'Mustard Yellow', 'Teal', 'Maroon', 'Chocolate Brown', 'Dusty Rose', 'Sage Green',
  'Mauve', 'Cream', 'Espresso', 'Slate Grey', 'Terracotta', 'Wine Red',
];

const MODEL_SHOTS = [
  '/images/product-mini.jpg',
  '/images/product-medium.jpg',
  '/images/product-large.jpg',
  '/images/product-crossbody.jpg',
];

const COLLECTION_DEFS = {
  everyday: {
    count: 100, skuPrefix: 'ED', priceMin: 1499, priceMax: 4999,
    materials: ['Canvas & Vegan Leather', 'Cotton Canvas & PU Trim', 'Recycled Nylon & Vegan Leather'],
    styles: ['Aria', 'Bella', 'Chloe', 'Daisy', 'Ella', 'Fiona', 'Gia', 'Holly', 'Ivy', 'Joy',
             'Kira', 'Luna', 'Mia', 'Nora', 'Opal', 'Pia', 'Quinn', 'Ruby', 'Stella', 'Tara'],
    types: ['Canvas Tote', 'Shoulder Bag', 'Crossbody', 'Hobo Bag', 'Bucket Bag', 'Mini Tote'],
    descTemplates: [
      (n, t, m) => `A versatile ${t.toLowerCase()} crafted in durable ${m.toLowerCase()}. Roomy enough for daily essentials, finished with smooth zippers and reinforced straps.`,
      (n, t, m) => `Meet your new everyday companion: the ${n}. A lightweight ${m.toLowerCase()} build with a structured silhouette that keeps its shape all day.`,
      (n, t, m) => `The ${n} is designed for real life — ${m.toLowerCase()}, easy-wipe lining, and pockets exactly where you need them.`,
    ],
  },
  signature: {
    count: 100, skuPrefix: 'SG', priceMin: 4999, priceMax: 14999,
    materials: ['Premium Saffiano Leather', 'Pebbled PU Leather', 'Quilted Vegan Leather'],
    styles: ['Aurelia', 'Bianca', 'Celeste', 'Delilah', 'Esme', 'Freya', 'Giselle', 'Harper', 'Isla', 'Jasmine',
             'Kiara', 'Lila', 'Mira', 'Nadia', 'Odette', 'Paloma', 'Rhea', 'Sienna', 'Valentina', 'Zara'],
    types: ['Satchel', 'Top-Handle Bag', 'Chain Clutch', 'Structured Tote', 'Evening Minaudiere', 'Flap Bag'],
    descTemplates: [
      (n, t, m) => `A statement ${t.toLowerCase()} in luxe ${m.toLowerCase()}. The ${n} pairs sculpted lines with polished hardware for evenings that matter.`,
      (n, t, m) => `Designed to turn heads, the ${n} is cut from ${m.toLowerCase()} with meticulous stitching and a sumptuous lined interior.`,
      (n, t, m) => `The ${n} brings runway polish to your wardrobe — ${m.toLowerCase()}, a refined silhouette, and detailing that rewards a second look.`,
    ],
  },
  leather: {
    count: 60, skuPrefix: 'LT', priceMin: 9999, priceMax: 29999,
    materials: ['Full-Grain Leather', 'Top-Grain Leather', 'Genuine Leather'],
    styles: ['Alessandra', 'Benedetta', 'Camila', 'Donatella', 'Elena', 'Francesca', 'Giorgia',
             'Helena', 'Isabella', 'Livia', 'Martina', 'Noemi', 'Olivia', 'Paola', 'Sofia'],
    types: ['Leather Tote', 'Leather Satchel', 'Doctor Bag', 'Leather Hobo', 'Leather Crossbody'],
    descTemplates: [
      (n, t, m) => `Handcrafted from ${m.toLowerCase()}, the ${n} ages beautifully with wear. A timeless ${t.toLowerCase()} built to last for years.`,
      (n, t, m) => `The ${n} is made from rich ${m.toLowerCase()} with hand-finished edges and solid brass fittings — quiet luxury for every day.`,
      (n, t, m) => `Cut from premium ${m.toLowerCase()}, the ${n} develops a unique patina over time. Classic craftsmanship, made to be carried for decades.`,
    ],
  },
};

// NEVER seed a guessable admin password in production: fail closed instead.
function seedAdminPassword() {
  if (process.env.AMMIGE_ADMIN_PASSWORD) return process.env.AMMIGE_ADMIN_PASSWORD;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AMMIGE_ADMIN_PASSWORD is not configured');
  }
  return 'ammige123'; // local dev only
}

async function seedCatalog(c, wipe = false) {
  if (wipe) {
    await c.executeMultiple('DELETE FROM products; DELETE FROM orders; DELETE FROM settings;');
  }
  const stmts = [];
  const settings = {
    admin_password: seedAdminPassword(),
    whatsapp: '923162852167',
    brand: 'AMMIGE',
    tagline: 'Carry Grace Everywhere',
    announcement: 'Free delivery across Pakistan on orders over Rs 5,000',
  };
  for (const [k, v] of Object.entries(settings)) {
    stmts.push({ sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', args: [k, v] });
  }

  let seq = 0;
  for (const [collection, def] of Object.entries(COLLECTION_DEFS)) {
    const combos = [];
    for (const style of def.styles)
      for (const type of def.types)
        for (const color of COLORS)
          combos.push([style, type, color]);
    const chosen = shuffle(combos).slice(0, def.count);

    chosen.forEach(([style, type, color], i) => {
      seq += 1;
      const name = `${style} ${type} — ${color}`;
      const sku = `AM-${def.skuPrefix}-${String(i + 1).padStart(4, '0')}`;
      const price = price99(def.priceMin, def.priceMax);
      const onSale = rand() < 0.25;
      const old_price = onSale
        ? Math.floor((price * (1.2 + rand() * 0.15)) / 100) * 100 + 99
        : null;
      const otherColors = shuffle(COLORS.filter((x) => x !== color));
      const colorList = [color, ...otherColors.slice(0, randInt(1, 3))];
      const colors = JSON.stringify(colorList);
      const material = pick(def.materials);
      const description = pick(def.descTemplates)(name, type, material);
      const image = seq % 9 === 0
        ? MODEL_SHOTS[seq % MODEL_SHOTS.length]
        : `/images/products/${collection}-${String((seq % 8) + 1).padStart(2, '0')}.jpg`;
      // Second photo of the SAME product (hover swap): the next shot in the
      // same collection pool, guaranteed different from the main image.
      const poolIdx = (seq % 8);
      const image2 = `/images/products/${collection}-${String(((poolIdx + 1) % 8) + 1).padStart(2, '0')}.jpg`;
      // Per-color photos: seed leaves this EMPTY on purpose. Fake mappings
      // (other products' photos) confused shoppers more than they helped.
      // The PDP smart-recolor tint shows the real bag in the clicked color;
      // admins can upload true per-color photos via variant_images anytime.
      const variant_images = JSON.stringify({});
      const rating = Math.round((4.2 + rand() * 0.8) * 10) / 10;
      const reviews = randInt(5, 400);
      let badge = null;
      const r = rand();
      if (r < 0.15) badge = onSale ? 'Sale' : pick(['New', 'Bestseller', 'New', 'Bestseller']);
      const stock = randInt(10, 120);
      const created_at = new Date(Date.now() - randInt(0, 180) * 24 * 3600 * 1000).toISOString();
      const SIZES_BY_COLLECTION = { everyday: ['Small', 'Medium'], signature: ['Medium', 'Large'], leather: ['Medium', 'Large'] };
      const sizes = JSON.stringify(SIZES_BY_COLLECTION[collection] || ['One Size']);
      // True 360° spin frames for the very first product (deterministic seed -> always id 1).
      const spin_frames = seq === 1
        ? JSON.stringify([0, 1, 2, 3, 4, 5, 6, 7].map((i) => `/images/products/spin/p1/frame-${i}.jpg`))
        : JSON.stringify([]);

      stmts.push({
        sql: `INSERT INTO products (sku, name, collection, price, old_price, colors, material,
              description, image, image2, variant_images, sizes, spin_frames, rating, reviews, badge, stock, active, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        args: [sku, name, collection, price, old_price, colors, material,
               description, image, image2, variant_images, sizes, spin_frames, rating, reviews, badge, stock, created_at],
      });
    });
  }

  const BATCH = 50;
  for (let i = 0; i < stmts.length; i += BATCH) {
    await c.batch(stmts.slice(i, i + BATCH));
  }
  const total = await c.execute('SELECT COUNT(*) AS c FROM products');
  return Number(total.rows[0].c);
}

module.exports = { seedCatalog };
