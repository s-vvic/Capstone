import { Router } from 'express';
import authRoutes from '../../../user-auth/src/routes/index.js';
import deviceHeartbeatRoutes from '../../../device-heartbeat/src/routes/index.js';
import eventNotificationRoutes from '../../../event-notification/src/routes/index.js';
import vpnRoutes from '../../../vpn/src/routes/index.js';
import { createStorageRouter } from '../../../storage-retention/src/routes/storageRoutes.js';
import { unifiedAuthenticate } from '../middleware/unifiedAuthMiddleware.js';

const router = Router();

// Component 1: 사용자 및 인증 관리 (/auth, /auth/sessions, /auth/plan)
router.use(authRoutes);

// Component 4: WireGuard VPN 컨트롤러 (/vpn)
router.use(vpnRoutes);

// Component 2: 보드 등록 및 생존 관리 (/devices, /vpn)
router.use(deviceHeartbeatRoutes);

// Component 3: 이벤트 수신 및 Push 알림 (/events, /notifications)
router.use(eventNotificationRoutes);

// Component 5: 스토리지 수명주기 및 파일 관리 (/storage)
const storageRouter = createStorageRouter({ authenticate: unifiedAuthenticate });
router.use('/storage', storageRouter);

export default router;
