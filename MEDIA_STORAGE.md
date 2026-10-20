# AMMIGE — Media Storage & Hostinger Env Vars

All product images, videos, GLB models and 360° frames are stored as **files on disk**,
never in the database. The database holds only URL strings like `/media/products/abc123.webp`.

---

## 1. ENV VARS (set all of these in Hostinger → Node.js Web App → Environment Variables)

| Var | Required | Example | What it does |
|---|---|---|---|
| `UPLOAD_DIR` | **Yes** | `/home/u123456789/ammige-uploads` | Folder for all uploaded files. **Must be OUTSIDE the deploy folder** so redeploys never delete it. Created automatically if missing. |
| `DB_PATH` | **Yes** | `/home/u123456789/ammige-data/ammige.db` | SQLite database file. **Must be OUTSIDE the deploy folder** for the same reason. |
| `AMMIGE_ADMIN_PASSWORD` | **Yes** | (strong random password) | Admin panel login password. Production **fails closed** if missing. |
| `ADMIN_SECRET` | **Yes** | (32+ random chars) | Signs admin session cookies. |
| `CUSTOMER_SECRET` | **Yes** | (32+ random chars) | Signs customer session cookies. |
| `NEXT_PUBLIC_SITE_URL` | **Yes** | `https://ammige.com` | Canonical site URL (SEO, sitemaps, absolute links). |
| `NODE_ENV` | Auto | `production` | Hostinger sets this. Enables fail-closed security. |

Generate secrets with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Suggested Hostinger layout** (replace `u123456789` with your Hostinger user):
```
/home/u123456789/
├── ammige-uploads/          ← UPLOAD_DIR
│   ├── products/            (product photos, WebP)
│   ├── videos/              (MP4s)
│   ├── models/              (.glb 3D models)
│   └── frames/              (360° spin frames)
├── ammige-data/
│   └── ammige.db            ← DB_PATH
└── domains/ammige.com/      ← deploy folder (Hostinger manages this — never store data here)
```

---

## 2. HOW IT WORKS

```
Admin uploads file
       ↓  POST /api/admin/upload (admin auth + rate limit + CSRF)
       ↓  validate: jpg/png/webp ≤5MB · mp4 ≤50MB · glb ≤15MB
       ↓  images → sharp → WebP (max 1920px, q82)
       ↓  saved: $UPLOAD_DIR/<kind>/<random-24-chars>.<ext>
       ↓  returns { url: "/media/products/abc123.webp" }
Admin saves product → DB stores ONLY the URL string

Customer opens page
       ↓  <img src="/media/products/abc123.webp">
       ↓  GET /media/[...path] streams from disk
           · correct Content-Type · HTTP Range (video seeking → 206)
           · Cache-Control: public, max-age=31536000, immutable
           · path-traversal blocked
```

**Why not /public?** Next.js does not serve files added to `/public` after the build.
Uploads land on disk at runtime → they must be served by the `/media` route handler.

**3D viewer priority:** `.glb` model → 6-face photo box → image gallery.

---

## 3. ONE-TIME MIGRATION (existing data-URL images → files)

If the database already contains `data:image/...` URLs (from the old upload system):

```bash
# On the Hostinger server (or locally with DB_PATH + UPLOAD_DIR set):
DB_PATH=/home/u123456789/ammige-data/ammige.db \
UPLOAD_DIR=/home/u123456789/ammige-uploads \
node lib/migrate-media.js
```

- Scans `products.image`, `image2`, `variant_images`, `spin_frames`.
- Writes each data-URL to disk, replaces the DB value with `/media/...`.
- Safe to re-run (skips values that are already URLs).
- Run **once**, verify a few product pages, done.

---

## 4. BACKUP

Two things to back up: the DB file and the uploads folder.

**Manual (SSH):**
```bash
# 1. SQLite-safe DB snapshot (never copy the .db while it's being written)
sqlite3 /home/u123456789/ammige-data/ammige.db ".backup '/tmp/ammige-backup.db'"

# 2. Pack everything with a date stamp
tar -czf ~/backup-ammige-$(date +%F).tar.gz \
  -C /tmp ammige-backup.db \
  -C /home/u123456789 ammige-uploads

# 3. Download ~/backup-ammige-YYYY-MM-DD.tar.gz via Hostinger File Manager
rm /tmp/ammige-backup.db
```

**Restore:**
```bash
tar -xzf backup-ammige-YYYY-MM-DD.tar.gz -C /tmp   # inspect first
# then place ammige.db at $DB_PATH and uploads at $UPLOAD_DIR, restart the app
```

**Recommended schedule:** weekly (or daily once orders are live). Keep 4–8 copies.
Hostinger's own account backups are a second layer, not a replacement — they may
not run right before you need them.

---

## 5. UPLOAD LIMITS (enforced)

| Kind | Allowed | Max size | Stored as |
|---|---|---|---|
| Product photo | jpg, png, webp | 5 MB | WebP (sharp, ≤1920px, q82) |
| 360° frame | jpg, png, webp | 5 MB | WebP |
| Product video | mp4 | 50 MB | MP4 as-is |
| 3D model | glb | 15 MB | GLB as-is |

GIF is no longer accepted for new uploads (old GIF data-URLs migrate as-is).
Filenames are always randomized (24 hex chars) — original names never touch disk.
