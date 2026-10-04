import { Router } from 'express';
import { boardEventController } from '../controllers/boardEventController.js';
import { validateEventReport } from '../middleware/validator.js';

const router = Router();

// 보드 이벤트 보고 수신 (ICD_v2 3.3.1)
router.post('/report', validateEventReport, boardEventController.reportEvent);

export default router;
