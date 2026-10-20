# AMMIGE — Environment Variables

All variables. Set in Vercel dashboard (both projects) or Hostinger Node.js app settings.

## Required

| Variable | Example | Notes |
|---|---|---|
| `AMMIGE_ADMIN_PASSWORD` | (strong password) | Admin panel login. Change from default immediately. |
| `ADMIN_SECRET` | 32+ random chars | Signs admin session cookies. Generate: `openssl rand -hex 32` |
| `CUSTOMER_SECRET` | 32+ random chars | Signs customer session cookies. Different from ADMIN_SECRET. |

## Database

| Variable | Example | Notes |
|---|---|---|
| `POSTGRES_URL` | `postgres://user:pass@host/db` | **Neon PostgreSQL** — set when migration is done. Code currently uses SQLite; this is reserved. |
| `DB_PATH` | `/home/uXXXXX/ammige-data/ammige.db` | SQLite file location (Hostinger/VPS). **Must be outside the deploy folder.** Vercel default: `/tmp/ammige.db` (ephemeral — see warning). |
| `TURSO_DATABASE_URL` | — | Legacy. Not used. |

> ⚠️ **Vercel `/tmp` is ephemeral.** The database resets on cold start/redeploy until the PostgreSQL migration is complete. Do not treat Vercel as permanent storage yet.

## Media storage

| Variable | Example | Notes |
|---|---|---|
| `UPLOAD_DIR` | `/home/uXXXXX/ammige-uploads` | Product images, videos, 3D models on disk. **Must be outside the deploy folder.** Auto-created on boot. |

## Site

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://ammige.com` | Canonical URL for SEO/sitemap. |

## Optional

| Variable | Default | Notes |
|---|---|---|
| `SITE_MODE` | `full` | Set by deploy script: `storefront` or `admin` per Vercel project. Do not set manually. |
