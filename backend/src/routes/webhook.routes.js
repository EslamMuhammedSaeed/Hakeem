import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireApiKey } from '../middleware/apiKey.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { serialize } from '../lib/serialize.js';
import { ingestNotification, webhookPayloadSchema } from '../services/notification.service.js';

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many notifications, slow down' },
});

export const webhookRouter = Router();

webhookRouter.post(
  '/notification',
  webhookLimiter,
  requireApiKey,
  asyncHandler(async (req, res) => {
    const payload = webhookPayloadSchema.parse(req.body ?? {});
    const result = await ingestNotification(payload);

    // Always 200 for accepted-but-unparsed text: the phone must not retry a
    // notification we have already stored just because no rule matched it.
    const status = result.status === 'REJECTED' ? 400 : 200;

    res.status(status).json(
      serialize({
        status: result.status,
        duplicate: result.status === 'DUPLICATE',
        notificationId: result.notification?.id ?? null,
        matchedRule: result.notification?.matchedRule ?? null,
        parseError: result.notification?.parseError ?? null,
        trade: result.trade ?? null,
        reason: result.reason ?? null,
      }),
    );
  }),
);

// Convenience endpoint for testing the forwarder without an API key check failure loop
webhookRouter.get('/ping', requireApiKey, (req, res) => {
  res.json({ ok: true, message: 'Webhook reachable and API key accepted', at: new Date().toISOString() });
});
