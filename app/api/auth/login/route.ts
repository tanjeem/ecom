import { NextRequest, NextResponse } from 'next/server';
import { authConfigured, checkCredentials, createSession, REMEMBER_DAYS, SESSION_COOKIE, SESSION_DAYS } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Best-effort brute-force brake: 8 failed attempts per IP per 15 minutes.
// In-memory, so it resets on deploy — enough to stop casual guessing.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;
const fails = new Map<string, { count: number; first: number }>();

const clientIp = (req: NextRequest) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

export async function POST(req: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json({ error: 'Login is not set up on this server. Run scripts/create-login.mjs and add AUTH_SECRET / AUTH_USERS.' }, { status: 503 });
  }

  const ip = clientIp(req);
  const rec = fails.get(ip);
  if (rec && Date.now() - rec.first < WINDOW_MS && rec.count >= MAX_FAILS) {
    const mins = Math.ceil((WINDOW_MS - (Date.now() - rec.first)) / 60000);
    return NextResponse.json({ error: `Too many attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.` }, { status: 429 });
  }

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }); }
  const username = String(body?.username || '');
  const password = String(body?.password || '');
  const user = username && password ? await checkCredentials(username, password) : null;

  if (!user) {
    const r = rec && Date.now() - rec.first < WINDOW_MS ? rec : { count: 0, first: Date.now() };
    r.count++;
    fails.set(ip, r);
    return NextResponse.json({ error: 'Wrong username or password' }, { status: 401 });
  }

  fails.delete(ip);
  const days = body?.remember ? REMEMBER_DAYS : SESSION_DAYS;
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(SESSION_COOKIE, await createSession(user, days), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: days * 86_400,
  });
  return res;
}
