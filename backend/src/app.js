import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { requireAccess } from './middleware/access.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.routes.js';
import { webhookRouter } from './routes/webhook.routes.js';
import { tradesRouter } from './routes/trades.routes.js';
import { portfolioRouter } from './routes/portfolio.routes.js';
import { notificationsRouter, parseRouter } from './routes/notifications.routes.js';
import { instrumentsRouter } from './routes/instruments.routes.js';
import { streamRouter } from './routes/stream.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(
    helmet({
      // The dashboard is a different port on the same host. same-origin CORP would
      // block those credentialed fetches even when CORS allows the origin.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients (the phone, curl) send no Origin header
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' || req.url.startsWith('/api/stream') },
      redact: {
        paths: ['req.headers["x-api-key"]', 'req.headers.authorization', 'req.headers.cookie', 'req.query.apiKey'],
        censor: '[redacted]',
      },
    }),
  );

  app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime(), at: new Date().toISOString() }));

  app.use('/api/webhook', webhookRouter);
  app.use('/api/auth', authRouter);

  // Writes always need a session or the API key. Reads are public unless
  // REQUIRE_AUTH_FOR_READS is set. The webhook router above keeps its own key check.
  app.use('/api/stream', requireAccess, streamRouter);
  app.use('/api/trades', requireAccess, tradesRouter);
  app.use('/api/portfolio', requireAccess, portfolioRouter);
  app.use('/api/notifications', requireAccess, notificationsRouter);
  app.use('/api/instruments', requireAccess, instrumentsRouter);
  app.use('/api/parse', requireAccess, parseRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
