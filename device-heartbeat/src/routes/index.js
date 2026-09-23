import { Router } from 'express';
import internalRoutes from './internalRoutes.js';
import deviceRoutes from './deviceRoutes.js';
import vpnRoutes from './vpnRoutes.js';

const router = Router();

// /devices 라우트 마운트 (internalRoutes가 먼저 평가되어 /heartbeat, /provision-by-serial이 :deviceId로 인식되지 않도록 함)
router.use('/devices', internalRoutes);
router.use('/devices', deviceRoutes);

// /vpn 라우트 마운트
router.use('/vpn', vpnRoutes);

export default router;
