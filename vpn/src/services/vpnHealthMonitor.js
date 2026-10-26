import { getVpnRepository } from '../repositories/index.js';
import { getWireguardDriver } from '../drivers/index.js';
import { VPN_CONFIG, VPN_STATUS, VPN_ERROR_TYPE } from '../constants/vpnConstants.js';
import { logger } from '../utils/logger.js';

/**
 * VPN 연결 상태 감시 및 자동 재연결 모니터 (VPN-F-005, VPN-F-006, NF-A-002, NF-A-003)
 */
export class VpnHealthMonitor {
  constructor(options = {}) {
    this.repository = options.repository || getVpnRepository();
    this.driver = options.driver || getWireguardDriver();
    this.intervalMs = options.intervalMs || 30000; // 기본 30초 주기
    this.handshakeTimeoutSec = options.handshakeTimeoutSec || VPN_CONFIG.HANDSHAKE_STALE_SEC; // 120초

    this.timer = null;
    this.listeners = [];
  }

  /**
   * 상태 변경 이벤트 리스너 등록 (VPN-F-005 알림 연계용)
   */
  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  emitStatusChange(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        logger.error(`[VpnHealthMonitor] 리스너 호출 실패: ${err.message}`);
      }
    }
  }

  /**
   * 모니터링 주기 시작
   */
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.checkHealth(), this.intervalMs);
    logger.info(`[VpnHealthMonitor] VPN 헬스체크 모니터 시작 (${this.intervalMs / 1000}초 주기)`);
  }

  /**
   * 모니터링 중지
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('[VpnHealthMonitor] VPN 헬스체크 모니터 중지');
    }
  }

  /**
   * 1회 헬스체크 검사 및 자동 복구 수행
   */
  async checkHealth() {
    try {
      const peers = await this.repository.findAll();
      const now = new Date();
      const nowEpoch = Math.floor(now.getTime() / 1000);

      for (const peer of peers) {
        if (!peer.wg_pubkey) continue;

        const driverPeer = await this.driver.getPeer(peer.wg_pubkey);
        const lastHandshakeStr = driverPeer?.lastHandshake || peer.last_handshake;

        let isTimedOut = false;
        if (lastHandshakeStr) {
          const handshakeEpoch = Math.floor(new Date(lastHandshakeStr).getTime() / 1000);
          if (nowEpoch - handshakeEpoch > this.handshakeTimeoutSec) {
            isTimedOut = true;
          }
        }

        // 핸드셰이크 타임아웃 발생 시
        if (isTimedOut && peer.vpn_status === VPN_STATUS.CONNECTED) {
          logger.warn(`[VpnHealthMonitor] 피어 핸드셰이크 타임아웃 감지: ${peer.peer_id} (IP: ${peer.vpn_ip})`);

          const prevStatus = peer.vpn_status;
          await this.repository.update(peer.peer_id, {
            vpn_status: VPN_STATUS.ERROR,
            error_type: VPN_ERROR_TYPE.HANDSHAKE_TIMEOUT,
          });

          this.emitStatusChange({
            peer_id: peer.peer_id,
            device_id: peer.device_id,
            prev_status: prevStatus,
            new_status: VPN_STATUS.ERROR,
            error_type: VPN_ERROR_TYPE.HANDSHAKE_TIMEOUT,
            timestamp: now.toISOString(),
          });

          // 자동 재연결(NF-A-002, 003) 정책 활성화된 경우
          if (peer.auto_connect) {
            await this.attemptAutoReconnect(peer);
          }
        }
      }
    } catch (err) {
      logger.error(`[VpnHealthMonitor] 헬스체크 수행 중 에러: ${err.message}`);
    }
  }

  /**
   * 끊김 발생 시 60초 이내 자동 재연결 시도
   */
  async attemptAutoReconnect(peer) {
    logger.info(`[VpnHealthMonitor] 자동 재연결 시도 중: ${peer.peer_id} (${peer.vpn_ip})`);

    try {
      if (peer.wg_pubkey && peer.vpn_ip) {
        await this.driver.addPeer(peer.wg_pubkey, peer.vpn_ip, VPN_CONFIG.KEEPALIVE_INTERVAL_SEC);
      }

      await this.repository.update(peer.peer_id, {
        vpn_status: VPN_STATUS.CONNECTED,
        last_handshake: new Date().toISOString(),
        error_type: null,
      });

      this.emitStatusChange({
        peer_id: peer.peer_id,
        device_id: peer.device_id,
        prev_status: VPN_STATUS.ERROR,
        new_status: VPN_STATUS.CONNECTED,
        error_type: null,
        timestamp: new Date().toISOString(),
      });

      logger.info(`[VpnHealthMonitor] 자동 재연결 성공: ${peer.peer_id}`);
    } catch (error) {
      logger.error(`[VpnHealthMonitor] 자동 재연결 실패: ${peer.peer_id} - ${error.message}`);
    }
  }
}

export const vpnHealthMonitor = new VpnHealthMonitor();
