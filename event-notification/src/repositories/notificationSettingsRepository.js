import { getDatabasePool } from '../config/database.js';

export class PostgresNotificationSettingsRepository {
  async findByUserId(userId) {
    const pool = getDatabasePool();
    const query = `SELECT * FROM notification_settings WHERE user_id = $1;`;
    const result = await pool.query(query, [userId]);
    if (result.rows.length > 0) {
      return result.rows[0];
    }

    return {
      user_id: userId,
      motion_alert: true,
      sound_alert: true,
      offline_alert: true,
      reconnect_alert: true,
      important_only: false,
      device_alerts: [],
    };
  }

  async upsert(userId, data) {
    const pool = getDatabasePool();
    const current = await this.findByUserId(userId);

    const motionAlert = data.motion_alert !== undefined ? Boolean(data.motion_alert) : current.motion_alert;
    const soundAlert = data.sound_alert !== undefined ? Boolean(data.sound_alert) : current.sound_alert;
    const offlineAlert = data.offline_alert !== undefined ? Boolean(data.offline_alert) : current.offline_alert;
    const reconnectAlert = data.reconnect_alert !== undefined ? Boolean(data.reconnect_alert) : current.reconnect_alert;
    const importantOnly = data.important_only !== undefined ? Boolean(data.important_only) : current.important_only;
    const deviceAlerts = JSON.stringify(Array.isArray(data.device_alerts) ? data.device_alerts : current.device_alerts);

    const query = `
      INSERT INTO notification_settings (
        user_id, motion_alert, sound_alert, offline_alert, reconnect_alert,
        important_only, device_alerts, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET
        motion_alert = EXCLUDED.motion_alert,
        sound_alert = EXCLUDED.sound_alert,
        offline_alert = EXCLUDED.offline_alert,
        reconnect_alert = EXCLUDED.reconnect_alert,
        important_only = EXCLUDED.important_only,
        device_alerts = EXCLUDED.device_alerts,
        updated_at = NOW()
      RETURNING *;
    `;

    const values = [userId, motionAlert, soundAlert, offlineAlert, reconnectAlert, importantOnly, deviceAlerts];
    const result = await pool.query(query, values);
    return result.rows[0];
  }
}
