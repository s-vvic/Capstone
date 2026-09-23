import { createDeviceHeartbeatApp } from './index.js';
import { env } from './config/env.js';
import { testDbConnection, closePool } from './config/database.js';
import { heartbeatMonitor } from './services/heartbeatMonitor.js';
import { logger } from './utils/logger.js';

async function startServer() {
  const app = createDeviceHeartbeatApp();

  // DB 연결 확인
  const dbStatus = await testDbConnection();
  if (dbStatus.ok) {
    logger.info(`[Database] DB 연결 확인 완료: driver=${dbStatus.driver} ${dbStatus.version || ''}`);
  } else {
    logger.warn(`[Database] DB 연결 실패 (${dbStatus.error}). DB 설정을 확인하세요.`);
  }

  // 백그라운드 생존 감시 데몬 시작 (SV-F-011)
  heartbeatMonitor.start();

  const server = app.listen(env.PORT, () => {
    logger.info('===========================================================');
    logger.info(' SecureCam Cloud Server - Component 2: 보드 생존 관리 모듈 ');
    logger.info(' - SPEC: FR/SV_F.md 3.2.2 (SV-F-010 ~ SV-F-014)');
    logger.info(' - NFR: NF-F-001(PostgreSQL 17.X), NF-P-003(30s Heartbeat)');
    logger.info(' - ICD: ICD-01 2.2/2.5, ICD-02 3.1/3.2, ICD-03 3.4');
    logger.info(` - Base URL: http://localhost:${env.PORT}/v1`);
    logger.info(` - Health Check: http://localhost:${env.PORT}/health`);
    logger.info(` - DB Driver: ${env.DB_DRIVER}`);
    logger.info(` - Heartbeat Interval: ${env.HEARTBEAT_INTERVAL_SECONDS}s, Timeout: ${env.OFFLINE_TIMEOUT_SECONDS}s`);
    logger.info('===========================================================');
  });

  const shutdown = async () => {
    logger.info('[Server] Graceful shutdown 시작...');
    heartbeatMonitor.stop();
    server.close(async () => {
      await closePool();
      logger.info('[Server] 서버 및 DB 풀 종료 완료.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  logger.error('[Server] 서버 시작 실패:', err);
  process.exit(1);
});
