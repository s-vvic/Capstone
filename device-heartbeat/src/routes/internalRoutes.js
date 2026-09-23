import { Router } from 'express';
import { internalDeviceController } from '../controllers/internalDeviceController.js';
import { validator } from '../middleware/validator.js';

const router = Router();

// 보드 최초 부팅 시 프로비저닝 요청 (POST /devices/provision-by-serial, ICD 3.1.1)
router.post('/provision-by-serial', validator.validateProvision, internalDeviceController.provision);

// 보드 30초 주기 Heartbeat 수신 (POST /devices/heartbeat, ICD 3.2.1, SV-F-013)
router.post('/heartbeat', validator.validateHeartbeat, internalDeviceController.heartbeat);

export default router;
