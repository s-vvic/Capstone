import { getPool } from '../config/database.js';

/**
 * PostgreSQL 17.X 비밀번호 재설정 저장소 (SV-F-002)
 */
export class PostgresPasswordResetRepository {
  constructor() {
    this.pool = getPool();
  }

  async create({ userId, resetToken, expiresAt }) {
    const query = `
      INSERT INTO password_resets (user_id, reset_token, expires_at, is_used, created_at)
      VALUES ($1, $2, $3, false, CURRENT_TIMESTAMP)
      RETURNING reset_id, user_id, reset_token, expires_at, is_used, created_at;
    `;
    const res = await this.pool.query(query, [userId, resetToken, expiresAt]);
    return res.rows[0];
  }

  async findByToken(resetToken) {
    const query = `
      SELECT reset_id, user_id, reset_token, expires_at, is_used, created_at
      FROM password_resets
      WHERE reset_token = $1 AND is_used = false AND expires_at > CURRENT_TIMESTAMP;
    `;
    const res = await this.pool.query(query, [resetToken]);
    return res.rows[0] || null;
  }

  async markUsed(resetId) {
    const query = `
      UPDATE password_resets
      SET is_used = true
      WHERE reset_id = $1
      RETURNING reset_id;
    `;
    const res = await this.pool.query(query, [resetId]);
    return res.rowCount > 0;
  }
}
