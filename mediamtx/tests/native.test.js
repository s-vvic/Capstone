import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { loadConfig, mediaMtxConfig } from '../src/config.js';
import { MediaClient } from '../src/mediaClient.js';

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
test('official MediaMTX binary validates generated config and serves authenticated dynamic paths', { skip: !process.env.MTX_TEST_BINARY, timeout: 30000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'securecam-c7-test-'));
  const apiPort = await freePort(); const whepPort = await freePort(); const icePort = await freePort();
  const config = loadConfig({ MTX_API_PASSWORD: 'a'.repeat(32), MTX_READ_PASSWORD: 'b'.repeat(32),
    MTX_API_URL: `http://127.0.0.1:${apiPort}`, MTX_WHEP_URL: `http://127.0.0.1:${whepPort}`,
    MTX_VPN_IP: '127.0.0.1', MTX_ICE_UDP_PORT: String(icePort) });
  const file = join(directory, 'mediamtx.yml');
  await writeFile(file, JSON.stringify(mediaMtxConfig(config)));
  t.after(() => rm(directory, { recursive: true, force: true })); // mkdtemp owns this exact test directory.
  const validation = spawnSync(process.env.MTX_TEST_BINARY, [`--validate-conf=${file}`], { encoding: 'utf8', windowsHide: true });
  assert.equal(validation.status, 0, validation.stdout + validation.stderr);
  const binary = spawn(process.env.MTX_TEST_BINARY, [file], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let output = '';
  binary.stdout.on('data', chunk => { output += chunk; }); binary.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    if (binary.exitCode === null) {
      const exit = new Promise(resolve => binary.once('exit', resolve));
      binary.kill(); await exit;
    }
  });
  const client = new MediaClient(config);
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try { await client.health(); ready = true; break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, output);
  assert.equal((await fetch(`${config.apiUrl}/v3/config/global/get`)).status, 401);
  const device = { mac: 'AABBCCDDEEFF', vpn_ip: '10.0.1.2' };
  await Promise.all([client.ensure(device, 'high'), client.ensure(device, 'low')]);
  const high = await (await client.api('/v3/config/paths/get/devices%2FAABBCCDDEEFF%2Fhigh')).json();
  assert.equal(high.source, 'rtsp://10.0.1.2:554/live/0');
  assert.equal(high.rtspTransport, 'tcp');
  assert.equal(high.sourceOnDemand, true);
  assert.equal((await client.status(device.mac, 'high')).ready, false);
  device.vpn_ip = '10.0.1.3'; await client.ensure(device, 'high');
  const updated = await (await client.api('/v3/config/paths/get/devices%2FAABBCCDDEEFF%2Fhigh')).json();
  assert.equal(updated.source, 'rtsp://10.0.1.3:554/live/0');
  const denied = await fetch(`${config.whepUrl}/devices/${device.mac}/high/whep`, { method: 'POST', headers: { 'content-type': 'application/sdp' }, body: 'v=0\r\n' });
  assert.equal(denied.status, 401);
  await denied.body?.cancel();
  const authenticated = await client.whep(`/devices/${device.mac}/high/whep`, { method: 'POST', headers: { 'content-type': 'application/sdp' }, body: 'invalid SDP' });
  assert.equal(authenticated.status, 400); // Authenticated request reaches negotiation and fails without a live source.
  await authenticated.body?.cancel();
});
