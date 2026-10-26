import { Router } from 'express';
import vpnConnectionRoutes from './vpnConnectionRoutes.js';
import vpnPeerRoutes from './vpnPeerRoutes.js';

const router = Router();

// /vpn prefix 아래로 연결
const vpnRouter = Router();
vpnRouter.use(vpnConnectionRoutes);
vpnRouter.use(vpnPeerRoutes);

router.use('/vpn', vpnRouter);

export default router;
export { vpnRouter };
