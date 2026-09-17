import { getPool } from '../config/database.js';

/**
 * PostgreSQL 17.X 사용자 저장소 (ICD 7.1.1 users)
 */
export class PostgresUserRepository {
  constructor() {
    this.pool = getPool();
  }

  async create({ email, passwordHash, name, plan = 'basic' }) {
    const query = `
      INSERT INTO users (email, password_hash, name, plan, created_at, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING user_id, email, name, plan, created_at, updated_at;
    `;
    const res = await this.pool.query(query, [email, passwordHash, name, plan]);
    return res.rows[0];
  }

  async findById(userId) {
    const query = `
      SELECT user_id, email, password_hash, name, plan, created_at, updated_at
      FROM users
      WHERE user_id = $1;
    `;
    const res = await this.pool.query(query, [userId]);
    return res.rows[0] || null;
  }

  async findByEmail(email) {
    const query = `
      SELECT user_id, email, password_hash, name, plan, created_at, updated_at
      FROM users
      WHERE email = $1;
    `;
    const res = await this.pool.query(query, [email]);
    return res.rows[0] || null;
  }

  async findByName(name) {
    const query = `
      SELECT user_id, email, name, plan, created_at
      FROM users
      WHERE name = $1;
    `;
    const res = await this.pool.query(query, [name]);
    return res.rows;
  }

  async update(userId, fields = {}) {
    const setClauses = [];
    const values = [];
    let idx = 1;

    if (fields.name !== undefined) {
      setClauses.push(`name = $${idx++}`);
      values.push(fields.name);
    }
    if (fields.passwordHash !== undefined) {
      setClauses.push(`password_hash = $${idx++}`);
      values.push(fields.passwordHash);
    }
    if (fields.plan !== undefined) {
      setClauses.push(`plan = $${idx++}`);
      values.push(fields.plan);
    }

    if (setClauses.length === 0) {
      return this.findById(userId);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE user_id = $${idx}
      RETURNING user_id, email, name, plan, created_at, updated_at;
    `;
    const res = await this.pool.query(query, values);
    return res.rows[0] || null;
  }

  async delete(userId) {
    const query = `DELETE FROM users WHERE user_id = $1 RETURNING user_id;`;
    const res = await this.pool.query(query, [userId]);
    return res.rowCount > 0;
  }
}
