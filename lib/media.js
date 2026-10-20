'use strict';

/**
 * Media storage layer — files live on DISK, never in the database.
 *
 * - UPLOAD_DIR env var points OUTSIDE the deploy/build folder so redeploys
 *   never wipe uploads. Created automatically if missing.
 * - Public URLs look like /media/products/abc123.webp and are served by
 *   app/media/[...path]/route.js (streams from disk, Range + cache headers).
 * - The database stores ONLY the URL string.
 *
 * Hostinger managed Node.js example:
 *   UPLOAD_DIR=/home/u123456789/ammige-uploads
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function getUploadDir() {
  if (process.env.UPLOAD_DIR && process.env.UPLOAD_DIR.trim()) {
    return path.resolve(process.env.UPLOAD_DIR.trim());
  }
  // Dev fallback: a folder next to the project (outside .next/public).
  // In production ALWAYS set UPLOAD_DIR explicitly.
  return path.join(os.homedir(), 'ammige-uploads');
}

let _ensured = null;
function ensureUploadDir() {
  const dir = getUploadDir();
  if (_ensured !== dir) {
    for (const sub of ['', 'products', 'videos', 'models', 'frames']) {
      fs.mkdirSync(path.join(dir, sub), { recursive: true });
    }
    _ensured = dir;
  }
  return dir;
}

/** kind → subfolder + allowed mime types + max bytes + final extension */
const KINDS = {
  image: {
    dir: 'products',
    mimes: new Set(['image/jpeg', 'image/png', 'image/webp']),
    maxBytes: 5 * 1024 * 1024,
    ext: '.webp', // sharp converts everything to WebP
  },
  video: {
    dir: 'videos',
    mimes: new Set(['video/mp4']),
    maxBytes: 50 * 1024 * 1024,
    ext: '.mp4',
  },
  model: {
    dir: 'models',
    // .glb is model/gltf-binary; some browsers send application/octet-stream
    mimes: new Set(['model/gltf-binary', 'application/octet-stream', 'application/gltf-buffer']),
    maxBytes: 15 * 1024 * 1024,
    ext: '.glb',
  },
  frame: {
    dir: 'frames',
    mimes: new Set(['image/jpeg', 'image/png', 'image/webp']),
    maxBytes: 5 * 1024 * 1024,
    ext: '.webp',
  },
};

function randomName(ext) {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24) + ext;
}

/**
 * Validate an uploaded file. Returns { ok, kind, error }.
 * `wanted` is the kind the admin UI asked for (image|video|model|frame).
 */
function validateUpload(file, wanted) {
  const kind = KINDS[wanted] ? wanted : 'image';
  const cfg = KINDS[kind];
  if (!file || typeof file === 'string' || !file.size) {
    return { ok: false, error: 'No file received.' };
  }
  // Extra guard for .glb: browsers often report octet-stream for unknown types,
  // so also accept by file extension.
  const name = String(file.name || '').toLowerCase();
  const mimeOk = cfg.mimes.has(file.type) || (kind === 'model' && name.endsWith('.glb'));
  if (!mimeOk) {
    const labels = {
      image: 'JPG, PNG or WEBP',
      video: 'MP4',
      model: 'GLB',
      frame: 'JPG, PNG or WEBP',
    };
    return { ok: false, error: `Only ${labels[kind]} files allowed.` };
  }
  if (file.size > cfg.maxBytes) {
    const mb = Math.round(cfg.maxBytes / 1024 / 1024);
    return { ok: false, error: `File too large (max ${mb} MB).` };
  }
  return { ok: true, kind, cfg };
}

/**
 * Persist a Buffer to disk under UPLOAD_DIR/<kind-dir>/<random>.<ext>.
 * Returns the public URL, e.g. /media/products/abc123.webp
 */
function saveBuffer(buf, kind) {
  const dir = ensureUploadDir();
  const cfg = KINDS[kind];
  const name = randomName(cfg.ext);
  const full = path.join(dir, cfg.dir, name);
  fs.writeFileSync(full, buf);
  return `/media/${cfg.dir}/${name}`;
}

