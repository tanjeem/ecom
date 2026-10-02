import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCredentials, createSession, hashPassword, verifySession } from '../auth';

test('view-only suffix gives a viewer role; plain entries are admins', async () => {
  process.env.AUTH_SECRET = 'test-secret';
  process.env.AUTH_USERS = `owner:${await hashPassword('owner-pass-123', 1000)};partner:${await hashPassword('partner-pass-123', 1000)}:viewer`;

  assert.equal(await checkCredentials('Partner', 'partner-pass-123'), 'partner');
  assert.equal(await checkCredentials('partner', 'wrong-password'), null);

  const viewer = await verifySession(await createSession('partner', 1));
  assert.deepEqual(viewer, { user: 'partner', role: 'viewer' });
  const admin = await verifySession(await createSession('owner', 1));
  assert.deepEqual(admin, { user: 'owner', role: 'admin' });
});

test('sessions fail when tampered with or the user is removed', async () => {
  process.env.AUTH_SECRET = 'test-secret';
  process.env.AUTH_USERS = `owner:${await hashPassword('owner-pass-123', 1000)}`;
  const token = await createSession('owner', 1);
  assert.equal(await verifySession(token.slice(0, -2) + 'xx'), null);
  process.env.AUTH_USERS = '';
  assert.equal(await verifySession(token), null);
});
