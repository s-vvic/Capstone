import { createControllerApp } from './app.js';
import { env } from './config/env.js';

const app = createControllerApp();

const server = app.listen(env.PORT, () => {
  console.log(`[INFO]  ======================================================`);
  console.log(`[INFO]  SecureCam Master Controller & Gateway running on port ${env.PORT}`);
  console.log(`[INFO]  Integrated Components:`);
  console.log(`[INFO]    - Component 1: User & Auth (/auth)`);
  console.log(`[INFO]    - Component 2: Device & Heartbeat (/devices, /vpn)`);
  console.log(`[INFO]    - Component 3: Event & Notification (/events, /notifications)`);
  console.log(`[INFO]    - Component 5: Storage & Retention (/storage)`);
  console.log(`[INFO]  Base URL: ${env.API_BASE_URL}`);
  console.log(`[INFO]  DB Driver: ${env.DB_DRIVER}`);
  console.log(`[INFO]  ======================================================`);
});

function gracefulShutdown(signal) {
  console.log(`[INFO]  Received ${signal}, initiating graceful shutdown...`);
  server.close(() => {
    console.log('[INFO]  Master controller server terminated successfully.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
