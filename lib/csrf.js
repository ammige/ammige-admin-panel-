import { NextResponse } from 'next/server';

/**
 * Defense-in-depth CSRF check for state-changing API routes.
 * The admin session cookie is SameSite=Lax, which already blocks most
 * cross-site cookie sends. This adds a second layer: if the request carries
 * an Origin or Referer header, its host must match the request Host.
 * Requests WITHOUT either header (curl, mobile apps, some privacy tools)
 * are allowed through so legitimate API use never breaks.
 */
function hostOf(urlStr) {
  try {
    return new URL(urlStr).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function checkOrigin(req) {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  if (origin) {
    const oh = hostOf(origin);
    if (oh && host && oh !== host) {
      return NextResponse.json({ error: 'Forbidden: origin mismatch.' }, { status: 403 });
    }
  } else if (referer) {
    const rh = hostOf(referer);
    if (rh && host && rh !== host) {
      return NextResponse.json({ error: 'Forbidden: referer mismatch.' }, { status: 403 });
    }
  }
  return null;
}
