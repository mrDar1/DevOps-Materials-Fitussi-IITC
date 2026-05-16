import './config/dns.js'; // must be first — sets DNS resolver before any lookup
import { createApp } from './app.js';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const start = async () => {
  await connectDatabase();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`Listening on http://localhost:${config.port} [${config.nodeEnv}]`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async (err) => {
      await disconnectDatabase().catch(() => undefined);
      if (err) {
        logger.error({ err }, 'Error during shutdown');
        process.exit(1);
      }
      process.exit(0);
    });
    setTimeout(() => {
      logger.warn('Forced exit after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

process.on('unhandledRejection', (reason) => logger.error({ reason }, 'Unhandled rejection'));
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
