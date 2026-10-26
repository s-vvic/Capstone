import express from 'express';
import { configureSecurityMiddleware } from './middleware/securityMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';
import { env } from './config/env.js';

export function createControllerApp() {
  const app = express();

  // JSON 및 URL-encoded 파서 (Base64 스냅샷 등 미디어 전송 고려 15MB 한도)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // 보안 미들웨어 설정 (Helmet, CORS)
  configureSecurityMiddleware(app);

  // 통합 헬스체크 엔드포인트 (NF-A-001)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'securecam-master-controller',
      components: {
        component_1_user_auth: 'UP',
        component_2_device_heartbeat: 'UP',
        component_3_event_notification: 'UP',
        component_4_wireguard_vpn: 'UP',
        component_5_storage_retention: 'UP',
      },
      environment: {
        node_env: env.NODE_ENV,
        db_driver: env.DB_DRIVER,
      },
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

export default createControllerApp;
