import { Router } from 'express';
import { notificationSettingsController } from '../controllers/notificationSettingsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { validateNotificationSettings } from '../middleware/validator.js';

const router = Router();

// 알림 설정 API는 인증 필요 (ICD_v2 2.7)
router.use(authenticate);

// 1. 알림 설정 조회 (ICD_v2 2.7.1)
router.get('/settings', notificationSettingsController.getSettings);

// 2. 알림 설정 전체 저장 (ICD_v2 2.7.2)
router.put('/settings', validateNotificationSettings, notificationSettingsController.updateSettings);

export default router;
