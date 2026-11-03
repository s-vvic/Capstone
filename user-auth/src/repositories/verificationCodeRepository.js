import crypto from 'crypto';
import { getPool } from '../config/database.js';
import { logger } from '../utils/logger.js';

export class PostgresVerificationCodeRepository {
  async create({ target, code, type = 'signup', expiresAt }) {
    const pool = getPool();
    const verificationId = crypto.randomUUID();
    const query = `
      INSERT INTO verification_codes (
        verification_id, target, code, type, is_verified, is_used, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, false, false, $5, NOW())
      RETURNING *;
    `;
    const res = await pool.query(query, [verificationId, target.toLowerCase().trim(), code, type, expiresAt]);
    return res.rows[0];
  }

  async findLatestActive({ target, type = 'signup' }) {
    const pool = getPool();
    const query = `
      SELECT * FROM verification_codes
      WHERE target = $1 AND type = $2 AND is_used = false AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const res = await pool.query(query, [target.toLowerCase().trim(), type]);
    return res.rows[0] || null;
  }

  async markVerified(verificationId) {
    const pool = getPool();
    const query = `
      UPDATE verification_codes
      SET is_verified = true
      WHERE verification_id = $1
      RETURNING *;
    `;
    const res = await pool.query(query, [verificationId]);
    return res.rows[0] || null;
  }

  async markUsed(verificationId) {
    const pool = getPool();
    const query = `
      UPDATE verification_codes
      SET is_used = true
      WHERE verification_id = $1
      RETURNING *;
    `;
    const res = await pool.query(query, [verificationId]);
    return res.rows[0] || null;
  }
}

export class InMemoryVerificationCodeRepository {
  constructor() {
    this.codes = new Map();
  }

  async create({ target, code, type = 'signup', expiresAt }) {
    const verificationId = crypto.randomUUID();
    const record = {
      verification_id: verificationId,
      target: target.toLowerCase().trim(),
      code: String(code).trim(),
      type,
      is_verified: false,
      is_used: false,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };
    this.codes.set(verificationId, record);
    return record;
  }

  async findLatestActive({ target, type = 'signup' }) {
    const normalizedTarget = target.toLowerCase().trim();
    const now = new Date();
    const active = [];

    for (const record of this.codes.values()) {
      if (
        record.target === normalizedTarget &&
        record.type === type &&
        !record.is_used &&
        new Date(record.expires_at) > now
      ) {
        active.push(record);
      }
    }

    if (active.length === 0) return null;
    active.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return active[0];
  }

  async markVerified(verificationId) {
    const record = this.codes.get(verificationId);
    if (!record) return null;
    record.is_verified = true;
    return record;
  }

  async markUsed(verificationId) {
    const record = this.codes.get(verificationId);
    if (!record) return null;
    record.is_used = true;
    return record;
  }

  clear() {
    this.codes.clear();
  }
}
