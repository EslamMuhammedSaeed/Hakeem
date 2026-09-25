import { SignJWT, jwtVerify } from 'jose';

const encoder = new TextEncoder();

export async function signSession(user, secret) {
  return new SignJWT({ email: user.email, tv: user.tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encoder.encode(secret));
}

export async function verifySession(token, secret) {
  const { payload } = await jwtVerify(token, encoder.encode(secret), { algorithms: ['HS256'] });
  return payload;
}

export function sessionMatches(payload, user) {
  if (!payload || !user) return false;
  return String(payload.sub) === String(user.id) && Number(payload.tv) === Number(user.tokenVersion);
}
