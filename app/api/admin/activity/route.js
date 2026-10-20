import { NextResponse } from 'next/server';
import { client, ready } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';

/** GET /api/admin/activity?limit=100 — recent admin activity. */
export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit'), 10) || 100));
  await ready();
  const r = await client().execute({
    sql: 'SELECT * FROM activity_log ORDER BY id DESC LIMIT ?',
    args: [limit],
  });
  return NextResponse.json({ items: r.rows });
}
