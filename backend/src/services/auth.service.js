import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword, warmPasswordCheck } from '../lib/password.js';
import { sessionMatches, signSession, verifySession } from '../lib/sessionToken.js';

export async function ensureSeedUser() {
  await warmPasswordCheck();
  const existing = await prisma.user.count();
  if (existing > 0) {
    logger.info('User already present, skipping seed');
    return;
  }

  await prisma.user.create({
    data: {
      email: env.SEED_USER_EMAIL,
      passwordHash: await hashPassword(env.SEED_USER_PASSWORD),
    },
  });
  logger.info({ email: env.SEED_USER_EMAIL }, 'Seeded default user');
}

export async function authenticate(email, password) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!ok || !user) return null;
  return user;
}

export async function userFromSessionToken(token) {
  if (!token) return null;

  let payload;
  try {
    payload = await verifySession(token, env.JWT_SECRET);
  } catch {
    return null;
  }

  const id = Number(payload.sub);
  if (!Number.isInteger(id)) return null;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!sessionMatches(payload, user)) return null;
  return user;
}

export function issueSession(user) {
  return signSession(user, env.JWT_SECRET);
}
