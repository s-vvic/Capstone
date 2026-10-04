import { notificationSettingsService } from '../services/notificationSettingsService.js';

export class NotificationSettingsController {
  /**
   * 알림 설정 조회 (ICD_v2 2.7.1, APP-F-070, WEB-F-091)
   * GET /notifications/settings
   */
  async getSettings(req, res, next) {
    try {
      const userId = req.user.userId || req.user.user_id;
      const settings = await notificationSettingsService.getSettings(userId);
      res.status(200).json(settings);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 알림 설정 수정 (ICD_v2 2.7.2, APP-F-070, APP-F-072)
   * PUT /notifications/settings
   */
  async updateSettings(req, res, next) {
    try {
      const userId = req.user.userId || req.user.user_id;
      const updated = await notificationSettingsService.updateSettings(userId, req.body);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }
}

export const notificationSettingsController = new NotificationSettingsController();
