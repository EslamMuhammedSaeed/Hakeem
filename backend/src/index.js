import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { disconnectPrisma, prisma } from './lib/prisma.js';
import { ensureSeedUser } from './services/auth.service.js';

const app = createApp();

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection verified');
    await ensureSeedUser();
  } catch (error) {
    logger.error(
      { err: error },
      'Could not reach MySQL. Check DATABASE_URL and that the server is running, then run: npx prisma migrate dev',
    );
    process.exit(1);
  }

  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`API listening on http://localhost:${env.PORT} (also reachable on your LAN IP for the phone)`);
  });

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down');
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
