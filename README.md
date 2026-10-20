# AMMIGE — Premium Women's Handbags

Next.js full-stack e-commerce store for the AMMIGE brand.

## Quick start (local)

```bash
npm install
npm run seed   # creates ammige.db with 260 products
npm run dev    # http://localhost:3000
```

Admin panel: `http://localhost:3000/admin` — default password `ammige123`
(change it in Settings right after first login, or set `AMMIGE_ADMIN_PASSWORD`).

## Environment

Copy `.env.example` to `.env.local`:

- `AMMIGE_ADMIN_PASSWORD` — admin panel password
- `ADMIN_SECRET` — long random string to sign admin sessions (production)
- `NEXT_PUBLIC_SITE_URL` — canonical site URL (sitemap, OG tags)
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` — production database on Vercel
  (Vercel's filesystem is ephemeral, so SQLite file DB won't persist there)

## Deploy

1. Push to GitHub (repo: `ammige`)
2. Import into Vercel, add env vars above
3. Create a free Turso database and set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
4. Run `npm run seed` once against the Turso DB
   (`TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run seed`)

## Features

- Home, Shop (search/filter/sort), Product detail, Checkout (COD), Order tracking
- Admin panel: dashboard stats, product CRUD, order management, settings
- SEO: metadata, Open Graph, sitemap.xml, robots.txt, JSON-LD
- Security: signed httpOnly admin sessions, rate limiting, input validation, security headers
