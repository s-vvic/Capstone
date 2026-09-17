import { env } from '../config/env.js';

/**
 * 보안 감사 및 시스템 이벤트 로깅 유틸리티 (NF-S-005)
 */
export const logger = {
  info(message, meta = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },

  warn(message, meta = {}) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },

  error(message, error = null, meta = {}) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${message}`, {
      errorMessage: error?.message || error,
      stack: env.NODE_ENV === 'development' ? error?.stack : undefined,
      ...meta,
    });
  },

  /**
   * 이상 접근 감지 및 보안 감사 로그 (NF-S-005)
   */
  security(event, details = {}) {
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      event,
      ip: details.ip || 'unknown',
      email: details.email || 'unknown',
      userId: details.userId || null,
      reason: details.reason || '',
      userAgent: details.userAgent || 'unknown',
    };

    console.warn(`[${timestamp}] [SECURITY_ALERT] [${event}]`, JSON.stringify(payload));

    // 필요 시 푸시 알림(FCM, ICD-07) 또는 관리자 알림 연계 지점
    return payload;
  },
};
