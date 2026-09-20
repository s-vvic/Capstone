import { getPool } from '../config/database.js';

/**
 * PostgreSQL 17.X 로그인 시도 기록 저장소 (ICD 2.1.1 429 TOO_MANY_REQUESTS, NF-S-005)
 */
export class PostgresLoginAttemptRepository {
  constructor() {
    this.pool = getPool();
  }

  async recordAttempt({ email, clientIp, isSuccess }) {
    const query = `
      INSERT INTO login_attempts (email, client_ip, is_success, attempt_time)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      RETURNING attempt_id, email, client_ip, is_success, attempt_time;
    `;
    const res = await this.pool.query(query, [email, clientIp, isSuccess]);
    return res.rows[0];
  }

  async getRecentFailedAttempts(email, clientIp, windowMinutes = 15) {
    const query = `
      SELECT COUNT(*) AS count
      FROM login_attempts
      WHERE (email = $1 OR client_ip = $2)
        AND is_success = false
        AND attempt_time > (CURRENT_TIMESTAMP - INTERVAL '1 minute' * $3);
    `;
    const res = await this.pool.query(query, [email, clientIp, windowMinutes]);
    return parseInt(res.rows[0].count, 10);
  }

  async clearAttempts(email, clientIp) {
    const query = `
      DELETE FROM login_attempts
      WHERE email = $1 OR client_ip = $2;
    `;
    await this.pool.query(query, [email, clientIp]);
  }
}
