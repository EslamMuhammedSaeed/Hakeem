import { env } from '../config/env.js';
import { requireUserOrApiKey } from './requireUserOrApiKey.js';

/**
 * Preview does not write a notification or a trade. It is a read of the rule
 * table, so the playground follows the same switch as the other reads.
 */
export function isOpenRead(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const path = req.originalUrl.split('?')[0];
  return req.method === 'POST' && path === '/api/parse/preview';
}

export function requireAccess(req, res, next) {
  if (!env.REQUIRE_AUTH_FOR_READS && isOpenRead(req)) return next();
  return requireUserOrApiKey(req, res, next);
}
