import { getVpnRepository } from "../repositories/index.js";
import { getWireguardDriver } from "../drivers/index.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../constants/errorCodes.js";
import {
  VPN_STATUS,
  VPN_ACTION,
  VPN_CONFIG,
} from "../constants/vpnConstants.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

export class VpnConnectionService {
  constructor(options = {}) {
    this._repository = options.repository || null;
    this._driver = options.driver || null;
  }

  get repository() {
    return this._repository || getVpnRepository();
  }

  get driver() {
    return this._driver || getWireguardDriver();
  }

  /**
   * 등록 기기 전체 VPN 연결 상태 목록 조회 (ICD-01 2.5.1, SV-F-014)
   * @param {string} [userId] - 사용자 ID (있으면 해당 사용자의 기기만 필터링)
   */
  async listConnections(userId = null) {
    const peers = userId
      ? await this.repository.findByUserId(userId)
      : await this.repository.findAll();

    // WireGuard 드라이버의 실시간 상태 조회
    const livePeers = await this.driver.getPeers();
    const liveMap = new Map();
    for (const lp of livePeers) {
      if (lp.publicKey) {
        liveMap.set(lp.publicKey, lp);
      }
    }

    const now = new Date();

    return peers
      .filter((p) => p.is_active !== false && p.peer_type !== "phone")
      .map((p) => {
        const live = p.wg_pubkey ? liveMap.get(p.wg_pubkey) : null;
        let vpnStatus = p.vpn_status || VPN_STATUS.DISCONNECTED;
        let lastHandshake = p.last_handshake;
        let errorType = p.error_type || null;

        // 실시간 드라이버 정보가 있으면 반영
        if (live) {
          if (live.vpnStatus) vpnStatus = live.vpnStatus;
          if (live.lastHandshake) lastHandshake = live.lastHandshake;
          if (live.errorType) errorType = live.errorType;
        }

        // 연결 지속 시간 계산 (초)
        let durationSec = p.connected_duration_sec || 0;
        if (vpnStatus === VPN_STATUS.CONNECTED && lastHandshake) {
          const handshakeTime = new Date(lastHandshake).getTime();
          const diff = Math.floor((now.getTime() - handshakeTime) / 1000);
          durationSec = Math.max(0, diff);
        }

        return {
          device_id: p.device_id || p.peer_id,
          mac: p.mac || p.mac_no?.replaceAll(":", "").toUpperCase() || null,
          device_name: p.name || p.device_name || "기기",
          mac_no: p.mac_no || "-",
          vpn_status: vpnStatus,
          vpn_ip: p.vpn_ip || "10.0.0.0",
          vpn_server: p.vpn_server || config.wgServerEndpoint,
          connected_duration_sec: durationSec,
          last_handshake: lastHandshake || null,
          error_type: errorType,
          auto_connect: p.auto_connect !== false,
          reconnect_on_start: p.reconnect_on_start !== false,
          reconnect_on_network_change: p.reconnect_on_network_change !== false,
        };
      });
  }

  /**
   * 특정 기기 VPN 연결 상태 단건 조회
   */
  async getConnection(deviceId, userId = null) {
    const peer = await this.repository.findById(deviceId);
    if (!peer) {
      throw AppError.notFound(
        `기기 ID '${deviceId}'를 찾을 수 없습니다.`,
        ERROR_CODES.DEVICE_NOT_FOUND,
      );
    }

    if (userId && peer.user_id !== userId) {
      throw AppError.forbidden(
        "해당 기기에 접근할 권한이 없습니다.",
        ERROR_CODES.FORBIDDEN,
      );
    }

    const list = await this.listConnections(userId);
    const found = list.find((item) => item.device_id === deviceId);
    if (!found)
      throw AppError.notFound(
        "카메라 VPN 연결을 찾을 수 없습니다.",
        ERROR_CODES.DEVICE_NOT_FOUND,
      );
    return found;
  }

