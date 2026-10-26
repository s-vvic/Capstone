import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes, { vpnRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // 보안 및 파싱 미들웨어
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 통합 헬스체크
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'UP',
      component: 'Component 4: WireGuard VPN Controller',
      timestamp: new Date().toISOString(),
    });
  });

  // 라우트 등록: /vpn 및 /v1/vpn 둘 다 지원
  app.use('/v1', routes);
  app.use('/', routes);

  // 전역 에러 핸들러
  app.use(errorHandler);

  return app;
}

export { vpnRouter };
export default createApp;
