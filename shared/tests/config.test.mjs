import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { databaseOptions, databaseSsl, apiBaseUrl, publicBaseUrl } from '../config.mjs';

test('canonical database settings override legacy URL consistently', () => {
  const options = databaseOptions({ DB_HOST: 'db.example', DB_PORT: '5433', DB_USER: 'user', DB_PASSWORD: 'p@:#', DB_NAME: 'shared', DB_SSL: 'true', DATABASE_URL: 'postgres://old:old@localhost/old' });
  assert.deepEqual(options, { host: 'db.example', port: 5433, user: 'user', password: 'p@:#', database: 'shared', ssl: { rejectUnauthorized: true } });
  assert.equal(databaseOptions({ DB_HOST: 'db.example' }).database, 'securecam_db');
  assert.throws(() => databaseOptions({ DB_PORT: 'not-a-port' }), /DB_PORT/);
});
test('legacy URL remains supported and explicit TLS overrides conflicting URL flags', () => {
  const url = 'postgresql://user:p%40ss@db.example/shared?sslmode=require';
  assert.equal(new URL(databaseOptions({ DATABASE_URL: url }).connectionString).searchParams.get('sslmode'), 'require');
  const options = databaseOptions({ DATABASE_URL: url, DB_SSL: 'true' });
  assert.equal(new URL(options.connectionString).searchParams.has('sslmode'), false);
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
  assert.throws(() => databaseOptions({ DATABASE_URL: 'not a url' }), /^Error: Invalid DATABASE_URL$/);
  assert.equal(databaseSsl({ DB_SSL: 'false' }), false);
  assert.throws(() => databaseSsl({ DB_SSL: 'disabled' }), /DB_SSL/);
});
test('all DB clients receive a verified custom CA', () => {
  const directory = mkdtempSync(join(tmpdir(), 'securecam-shared-ca-'));
  const file = join(directory, 'ca.pem');
  writeFileSync(file, 'configuration-test-ca');
  try { assert.deepEqual(databaseOptions({ DB_SSL: 'true', DB_SSL_CA_FILE: file }).ssl, { rejectUnauthorized: true, ca: 'configuration-test-ca' }); }
  finally { unlinkSync(file); rmdirSync(directory); }
});
test('API and public links preserve proxy prefixes and support the previous origin setting', () => {
  assert.equal(apiBaseUrl({ API_BASE_URL: 'https://host/prefix/v1/', PUBLIC_BASE_URL: 'https://old' }), 'https://host/prefix/v1');
  assert.equal(publicBaseUrl({ API_BASE_URL: 'https://host/prefix/v1/' }), 'https://host/prefix');
  assert.equal(apiBaseUrl({ PUBLIC_BASE_URL: 'https://old/' }), 'https://old/v1');
  assert.equal(apiBaseUrl({ PORT: '3007' }), 'http://localhost:3007/v1');
});
test('every backend PostgreSQL pool uses the same canonical settings without connecting', () => {
  const script = `
    import assert from 'node:assert/strict';
    const clients = [
      ['../user-auth/src/config/database.js','getPool'],
      ['../device-heartbeat/src/config/database.js','getPool'],
      ['../event-notification/src/config/database.js','getDatabasePool'],
      ['../vpn/src/config/database.js','getDatabasePool'],
      ['../storage-retention/src/config/database.js','pool'],
    ];
    for (const [file,key] of clients) {
      const module = await import(file);
      const pool = typeof module[key] === 'function' ? module[key]() : module[key];
      assert.equal(pool.options.host, 'shared-db.invalid');
      assert.equal(pool.options.database, 'shared_test');
      assert.equal(pool.options.ssl.rejectUnauthorized, true);
      assert.equal(pool.options.connectionString, undefined);
      await pool.end();
    }
    const {createDeviceStore} = await import('../mediamtx/src/adapters.js');
    const store = createDeviceStore(); await store.close();
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test', DB_DRIVER: 'postgres', DB_HOST: 'shared-db.invalid', DB_NAME: 'shared_test', DB_SSL: 'true', DB_SSL_CA_FILE: '', DATABASE_URL: 'postgres://old:old@localhost/old' },
  });
  assert.equal(result.status, 0, result.stderr);
});
test('all component example files are valid UTF-8 dotenv with unique variables', () => {
  for (const component of ['controller', 'user-auth', 'device-heartbeat', 'event-notification', 'vpn', 'storage-retention', 'mediamtx']) {
    const text = readFileSync(new URL(`../../${component}/.env.example`, import.meta.url), 'utf8');
    assert.equal(text.includes('\uFFFD'), false, component);
    const names = [...text.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(match => match[1]);
    assert.equal(new Set(names).size, names.length, component);
    const values = parseEnv(text);
    assert.ok(values.DB_HOST, component);
    assert.equal(values.DATABASE_URL, undefined, component);
    assert.equal(values.PUBLIC_BASE_URL, undefined, component);
  }
});
