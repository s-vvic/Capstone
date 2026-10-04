import { EventEmitter } from 'events';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { buildFcmPayload } from '../utils/fcmPayloadBuilder.js';
import { EVENT_TYPES } from '../constants/eventTypes.js';
import {
  getNotificationSettingsRepository,
  getNotificationHistoryRepository,
} from '../repositories/index.js';

export class FcmNotificationService extends EventEmitter {
  constructor() {
    super();
    this.maxLatencyMs = 5000; // NF-P-002: 5초 이내 기준값
  }

  /**
   * 사용자 알림 설정에 따라 해당 이벤트가 발송 대상인지 판정합니다. (ICD_v2 2.7)
   */
  async shouldSendNotification(userId, event) {
    if (!userId) return false;

    const settingsRepo = getNotificationSettingsRepository();
    const settings = await settingsRepo.findByUserId(userId);

    // 1. 기기별 알림 활성화 여부 확인
    if (settings.device_alerts && Array.isArray(settings.device_alerts)) {
      const deviceSetting = settings.device_alerts.find((d) => d.device_id === event.device_id);
      if (deviceSetting && deviceSetting.enabled === false) {
        return false;
      }
    }

    // 2. 중요 알림만 수신 옵션 확인
    if (settings.important_only && !event.is_important) {
      return false;
    }

    // 3. 이벤트 유형별 알림 설정 확인
    switch (event.event_type) {
      case EVENT_TYPES.MOTION:
        return settings.motion_alert !== false;

      case EVENT_TYPES.SOUND:
        return settings.sound_alert !== false;

      case EVENT_TYPES.CONNECTION:
        if (event.detail && event.detail.includes('offline')) {
          return settings.offline_alert !== false;
        }
        if (event.detail && event.detail.includes('reconnect')) {
          return settings.reconnect_alert !== false;
        }
        return true;

      case EVENT_TYPES.SYSTEM:
        return true;

      default:
        return true;
    }
  }

  /**
   * 이벤트에 대한 FCM 알림을 비동기로 디스패치합니다.
   * NF-P-002 요구사항인 5초 이내 발송 지연시간을 계측합니다.
   */
  async dispatchNotification(event, device = {}, targetUserId = null) {
    const startTime = Date.now();
    const userId = targetUserId || device.user_id;

    if (!userId) {
      logger.info('No user assigned for device, skipping push notification', {
        deviceId: event.device_id,
      });
      return { sent: false, reason: 'NO_USER' };
    }

    const shouldSend = await this.shouldSendNotification(userId, event);
    if (!shouldSend) {
      logger.info('Push notification filtered out by user settings', {
        userId,
        eventType: event.event_type,
        deviceId: event.device_id,
      });
      return { sent: false, reason: 'FILTERED_BY_SETTINGS' };
    }

    const payload = buildFcmPayload(event, device);

    // 모의 또는 실제 FCM 전송 실행 (NF-P-002: 5초 이내 보장)
    await this.simulateOrSendFcm(payload);

    const latencyMs = Date.now() - startTime;
    logger.pushDispatched(event.event_id, userId, latencyMs);

    const historyRepo = getNotificationHistoryRepository();
    await historyRepo.record({
      event_id: event.event_id,
      user_id: userId,
      device_id: event.device_id,
      title: payload.notification.title,
      body: payload.notification.body,
      payload,
      latency_ms: latencyMs,
    });

    const result = {
      sent: true,
      latency_ms: latencyMs,
      within_sla: latencyMs <= this.maxLatencyMs,
      payload,
    };

    this.emit('notificationSent', { event, userId, result });
    return result;
  }

  async simulateOrSendFcm(payload) {
    // 테스트 및 모의 환경 지연 시뮬레이션
    const delay = env.FCM_MOCK_DELAY_MS || 50;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export const fcmNotificationService = new FcmNotificationService();
