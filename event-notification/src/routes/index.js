import { Router } from 'express';
import eventRoutes from './eventRoutes.js';
import boardRoutes from './boardRoutes.js';
import notificationRoutes from './notificationRoutes.js';

const router = Router();

// 1. 보드 내부 이벤트 보고 라우트 (ICD_v2 3.3: POST /events/report)
router.use('/events', boardRoutes);

// 2. 클라이언트 이벤트 조회 및 관리 라우트 (ICD_v2 2.3: GET /events, PATCH /events/...)
router.use('/events', eventRoutes);

// 3. 알림 설정 라우트 (ICD_v2 2.7: /notifications/settings)
router.use('/notifications', notificationRoutes);

export default router;
