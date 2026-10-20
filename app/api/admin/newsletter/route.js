import { NextResponse } from 'next/server';
import { client, ready } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  if (checkRate(req, { windowMs: 60_000, max: 120, scope: 'admin-read' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  await ready();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
  const q = (searchParams.get('q') || '').trim();
  const c = client();
  const where = q ? 'WHERE email LIKE ?' : '';
  const args = q ? [`%${q}%`] : [];
  const total = (await c.execute({
    sql: `SELECT COUNT(*) AS n FROM newsletter ${where}`, args,
  })).rows[0].n;
  const r = await c.execute({
    sql: `SELECT id, email, created_at FROM newsletter ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    args: [...args, limit, (page - 1) * limit],
  });
  return NextResponse.json({ items: r.rows, total, page, limit });
}

export async function DELETE(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const originErr = checkOrigin(req);
  if (originErr) return originErr;
  if (checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' })) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  const { id } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'id required.' }, { status: 400 });
  await ready();
  await client().execute({ sql: 'DELETE FROM newsletter WHERE id = ?', args: [id] });
  return NextResponse.json({ ok: true });
}
