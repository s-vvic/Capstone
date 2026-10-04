import { getNotificationSettingsRepository } from '../repositories/index.js';
import { AppError } from '../errors/AppError.js';

export class NotificationSettingsService {
  async getSettings(userId) {
    if (!userId) {
      throw AppError.unauthorized('사용자 인증 정보가 필요합니다.');
    }

    const settingsRepo = getNotificationSettingsRepository();
    const settings = await settingsRepo.findByUserId(userId);

    return {
      motion_alert: settings.motion_alert,
      sound_alert: settings.sound_alert,
      offline_alert: settings.offline_alert,
      reconnect_alert: settings.reconnect_alert,
      important_only: settings.important_only,
      device_alerts: settings.device_alerts || [],
    };
  }

  async updateSettings(userId, payload) {
    if (!userId) {
      throw AppError.unauthorized('사용자 인증 정보가 필요합니다.');
    }

    const settingsRepo = getNotificationSettingsRepository();
    const updated = await settingsRepo.upsert(userId, payload);

    return {
      motion_alert: updated.motion_alert,
      sound_alert: updated.sound_alert,
      offline_alert: updated.offline_alert,
      reconnect_alert: updated.reconnect_alert,
      important_only: updated.important_only,
      device_alerts: updated.device_alerts || [],
    };
  }
}

export const notificationSettingsService = new NotificationSettingsService();
