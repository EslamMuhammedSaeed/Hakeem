import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import express from 'express';
import { clearSessionCookie, cookieSecure, readCookie, sessionCookie } from '../src/lib/cookies.js';
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
  const clearedOpen = clearSessionCookie({ secure: false });
  assert.match(clearedOpen, /Max-Age=0/);
  assert.doesNotMatch(clearedOpen, /Secure/);

  assert.equal(readCookie(dev), 'abc');
  assert.equal(readCookie('other=1; el_hakeem_session=a%20b'), 'a b');
  assert.equal(readCookie(undefined), null);
});

function cookieApp(mode) {
  const app = express();
  app.set('trust proxy', 1);
  app.post('/login', (req, res) => {
    res.setHeader('Set-Cookie', sessionCookie('tok', { secure: cookieSecure(mode, req.secure) }));
    res.end('ok');
  });
  app.post('/logout', (req, res) => {
    res.setHeader('Set-Cookie', clearSessionCookie({ secure: cookieSecure(mode, req.secure) }));
    res.end('ok');
  });
  return app;
}

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function setCookie(server, path, headers = {}) {
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers });
  return response.headers.get('set-cookie') ?? '';
}

test('COOKIE_SECURE auto follows http, https, and X-Forwarded-Proto; true and false are forced', async () => {
  assert.equal(cookieSecure('auto', false), false);
  assert.equal(cookieSecure('auto', true), true);
  assert.equal(cookieSecure('true', false), true);
  assert.equal(cookieSecure('false', true), false);

  const auto = await listen(cookieApp('auto'));
  const forcedOn = await listen(cookieApp('true'));
  const forcedOff = await listen(cookieApp('false'));
  try {
    const overHttp = await setCookie(auto, '/login');
    assert.match(overHttp, /HttpOnly/);
    assert.match(overHttp, /SameSite=Lax/);
    assert.match(overHttp, /Max-Age=604800/);
    assert.doesNotMatch(overHttp, /Secure/);

    const forwarded = await setCookie(auto, '/login', { 'X-Forwarded-Proto': 'https' });
    assert.match(forwarded, /Secure/);

    const directHttps = sessionCookie('tok', { secure: cookieSecure('auto', true) });
    assert.match(directHttps, /Secure/);

    const always = await setCookie(forcedOn, '/login');
    assert.match(always, /Secure/);
    const never = await setCookie(forcedOff, '/login', { 'X-Forwarded-Proto': 'https' });
    assert.doesNotMatch(never, /Secure/);

    const clearedHttp = await setCookie(auto, '/logout');
    assert.match(clearedHttp, /Max-Age=0/);
    assert.doesNotMatch(clearedHttp, /Secure/);
    const clearedHttps = await setCookie(auto, '/logout', { 'X-Forwarded-Proto': 'https' });
    assert.match(clearedHttps, /Max-Age=0/);
    assert.match(clearedHttps, /Secure/);
  } finally {
    auto.close();
    forcedOn.close();
    forcedOff.close();
  }
});
