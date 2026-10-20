'use strict';

/**
 * Database layer — PostgreSQL (Neon) via `@neondatabase/serverless`.
 * Production: POSTGRES_URL env var (Neon pooled connection).
 * Same code path everywhere — only the connection string changes.
 *
 * Compatibility: the codebase was written for @libsql/client
 * (execute({ sql, args }) with `?` placeholders). This wrapper
 * converts `?` -> $1, $2... and exposes the same execute() shape
 * so no query call-sites needed changes.
 */
const { neon } = require('@neondatabase/serverless');

function getSql() {
  const url = process.env.POSTGRES_URL;
  if (!url) return null; // Build-time: no DB yet, queries return empty
  return neon(url);
}

let _sql = null;
let _sqlTried = false;
function sql() {
  if (!_sql && !_sqlTried) {
    _sqlTried = true;
    _sql = getSql();
  }
  return _sql;
}

// Convert `?` placeholders to $1, $2, ... (skip ? inside string literals)
function toPgPlaceholders(sql) {
  // SQLite: INSERT OR IGNORE INTO settings -> PG: INSERT ... ON CONFLICT DO NOTHING
  if (/INSERT\s+OR\s+IGNORE\s+INTO\s+settings/i.test(sql)) {
    sql = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+settings/i, 'INSERT INTO settings');
    // Append ON CONFLICT after the VALUES clause
    sql = sql + ' ON CONFLICT (key) DO NOTHING';
  }
  let idx = 0;
  let out = '';
  let inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" && (i === 0 || sql[i - 1] !== '\\')) {
      if (inStr && sql[i + 1] === "'") { out += "''"; i++; continue; }
      inStr = !inStr;
      out += c;
      continue;
    }
    if (c === '?' && !inStr) {
      idx++;
      out += '$' + idx;
    } else {
      out += c;
    }
  }
  return out;
}

function makeClient() {
  const noDb = () => ({ rows: [] });
  const isBuild = () => process.env.NEXT_PHASE === 'phase-production-build';
  return {
    async execute(sqlOrObj, argsArray) {
      if (isBuild()) return noDb();
      const s = sql();
      if (!s) return noDb(); // Build-time: no DB configured
      let sqlText, args;
      if (typeof sqlOrObj === 'string') {
        sqlText = sqlOrObj;
        args = argsArray || [];
      } else {
        sqlText = sqlOrObj.sql;
        args = sqlOrObj.args || [];
      }
      let pgSql = toPgPlaceholders(sqlText);
      // libsql exposes lastInsertRowid; emulate via RETURNING id
      // (skip for settings table which uses key as PK, not id)
      let wantId = false;
      if (/^\s*INSERT\s/i.test(pgSql) && !/RETURNING\s/i.test(pgSql) && !/INTO\s+settings\b/i.test(pgSql)) {
        pgSql += ' RETURNING id';
        wantId = true;
      }
      // The Neon HTTP driver does not report rowCount for UPDATE/DELETE, so
      // rowsAffected would always read 0. Append RETURNING id instead and
      // count returned rows (every table except settings has an id column).
      if (/^\s*(UPDATE|DELETE)\s/i.test(pgSql) && !/RETURNING\s/i.test(pgSql) && !/\bsettings\b/i.test(pgSql)) {
        pgSql += ' RETURNING id';
      }
      const rows = await s.query(pgSql, args);
      const out = { rows };
      // Emulate libsql rowsAffected: the Neon driver attaches rowCount to the
      // result array (rows.length is 0 for UPDATE/DELETE, so never use it).
      out.rowsAffected = typeof rows.rowCount === 'number' ? rows.rowCount : rows.length;
      if (wantId && rows[0] && rows[0].id !== undefined) {
        out.lastInsertRowid = rows[0].id;
      }
      return out;
    },
    async executeMultiple(multiSql) {
      if (isBuild()) return noDb();
      const s = sql();
      if (!s) return noDb();
      // Split on semicolons and run each statement (schema setup)
      const stmts = multiSql.split(';').map((x) => x.trim()).filter(Boolean);
      for (const st of stmts) {
        await s.query(toPgPlaceholders(st), []);
      }
      return { rows: [] };
    },
    async batch(stmtArray) {
      // Execute an array of { sql, args } statements sequentially
      for (const st of stmtArray) {
        await this.execute(st);
      }
      return { rows: [] };
    },
  };
}

