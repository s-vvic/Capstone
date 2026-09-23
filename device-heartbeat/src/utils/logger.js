import { env } from '../config/env.js';

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

  deviceStatus(deviceId, oldStatus, newStatus, reason = '') {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] [DEVICE_STATUS_CHANGE] ${deviceId}: ${oldStatus} -> ${newStatus} (${reason})`
    );
  },
};
