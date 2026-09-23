import { deviceRepository } from '../repositories/index.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class HeartbeatMonitor {
  constructor() {
    this.timer = null;
    this.isRunning = false;
    this.listeners = [];
  }

  /**
   * 오프라인 감시 백그라운드 타이머 시작 (SV-F-011)
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(async () => {
      try {
        await this.checkStaleDevices();
      } catch (err) {
        logger.error('[HeartbeatMonitor] 오프라인 감시 주기 오류:', err);
      }
    }, env.OFFLINE_CHECK_INTERVAL_SECONDS * 1000);

    // Unref so process can exit cleanly if only timer is running
    if (this.timer.unref) {
      this.timer.unref();
    }

    logger.info(
      `[HeartbeatMonitor] 백그라운드 생존 감시 데몬 가동 (주기: ${env.OFFLINE_CHECK_INTERVAL_SECONDS}초, 타임아웃: ${env.OFFLINE_TIMEOUT_SECONDS}초)`
    );
  }

  /**
   * 백그라운드 타이머 정지
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    logger.info('[HeartbeatMonitor] 백그라운드 생존 감시 데몬 정지');
  }

  /**
   * 타임아웃 경과 기기 검사 및 오프라인 일괄 전환 (테스트에서도 직접 호출 가능)
   */
  async checkStaleDevices() {
    const cutoffTime = new Date(Date.now() - env.OFFLINE_TIMEOUT_SECONDS * 1000).toISOString();
    const staleDevices = await deviceRepository.markStaleDevicesOffline(cutoffTime);

    if (staleDevices && staleDevices.length > 0) {
      for (const d of staleDevices) {
        logger.deviceStatus(
          d.device_id,
          'online',
          'offline',
          `Heartbeat 수신 지연 초과 (${env.OFFLINE_TIMEOUT_SECONDS}초 무응답)`
        );

        // 상태 변경 이벤트 리스너 호출
        for (const listener of this.listeners) {
          try {
            listener({
              deviceId: d.device_id,
              name: d.name,
              serialNo: d.serial_no,
              oldStatus: 'online',
              newStatus: 'offline',
              timestamp: new Date().toISOString(),
            });
          } catch (e) {
            logger.error('[HeartbeatMonitor] 리스너 호출 오류:', e);
          }
        }
      }
    }

    return staleDevices;
  }

  /**
   * 상태 전환 알림 이벤트 구독
   */
  onStatusChange(callback) {
    this.listeners.push(callback);
  }
}

export const heartbeatMonitor = new HeartbeatMonitor();