/** Same as saveBuffer but with an explicit extension (fallback paths). */
function saveBufferAs(buf, kind, ext) {
  const dir = ensureUploadDir();
  const cfg = KINDS[kind];
  const name = randomName(ext.startsWith('.') ? ext : '.' + ext);
  const full = path.join(dir, cfg.dir, name);
  fs.writeFileSync(full, buf);
  return `/media/${cfg.dir}/${name}`;
}

/**
 * Resolve a /media/<dir>/<file> request path to an absolute disk path.
 * Returns null when the path is invalid or escapes UPLOAD_DIR.
 */
function resolveMediaPath(parts) {
  if (!Array.isArray(parts) || parts.length !== 2) return null;
  const [dir, file] = parts;
  if (!['products', 'videos', 'models', 'frames'].includes(dir)) return null;
  if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(file)) return null;
  const base = ensureUploadDir();
  const full = path.resolve(base, dir, file);
  if (!full.startsWith(base + path.sep)) return null; // traversal guard
  return full;
}

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.glb': 'model/gltf-binary',
};

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// DB-backed storage for IMAGES (Vercel-safe).
//
// Why: on Vercel the disk is ephemeral and NOT shared between the storefront
// and admin deployments, so disk uploads never reach customers. Images are
// small (sharp-compressed WebP), so they live in the shared Postgres DB
// (media_files, base64) and app/media/[...path]/route.js serves them from
// there on BOTH deployments. Videos/models are too large for DB rows — they
// keep the disk path (they need the Hostinger/disk deployment to be served).
// Without POSTGRES_URL (local dev), everything falls back to disk.
// ---------------------------------------------------------------------------
let _neonSql = null;
let _mediaTableReady = false;

function mediaDb() {
  const url = process.env.POSTGRES_URL;
  if (!url) return null;
  if (_neonSql === null) {
    try {
      _neonSql = require('@neondatabase/serverless').neon(url);
    } catch {
      _neonSql = false;
    }
  }
  return _neonSql || null;
}

async function ensureMediaTable(s) {
  if (_mediaTableReady) return;
  await s.query(
    'CREATE TABLE IF NOT EXISTS media_files (name TEXT PRIMARY KEY, dir TEXT NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())',
    []
  );
  _mediaTableReady = true;
}

/**
 * Persist an upload and return its public /media/<dir>/<file> URL.
 * Images/frames go to the shared DB when POSTGRES_URL is set; everything
 * else (and any DB failure) falls back to disk. opts: { ext, mime }.
 */
async function saveMedia(buf, kind, opts = {}) {
  const cfg = KINDS[kind] || KINDS.image;
  const ext = opts.ext ? (opts.ext.startsWith('.') ? opts.ext : '.' + opts.ext) : cfg.ext;
  const mime = opts.mime || CONTENT_TYPES[ext] || 'application/octet-stream';
  if (kind === 'image' || kind === 'frame') {
    const s = mediaDb();
    if (s) {
      try {
        await ensureMediaTable(s);
        const name = randomName(ext);
        await s.query('INSERT INTO media_files (name, dir, mime, data) VALUES ($1, $2, $3, $4)', [
          name, cfg.dir, mime, buf.toString('base64'),
        ]);
        return `/media/${cfg.dir}/${name}`;
      } catch (e) {
        console.error('media DB save failed, falling back to disk', e);
      }
    }
  }
  return saveBufferAs(buf, kind, ext);
}

/** Read an uploaded file back from the DB. Returns { mime, buf } or null. */
async function readMediaDb(parts) {
  if (!Array.isArray(parts) || parts.length !== 2) return null;
  const [dir, file] = parts;
  if (!['products', 'videos', 'models', 'frames'].includes(dir)) return null;
  if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(file)) return null;
  const s = mediaDb();
  if (!s) return null;
  try {
    await ensureMediaTable(s);
    const rows = await s.query('SELECT mime, data FROM media_files WHERE name = $1 AND dir = $2', [file, dir]);
    if (!rows.length) return null;
    return { mime: rows[0].mime, buf: Buffer.from(rows[0].data, 'base64') };
  } catch {
    return null;
  }
}

module.exports = {
  getUploadDir,
  ensureUploadDir,
  validateUpload,
  saveBuffer,
  saveBufferAs,
  saveMedia,
  readMediaDb,
  resolveMediaPath,
  contentTypeFor,
  KINDS,
};
