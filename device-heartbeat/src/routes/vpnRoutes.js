import { Router } from 'express';
import { vpnController } from '../controllers/vpnController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validator } from '../middleware/validator.js';

const router = Router();

// 등록 기기의 VPN 연결 상태 전체 조회 (GET /vpn/connections, ICD 2.5.1, SV-F-014)
router.get('/connections', authenticate, vpnController.listConnections);

// 특정 기기 VPN 수동 연결 / 끊기 (POST /vpn/connections/:deviceId/action, ICD 2.5.2, SV-F-014)
router.post('/connections/:deviceId/action', authenticate, validator.validateVpnAction, vpnController.executeAction);

export default router;
