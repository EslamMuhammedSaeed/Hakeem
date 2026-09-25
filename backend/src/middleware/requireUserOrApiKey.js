import { apiKeyFromRequest, apiKeyMatches } from './apiKey.js';
import { readCookie } from '../lib/cookies.js';
import { userFromSessionToken } from '../services/auth.service.js';

/**
 * Dashboard credential: a valid session cookie, or the existing webhook API key
 * (header, bearer, or `?apiKey=` for non-browser clients). A bad cookie does not
 * reject a request that also carries a valid key.
 */
export function requireUserOrApiKey(req, res, next) {
  Promise.resolve()
    .then(async () => {
      const token = readCookie(req.headers.cookie);
      const user = await userFromSessionToken(token);
      if (user) return { kind: 'user', userId: user.id };

      if (apiKeyMatches(apiKeyFromRequest(req))) return { kind: 'apiKey' };
      return null;
    })
    .then((auth) => {
      if (!auth) {
        res.status(401).json({ error: 'Unauthenticated', code: 'UNAUTHENTICATED' });
        return;
      }
      req.auth = auth;
      next();
    })
    .catch(next);
}
