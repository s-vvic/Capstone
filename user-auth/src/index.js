import express from 'express';
import { configureSecurityMiddleware } from './middleware/securityMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

// Configuration
export * from './config/env.js';
export * from './config/plans.js';
export * from './config/database.js';

// Constants & Errors
export * from './constants/errorCodes.js';
export * from './errors/AppError.js';

// Utilities
export * from './utils/logger.js';
export * from './utils/password.js';
export * from './utils/jwt.js';

// Repositories
export * from './repositories/index.js';

// Services
export * from './services/authService.js';
export * from './services/accountService.js';
export * from './services/sessionService.js';
export * from './services/planService.js';

// Middleware
export * from './middleware/authMiddleware.js';
export * from './middleware/planMiddleware.js';
export * from './middleware/rateLimiter.js';
export * from './middleware/errorHandler.js';
export * from './middleware/validator.js';

/**
 * 모듈형 Express 애플리케이션 팩토리 함수
 * 메인 서버에서 app.use('/api', createAuthApp()) 또는 단독 서버에서 사용 가능
 */
export function createAuthApp() {
  const app = express();

  // JSON 파서 및 URL 인코딩 파서 (UTF-8, ICD 1.3)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 보안 미들웨어 설정 (NF-S-001)
  configureSecurityMiddleware(app);

  // 헬스체크 엔드포인트 (NF-A-001 가용성)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'securecam-user-auth-module',
    });
  });

  // ICD-01 베이스 URL 규격 지원: /v1 및 루트 / 모두 라우팅 매핑
  app.use('/v1', routes);
  app.use('/', routes);

  // 404 및 ICD 8.0 표준 에러 핸들러
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createAuthApp;
