import pg from 'pg';
import { config } from './env.js';

const { Pool } = pg;

let pool = null;

export function getDatabasePool() {
  if (config.dbDriver !== 'postgres') {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client', err);
    });
  }

  return pool;
}

export async function closeDatabasePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
