import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-guard';

const { saveMediaNamed } = require('@/lib/media');

/**
 * POST /api/admin/media-upload — store a site asset in the shared media DB
 * under a fixed name (stable URL). Body: { dir, name, mime, data(base64) }.
 * Used for the homepage band video; the admin UI can adopt it later.
 */
export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  if (!b || !b.data) return NextResponse.json({ error: 'Missing file data.' }, { status: 400 });
  const dir = String(b.dir || 'videos');
  const name = String(b.name || '');
  if (!['videos', 'products', 'frames', 'models'].includes(dir) || !/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(name)) {
    return NextResponse.json({ error: 'Bad dir or name.' }, { status: 400 });
  }
  const buf = Buffer.from(String(b.data), 'base64');
  if (!buf.length || buf.length > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'File empty or over 4 MB.' }, { status: 400 });
  }
  const url = await saveMediaNamed(buf, dir, name, String(b.mime || 'application/octet-stream'));
  if (!url) return NextResponse.json({ error: 'Media DB unavailable.' }, { status: 500 });
  return NextResponse.json({ ok: true, url });
}