  /**
   * 특정 기기 VPN 수동 연결 / 끊기 (ICD-01 2.5.2, SV-F-014)
   * @param {string} deviceId
   * @param {string} [userId]
   * @param {'connect'|'disconnect'} action
   */
  async executeVpnAction(deviceId, userId, action) {
    if (!action || !["connect", "disconnect"].includes(action)) {
      throw AppError.badRequest(
        "action은 'connect' 또는 'disconnect'여야 합니다.",
        { field: "action" },
      );
    }

    const peer = await this.repository.findById(deviceId);
    if (!peer) {
      throw AppError.notFound(
        `기기 ID '${deviceId}'를 찾을 수 없습니다.`,
        ERROR_CODES.DEVICE_NOT_FOUND,
      );
    }

    if (userId && peer.user_id !== userId) {
      throw AppError.forbidden(
        "해당 기기의 VPN을 제어할 권한이 없습니다.",
        ERROR_CODES.FORBIDDEN,
      );
    }

    const now = new Date().toISOString();

    if (action === VPN_ACTION.CONNECT) {
      // 1. 드라이버에 피어 활성화
      if (peer.wg_pubkey && peer.vpn_ip) {
        await this.driver.addPeer(
          peer.wg_pubkey,
          peer.vpn_ip,
          VPN_CONFIG.KEEPALIVE_INTERVAL_SEC,
        );
      }

      // 2. DB 상태 업데이트
      const updated = await this.repository.update(peer.peer_id, {
        vpn_status: VPN_STATUS.CONNECTED,
        last_handshake: now,
        error_type: null,
      });

      logger.info(
        `[VpnConnectionService] 수동 연결 완료: ${deviceId} (IP: ${peer.vpn_ip})`,
      );

      return {
        success: true,
        device_id: deviceId,
        action,
        vpn_status: VPN_STATUS.CONNECTED,
        vpn_ip: updated.vpn_ip,
        updated_at: updated.updated_at,
      };
    } else {
      // DISCONNECT
      // 1. 드라이버에서 피어 제거/비활성화
      if (peer.wg_pubkey) {
        await this.driver.removePeer(peer.wg_pubkey);
      }

      // 2. DB 상태 업데이트
      const updated = await this.repository.update(peer.peer_id, {
        vpn_status: VPN_STATUS.DISCONNECTED,
        error_type: null,
      });

      logger.info(`[VpnConnectionService] 수동 연결 끊기 완료: ${deviceId}`);

      return {
        success: true,
        device_id: deviceId,
        action,
        vpn_status: VPN_STATUS.DISCONNECTED,
        vpn_ip: updated.vpn_ip,
        updated_at: updated.updated_at,
      };
    }
  }

  /**
   * VPN 서버 복구 요청 (ICD-01 2.5.3)
   */
  async recoverVpnTunnel(deviceId, userId = null) {
    const peer = await this.repository.findById(deviceId);
    if (!peer) {
      throw AppError.notFound(
        `기기 ID '${deviceId}'를 찾을 수 없습니다.`,
        ERROR_CODES.DEVICE_NOT_FOUND,
      );
    }

    if (userId && peer.user_id !== userId) {
      throw AppError.forbidden(
        "해당 기기의 VPN 복구를 요청할 권한이 없습니다.",
        ERROR_CODES.FORBIDDEN,
      );
    }

    logger.info(`[VpnConnectionService] 터널 복구 프로세스 시작: ${deviceId}`);

    // 1. 드라이버 인터페이스에서 기존 피어 제거 후 재등록 (터널 리셋)
    if (peer.wg_pubkey) {
      await this.driver.removePeer(peer.wg_pubkey);
      if (peer.vpn_ip) {
        await this.driver.addPeer(
          peer.wg_pubkey,
          peer.vpn_ip,
          VPN_CONFIG.KEEPALIVE_INTERVAL_SEC,
        );
      }
    }

    // 2. DB 상태를 connected로 갱신 및 오류 초기화
    const now = new Date().toISOString();
    const updated = await this.repository.update(peer.peer_id, {
      vpn_status: VPN_STATUS.CONNECTED,
      last_handshake: now,
      error_type: null,
      connected_duration_sec: 0,
    });

    logger.info(
      `[VpnConnectionService] 터널 복구 프로세스 성공 완료: ${deviceId}`,
    );

    return {
      success: true,
      message: "VPN 터널이 성공적으로 복구 및 재설정되었습니다.",
      device_id: deviceId,
      vpn_status: VPN_STATUS.CONNECTED,
      vpn_ip: updated.vpn_ip,
      recovered_at: now,
    };
  }
}

export const vpnConnectionService = new VpnConnectionService();
