import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';
import { checkRate } from '@/lib/rate-limit';
import { checkOrigin } from '@/lib/csrf';

const { validateUpload, saveBuffer, saveBufferAs } = require('@/lib/media');

let _sharp = null;
function sharp() {
  if (_sharp === null) {
    try {
      _sharp = require('sharp');
    } catch {
      _sharp = false; // sharp not installed — store original bytes instead
    }
  }
  return _sharp || null;
}

/**
 * POST /api/admin/upload — admin file upload to DISK (never the database).
 *
 * multipart/form-data fields:
 *   file : the file
 *   kind : image | video | model | frame   (default: image)
 *
 * - images/frames → compressed to WebP (max 1920px, q82) via sharp
 * - videos (.mp4) and GLB models stored as-is
 * - filenames randomized; returns { ok, url } where url = /media/<dir>/<file>
 * - the caller stores ONLY this URL string in the database
 */
export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (!checkRate(req, { windowMs: 60_000, max: 30, scope: 'admin-upload' })) {
    return NextResponse.json({ error: 'Too many uploads. Slow down.' }, { status: 429 });
  }
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 });
  }
  const file = form.get('file');
  const kind = String(form.get('kind') || 'image').toLowerCase();

  const v = validateUpload(file, kind);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  let buf = Buffer.from(await file.arrayBuffer());
  let outKind = v.kind;

  // Compress images/frames to WebP on the server.
  if ((v.kind === 'image' || v.kind === 'frame') && sharp()) {
    try {
      buf = await sharp()(buf, { animated: false })
        .rotate() // honor EXIF orientation
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch (e) {
      console.error('sharp convert failed, storing original', e);
      // fall through: store original bytes with a matching extension
      const ext = file.type === 'image/png' ? '.png' : '.jpg';
      const url = saveBufferAs(buf, 'image', ext);
      return NextResponse.json({ ok: true, url, size: buf.length, type: file.type });
    }
  }

  const url = saveBuffer(buf, outKind);
  return NextResponse.json({ ok: true, url, size: buf.length, kind: outKind });
}
