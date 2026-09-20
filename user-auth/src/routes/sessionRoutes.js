import { Router } from 'express';
import { sessionController } from '../controllers/sessionController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// 모든 세션 관리 라우트는 로그인 인증 필요
router.use(authenticate);

// 다중 기기 로그인 현황 목록 조회 (GET /auth/sessions, SV-F-004)
router.get('/', sessionController.getSessions);

// 현재 기기를 제외한 다른 모든 기기 일괄 로그아웃 (DELETE /auth/sessions/other, SV-F-004)
router.delete('/other', sessionController.revokeAllOtherSessions);

// 특정 기기 강제 로그아웃 (DELETE /auth/sessions/:sessionId, SV-F-004)
router.delete('/:sessionId', sessionController.revokeSession);

export default router;
