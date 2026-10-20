import { NextResponse } from 'next/server';
import { client, ready } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { checkOrigin } from '@/lib/csrf';

/** Admin: popup stats totals. */
export async function GET(req, { params }) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  const id = parseInt(params.id, 10);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  await ready();
  const r = await client().execute({
    sql: `SELECT event, COUNT(*) AS n FROM content_stats WHERE content_id = ? GROUP BY event`,
    args: [id],
  });
  const totals = {};
  for (const row of r.rows) totals[row.event] = Number(row.n);
  return NextResponse.json({ totals });
}
