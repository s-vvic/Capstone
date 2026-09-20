import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

let pool = null;

/**
 * PostgreSQL 17.X 커넥션 풀 초기화
 */
export function getPool() {
  if (env.DB_DRIVER !== 'postgres') {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client:', err);
    });
  }

  return pool;
}

/**
 * DB 연결 헬스체크 (NF-A-001 가용성 요구사항)
 */
export async function testDbConnection() {
  if (env.DB_DRIVER !== 'postgres') {
    return { ok: true, driver: 'memory', message: 'In-memory standalone repository active' };
  }

  try {
    const p = getPool();
    const res = await p.query('SELECT version()');
    return { ok: true, driver: 'postgres', version: res.rows[0].version };
  } catch (error) {
    return { ok: false, driver: 'postgres', error: error.message };
  }
}

/**
 * DB 커넥션 풀 종료
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
