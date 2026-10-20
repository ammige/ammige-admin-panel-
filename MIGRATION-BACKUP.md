# AMMIGE — Migration, Seed & Backup

## First boot / migration

The database auto-migrates on every boot (`lib/db.js` → `ready()`):

1. Creates all tables if missing (`CREATE TABLE IF NOT EXISTS`)
2. Runs `ALTER TABLE` migrations (new columns — safe to re-run)
3. Seeds default settings
4. Seeds content blocks (Phase 1–6): nav, footer, SEO, announcement, marquee, popup, offers, homepage layout, hero, banners, FAQs, collections, 3D viewer settings
5. Seeds 260 placeholder products **only if the products table is empty**

No manual command needed. To force a fresh seed: delete the `.db` file and restart.

## One-time media migration (data-URL → disk files)

If products still have `data:` URLs in image fields:

```bash
npm run migrate-media
```

Scans all products, writes files to `UPLOAD_DIR`, replaces with `/media/...` URLs. Idempotent.

## Backup (Hostinger/VPS)

```bash
# 1. Database
sqlite3 "$DB_PATH" ".backup '$HOME/ammige-backup-$(date +%F).db'"

# 2. Uploads
tar -czf "$HOME/ammige-uploads-$(date +%F).tar.gz" "$UPLOAD_DIR"

# 3. Keep 7 days
find "$HOME" -name 'ammige-backup-*.db' -mtime +7 -delete
find "$HOME" -name 'ammige-uploads-*.tar.gz' -mtime +7 -delete
```

Run daily via cron. Test restores quarterly.

## PostgreSQL migration (pending)

When `POSTGRES_URL` is set and code is converted:
- Same backup strategy via `pg_dump`
- Zero-downtime: point both Vercel projects at Neon, then decommission SQLite
