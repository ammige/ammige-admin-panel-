import { NextResponse } from 'next/server';
import { SITE_MODE } from './lib/site-mode';

/**
 * SITE_MODE splits the single codebase into two isolated deployments.
 * Set per-deployment in lib/site-mode.js (rewritten by the deploy script):
 *  - 'storefront' : public shop only. /admin and /api/admin/* -> 404.
 *  - 'admin'      : admin panel only. Everything except /admin*,
 *                   /api/admin/* and public assets -> 404 ("/" redirects to /admin).
 *  - 'full'       : everything served (local dev default).
 */
export function middleware(req) {
  const mode = SITE_MODE;
  const { pathname } = req.nextUrl;

  // Tell the root layout which path is being rendered, so /admin can
  // skip the storefront chrome (header/footer/cart/WhatsApp) entirely.
  const pass = () => {
    const res = NextResponse.next();
    res.headers.set('x-pathname', pathname);
    return res;
  };

  if (mode === 'storefront') {
    if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/')) {
      return new NextResponse('Not found', { status: 404 });
    }
    return pass();
  }

  if (mode === 'admin') {
    if (pathname === '/') {
      const url = req.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
    const ok =
      pathname === '/admin' ||
      pathname.startsWith('/admin/') ||
      pathname.startsWith('/api/admin/') ||
      pathname.startsWith('/images/') ||
      pathname === '/icon.svg';
    if (!ok) return new NextResponse('Not found', { status: 404 });
    return pass();
  }

  return pass();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
