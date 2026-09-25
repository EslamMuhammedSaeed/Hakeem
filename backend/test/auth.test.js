import assert from 'node:assert/strict';
import test from 'node:test';
import { clearSessionCookie, readCookie, sessionCookie } from '../src/lib/cookies.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { sessionMatches, signSession, verifySession } from '../src/lib/sessionToken.js';

const SECRET = 'test-secret-key-at-least-32-chars!!';

test('wrong password and unknown user both fail without a distinct result', async () => {
  const hash = await hashPassword('correct-horse');
  const wrong = await verifyPassword('nope', hash);
  const missing = await verifyPassword('nope', undefined);

  assert.equal(wrong, false);
  assert.equal(missing, false);
  assert.equal(await verifyPassword('correct-horse', hash), true);
});

test('a signed session verifies, a tampered token does not, and tokenVersion must match', async () => {
  const user = { id: 7, email: 'owner@localhost', tokenVersion: 2 };
  const token = await signSession(user, SECRET);
  const payload = await verifySession(token, SECRET);

  assert.equal(sessionMatches(payload, user), true);
  assert.equal(sessionMatches(payload, { ...user, tokenVersion: 3 }), false);
  assert.equal(sessionMatches(payload, null), false);

  const tampered = `${token.slice(0, -4)}aaaa`;
  await assert.rejects(() => verifySession(tampered, SECRET));
  await assert.rejects(() => verifySession(token, `${SECRET}-other`));
});

test('session cookie is HttpOnly and SameSite=Lax, and Secure only when asked', () => {
  const dev = sessionCookie('abc', { secure: false });
  assert.match(dev, /HttpOnly/);
  assert.match(dev, /SameSite=Lax/);
  assert.doesNotMatch(dev, /Secure/);
  assert.match(dev, /Max-Age=604800/);

  const prod = sessionCookie('abc', { secure: true });
  assert.match(prod, /Secure/);

  const cleared = clearSessionCookie({ secure: true });
  assert.match(cleared, /Max-Age=0/);
  assert.match(cleared, /Secure/);

  assert.equal(readCookie(dev), 'abc');
  assert.equal(readCookie('other=1; el_hakeem_session=a%20b'), 'a b');
  assert.equal(readCookie(undefined), null);
});
