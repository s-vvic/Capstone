import { Router } from 'express';
import { eventController } from '../controllers/eventController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import {
  validateEventStatusUpdate,
  validateBatchConfirm,
} from '../middleware/validator.js';

const router = Router();

// 모든 이벤트 조회/관리 API는 인증 필요 (ICD_v2 2.3)
router.use(authenticate);

// 1. 이벤트 목록 조회
router.get('/', eventController.listEvents);

// 2. 대시보드 통계 요약
router.get('/summary', eventController.getSummary);

// 3. 이벤트 다중/일괄 확인 처리 (WEB-F-033, APP-F-034)
router.patch('/batch', validateBatchConfirm, eventController.batchConfirm);

// 4. 개별 이벤트 상태 갱신 (확인 처리, 중요, 메모)
router.patch('/:eventId', validateEventStatusUpdate, eventController.updateEvent);

export default router;
