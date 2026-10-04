import express from 'express';
import { configureSecurityMiddleware } from './middleware/securityMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

// Config
export * from './config/env.js';
export * from './config/database.js';

// Constants & Errors
export * from './constants/errorCodes.js';
export * from './constants/eventTypes.js';
export * from './errors/AppError.js';

// Utilities
export * from './utils/logger.js';
export * from './utils/snapshotStorage.js';
export * from './utils/fcmPayloadBuilder.js';

// Repositories
export * from './repositories/index.js';

// Services
export * from './services/eventService.js';
export * from './services/notificationSettingsService.js';
export * from './services/fcmNotificationService.js';

// Middleware
export * from './middleware/authMiddleware.js';
export * from './middleware/validator.js';
export * from './middleware/errorHandler.js';

/**
 * 모듈형 Express 애플리케이션 팩토리 함수
 * 메인 서버에서 app.use(createEventNotificationApp()) 또는 독립 서버 구동 지원
 */
export function createEventNotificationApp() {
  const app = express();

  // JSON 및 URL-encoded 본문 파싱 (Base64 스냅샷을 고려하여 15MB 한도 설정)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // 보안 미들웨어 설정 (NF-S-001)
  configureSecurityMiddleware(app);

  // 헬스체크 엔드포인트 (NF-A-001)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'securecam-event-notification-module',
    });
  });

  // ICD-01 베이스 URL 규격 지원: /v1 및 루트 / 모두 라우팅
  app.use('/v1', routes);
  app.use('/', routes);

  // 404 및 ICD 8.0 표준 오류 핸들러
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createEventNotificationApp;
