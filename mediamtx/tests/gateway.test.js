import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadConfig, mediaMtxConfig, inBoardSubnet } from '../src/config.js';
import { createAuthenticator } from '../src/adapters.js';
import { MediaClient } from '../src/mediaClient.js';
import { GatewayError } from '../src/errors.js';

export const settings = () => loadConfig({ MTX_API_PASSWORD: 'a'.repeat(32), MTX_READ_PASSWORD: 'b'.repeat(32),
  C7_PUBLIC_BASE_URL: 'http://10.0.0.1:3007', C7_ALLOWED_ORIGINS: 'http://localhost:5173' });
const mac = 'AABBCCDDEEFF';

async function fixture(t, changes = {}) {
  const config = settings();
  const calls = [];
  let time = 100000;
  const device = { device_id: 'CAM-EEFF', mac, vpn_ip: '10.0.1.2', is_active: true };
  const media = {
    async health() {}, async status() { return { ready: false, tracks: [], readers: 0 }; },
    async ensure(d, q) { calls.push(['ensure', d, q]); return `devices/${d.mac}/${q}`; },
    sessionPath(location) { return location; },
    async whep(path, options) {
      calls.push([path, options]);
      return options.method === 'POST'
        ? new Response('v=0\r\nanswer', { status: 201, headers: { location: '/upstream/session', etag: '"tag"' } })
        : new Response(null, { status: 204 });
    },
  };
  const devices = { async health() {}, async findOwned(m, user) { return m === mac && user === 'owner' ? device : null; } };
  const authenticate = async token => {
    if (!['Bearer owner', 'Bearer other'].includes(token)) throw new GatewayError(401, 'UNAUTHORIZED', 'Invalid session');
    return { userId: token.slice(7) };
  };
  Object.assign(media, changes.media);
  Object.assign(devices, changes.devices);
  Object.assign(config, changes.config);
  const gateway = createApp({ config, authenticate, devices, media, now: () => time, logger: { error() {} } });
  const server = gateway.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await gateway.close(); await new Promise(resolve => server.close(resolve)); });
  const request = (path, init = {}) => fetch(base + path, { ...init, headers: { authorization: 'Bearer owner', ...init.headers } });
  return { config, calls, gateway, media, request, setTime(value) { time = value; } };
}

