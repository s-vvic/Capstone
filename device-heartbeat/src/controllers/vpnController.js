import { vpnStatusService } from '../services/vpnStatusService.js';

export const vpnController = {
  /**
   * 등록 기기의 VPN 연결 상태 전체 조회 (GET /vpn/connections, ICD 2.5.1, SV-F-014)
   */
  async listConnections(req, res, next) {
    try {
      const userId = req.user?.userId;
      const connections = await vpnStatusService.listConnections(userId);
      res.status(200).json(connections);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 특정 기기 VPN 수동 연결 / 끊기 (POST /vpn/connections/:deviceId/action, ICD 2.5.2, SV-F-014)
   */
  async executeAction(req, res, next) {
    try {
      const userId = req.user?.userId;
      const { deviceId } = req.params;
      const { action } = req.body;
      const result = await vpnStatusService.executeVpnAction(deviceId, userId, action);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
