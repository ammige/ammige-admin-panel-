# AMMIGE — Complete Technical Overview
### For Hostinger Shared Hosting Deployment Assessment
**Date:** 2026-10-18 | **Repo:** github.com/Taha-Siraj/ammige

---

## 1. TECH STACK

| Layer | Technology | Version |
|---|---|---|
| Framework | **Next.js** (App Router) | 15.5.27 |
| UI Library | **React** + React DOM | 19.0.0 |
| 3D Engine | **Three.js** | 0.186.1 |
| Animation | **GSAP** | 3.15.0 |
| Database driver | **@libsql/client** (SQLite) | 0.15.15 |
| Runtime | **Node.js** | ≥ 20 required |
| Language | JavaScript (no TypeScript) | — |
| Styling | Plain CSS (styled-jsx + global CSS, no Tailwind) | — |
| Fonts | Cormorant Garamond + Inter (Google Fonts) | — |

**NOT used:** No PHP, no Tailwind, no TypeScript, no Vite, no plain HTML.

---

## 2. DATABASE

**Engine:** SQLite via `@libsql/client`.
- Local dev: `ammige.db` file in project root (configurable via `DB_PATH` env var).
- Vercel production: ephemeral `/tmp/ammige.db` (wiped on cold start — known issue; planned move to Neon PostgreSQL).
- Turso env vars (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`) exist in code but Turso plan was dropped.

**Tables (6):**

| Table | Purpose | Key columns |
|---|---|---|
| `products` | Catalog (~260 rows) | id, sku, name, collection (everyday/signature/leather), price, old_price, colors (JSON), material, description, image, image2, variant_images (JSON), sizes (JSON), spin_frames (JSON), video_url, rating, reviews, badge, stock, active, created_at |
| `orders` | Customer orders (COD) | id, customer (JSON), items (JSON), total, payment, notes, status, discount, coupon_code, created_at |
| `customers` | Store accounts | id, name, email (unique), phone, password_hash, created_at |
| `coupons` | Discount codes | id, code (unique), type (percent/flat), value, min_order, usage_limit, used_count, expires_at, active, created_at |
| `newsletter` | Email subscribers | id, email (unique), created_at |
| `settings` | Site config (marquee, popup, announcement, contact info) | key (PK), value |

**Credentials storage:** Environment variables only — never in code:
- `ADMIN_SECRET`, `AMMIGE_ADMIN_PASSWORD`, `CUSTOMER_SECRET` (auth)
- `DB_PATH` (database file location)
- `NEXT_PUBLIC_SITE_URL` (public site URL)
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (legacy, unused)

---

## 3. MEDIA

| Type | Storage |
|---|---|
| Product/hero/collection images | **Local files** in `public/images/` (AI-generated JPGs, ~13–60 KB each after compression) |
| Admin-uploaded images | Stored as **data URLs inside the SQLite DB** (JPG/PNG/WEBP/GIF, 3 MB cap per file) |
| 360° spin frames | Local files `public/images/products/spin/p1/` (16 frames) |
| 3D multi-angle views | Local files `public/images/products/3d/p{N}/` |
| Product videos | External URLs only (`video_url` column — YouTube/.mp4/.webm, not hosted locally) |
| CDN / cloud storage | **None** (no Cloudinary, no Vercel Blob currently) |

---

## 4. BACKEND / API

**Yes — full backend. 27 API routes** (all under `app/api/`):

**Admin (15 routes, password + secret protected):**
- `admin/login`, `admin/logout` — auth
- `admin/products`, `admin/products/[id]`, `admin/products/bulk` — CRUD + bulk delete
- `admin/orders`, `admin/orders/[id]`, `admin/orders/manual` — order management
- `admin/customers`, `admin/coupons`, `admin/coupons/[id]` — customers + discount codes
- `admin/newsletter`, `admin/settings`, `admin/stats`, `admin/upload`, `admin/export`

**Storefront (12 routes):**
- `products`, `products/[id]` — catalog
- `orders` (POST — checkout), `track/[id]` — order placement + tracking
- `auth/signup`, `auth/login`, `auth/logout`, `auth/me`, `auth/orders` — customer accounts
- `coupons/validate`, `newsletter` (POST), `collections`, `config`

**Other server-side pieces:**
- `middleware.js` — route guard: blocks `/admin` + `/api/admin/*` on the storefront project; injects `x-pathname` header
- Admin panel UI: `app/admin/page.js` (single-page admin: products, orders, customers, coupons, newsletter, settings)
- Security: login rate-limit (8/10 min/IP), CSRF origin checks, httpOnly session cookies
- Payments: **COD only** (bank transfer removed); no payment gateway integration
- Contact form: `components/ContactForm.js` (frontend only — check target)

---

## 5. FILE STRUCTURE

```
ammige/
├── app/                        # Next.js App Router
│   ├── page.js                 # Homepage (editorial hero, collections, bestsellers)
│   ├── layout.js               # Root layout (Header/Footer/CartDrawer, skips on /admin)
│   ├── shop/page.js            # Shop (filters, live collection counts)
│   ├── product/[id]/page.js    # Product detail (3D viewer, video, variants)
│   ├── checkout/page.js        # Checkout (COD only)
│   ├── track/page.js           # Order tracking
│   ├── cart → (drawer, no page)
│   ├── wishlist/page.js
│   ├── login/ signup/ account/ # Customer accounts
│   ├── about/ contact/ faq/ shipping/ privacy/ terms/
│   ├── admin/page.js           # Admin panel (all management UI)
│   └── api/                    # 27 API routes (see §4)
│       ├── admin/...  (15)
│       ├── auth/...    (5)
│       └── products, orders, coupons, newsletter, collections, config, track
├── components/                 # 21 React components
│   ├── Product3DViewer.js      # Three.js 6-face 3D box viewer
│   ├── Spin360Viewer.js        # Image-sequence 360 viewer (legacy path)
│   ├── ProductDetail.js        # PDP logic (variants, gallery, 3D/video buttons)
│   ├── Header.js  Footer.js  CartProvider.js  ProductCard.js ...
│   └── OfferPopup.js  EditorialHero.js  SmartImage.js ...
├── lib/                        # 12 server modules
│   ├── db.js                   # SQLite connection + schema + auto-seed (260 dummy products)
│   ├── catalog.js              # Seed catalog generator
│   ├── auth.js / customer-auth.js / customer-session.js
│   ├── admin-guard.js  csrf.js  rate-limit.js
│   └── seo.js  orders.js  seed.js  site-mode.js
├── public/
│   └── images/                 # All local images (hero, collections, products, 3d, spin)
│   └── llms.txt  robots.txt
├── middleware.js               # Admin route guard
├── next.config.js              # Headers (HSTS, X-Frame-Options, etc.)
├── ecosystem.config.js         # PM2 config (for VPS)
├── HOSTINGER_DEPLOY.md         # VPS deploy guide (already written)
└── package.json
```

**Total:** ~120 source files (excluding node_modules).

---

## 6. BUILD

- **Type:** Dynamic server-rendered app — **needs a Node.js server to run.**
- **Build command:** `npm run build` → output in `.next/`
- **Start command:** `npm start` (runs `next start` on port 3000; PM2 config in `ecosystem.config.js`)
- **Dev:** `npm run dev`
- **Seed:** `npm run seed` (`node lib/seed.js`)

It is **NOT** a static site. Every product page, the shop, checkout, admin, and all forms hit the Node API at runtime.

---

## 7. HOSTINGER COMPATIBILITY

### Can it run on Premium Shared Hosting (public_html)? **NO.**

| Requirement | Shared hosting | AMMIGE needs |
|---|---|---|
| Node.js runtime | ❌ Not available (PHP only) | ✅ Node ≥ 20 |
| API routes (`/api/*`) | ❌ No server code execution | ✅ 27 routes |
| Database writes | MySQL only (via PHP) | ✅ SQLite file writes / PostgreSQL |
| Long-running process | ❌ | ✅ `next start` server |

### What exactly breaks if you upload a static export to public_html:

| Feature | Static export | Status |
|---|---|---|
| Homepage, About, Contact, FAQ, Privacy, Terms | ✅ Works | Static pages fine |
| Product images, hero, 3D viewer (Three.js) | ✅ Works | Pure frontend JS |
| Shop page product listing | ❌ Broken | Fetches `/api/products` |
| Product detail pages | ❌ Broken | Fetches `/api/products/[id]` |
| Search / filters | ❌ Broken | API-driven |
| Cart checkout / order placement | ❌ Broken | POSTs `/api/orders` |
| Order tracking | ❌ Broken | GETs `/api/track/[id]` |
| Customer login/signup/accounts | ❌ Broken | All `/api/auth/*` |
| Coupon validation | ❌ Broken | POSTs `/api/coupons/validate` |
| Newsletter signup | ❌ Broken | POSTs `/api/newsletter` |
| **Entire admin panel** | ❌ Dead | 100% API-driven |
| Marquee/popup/announcement settings | ❌ Frozen | Read from `/api/config` |

**Bottom line:** A static export keeps the *brochure* (homepage + info pages + images + 3D viewer shell) but kills the *store* (no products, no checkout, no admin). It would be a demo, not a shop.

### Realistic options:

| Option | What | Cost/effort |
|---|---|---|
| **A. Hostinger VPS** (recommended) | KVM 1+, Ubuntu, Node 20, PM2, Nginx — full app runs as-is | ~$5–7/mo; guide already in `HOSTINGER_DEPLOY.md` |
| **B. Stay on Vercel** (current) | Zero change; free tier | $0; already live |
| **C. Static brochure on shared** | Export static pages only; "Shop Now" links to Vercel store | Free; loses on-domain store |
| **D. Rewrite backend in PHP+MySQL** | Rebuild 27 API routes + admin in PHP | 2–4 weeks of work; not recommended |

---

## 8. EXPORT (static) — HOW-TO

If you still want the static brochure version for `public_html`:

**Changes required in code:**
1. `next.config.js` → add `output: 'export'` and `images: { unoptimized: true }`
2. `app/product/[id]/page.js` → add `generateStaticParams()` (export all 260 product IDs at build time)
3. All `fetch('/api/...')` calls → replaced with build-time data or removed
4. `middleware.js` → delete (no server); admin becomes unreachable
5. `next.config.js` `headers()` → move to `.htaccess` (static hosts ignore Next headers)

**Build & download:**
```bash
npm run build          # output goes to out/  (not .next/)
```
- The `out/` folder IS the website — zip it and upload to `public_html`, or
- Push to GitHub, then download ZIP: `github.com/Taha-Siraj/ammige → Code → Download ZIP`
- `.htaccess` for HTTPS + caching must be added manually in `public_html`

**My honest recommendation:** Don't static-export the store. Use **Option A (VPS)** when order volume justifies it, or **stay on Vercel (Option B)** for now — both keep 100% functionality. The static export is only useful as a temporary landing page.

---

## Step-by-step: deploying on Hostinger (correct path)

### Path 1 — VPS (full store, recommended long-term)
1. Hostinger → VPS → **KVM 1**, Ubuntu 22.04.
2. SSH in, install Node 20:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs nginx
   sudo npm i -g pm2
   ```
3. Clone + build:
   ```bash
   cd /var/www && sudo git clone https://github.com/Taha-Siraj/ammige.git
   cd ammige && npm ci && npm run build
   ```
4. Env vars: create `.env` (`ADMIN_SECRET`, `AMMIGE_ADMIN_PASSWORD`, `CUSTOMER_SECRET`, `DB_PATH=/var/www/ammige/ammige.db`, `NEXT_PUBLIC_SITE_URL=https://ammige.com`)
5. Fix images (GitHub copy has corrupt binaries — overlay real images, see `HOSTINGER_DEPLOY.md` §2b).
6. Start: `pm2 start ecosystem.config.js && pm2 save`
7. Nginx reverse-proxy 80/443 → `localhost:3000`; point `ammige.com` DNS to VPS IP.
8. Full detail: [`HOSTINGER_DEPLOY.md`](./HOSTINGER_DEPLOY.md)

### Path 2 — Stay on Vercel (full store, $0, current)
Nothing to do — already live at `ammige-taha-sirajs-projects.vercel.app`. Add `ammige.com` as a custom domain in the Vercel dashboard when ready.

### Path 3 — Shared hosting static brochure (limited)
1. Apply the 5 code changes in §8.
2. `npm run build` → zip the `out/` folder.
3. Hostinger → File Manager → `public_html` → upload + extract ZIP.
4. Add `.htaccess` (HTTPS redirect + cache headers).
5. Accept the broken-features table in §7 — link "Shop" buttons to the Vercel URL.
