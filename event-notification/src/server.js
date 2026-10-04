import { createEventNotificationApp } from './index.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { closeDatabasePool } from './config/database.js';

const app = createEventNotificationApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    `SecureCam Event Ingestion & Push Notification Engine running on port ${env.PORT} (${env.NODE_ENV})`
  );
  logger.info(`Base URL: ${env.API_BASE_URL}`);
  logger.info(`DB Driver: ${env.DB_DRIVER}`);
});

async function shutdown() {
  logger.info('Graceful shutdown initiated...');
  server.close(async () => {
    await closeDatabasePool();
    logger.info('Server terminated successfully.');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