let _client = null;
function client() {
  if (!_client) _client = makeClient();
  return _client;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    collection TEXT NOT NULL CHECK (collection IN ('everyday','signature','leather')),
    price INTEGER NOT NULL,
    old_price INTEGER NULL,
    colors TEXT NOT NULL DEFAULT '[]',
    material TEXT,
    description TEXT,
    image TEXT,
    image2 TEXT NULL,
    variant_images TEXT NULL,
    sizes TEXT NULL,
    spin_frames TEXT NULL,
    video_url TEXT NULL,
    rating REAL DEFAULT 0,
    reviews INTEGER DEFAULT 0,
    badge TEXT NULL,
    badge_start TEXT NULL,
    badge_end TEXT NULL,
    slug TEXT NULL,
    tags TEXT NULL DEFAULT '',
    description_html TEXT NULL,
    spin_enabled INTEGER NULL,
    spin_poster TEXT NULL,
    spin_mode TEXT NULL,
    stock INTEGER DEFAULT 50,
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer TEXT NOT NULL,
    items TEXT NOT NULL,
    total INTEGER NOT NULL,
    payment TEXT DEFAULT 'cod',
    notes TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percent','flat')),
    value INTEGER NOT NULL,
    min_order INTEGER NOT NULL DEFAULT 0,
    usage_limit INTEGER NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS newsletter (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS content_blocks (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','scheduled')),
    active INTEGER NOT NULL DEFAULT 1,
    starts_at TEXT NULL,
    ends_at TEXT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_content_blocks_type ON content_blocks(type, active, priority);
  CREATE TABLE IF NOT EXISTS content_stats (
    id SERIAL PRIMARY KEY,
    content_id INTEGER NOT NULL,
    event TEXT NOT NULL CHECK (event IN ('impression','close','cta_click')),
    meta TEXT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_content_stats_cid ON content_stats(content_id, event);
  CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    actor TEXT NOT NULL DEFAULT 'admin',
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NULL,
    detail TEXT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
`;

// Columns added after launch — applied idempotently via guarded ALTERs.
const ORDER_MIGRATIONS = [
  'ALTER TABLE orders ADD COLUMN discount INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE orders ADD COLUMN coupon_code TEXT NULL',
  'ALTER TABLE orders ADD COLUMN tracking_number TEXT NULL',
  'ALTER TABLE orders ADD COLUMN courier TEXT NULL',
  'ALTER TABLE orders ADD COLUMN admin_notes TEXT NULL',
  'ALTER TABLE orders ADD COLUMN customer_id INTEGER NULL',
  'ALTER TABLE products ADD COLUMN image2 TEXT NULL',
  'ALTER TABLE products ADD COLUMN variant_images TEXT NULL',
  'ALTER TABLE products ADD COLUMN sizes TEXT NULL',
  'ALTER TABLE products ADD COLUMN spin_frames TEXT NULL',
  'ALTER TABLE products ADD COLUMN video_url TEXT NULL',
  'ALTER TABLE products ADD COLUMN model_3d TEXT NULL',
  'ALTER TABLE products ADD COLUMN slug TEXT NULL',
  'ALTER TABLE products ADD COLUMN tags TEXT NULL DEFAULT \'\'',
  'ALTER TABLE products ADD COLUMN badge_start TEXT NULL',
  'ALTER TABLE products ADD COLUMN badge_end TEXT NULL',
  'ALTER TABLE products ADD COLUMN description_html TEXT NULL',
  'ALTER TABLE products ADD COLUMN spin_enabled INTEGER NULL',
  'ALTER TABLE products ADD COLUMN spin_poster TEXT NULL',
  'ALTER TABLE products ADD COLUMN spin_mode TEXT NULL',
];

function defaultAdminPassword() {
  if (process.env.AMMIGE_ADMIN_PASSWORD) return process.env.AMMIGE_ADMIN_PASSWORD;
  // FAIL CLOSED: never seed a guessable admin password in production.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AMMIGE_ADMIN_PASSWORD is not configured');
  }
  return 'ammige123'; // local dev only
}

function getDefaultSettings() {
  return {
    // Evaluated lazily at seed time (NOT at module load) so `next build`
    // never crashes on missing env, and production fails closed instead
    // of seeding a guessable admin password.
    admin_password: defaultAdminPassword(),
    whatsapp: '923162852167',
    brand: 'AMMIGE',
    tagline: 'Carry Grace Everywhere',
    announcement: 'Free delivery across Pakistan on orders over Rs 5,000',
    video_url: '',
    shipping_flat: '250',
    free_shipping_threshold: '5000',
    payment_cod: '1',
    payment_bank: '1',
    // Storefront display controls (admin-toggled)
    marquee_enabled: '1',
    marquee_items: 'Free nationwide delivery over Rs 5,000|Cash on Delivery|Handcrafted in Pakistan|Premium gift packaging|7-day easy exchange',
    popup_enabled: '0',
    popup_title: 'Welcome to AMMIGE ✨',
    popup_text: 'Get 10% off your first order. Use code WELCOME10 at checkout.',
    popup_cta: 'Shop Now',
    popup_delay: '8',
    // Phase 1: global site settings
    store_name: 'AMMIGE',
    logo_light: '',
    logo_dark: '',
    favicon_url: '',
    contact_email: '',
    contact_phone: '',
    contact_address: '',
    social_links: '{}',
    theme_primary: '#111111',
    theme_secondary: '#B08D3E',
    theme_accent: '#B08D3E',
    theme_font: 'cormorant-inter',
    theme_button_style: 'sharp',
    theme_radius: '2',
    maintenance_enabled: '0',
    maintenance_message: 'We are polishing something beautiful. Please check back soon.',
  };
}

let _ready = null;
async function ready() {
  // Skip DB setup during Next.js build (prerendering) — no DB needed then.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (!_ready) {
    _ready = (async () => {
      const c = client();
      await c.executeMultiple(SCHEMA);
      // Idempotent column migrations for tables created before these
      // columns existed. Ignore "duplicate column" errors (SQLite and PG word it differently).
      for (const sql of ORDER_MIGRATIONS) {
        try {
          await c.execute(sql);
        } catch (e) {
          const msg = String(e && e.message || '');
          if (!/duplicate column name|already exists/i.test(msg)) throw e;
        }
      }
      // Seed defaults without overwriting existing settings.
      for (const [k, v] of Object.entries(getDefaultSettings())) {
        await c.execute({
          sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
          args: [k, v],
        });
      }
      // Seed Phase-1 content blocks from the previously-hardcoded site
      // chrome (nav, footer, SEO). INSERT OR IGNORE on (type,name) semantics
      // via a uniqueness check — only seeds when no block of that type+name exists.
      try {
        const { seedPhase1Content, seedPhase2Content, seedPhase3Content, seedPhase4Content, seedFaqs, seedCollections, seedViewerSettings } = require('./content-seed');
        await seedPhase1Content(c);
        await seedPhase2Content(c);
        await seedPhase3Content(c);
        await seedPhase4Content(c);
        await seedFaqs(c);
        await seedCollections(c);
        await seedViewerSettings(c);
      } catch (e) {
        console.error('phase1 content seed failed', e);
      }
    })();
  }
  return _ready;
}

async function getSetting(key) {
  await ready();
  const r = await client().execute({
    sql: 'SELECT value FROM settings WHERE key = ?',
    args: [key],
  });
  return r.rows.length ? r.rows[0].value : null;
}

function safeParseArray(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function safeParseObject(s) {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function parseProduct(row) {
  if (!row) return null;
  // Badge schedule: badge only shows within its start/end window.
  let badge = row.badge || null;
  if (badge) {
    const now = new Date().toISOString();
    if ((row.badge_start && row.badge_start > now) || (row.badge_end && row.badge_end <= now)) {
      badge = null;
    }
  }
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    slug: row.slug || null,
    collection: row.collection,
    price: row.price,
    old_price: row.old_price,
    colors: safeParseArray(row.colors),
    material: row.material,
    description: row.description,
    description_html: row.description_html || null,
    tags: row.tags || '',
    spin_enabled: row.spin_enabled == null ? null : row.spin_enabled === 1,
    spin_poster: row.spin_poster || null,
    spin_mode: row.spin_mode || null,
    image: row.image,
    image2: row.image2 || null,
    variant_images: safeParseObject(row.variant_images),
    sizes: safeParseArray(row.sizes),
    spin_frames: safeParseArray(row.spin_frames),
    video_url: row.video_url || null,
    model_3d: row.model_3d || null,
    rating: row.rating,
    reviews: row.reviews,
    badge,
    badge_start: row.badge_start || null,
    badge_end: row.badge_end || null,
    stock: row.stock,
    active: row.active === 1,
    created_at: row.created_at,
  };
}

function parseOrder(row) {
  if (!row) return null;
  let customer = {};
  let items = [];
  try { customer = JSON.parse(row.customer); } catch { /* keep {} */ }
  try { items = JSON.parse(row.items); } catch { /* keep [] */ }
  return {
    id: row.id, customer, items,
    total: row.total, payment: row.payment,
    notes: row.notes, status: row.status,
    created_at: row.created_at,
    customer_id: row.customer_id != null ? Number(row.customer_id) : null,
    discount: Number(row.discount || 0),
    coupon_code: row.coupon_code || null,
    tracking_number: row.tracking_number || null,
    courier: row.courier || null,
    admin_notes: row.admin_notes || null,
  };
}

const COLLECTIONS = {
  everyday: {
    id: 'everyday',
    name: 'Everyday Collection',
    tagline: 'Effortless pieces for every day, made to be carried on repeat.',
    image: '/images/collection-everyday.jpg',
  },
  signature: {
    id: 'signature',
    name: 'Signature Collection',
    tagline: 'Statement pieces for evenings that matter.',
    image: '/images/collection-signature.jpg',
  },
  leather: {
    id: 'leather',
    name: 'Leather Collection',
    tagline: 'Full-grain leather that ages beautifully with you.',
    image: '/images/collection-leather.jpg',
  },
};

const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

function normalizeCollection(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase().replace(/\s*collections?$/, '').trim();
  return COLLECTIONS[s] ? s : null;
}

const nowISO = () => new Date().toISOString();
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;
const isPositiveInt = (v) => Number.isInteger(v) && v > 0;

/**
 * Strip angle brackets + control chars from stored text.
 * Defense-in-depth against stored XSS: product fields are rendered into
 * JSON-LD <script> blocks where `</script>` would break out, and React
 * escapes the rest. Product/store text never legitimately needs < or >.
 */
function sanitizeText(v, maxLen = 500) {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[<>\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function sanitizeStringArray(arr, maxItems = 12, maxLen = 40) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const v of arr.slice(0, maxItems)) {
    const s = sanitizeText(v, maxLen);
    if (s) out.push(s);
  }
  return out;
}

/** Only allow relative paths or http(s) URLs for product images. */
function isSafeImageUrl(u) {
  return typeof u === 'string' && /^(https?:\/\/|\/)/i.test(u.trim());
}

const WEAK_PASSWORDS = new Set([
  'ammige123', 'admin123', 'admin', 'password', 'password123',
  '123456', '12345678', 'qwerty', 'letmein', 'changeme',
]);

function isWeakPassword(pw) {
  if (typeof pw !== 'string') return true;
  const s = pw.trim();
  return s.length < 8 || WEAK_PASSWORDS.has(s.toLowerCase());
}

/** WhatsApp number: digits with optional leading +, spaces/dashes. */
function isValidWhatsapp(v) {
  return typeof v === 'string' && /^[+\d][\d\s-]{5,20}$/.test(v.trim());
}

// ---------------------------------------------------------------- coupons

function parseCoupon(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: row.value,
    min_order: row.min_order,
    usage_limit: row.usage_limit,
    used_count: row.used_count,
    expires_at: row.expires_at,
    active: row.active === 1,
    created_at: row.created_at,
  };
}

async function getCouponByCode(code) {
  await ready();
  if (!isNonEmptyString(code)) return null;
  const r = await client().execute({
    sql: 'SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) LIMIT 1',
    args: [code.trim()],
  });
  return r.rows.length ? parseCoupon(r.rows[0]) : null;
}

/**
 * Validate a coupon against a cart subtotal.
 * Returns { ok:true, discount } or { ok:false, error }.
 * Discount is always capped at the subtotal.
 */
function checkCoupon(coupon, subtotal) {
  if (!coupon) return { ok: false, error: 'Invalid coupon code.' };
  if (!coupon.active) return { ok: false, error: 'This coupon is no longer active.' };
  if (coupon.expires_at) {
    const exp = new Date(coupon.expires_at);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
      return { ok: false, error: 'This coupon has expired.' };
    }
  }
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    return { ok: false, error: 'This coupon has reached its usage limit.' };
  }
  if (subtotal < coupon.min_order) {
    return {
      ok: false,
      error: `This coupon needs a minimum order of Rs ${Number(coupon.min_order).toLocaleString('en-PK')}.`,
    };
  }
  let discount = 0;
  if (coupon.type === 'percent') {
    discount = Math.floor((subtotal * coupon.value) / 100);
  } else {
    discount = coupon.value;
  }
  discount = Math.max(0, Math.min(discount, subtotal));
  return { ok: true, discount };
}

/** Shipping for a (discounted) subtotal, from settings. */
async function shippingFor(subtotal) {
  const flat = parseInt((await getSetting('shipping_flat')) || '250', 10);
  const threshold = parseInt((await getSetting('free_shipping_threshold')) || '5000', 10);
  if (subtotal <= 0) return 0;
  return subtotal >= threshold ? 0 : Math.max(0, flat);
}

/** Newsletter subscribe. Returns { ok:true, already:boolean }. */
async function subscribeNewsletter(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean) || clean.length > 120) {
    throw { status: 400, error: 'Please enter a valid email address.' };
  }
  await ready();
  const c = client();
  try {
    await c.execute({
      sql: 'INSERT INTO newsletter (email, created_at) VALUES (?, ?)',
      args: [clean, nowISO()],
    });
    return { ok: true, already: false };
  } catch (e) {
    // UNIQUE violation -> already subscribed; treat as success.
    const msg = String((e && e.message) || '');
    if (/unique/i.test(msg)) return { ok: true, already: true };
    throw e;
  }
}

// ---------------------------------------------------------------- customers

function cleanCustomerEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseCustomer(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || null,
    created_at: row.created_at,
  };
}

async function findCustomerByEmail(email) {
  await ready();
  const clean = cleanCustomerEmail(email);
  if (!clean) return null;
  const r = await client().execute({
    sql: 'SELECT * FROM customers WHERE email = ? LIMIT 1',
    args: [clean],
  });
  return r.rows.length ? parseCustomer(r.rows[0]) : null;
}

async function findCustomerById(id) {
  await ready();
  if (!isPositiveInt(Number(id))) return null;
  const r = await client().execute({
    sql: 'SELECT * FROM customers WHERE id = ? LIMIT 1',
    args: [Number(id)],
  });
  return r.rows.length ? parseCustomer(r.rows[0]) : null;
}

/** Create a customer. opts: { name, email, phone, password_hash }. */
async function createCustomer({ name, email, phone, password_hash }) {
  await ready();
  const clean = cleanCustomerEmail(email);
  const ins = await client().execute({
    sql: 'INSERT INTO customers (name, email, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [
      sanitizeText(name, 60),
      clean,
      phone ? sanitizeText(phone, 30) : null,
      password_hash,
      nowISO(),
    ],
  });
  return findCustomerById(Number(ins.lastInsertRowid));
}

/** Internal: fetch id + password_hash for login. Never expose the hash. */
async function getCustomerCredentials(email) {
  await ready();
  const clean = cleanCustomerEmail(email);
  if (!clean) return null;
  const r = await client().execute({
    sql: 'SELECT id, password_hash FROM customers WHERE email = ? LIMIT 1',
    args: [clean],
  });
  return r.rows.length ? { id: Number(r.rows[0].id), password_hash: r.rows[0].password_hash } : null;
}

/** Customer's orders, newest first. */
async function getCustomerOrders(customerId) {
  await ready();
  const r = await client().execute({
    sql: 'SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 50',
    args: [Number(customerId)],
  });
  const out = [];
  for (const row of r.rows) out.push(parseOrder(row));
  return out;
}

/** URL-friendly slug from a product name. */
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product';
}

module.exports = {
  client,
  ready,
  getSetting,
  parseProduct,
  parseOrder,
  slugify,
  COLLECTIONS,
  ORDER_STATUSES,
  normalizeCollection,
  nowISO,
  isNonEmptyString,
  isPositiveInt,
  sanitizeText,
  sanitizeStringArray,
  isSafeImageUrl,
  isWeakPassword,
  isValidWhatsapp,
  parseCoupon,
  getCouponByCode,
  checkCoupon,
  shippingFor,
  subscribeNewsletter,
  cleanCustomerEmail,
  findCustomerByEmail,
  findCustomerById,
  createCustomer,
  getCustomerOrders,
  getCustomerCredentials,
};
