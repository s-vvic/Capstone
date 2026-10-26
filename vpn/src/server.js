import { createApp } from './app.js';
import { config } from './config/env.js';
import { vpnHealthMonitor } from './services/vpnHealthMonitor.js';
import { logger } from './utils/logger.js';
import { closeDatabasePool } from './config/database.js';

const app = createApp();
const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`========================================================`);
  logger.info(`SecureCam Component 4: WireGuard VPN Controller 실행 중`);
  logger.info(`- 포트: ${PORT}`);
  logger.info(`- 환경: ${config.nodeEnv}`);
  logger.info(`- DB 드라이버: ${config.dbDriver}`);
  logger.info(`- WireGuard 드라이버: ${config.wgDriver}`);
  logger.info(`- 서버 엔드포인트: ${config.wgServerEndpoint}`);
  logger.info(`- IP 풀: ${config.ipPoolStart} ~ ${config.ipPoolEnd}`);
  logger.info(`========================================================`);

  // 백그라운드 헬스체크 모니터 시작
  vpnHealthMonitor.start();
});

// Graceful Shutdown
async function handleShutdown(signal) {
  logger.info(`[Server] ${signal} 시그널 수신, 안전하게 종료를 시작합니다.`);
  vpnHealthMonitor.stop();

  server.close(async () => {
    logger.info('[Server] HTTP 서버 리스너가 종료되었습니다.');
    await closeDatabasePool();
    logger.info('[Server] 프로세스가 정상 종료되었습니다.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
