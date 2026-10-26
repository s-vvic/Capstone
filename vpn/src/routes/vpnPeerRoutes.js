import { Router } from 'express';
import { vpnPeerController } from '../controllers/vpnPeerController.js';
import { authenticate, optionalAuthenticate } from '../middleware/authMiddleware.js';

const router = Router();

// 서버 상태 및 통계 (공개 또는 옵션 인증)
router.get('/status', optionalAuthenticate, vpnPeerController.getStatus);

// 피어 등록 (보드 프로비저닝 또는 앱 등록)
router.post('/peers/register', optionalAuthenticate, vpnPeerController.register);

// 피어 해제 (인증 필요)
router.delete('/peers/:peerId', authenticate, vpnPeerController.unregister);

// 피어 WireGuard 클라이언트 설정 파일 다운로드 (인증 필요)
router.get('/peers/:peerId/config', optionalAuthenticate, vpnPeerController.getConfig);

export default router;
