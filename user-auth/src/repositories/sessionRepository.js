import { getPool } from '../config/database.js';

/**
 * PostgreSQL 17.X 세션 저장소 (SV-F-003 자동로그인, SV-F-004 다중 기기 세션 관리)
 */
export class PostgresSessionRepository {
  constructor() {
    this.pool = getPool();
  }

  async create({
    userId,
    deviceName,
    deviceType = 'web',
    clientIp,
    userAgent,
    tokenJti,
    isAutoLogin = false,
    expiresAt,
  }) {
    const query = `
      INSERT INTO user_sessions (
        user_id, device_name, device_type, client_ip, user_agent,
        token_jti, is_auto_login, is_active, last_active_at, created_at, expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8)
      RETURNING session_id, user_id, device_name, device_type, client_ip, user_agent,
                token_jti, is_auto_login, is_active, last_active_at, created_at, expires_at;
    `;
    const res = await this.pool.query(query, [
      userId,
      deviceName,
      deviceType,
      clientIp,
      userAgent,
      tokenJti,
      isAutoLogin,
      expiresAt,
    ]);
    return res.rows[0];
  }

  async findById(sessionId) {
    const query = `
      SELECT session_id, user_id, device_name, device_type, client_ip, user_agent,
             token_jti, is_auto_login, is_active, last_active_at, created_at, expires_at
      FROM user_sessions
      WHERE session_id = $1;
    `;
    const res = await this.pool.query(query, [sessionId]);
    return res.rows[0] || null;
  }

  async findByJti(tokenJti) {
    const query = `
      SELECT session_id, user_id, device_name, device_type, client_ip, user_agent,
             token_jti, is_auto_login, is_active, last_active_at, created_at, expires_at
      FROM user_sessions
      WHERE token_jti = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP;
    `;
    const res = await this.pool.query(query, [tokenJti]);
    return res.rows[0] || null;
  }

  async findActiveByUserId(userId) {
    const query = `
      SELECT session_id, user_id, device_name, device_type, client_ip, user_agent,
             token_jti, is_auto_login, is_active, last_active_at, created_at, expires_at
      FROM user_sessions
      WHERE user_id = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_active_at DESC;
    `;
    const res = await this.pool.query(query, [userId]);
    return res.rows;
  }

  async countActiveByUserId(userId) {
    const query = `
      SELECT COUNT(*) AS count
      FROM user_sessions
      WHERE user_id = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP;
    `;
    const res = await this.pool.query(query, [userId]);
    return parseInt(res.rows[0].count, 10);
  }

  async updateLastActive(sessionId) {
    const query = `
      UPDATE user_sessions
      SET last_active_at = CURRENT_TIMESTAMP
      WHERE session_id = $1;
    `;
    await this.pool.query(query, [sessionId]);
  }

  async deactivate(sessionId) {
    const query = `
      UPDATE user_sessions
      SET is_active = false
      WHERE session_id = $1
      RETURNING session_id;
    `;
    const res = await this.pool.query(query, [sessionId]);
    return res.rowCount > 0;
  }

  async deactivateByJti(tokenJti) {
    const query = `
      UPDATE user_sessions
      SET is_active = false
      WHERE token_jti = $1
      RETURNING session_id;
    `;
    const res = await this.pool.query(query, [tokenJti]);
    return res.rowCount > 0;
  }

  async deactivateAllOtherSessions(userId, currentSessionId) {
    const query = `
      UPDATE user_sessions
      SET is_active = false
      WHERE user_id = $1 AND session_id != $2 AND is_active = true;
    `;
    const res = await this.pool.query(query, [userId, currentSessionId]);
    return res.rowCount;
  }

  async deactivateAllUserSessions(userId) {
    const query = `
      UPDATE user_sessions
      SET is_active = false
      WHERE user_id = $1 AND is_active = true;
    `;
    const res = await this.pool.query(query, [userId]);
    return res.rowCount;
  }
}
