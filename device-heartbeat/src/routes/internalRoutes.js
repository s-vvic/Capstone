import { Router } from 'express';
import { internalDeviceController } from '../controllers/internalDeviceController.js';
import { validator } from '../middleware/validator.js';

const router = Router();

// 보드 최초 부팅 시 프로비저닝 요청 (ICD_v2 3.1.1: provision-by-mac, SV-F-015 MAC 기반 식별 번호 부여)
router.post('/provision-by-mac', validator.validateProvision, internalDeviceController.provision);

// 하위 호환 프로비저닝 경로 (POST /devices/provision-by-serial, ICD v1)
router.post('/provision-by-serial', validator.validateProvision, internalDeviceController.provision);

// 보드 30초 주기 Heartbeat 수신 (POST /devices/heartbeat, ICD_v2 3.2.1, SV-F-013)
router.post('/heartbeat', validator.validateHeartbeat, internalDeviceController.heartbeat);

export default router;