test('configuration confines native interfaces and permits only RTSP/TCP pulls and WebRTC reads', () => {
  const config = mediaMtxConfig(settings());
  assert.equal(config.apiAddress, '127.0.0.1:9997');
  assert.equal(config.webrtcAddress, '127.0.0.1:8889');
  assert.equal(config.pathDefaults.rtspTransport, 'tcp');
  assert.equal(config.webrtcIPsFromInterfaces, false);
  assert.deepEqual(config.webrtcICEServers2, []);
  assert.deepEqual(config.paths, {});
  assert.ok(config.authInternalUsers.every(u => u.permissions.every(p => p.action !== 'publish')));
  assert.equal(config.hls, false);
  assert.equal(config.pathDefaults.record, false);
});
test('canonical shared names win over previous C7 aliases', () => {
  const config = loadConfig({ MTX_API_PASSWORD: 'a'.repeat(32), MTX_READ_PASSWORD: 'b'.repeat(32),
    PORT: '3107', C7_PORT: '9999', RTSP_PORT: '8554', C7_RTSP_PORT: '554',
    API_BASE_URL: 'https://media.example/prefix/v1', C7_PUBLIC_BASE_URL: 'http://old.example',
    WG_SERVER_IP: '10.0.0.5', MTX_VPN_IP: '10.0.0.6' });
  assert.equal(config.port, 3107);
  assert.equal(config.rtspPort, 8554);
  assert.equal(config.publicBase, 'https://media.example/prefix');
  assert.equal(config.vpnIp, '10.0.0.5');
  const legacy = loadConfig({ MTX_API_PASSWORD: 'a'.repeat(32), MTX_READ_PASSWORD: 'b'.repeat(32),
    C7_PORT: '3108', C7_RTSP_PORT: '8555', C7_PUBLIC_BASE_URL: 'http://legacy.example', MTX_VPN_IP: '10.0.0.8' });
  assert.equal(legacy.port, 3108);
  assert.equal(legacy.rtspPort, 8555);
  assert.equal(legacy.publicBase, 'http://legacy.example');
  assert.equal(legacy.vpnIp, '10.0.0.8');
});
test('reject unsafe configuration and off-subnet board destinations', () => {
  assert.throws(() => loadConfig({}), /PASSWORD/);
  assert.throws(() => loadConfig({ MTX_API_PASSWORD: 'a'.repeat(32), MTX_READ_PASSWORD: 'b'.repeat(32), MTX_API_URL: 'http://0.0.0.0:9997' }), /127.0.0.1/);
  for (const ip of ['127.0.0.1', '169.254.169.254', '10.0.2.1', '10.0.1.0', '10.0.1.255', 'bad']) assert.equal(inBoardSubnet(ip, '10.0.1.0/24'), false);
  assert.equal(inBoardSubnet('10.0.1.2', '10.0.1.0/24'), true);
});
test('C1 authentication distinguishes invalid sessions from dependency failures', async () => {
  const auth = createAuthenticator(settings(), async (url, options) => {
    assert.equal(options.headers.authorization, 'Bearer token');
    return Response.json({ user_id: 'owner', plan: 'basic' });
  });
  assert.equal((await auth('Bearer token')).userId, 'owner');
  await assert.rejects(auth('token'), { status: 401 });
  await assert.rejects(createAuthenticator(settings(), async () => new Response(null, { status: 401 }))('Bearer token'), { status: 401 });
  await assert.rejects(createAuthenticator(settings(), async () => { throw new Error('offline'); })('Bearer token'), { status: 503 });
  await assert.rejects(createAuthenticator(settings(), async () => Response.json({}))('Bearer token'), { status: 503 });
});
test('metadata contains both qualities, device identity and authenticated WHEP URLs', async t => {
  const f = await fixture(t);
  const response = await f.request(`/v1/streams/${mac}`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.device_id, 'CAM-EEFF'); assert.equal(body.mac, mac);
  assert.deepEqual(body.streams.map(s => s.quality), ['high', 'low']);
  assert.ok(body.streams.every(s => s.whep_url.startsWith(f.config.publicBase)));
  assert.equal(f.calls.length, 0);
});
test('unauthenticated, unowned, malformed and disallowed-origin requests cannot allocate media', async t => {
  const f = await fixture(t);
  assert.equal((await f.request(`/v1/streams/${mac}`, { headers: { authorization: '' } })).status, 401);
  assert.equal((await f.request(`/v1/streams/${mac}`, { headers: { authorization: 'Bearer other' } })).status, 404);
  assert.equal((await f.request('/v1/streams/aabbccddeeff')).status, 400);
  assert.equal((await f.request(`/v1/streams/${mac}/ultra/status`)).status, 400);
  assert.equal((await f.request(`/v1/streams/${mac}`, { headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal(f.calls.length, 0);
});
test('WHEP offer, trickle ICE and deletion preserve session ownership and rewrite Location', async t => {
  const f = await fixture(t);
  const endpoint = `/v1/streams/${mac}/low/whep`;
  const response = await f.request(endpoint, { method: 'POST', headers: { 'content-type': 'application/sdp', origin: 'http://localhost:5173' }, body: 'v=0\r\noffer' });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('access-control-expose-headers').includes('Location'), true);
  assert.equal(await response.text(), 'v=0\r\nanswer');
  const location = new URL(response.headers.get('location')).pathname;
  assert.ok(location.startsWith(endpoint + '/'));
  assert.equal(response.headers.get('etag'), '"tag"');
  assert.equal((await f.request(location, { method: 'DELETE', headers: { authorization: 'Bearer other' } })).status, 404);
  assert.equal((await f.request(location.replace('/low/', '/high/'), { method: 'DELETE' })).status, 404);
  assert.equal((await f.request(location, { method: 'PATCH', headers: { 'content-type': 'application/trickle-ice-sdpfrag', 'if-match': '"tag"' }, body: 'a=candidate:test' })).status, 204);
  assert.equal((await f.request(location, { method: 'DELETE' })).status, 204);
  assert.equal((await f.request(location, { method: 'DELETE' })).status, 404);
  assert.ok(f.calls.some(([path, options]) => path === '/upstream/session' && options.method === 'PATCH' && options.headers['if-match'] === '"tag"'));
});
test('capacity, invalid content, source failures and expired session cleanup', async t => {
  const f = await fixture(t, { config: { maxSessions: 1, sessionTtlMs: 1000 } });
  const endpoint = `/v1/streams/${mac}/high/whep`;
  assert.equal((await f.request(endpoint, { method: 'POST', body: '{}' })).status, 415);
  const options = { method: 'POST', headers: { 'content-type': 'application/sdp' }, body: 'v=0\r\noffer' };
  assert.equal((await f.request(endpoint, options)).status, 201);
  assert.equal((await f.request(endpoint, options)).status, 429);
  f.setTime(102000); await f.gateway.sweep();
  assert.equal((await f.request(endpoint, options)).status, 201);
});
test('health reports dependency failure instead of a constant healthy status', async t => {
  const f = await fixture(t, { media: { async health() { throw new Error('offline'); } } });
  const response = await f.request('/health');
  assert.equal(response.status, 503);
  assert.equal((await response.json()).dependencies.mediamtx, false);
});
test('active streams close after board ownership is revoked', async t => {
  let owned = true;
  const f = await fixture(t, { devices: { async findOwned() { return owned ? { device_id: 'CAM-EEFF', mac, vpn_ip: '10.0.1.2' } : null; } } });
  const response = await f.request(`/v1/streams/${mac}/high/whep`, { method: 'POST', headers: { 'content-type': 'application/sdp' }, body: 'v=0\r\noffer' });
  assert.equal(response.status, 201);
  owned = false;
  f.setTime(131000);
  await f.gateway.sweep();
  assert.equal((await (await f.request('/health')).json()).active_sessions, 0);
  assert.ok(f.calls.some(([path, options]) => path === '/upstream/session' && options.method === 'DELETE'));
});
test('unavailable sources return a sanitized error and do not consume session capacity', async t => {
  const f = await fixture(t, { media: { async ensure() { throw new GatewayError(503, 'MEDIA_UNAVAILABLE', 'MediaMTX unavailable'); } } });
  const response = await f.request(`/v1/streams/${mac}/high/whep`, { method: 'POST', headers: { 'content-type': 'application/sdp' }, body: 'v=0\r\noffer' });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error_code: 'MEDIA_UNAVAILABLE', message: 'MediaMTX unavailable' });
  assert.equal((await (await f.request('/health')).json()).active_sessions, 0);
});
test('MediaMTX client serializes path creation and updates changed VPN sources', async () => {
  const config = settings();
  const store = new Map(); const calls = [];
  const client = new MediaClient(config, async (url, options) => {
    calls.push([url, options]);
    const key = decodeURIComponent(new URL(url).pathname.split('/').at(-1));
    if (options.method === 'POST' || options.method === 'PATCH') { store.set(key, JSON.parse(options.body)); return Response.json({ status: 'ok' }); }
    return store.has(key) ? Response.json(store.get(key)) : new Response(null, { status: 404 });
  });
  const device = { mac, vpn_ip: '10.0.1.2' };
  await Promise.all([client.ensure(device, 'high'), client.ensure(device, 'high')]);
  assert.equal(calls.filter(([, options]) => options.method === 'POST').length, 1);
  device.vpn_ip = '10.0.1.3'; await client.ensure(device, 'high');
  assert.equal(store.get(`devices/${mac}/high`).source, 'rtsp://10.0.1.3:554/live/0');
  assert.equal(calls.filter(([, options]) => options.method === 'PATCH').length, 1);
  device.vpn_ip = '169.254.169.254'; await assert.rejects(client.ensure(device, 'high'), { status: 409 });
  assert.ok(calls.every(([, options]) => options.headers.authorization.startsWith('Basic ')));
});
test('upstream session locations cannot become an arbitrary HTTP proxy', () => {
  const client = new MediaClient(settings()); const path = `devices/${mac}/high`;
  const suffix = '/whep/12345678-1234-1234-1234-123456789abc';
  assert.equal(client.sessionPath(`/${path}${suffix}`, path), `/${path}${suffix}`);
  for (const location of [`http://evil.example/${path}${suffix}`, '/v3/config/global/get', `/${path}${suffix}?secret=1`])
    assert.throws(() => client.sessionPath(location, path), { status: 502 });
});
