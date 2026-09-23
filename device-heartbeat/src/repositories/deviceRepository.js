import { getPool } from '../config/database.js';

/**
 * PostgreSQL 17.X 보드 저장소 (ICD 7.1.2 devices 및 실시간 상태 관리)
 */
export class PostgresDeviceRepository {
  constructor() {
    this.pool = getPool();
  }

  async create(deviceData) {
    const query = `
      INSERT INTO devices (
        device_id, user_id, serial_no, register_code, name, location,
        description, group_id, model, firmware_version, wg_pubkey, vpn_ip,
        provision_token, is_active, status, vpn_status, rtsp_url, rtsp_url_sub,
        thumbnail_url, registered_at, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *;
    `;
    const res = await this.pool.query(query, [
      deviceData.deviceId,
      deviceData.userId || null,
      deviceData.serialNo,
      deviceData.registerCode || null,
      deviceData.name,
      deviceData.location || '미지정',
      deviceData.description || '',
      deviceData.groupId || null,
      deviceData.model || 'RV-1106',
      deviceData.firmwareVersion || 'v1.0.0',
      deviceData.wgPubkey || null,
      deviceData.vpnIp || null,
      deviceData.provisionToken || null,
      deviceData.isActive !== false,
      deviceData.status || 'offline',
      deviceData.vpnStatus || 'disconnected',
      deviceData.rtspUrl || null,
      deviceData.rtspUrlSub || null,
      deviceData.thumbnailUrl || '',
      deviceData.registeredAt || null,
    ]);
    return res.rows[0];
  }

  async findById(deviceId) {
    const res = await this.pool.query('SELECT * FROM devices WHERE device_id = $1;', [deviceId]);
    return res.rows[0] || null;
  }

  async findBySerial(serialNo) {
    const res = await this.pool.query('SELECT * FROM devices WHERE serial_no = $1;', [serialNo]);
    return res.rows[0] || null;
  }

  async findByRegisterCode(code) {
    const res = await this.pool.query('SELECT * FROM devices WHERE register_code = $1;', [code]);
    return res.rows[0] || null;
  }

  async findByProvisionToken(token) {
    const res = await this.pool.query('SELECT * FROM devices WHERE provision_token = $1;', [token]);
    return res.rows[0] || null;
  }

  async findByUserId(userId) {
    const res = await this.pool.query(
      'SELECT * FROM devices WHERE user_id = $1 AND is_active = true ORDER BY created_at ASC;',
      [userId]
    );
    return res.rows;
  }

  async findAll() {
    const res = await this.pool.query('SELECT * FROM devices ORDER BY created_at ASC;');
    return res.rows;
  }

  async getAllAssignedVpnIps() {
    const res = await this.pool.query('SELECT vpn_ip FROM devices WHERE vpn_ip IS NOT NULL;');
    return res.rows.map((r) => r.vpn_ip);
  }

  async count() {
    const res = await this.pool.query('SELECT COUNT(*) AS count FROM devices;');
    return parseInt(res.rows[0].count, 10);
  }

  async update(deviceId, fields = {}) {
    const setClauses = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${idx++}`);
      values.push(value);
    }

    if (setClauses.length === 0) {
      return this.findById(deviceId);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(deviceId);

    const query = `
      UPDATE devices
      SET ${setClauses.join(', ')}
      WHERE device_id = $${idx}
      RETURNING *;
    `;
    const res = await this.pool.query(query, values);
    return res.rows[0] || null;
  }

  async updateHeartbeat(deviceId, metrics) {
    const query = `
      UPDATE devices
      SET status = 'online',
          vpn_status = $1,
          last_seen = CURRENT_TIMESTAMP,
          last_handshake = CURRENT_TIMESTAMP,
          storage_used_bytes = COALESCE($2, storage_used_bytes),
          storage_used_gb = ROUND((COALESCE($2, storage_used_bytes)::numeric / 1073741824.0), 2),
          latency_ms = COALESCE($3, latency_ms),
          firmware_version = COALESCE($4, firmware_version),
          uptime_seconds = uptime_seconds + 30,
          connected_duration_sec = connected_duration_sec + 30,
          error_type = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE device_id = $5
      RETURNING *;
    `;
    const vpnStatus = metrics.wgOk ? 'connected' : 'error';
    const res = await this.pool.query(query, [
      vpnStatus,
      metrics.storageUsedBytes || null,
      metrics.latencyMs || null,
      metrics.firmwareVersion || null,
      deviceId,
    ]);
    return res.rows[0] || null;
  }

  async markStaleDevicesOffline(cutoffTime) {
    const query = `
      UPDATE devices
      SET status = 'offline',
          vpn_status = 'disconnected',
          error_type = 'heartbeat_timeout',
          updated_at = CURRENT_TIMESTAMP
      WHERE status = 'online' AND (last_seen IS NULL OR last_seen < $1)
      RETURNING device_id, name, serial_no, last_seen;
    `;
    const res = await this.pool.query(query, [cutoffTime]);
    return res.rows;
  }
}
