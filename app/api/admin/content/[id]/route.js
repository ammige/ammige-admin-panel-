import { NextResponse } from 'next/server';
import { client, ready } from '@/lib/db';
import {
  getBlockById, cleanBlockInput, logActivity, revalidateSite,
} from '@/lib/content';
import { nowUTC } from '@/lib/time';
import { requireAdmin } from '@/lib/admin-guard';
import { checkOrigin } from '@/lib/csrf';
import { checkRate } from '@/lib/rate-limit';

function adminWriteLimit(req) {
  return checkRate(req, { windowMs: 60_000, max: 60, scope: 'admin-write' });
}

/** PATCH /api/admin/content/[id] — update a block. */
export async function PATCH(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!adminWriteLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
  }
  let b;
  try { b = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  await ready();
  const existing = await getBlockById(id);
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  // Merge: only supplied fields change; type/name can be renamed too.
  const merged = {
    type: b.type !== undefined ? b.type : existing.type,
    name: b.name !== undefined ? b.name : existing.name,
    data: b.data !== undefined ? b.data : existing.data,
    status: b.status !== undefined ? b.status : existing.status,
    active: b.active !== undefined ? b.active : existing.active,
    starts_at: b.starts_at !== undefined ? b.starts_at : existing.starts_at,
    ends_at: b.ends_at !== undefined ? b.ends_at : existing.ends_at,
    priority: b.priority !== undefined ? b.priority : existing.priority,
  };
  const cleaned = cleanBlockInput(merged);
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });

  await client().execute({
    sql: `UPDATE content_blocks SET type=?, name=?, data=?, status=?, active=?,
          starts_at=?, ends_at=?, priority=?, updated_at=? WHERE id=?`,
    args: [cleaned.data.type, cleaned.data.name, cleaned.data.data, cleaned.data.status,
      cleaned.data.active, cleaned.data.starts_at, cleaned.data.ends_at,
      cleaned.data.priority, nowUTC(), id],
  });
  await logActivity('update', `content:${cleaned.data.type}`, id, cleaned.data.name);
  revalidateSite();
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/content/[id] — delete a block. */
export async function DELETE(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  if (!adminWriteLimit(req)) {
    return NextResponse.json({ error: 'Too many requests. Slow down.' }, { status: 429 });
  }
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
  }
  await ready();
  const existing = await getBlockById(id);
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  await client().execute({ sql: 'DELETE FROM content_blocks WHERE id = ?', args: [id] });
  await logActivity('delete', `content:${existing.type}`, id, existing.name);
  revalidateSite();
  return NextResponse.json({ ok: true });
}
