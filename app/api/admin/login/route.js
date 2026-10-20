import { NextResponse } from 'next/server';
import { getSetting } from '@/lib/db';
import { issueSessionCookie } from '@/lib/auth';
import { checkRate } from '@/lib/rate-limit';
import { checkOrigin } from '@/lib/csrf';

export async function POST(req) {
  // Brute-force protection: 8 attempts per 10 minutes per IP
  if (!checkRate(req, { windowMs: 10 * 60 * 1000, max: 8, scope: 'admin-login' })) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }
  const badOrigin = checkOrigin(req);
  if (badOrigin) return badOrigin;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const { password } = body || {};
  // Password source: env var first (operator-controlled), then DB setting.
  // NEVER a hardcoded default in production (fail closed if nothing configured).
  let expected = process.env.AMMIGE_ADMIN_PASSWORD || '';
  if (!expected) expected = await getSetting('admin_password');
  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Server misconfigured: admin password not set.' }, { status: 503 });
    }
    expected = 'ammige123'; // local dev only
  }
  if (typeof password === 'string' && password === expected && password.length > 0) {
    const res = NextResponse.json({ ok: true });
    res.headers.set('Set-Cookie', issueSessionCookie());
    return res;
  }
  return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
}
