import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';
import { checkOrigin } from '@/lib/csrf';

export async function POST(req) {
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', clearSessionCookie());
  return res;
}
