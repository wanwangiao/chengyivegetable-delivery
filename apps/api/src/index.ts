import { validateEnv } from './config/env-validator';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from '@chengyi/lib';

// Validate environment variables before starting the application
validateEnv();

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info({ port: env.port }, 'API server started');
});

const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

signals.forEach(signal => {
  process.on(signal, () => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
});
