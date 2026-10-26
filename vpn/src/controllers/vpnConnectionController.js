import { vpnConnectionService } from '../services/vpnConnectionService.js';
import { validator } from '../middleware/validator.js';

export const vpnConnectionController = {
  /**
   * 등록 기기의 VPN 연결 상태 전체 조회 (GET /vpn/connections, ICD 2.5.1, SV-F-014)
   */
  async listConnections(req, res, next) {
    try {
      const userId = req.user?.userId;
      const connections = await vpnConnectionService.listConnections(userId);
      res.status(200).json(connections);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 특정 기기 VPN 연결 상태 조회 (GET /vpn/connections/:deviceId)
   */
  async getConnection(req, res, next) {
    try {
      const { deviceId } = req.params;
      const userId = req.user?.userId;
      const connection = await vpnConnectionService.getConnection(deviceId, userId);
      res.status(200).json(connection);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 특정 기기 VPN 수동 연결 / 끊기 (POST /vpn/connections/:deviceId/action, ICD 2.5.2, SV-F-014)
   */
  async executeAction(req, res, next) {
    try {
      const { deviceId } = req.params;
      const { action } = req.body;
      const userId = req.user?.userId;

      validator.validateVpnAction(action);

      const result = await vpnConnectionService.executeVpnAction(deviceId, userId, action);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * VPN 서버 복구 요청 (POST /vpn/connections/:deviceId/recover, ICD 2.5.3)
   */
  async recover(req, res, next) {
    try {
      const { deviceId } = req.params;
      const userId = req.user?.userId;

      const result = await vpnConnectionService.recoverVpnTunnel(deviceId, userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
