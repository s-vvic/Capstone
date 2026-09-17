import helmet from 'helmet';
import cors from 'cors';
import { env } from '../config/env.js';

/**
 * 보안 정책 미들웨어 설정 (NF-S-001: 외부 구간 HTTPS, 보안 헤더, CORS)
 */
export function configureSecurityMiddleware(app) {
  // 1. Helmet 기본 보안 헤더 (XSS, Clickjacking, MIME 스니핑 방지)
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. CORS 허용 (안드로이드 앱 및 웹 대시보드 허용)
  app.use(
    cors({
      origin: '*', // 실무 배포 시 특정 도메인으로 한정
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['Authorization'],
    })
  );

  // 3. 프로덕션 환경 HTTPS HSTS 및 리다이렉트 권고 미들웨어 (NF-S-001)
  app.use((req, res, next) => {
    if (env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
      if (!isHttps && req.headers.host) {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
    }
    next();
  });
}
