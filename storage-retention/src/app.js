// Express 앱 조립 (listen은 server.js에서) — 테스트에서도 이 함수로 앱을 만듦
import express from 'express';
import { authenticate } from './middleware/authMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';
import { createStorageRouter } from './routes/storageRoutes.js';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Component 3 · 저장소 관리
  app.use('/v1/storage', createStorageRouter({ authenticate }));

  // 오류 처리는 항상 맨 마지막
  app.use(errorHandler);
  return app;
}