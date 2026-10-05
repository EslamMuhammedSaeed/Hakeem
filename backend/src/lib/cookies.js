export const SESSION_COOKIE = 'el_hakeem_session';
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

/**
 * `auto` follows the request: Express `req.secure` is true for a TLS connection
 * and, with `trust proxy`, for `X-Forwarded-Proto: https`.
 */
export function cookieSecure(mode, requestIsSecure) {
  if (mode === 'true') return true;
  if (mode === 'false') return false;
  return Boolean(requestIsSecure);
}

export function sessionCookie(token, { secure = false, maxAge = SESSION_MAX_AGE } = {}) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie({ secure = false } = {}) {
  return sessionCookie('', { secure, maxAge: 0 });
}

export function readCookie(header, name = SESSION_COOKIE) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}
