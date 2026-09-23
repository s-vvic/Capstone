import helmet from 'helmet';
import cors from 'cors';
import { env } from '../config/env.js';

/**
 * 보안 정책 미들웨어 설정 (NF-S-001)
 */
export function configureSecurityMiddleware(app) {
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-user-id'],
      exposedHeaders: ['Authorization'],
    })
  );

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
