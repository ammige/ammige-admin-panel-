import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

export function requireAdmin(req) {
  const ok = verifySession(req.headers.get('cookie') || '');
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized: admin login required.' }, { status: 401 });
  }
  return null;
}
