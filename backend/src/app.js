import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { requireApiKey } from './middleware/apiKey.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { webhookRouter } from './routes/webhook.routes.js';
import { tradesRouter } from './routes/trades.routes.js';
import { portfolioRouter } from './routes/portfolio.routes.js';
import { notificationsRouter, parseRouter } from './routes/notifications.routes.js';
import { instrumentsRouter } from './routes/instruments.routes.js';
import { streamRouter } from './routes/stream.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Non-browser clients (the phone, curl) send no Origin header
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed`));
      },
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' || req.url.startsWith('/api/stream') },
      redact: { paths: ['req.headers["x-api-key"]', 'req.headers.authorization'], censor: '[redacted]' },
    }),
  );

  app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime(), at: new Date().toISOString() }));

  app.use('/api/webhook', webhookRouter);

  // Everything the dashboard reads shares the same key
  app.use('/api/stream', requireApiKey, streamRouter);
  app.use('/api/trades', requireApiKey, tradesRouter);
  app.use('/api/portfolio', requireApiKey, portfolioRouter);
  app.use('/api/notifications', requireApiKey, notificationsRouter);
  app.use('/api/instruments', requireApiKey, instrumentsRouter);
  app.use('/api/parse', requireApiKey, parseRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
