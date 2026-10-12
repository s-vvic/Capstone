import helmet from 'helmet';
import cors from 'cors';

export function configureSecurityMiddleware(app) {
  // Helmet 보안 헤더 (NF-S-001)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS 설정 (NF-C-002: 브라우저 호환)
  app.use(
    cors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-plan'],
    })
  );
}
