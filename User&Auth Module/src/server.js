import { createAuthApp } from './index.js';
import { env } from './config/env.js';
import { testDbConnection, closePool } from './config/database.js';
import { logger } from './utils/logger.js';

async function startServer() {
  const app = createAuthApp();

  // DB 연결 테스트
  const dbStatus = await testDbConnection();
  if (dbStatus.ok) {
    logger.info(`[Database] DB 연결 확인 완료: driver=${dbStatus.driver} ${dbStatus.version || ''}`);
  } else {
    logger.warn(`[Database] DB 연결 실패 (${dbStatus.error}). DB 설정을 확인하세요.`);
  }

  const server = app.listen(env.PORT, () => {
    logger.info('===========================================================');
    logger.info('  SecureCam Cloud Server - 사용자 및 인증 관리 모듈 (v1.0) ');
    logger.info('  - SPEC: FR/SV_F.md 3.2.1 (SV-F-001 ~ SV-F-005)');
    logger.info('  - NFR: NF-F-001(PostgreSQL 17.X), NF-F-004(Express.js)');
    logger.info('  - NFR: NF-S-001(HTTPS), NF-S-002(bcrypt), NF-S-003(JWT)');
    logger.info('  - ICD: ICD-01 2.1 인증 API, ICD 8.0 공통 오류 규격');
    logger.info(`  - Base URL: http://localhost:${env.PORT}/v1/auth`);
    logger.info(`  - Health Check: http://localhost:${env.PORT}/health`);
    logger.info(`  - DB Driver: ${env.DB_DRIVER}`);
    logger.info('===========================================================');
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('[Server] Graceful shutdown 시작...');
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
