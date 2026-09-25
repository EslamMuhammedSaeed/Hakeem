import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { emailSchema } from '../lib/email.js';
import { clearSessionCookie, readCookie, sessionCookie } from '../lib/cookies.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { authenticate, issueSession, userFromSessionToken } from '../services/auth.service.js';

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts', code: 'RATE_LIMITED' },
});

export const authRouter = Router();

authRouter.get('/config', (req, res) => {
  res.json({ requireAuthForReads: env.REQUIRE_AUTH_FOR_READS });
});

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body ?? {});
    const user = await authenticate(input.email, input.password);
    if (!user) throw new HttpError(401, 'Invalid email or password', undefined, 'INVALID_CREDENTIALS');

    const token = await issueSession(user);
    res.setHeader('Set-Cookie', sessionCookie(token, { secure: env.isProduction }));
    res.json({ email: user.email });
  }),
);

authRouter.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', clearSessionCookie({ secure: env.isProduction }));
  res.status(204).end();
});

authRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await userFromSessionToken(readCookie(req.headers.cookie));
    if (!user) throw new HttpError(401, 'Unauthenticated', undefined, 'UNAUTHENTICATED');
    res.json({ email: user.email });
  }),
);
