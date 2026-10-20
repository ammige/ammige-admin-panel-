import { NextResponse } from 'next/server';
import { client, ready } from '@/lib/db';
import {
  getAllBlocks, cleanBlockInput, logActivity, revalidateSite,
} from '@/lib/content';
import { nowUTC } from '@/lib/time';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

function adminWriteLimit(req) {
  return checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' });
}

/** GET /api/admin/content?type=popup — list blocks (admin, all statuses). */
export async function GET(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || '';
  await ready();
  let rows;
  if (type) {
    rows = await getAllBlocks(type);
  } else {
    const r = await client().execute({
      sql: 'SELECT * FROM content_blocks ORDER BY type ASC, priority ASC, id ASC',
    });
    rows = r.rows.map((row) => {
      let data = {};
      try { data = JSON.parse(row.data || '{}'); } catch {}
      return { ...row, data };
    });
  }
  return NextResponse.json({ items: rows });
}

/** POST /api/admin/content — create a block. */
export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!adminWriteLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  let b;
  try { b = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const cleaned = cleanBlockInput(b);
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });

  await ready();
  const now = nowUTC();
  const ins = await client().execute({
    sql: `INSERT INTO content_blocks
          (type, name, data, status, active, starts_at, ends_at, priority, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [cleaned.data.type, cleaned.data.name, cleaned.data.data, cleaned.data.status,
      cleaned.data.active, cleaned.data.starts_at, cleaned.data.ends_at,
      cleaned.data.priority, now, now],
  });
  const id = Number(ins.lastInsertRowid);
  await logActivity('create', `content:${cleaned.data.type}`, id, cleaned.data.name);
  revalidateSite();
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
