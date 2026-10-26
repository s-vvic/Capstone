import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { setVpnRepository } from '../src/repositories/index.js';
import { setWireguardDriver } from '../src/drivers/index.js';
import { InMemoryVpnRepository } from '../src/repositories/inMemoryVpnRepository.js';
import { VirtualWireguardDriver } from '../src/drivers/virtualWireguardDriver.js';
import { VpnPeerService } from '../src/services/vpnPeerService.js';
import { defaultIpPoolManager } from '../src/services/ipPoolManager.js';

test('VPN Connections API - GET /v1/vpn/connections (ICD 2.5.1, SV-F-014)', async (t) => {
  let app;
  let repo;
  let driver;
  let peerService;

  t.beforeEach(async () => {
    defaultIpPoolManager.clear();
    repo = new InMemoryVpnRepository();
    driver = new VirtualWireguardDriver();

    setVpnRepository(repo);
    setWireguardDriver(driver);

    peerService = new VpnPeerService({ repository: repo, driver, ipPool: defaultIpPoolManager });

    // 테스트용 기기 사전 등록
    await peerService.registerPeer({
      peer_id: 'CAM-001',
      peer_type: 'device',
      name: '거실 카메라',
      mac_no: '00:11:22:33:44:01',
      user_id: 'user-A',
    });

    await peerService.registerPeer({
      peer_id: 'CAM-002',
      peer_type: 'device',
      name: '현관 카메라',
      mac_no: '00:11:22:33:44:02',
      user_id: 'user-B',
    });

    app = createApp();
  });

  await t.test('인증 없이 호출 시 401 Unauthorized', async () => {
    const res = await request(app).get('/v1/vpn/connections');
    assert.equal(res.status, 401);
    assert.ok(res.body.error);
  });

  await t.test('인증된 사용자의 기기 목록만 조회 (ICD 2.5.1 필드 규격 검증)', async () => {
    const res = await request(app)
      .get('/v1/vpn/connections')
      .set('x-user-id', 'user-A');

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 1);

    const item = res.body[0];
    assert.equal(item.device_id, 'CAM-001');
    assert.equal(item.device_name, '거실 카메라');
    assert.equal(item.mac_no, '00:11:22:33:44:01');
    assert.equal(item.vpn_status, 'connected');
    assert.equal(item.vpn_ip, '10.0.0.10');
    assert.equal(item.vpn_server, 'vpn.securecam.com:443');
    assert.equal(typeof item.connected_duration_sec, 'number');
    assert.ok(item.last_handshake);
    assert.equal(item.error_type, null);
    assert.equal(item.auto_connect, true);
    assert.equal(item.reconnect_on_start, true);
    assert.equal(item.reconnect_on_network_change, true);
  });

  await t.test('특정 기기 단건 조회 (GET /v1/vpn/connections/:deviceId)', async () => {
    const res = await request(app)
      .get('/v1/vpn/connections/CAM-001')
      .set('x-user-id', 'user-A');

    assert.equal(res.status, 200);
    assert.equal(res.body.device_id, 'CAM-001');
    assert.equal(res.body.vpn_ip, '10.0.0.10');
  });

  await t.test('타인의 기기 단건 조회 시 403 Forbidden', async () => {
    const res = await request(app)
      .get('/v1/vpn/connections/CAM-002')
      .set('x-user-id', 'user-A');

    assert.equal(res.status, 403);
    assert.ok(res.body.error);
  });

  await t.test('존재하지 않는 기기 조회 시 404 Not Found', async () => {
    const res = await request(app)
      .get('/v1/vpn/connections/NON-EXISTENT')
      .set('x-user-id', 'user-A');

    assert.equal(res.status, 404);
  });
});
