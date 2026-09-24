import crypto from 'node:crypto';
import { env } from '../config/env.js';

const expected = Buffer.from(env.WEBHOOK_API_KEY, 'utf8');

function safeEqual(candidate) {
  const provided = Buffer.from(candidate, 'utf8');
  // timingSafeEqual throws on length mismatch, so compare lengths separately
  if (provided.length !== expected.length) {
    crypto.timingSafeEqual(expected, expected);
    return false;
  }
  return crypto.timingSafeEqual(provided, expected);
}

export function requireApiKey(req, res, next) {
  const header = req.get('x-api-key') ?? req.query.apiKey;
  const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const candidate = header || bearer;

  if (!candidate || !safeEqual(String(candidate))) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  return next();
}
