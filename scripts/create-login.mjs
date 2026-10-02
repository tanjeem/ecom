// Adds or updates a login in .env.local (AUTH_USERS), creating AUTH_SECRET
// and CRON_SECRET on first run. Passwords are stored only as PBKDF2 hashes.
//
// Usage: node scripts/create-login.mjs <username> [password]
//   Omit the password to type it hidden. Copy the printed AUTH_* values into
//   Vercel → Settings → Environment Variables for production.

import fs from 'fs';
import path from 'path';
import { webcrypto as crypto } from 'crypto';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env.local');

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');

async function hashPassword(password, iterations = 210_000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return `pbkdf2.${iterations}.${b64url(salt)}.${b64url(new Uint8Array(bits))}`;
}

function readHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    let value = '';
    stdin.on('data', (buf) => {
      for (const ch of buf.toString('utf8')) {
        if (ch === '\r' || ch === '\n') { stdin.setRawMode?.(false); stdin.pause(); process.stdout.write('\n'); resolve(value); return; }
        if (ch === '\u0003') process.exit(1);
        if (ch === '\u007f') value = value.slice(0, -1); else value += ch;
      }
    });
  });
}

const username = (process.argv[2] || '').trim().toLowerCase();
if (!/^[a-z0-9._@-]{2,64}$/.test(username)) {
  console.error('Usage: node scripts/create-login.mjs <username> [password]   (letters, digits, . _ @ -)');
  process.exit(1);
}
const password = process.argv[3] ?? await readHidden(`Password for ${username}: `);
if (password.length < 10) { console.error('Use at least 10 characters.'); process.exit(1); }

let env = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.replace(/^["']|["']$/g, '');
const set = (k, v) => {
  const line = `${k}="${v}"`;
  env = env.match(new RegExp(`^${k}=`, 'm')) ? env.replace(new RegExp(`^${k}=.*$`, 'm'), line) : `${env.replace(/\n?$/, '\n')}${line}\n`;
};

if (!get('AUTH_SECRET')) set('AUTH_SECRET', b64url(crypto.getRandomValues(new Uint8Array(32))));
if (!get('CRON_SECRET')) set('CRON_SECRET', b64url(crypto.getRandomValues(new Uint8Array(24))));

const users = new Map((get('AUTH_USERS') || '').split(';').filter(Boolean).map((e) => [e.slice(0, e.indexOf(':')), e.slice(e.indexOf(':') + 1)]));
const existed = users.has(username);
users.set(username, await hashPassword(password));
set('AUTH_USERS', [...users].map(([u, h]) => `${u}:${h}`).join(';'));

fs.writeFileSync(ENV, env);
console.log(`${existed ? 'Updated' : 'Added'} login "${username}" in .env.local (${users.size} user${users.size > 1 ? 's' : ''}).`);
console.log('Restart the dev server, and set AUTH_SECRET, AUTH_USERS and CRON_SECRET in Vercel for production.');
