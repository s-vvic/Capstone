import { getPool } from '../config/database.js';

/**
 * PostgreSQL 17.X Heartbeat 메트릭 로그 저장소
 */
export class PostgresHeartbeatRepository {
  constructor() {
    this.pool = getPool();
  }

  async recordHeartbeat(logData) {
    const query = `
      INSERT INTO heartbeat_history (
        device_id, serial_no, status, rtsp_ok, wg_ok, storage_used_bytes,
        latency_ms, firmware_version, received_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const res = await this.pool.query(query, [
      logData.deviceId,
      logData.serialNo,
      logData.status || 'online',
      Boolean(logData.rtspOk),
      Boolean(logData.wgOk),
      logData.storageUsedBytes || null,
      logData.latencyMs || null,
      logData.firmwareVersion || null,
    ]);
    return res.rows[0];
  }

  async getRecentLogs(deviceId, limit = 50) {
    const query = `
      SELECT * FROM heartbeat_history
      WHERE device_id = $1
      ORDER BY received_at DESC
      LIMIT $2;
    `;
    const res = await this.pool.query(query, [deviceId, limit]);
    return res.rows;
  }
}
