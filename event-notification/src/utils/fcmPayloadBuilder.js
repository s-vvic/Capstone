import { EVENT_TYPES, NOTIFICATION_TEMPLATES } from '../constants/eventTypes.js';

/**
 * ICD_v2 제6장 (ICD-07) 규격에 따른 FCM 알림 페이로드 빌더
 */
export function buildFcmPayload(event, device = {}) {
  const deviceName = device.name || event.device_id || '보안 카메라';
  const location = device.location || '설치 위치';

  let title = `${deviceName} 이벤트 알림`;
  let body = `${location}에서 이벤트가 감지되었습니다.`;

  switch (event.event_type) {
    case EVENT_TYPES.MOTION:
      title = NOTIFICATION_TEMPLATES[EVENT_TYPES.MOTION].title(deviceName);
      body = NOTIFICATION_TEMPLATES[EVENT_TYPES.MOTION].body(location);
      break;

    case EVENT_TYPES.SOUND:
      title = NOTIFICATION_TEMPLATES[EVENT_TYPES.SOUND].title(deviceName);
      body = NOTIFICATION_TEMPLATES[EVENT_TYPES.SOUND].body(location, {
        soundLevelDb: event.sound_level_db,
      });
      break;

    case EVENT_TYPES.CONNECTION:
      if (event.detail && event.detail.includes('offline')) {
        title = NOTIFICATION_TEMPLATES.connection_offline.title(deviceName);
        body = NOTIFICATION_TEMPLATES.connection_offline.body(deviceName);
      } else if (event.detail && event.detail.includes('reconnect')) {
        title = NOTIFICATION_TEMPLATES.connection_reconnect.title(deviceName);
        body = NOTIFICATION_TEMPLATES.connection_reconnect.body(deviceName);
      } else if (event.detail && event.detail.includes('vpn')) {
        title = NOTIFICATION_TEMPLATES.vpn_error.title(deviceName);
        body = NOTIFICATION_TEMPLATES.vpn_error.body(event.detail);
      } else {
        title = `${deviceName} 연결 상태 변경`;
        body = `${deviceName}의 네트워크 연결 상태가 변경되었습니다.`;
      }
      break;

    case EVENT_TYPES.SYSTEM:
      title = NOTIFICATION_TEMPLATES[EVENT_TYPES.SYSTEM].title(deviceName);
      body = NOTIFICATION_TEMPLATES[EVENT_TYPES.SYSTEM].body(event.detail);
      break;

    default:
      break;
  }

  return {
    notification: {
      title,
      body,
    },
    data: {
      event_id: String(event.event_id),
      device_id: String(event.device_id),
      event_type: String(event.event_type),
      occurred_at: String(event.occurred_at),
      snapshot_url: event.snapshot_url ? String(event.snapshot_url) : '',
      action: 'open_event',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'securecam_alerts',
        sound: 'default',
      },
    },
  };
}
