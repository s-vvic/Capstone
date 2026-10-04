/**
 * SecureCam 이벤트 유형 및 상태 상수 정의 (ICD_v2 2.3, 3.3, 6.3)
 */

export const EVENT_TYPES = {
  MOTION: 'motion',
  SOUND: 'sound',
  CONNECTION: 'connection',
  SYSTEM: 'system',
};

export const VALID_EVENT_TYPES = Object.values(EVENT_TYPES);

export const EVENT_STATUS = {
  UNCONFIRMED: 'unconfirmed',
  CONFIRMED: 'confirmed',
};

export const VALID_EVENT_STATUSES = Object.values(EVENT_STATUS);

/**
 * ICD_v2 6.3 알림 유형별 기본 메시지 템플릿
 */
export const NOTIFICATION_TEMPLATES = {
  [EVENT_TYPES.MOTION]: {
    title: (deviceName) => `${deviceName} 움직임 감지`,
    body: (location) => `${location || '설치 위치'}에서 움직임이 감지되었습니다.`,
  },
  [EVENT_TYPES.SOUND]: {
    title: (deviceName) => `${deviceName} 소리 탐지`,
    body: (location, detail = {}) =>
      `${location || '설치 위치'}에서 소리가 감지되었습니다.${detail.soundLevelDb ? ` (${detail.soundLevelDb}dB)` : ''}`,
  },
  connection_offline: {
    title: (deviceName) => `${deviceName} 연결 끊김`,
    body: (deviceName) => `${deviceName}이 오프라인 상태가 되었습니다.`,
  },
  connection_reconnect: {
    title: (deviceName) => `${deviceName} 재연결`,
    body: (deviceName) => `${deviceName}이 다시 연결되었습니다.`,
  },
  vpn_error: {
    title: (deviceName) => `${deviceName} VPN 오류`,
    body: (errorType) => `VPN 연결 오류가 발생했습니다. (${errorType || '터널 단절'})`,
  },
  [EVENT_TYPES.SYSTEM]: {
    title: (deviceName) => `${deviceName} 시스템 알림`,
    body: (detail) => `시스템 이벤트가 발생했습니다: ${detail || '상세 내용 확인 필요'}`,
  },
};
