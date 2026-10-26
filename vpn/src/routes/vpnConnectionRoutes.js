import { Router } from 'express';
import { vpnConnectionController } from '../controllers/vpnConnectionController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// 모든 VPN 연결 관리 API는 JWT 인증 필요
router.use('/connections', authenticate);

// 2.5.1 VPN 연결 상태 목록 조회
router.get('/connections', vpnConnectionController.listConnections);

// 특정 기기 VPN 연결 상태 조회
router.get('/connections/:deviceId', vpnConnectionController.getConnection);

// 2.5.2 VPN 수동 연결 / 끊기
router.post('/connections/:deviceId/action', vpnConnectionController.executeAction);

// 2.5.3 VPN 서버 복구 요청
router.post('/connections/:deviceId/recover', vpnConnectionController.recover);

export default router;
