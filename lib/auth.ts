// Login for the whole app. Users come from the AUTH_USERS env var as
// `username:pbkdf2.<iterations>.<salt>.<hash>[:viewer]` entries separated by
// `;` (create them with `node scripts/create-login.mjs`). A `:viewer` suffix
// makes a read-only login: it can see everything but change nothing. Sessions are HMAC-signed cookies
// keyed by AUTH_SECRET, verified in proxy.ts on every request.
//
// Uses only Web Crypto so it runs in the proxy and in route handlers alike.

export const SESSION_COOKIE = 'to_session';
export const SESSION_DAYS = 7;
export const REMEMBER_DAYS = 30;

const enc = new TextEncoder();

const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

/** Constant-time comparison so timing doesn't leak how much of a value matched. */
function safeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export const authConfigured = () => !!process.env.AUTH_SECRET && !!process.env.AUTH_USERS;

// ─── passwords ───────────────────────────────────────────────────────────────

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256));
}

export async function hashPassword(password: string, iterations = 210_000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2.${iterations}.${b64url(salt)}.${b64url(await pbkdf2(password, salt, iterations))}`;
}

async function verifyPassword(password: string, stored: string) {
  // `.` separator: `$` would be mangled by .env variable expansion
  const [scheme, iter, salt, hash] = stored.split('.');
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return false;
  return safeEqual(await pbkdf2(password, fromB64url(salt), Number(iter)), fromB64url(hash));
}

export type Role = 'admin' | 'viewer';

function users(): Map<string, { hash: string; role: Role }> {
  const map = new Map<string, { hash: string; role: Role }>();
  for (const entry of (process.env.AUTH_USERS || '').split(';')) {
    const [name, hash, role] = entry.split(':').map(x => x.trim());
    if (name && hash) map.set(name.toLowerCase(), { hash, role: role === 'viewer' ? 'viewer' : 'admin' });
  }
  return map;
}

/** Returns the canonical username on success. Always does the hashing work, so unknown users take as long as wrong passwords. */
export async function checkCredentials(username: string, password: string): Promise<string | null> {
  const name = username.trim().toLowerCase();
  const stored = users().get(name)?.hash;
  const ok = await verifyPassword(password, stored || 'pbkdf2.210000.AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  return stored && ok ? name : null;
}

// ─── sessions ────────────────────────────────────────────────────────────────

async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.AUTH_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export async function createSession(username: string, days: number) {
  const payload = b64url(enc.encode(JSON.stringify({ u: username, exp: Date.now() + days * 86_400_000 })));
  return `${payload}.${b64url(await hmac(payload))}`;
}

export async function verifySession(token: string | undefined | null): Promise<{ user: string; role: Role } | null> {
  if (!token || !process.env.AUTH_SECRET) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  try {
    if (!safeEqual(await hmac(payload), fromB64url(sig))) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    // A user removed from AUTH_USERS loses access immediately; role changes apply at once too
    const u = users().get(String(data.u));
    if (!u) return null;
    return { user: String(data.u), role: u.role };
  } catch {
    return null;
  }
}
