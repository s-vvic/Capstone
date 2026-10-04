import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool = null;

export function getDatabasePool() {
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
      logger.error('Unexpected PostgreSQL pool error', { error: err.message });
    });
  }

  return pool;
}

export async function closeDatabasePool() {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}
