import { deviceRepository } from '../repositories/index.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export class VpnStatusService {
  /**
   * 등록 기기의 VPN 연결 상태 전체 조회 (SV-F-014, ICD 2.5.1)
   */
  async listConnections(userId) {
    const devices = userId
      ? await deviceRepository.findByUserId(userId)
      : await deviceRepository.findAll();

    return devices.map((d) => ({
      device_id: d.device_id,
      device_name: d.name,
      serial_no: d.serial_no,
      vpn_status: d.vpn_status,
      vpn_ip: d.vpn_ip || '10.0.0.0',
      vpn_server: d.vpn_server || 'vpn.securecam.com:443',
      connected_duration_sec: d.connected_duration_sec || 0,
      last_handshake: d.last_handshake || null,
      error_type: d.error_type || null,
      auto_connect: d.auto_connect !== false,
      reconnect_on_start: d.reconnect_on_start !== false,
      reconnect_on_network_change: d.reconnect_on_network_change !== false,
    }));
  }

  /**
   * 특정 기기 VPN 수동 연결 / 끊기 (SV-F-014, ICD 2.5.2)
   */
  async executeVpnAction(deviceId, userId, action) {
    if (!action || !['connect', 'disconnect'].includes(action)) {
      throw AppError.badRequest("action은 'connect' 또는 'disconnect'여야 합니다.");
    }

    const device = await deviceRepository.findById(deviceId);
    if (!device) {
      throw AppError.notFound(`보드 ID '${deviceId}'를 찾을 수 없습니다.`);
    }

    if (userId && device.user_id && device.user_id !== userId) {
      throw AppError.forbidden('해당 기기의 VPN을 제어할 권한이 없습니다.');
    }

    const newVpnStatus = action === 'connect' ? 'connected' : 'disconnected';
    const now = new Date().toISOString();

    const updated = await deviceRepository.update(deviceId, {
      vpn_status: newVpnStatus,
      last_handshake: action === 'connect' ? now : device.last_handshake,
      error_type: null,
    });

    logger.info(`[VPN] 수동 제어 완료: ${deviceId} -> action=${action} (결과: ${newVpnStatus})`);

    return {
      success: true,
      device_id: deviceId,
      action,
      vpn_status: newVpnStatus,
      vpn_ip: updated.vpn_ip,
      updated_at: updated.updated_at,
    };
  }
}

export const vpnStatusService = new VpnStatusService();
