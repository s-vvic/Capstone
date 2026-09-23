import { Router } from 'express';
import { deviceController } from '../controllers/deviceController.js';
import { ptzController } from '../controllers/ptzController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validator } from '../middleware/validator.js';

const router = Router();

// 보드 등록 (POST /devices/register, ICD 2.2.2, SV-F-010)
router.post('/register', authenticate, validator.validateRegister, deviceController.register);

// 등록 보드 전체 목록 조회 (GET /devices, ICD 2.2.1, SV-F-011)
router.get('/', authenticate, deviceController.list);

// 특정 보드 상세 상태 및 스트림 URL 조회 (GET /devices/:deviceId/status, ICD 2.2.3)
router.get('/:deviceId/status', authenticate, deviceController.getStatus);

// 보드 정보 수정 (PATCH /devices/:deviceId, ICD 2.2.4, SV-F-012)
router.patch('/:deviceId', authenticate, deviceController.update);

// PTZ 제어 명령 (POST /devices/:deviceId/ptz, ICD 3.4.1, WC-F-033)
router.post('/:deviceId/ptz', authenticate, validator.validatePtz, ptzController.controlPtz);

export default router;
