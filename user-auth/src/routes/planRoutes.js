import { Router } from 'express';
import { planController } from '../controllers/planController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// 전체 플랜 비교 목록 (인증 없이도 플랜 안내 페이지 조회 가능)
router.get('/tiers', planController.getAllPlans);

// 사용자 플랜 조회 (GET /auth/plan, SV-F-005)
router.get('/', authenticate, planController.getMyPlan);

// 사용자 플랜 변경 (PATCH /auth/plan, SV-F-005)
router.patch('/', authenticate, planController.changePlan);

export default router;
