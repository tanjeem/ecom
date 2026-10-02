import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

// Reachable without a session. Webhooks authenticate themselves; cron jobs
// must carry Vercel's CRON_SECRET.
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/pathao/webhook'];

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  if (pathname.startsWith('/api/cron/')) {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get('authorization') === `Bearer ${secret}`) return NextResponse.next();
    // Fall through: a signed-in user may also trigger a cron job by hand
  }

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    // View-only logins may read anything but not change data or run jobs
    const writes = !['GET', 'HEAD', 'OPTIONS'].includes(req.method) || pathname.startsWith('/api/cron/');
    if (session.role === 'viewer' && pathname.startsWith('/api/') && writes) {
      return NextResponse.json({ error: 'This login is view-only.' }, { status: 403 });
    }
    const headers = new Headers(req.headers);
    headers.set('x-auth-user', session.user);
    headers.set('x-auth-role', session.role);
    return NextResponse.next({ request: { headers } });
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's static output and public files
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)'],
};
