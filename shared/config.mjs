import { readFileSync } from 'node:fs';

// Shared names and precedence; this module never loads or prints a .env file.
const connectionKeys = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
export function databaseSsl(env = process.env) {
  const enabled = env.DB_SSL === true || env.DB_SSL === 'true';
  if (![undefined, '', true, false, 'true', 'false'].includes(env.DB_SSL)) throw new Error('DB_SSL must be true or false');
  if (!enabled) return false;
  return { rejectUnauthorized: true, ...(env.DB_SSL_CA_FILE ? { ca: readFileSync(env.DB_SSL_CA_FILE, 'utf8') } : {}) };
}

export function databaseOptions(env = process.env) {
  // Canonical DB_* connection fields win as a group. A legacy URL is fallback only.
  const canonical = connectionKeys.some(key => env[key] !== undefined && env[key] !== '');
  if (!canonical && env.DATABASE_URL) {
    let url;
    try { url = new URL(env.DATABASE_URL); } catch { throw new Error('Invalid DATABASE_URL'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Invalid DATABASE_URL protocol');
    const explicitSsl = env.DB_SSL !== undefined && env.DB_SSL !== '';
    if (explicitSsl) {
      // pg connection-string TLS query settings otherwise override its ssl option.
      for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
    }
    return { connectionString: url.toString(), ...(explicitSsl ? { ssl: databaseSsl(env) } : {}) };
  }
  const port = Number(env.DB_PORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT must be a valid port');
  return {
    host: env.DB_HOST || 'localhost', port, user: env.DB_USER || 'postgres',
    password: env.DB_PASSWORD ?? 'postgres', database: env.DB_NAME || 'securecam_db',
    ssl: databaseSsl(env),
  };
}

export function apiBaseUrl(env = process.env, defaultPort = 3000) {
  // Canonical API_BASE_URL includes /v1. Legacy public origins did not.
  const raw = env.API_BASE_URL || (env.PUBLIC_BASE_URL ? `${env.PUBLIC_BASE_URL.replace(/\/+$/, '')}/v1` : `http://localhost:${env.PORT || defaultPort}/v1`);
  return raw.replace(/\/+$/, '');
}

export function publicBaseUrl(env = process.env, defaultPort = 3000) {
  return apiBaseUrl(env, defaultPort).replace(/\/v1$/, '');
}
