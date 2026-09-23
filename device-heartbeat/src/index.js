import express from 'express';
import { configureSecurityMiddleware } from './middleware/securityMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

// Config
export * from './config/env.js';
export * from './config/database.js';

// Constants & Errors
export * from './constants/errorCodes.js';
export * from './errors/AppError.js';

// Utilities
export * from './utils/logger.js';
export * from './utils/tokenGenerator.js';
export * from './utils/vpnIpAllocator.js';

// Repositories
export * from './repositories/index.js';

// Services
export * from './services/deviceService.js';
export * from './services/heartbeatService.js';
export * from './services/heartbeatMonitor.js';
export * from './services/vpnStatusService.js';
export * from './services/ptzService.js';

// Middleware
export * from './middleware/authMiddleware.js';
export * from './middleware/validator.js';
export * from './middleware/errorHandler.js';

/**
 * 모듈형 Express 애플리케이션 팩토리 함수
 * 메인 서버에서 app.use(createDeviceHeartbeatApp()) 또는 단독 서버에서 실행 가능
 */
export function createDeviceHeartbeatApp() {
  const app = express();

  // JSON 및 URL-encoded 파서
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 보안 미들웨어 설정 (NF-S-001)
  configureSecurityMiddleware(app);

  // 헬스체크 엔드포인트 (NF-A-001)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'securecam-device-heartbeat-module',
    });
  });

  // ICD-01 베이스 URL 규격 지원: /v1 및 루트 / 모두 지원
  app.use('/v1', routes);
  app.use('/', routes);

  // 404 및 ICD 8.0 표준 오류 핸들러
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createDeviceHeartbeatApp;
