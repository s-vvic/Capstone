/**
 * 구조화 로거 (콘솔 출력 및 디버그 모니터링)
 */
export const logger = {
  info: (msg, meta = {}) => {
    console.log(`[INFO]  ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },
  warn: (msg, meta = {}) => {
    console.warn(`[WARN]  ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },
  error: (msg, meta = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },
  eventIngested: (event) => {
    console.log(
      `[EVENT] ${new Date().toISOString()} - Ingested ${event.event_type} from ${event.device_id} (ID: ${event.event_id})`
    );
  },
  pushDispatched: (eventId, targetUserId, latencyMs) => {
    console.log(
      `[PUSH]  ${new Date().toISOString()} - Sent FCM for event ${eventId} to user ${targetUserId} in ${latencyMs}ms`
    );
  },
};
