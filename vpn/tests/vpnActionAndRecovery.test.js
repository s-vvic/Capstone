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
import { VPN_STATUS } from '../src/constants/vpnConstants.js';

test('VPN Action & Recovery API (ICD 2.5.2, 2.5.3, SV-F-014)', async (t) => {
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

    await peerService.registerPeer({
      peer_id: 'CAM-ACTION-1',
      peer_type: 'device',
      name: '제어 대상 카메라',
      mac_no: '00:11:22:33:44:55',
      user_id: 'user-owner',
    });

    app = createApp();
  });

  await t.test('수동 끊기 (action: "disconnect") 실행 검증', async () => {
    const res = await request(app)
      .post('/v1/vpn/connections/CAM-ACTION-1/action')
      .set('x-user-id', 'user-owner')
      .send({ action: 'disconnect' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.action, 'disconnect');
    assert.equal(res.body.vpn_status, VPN_STATUS.DISCONNECTED);

    // 드라이버에서도 제거되었는지 확인
    const peer = await repo.findById('CAM-ACTION-1');
    const driverPeer = await driver.getPeer(peer.wg_pubkey);
    assert.equal(driverPeer, null);
  });

  await t.test('수동 연결 (action: "connect") 실행 검증', async () => {
    // 먼저 끊기
    await request(app)
      .post('/v1/vpn/connections/CAM-ACTION-1/action')
      .set('x-user-id', 'user-owner')
      .send({ action: 'disconnect' });

    // 다시 연결
    const res = await request(app)
      .post('/v1/vpn/connections/CAM-ACTION-1/action')
      .set('x-user-id', 'user-owner')
      .send({ action: 'connect' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.action, 'connect');
    assert.equal(res.body.vpn_status, VPN_STATUS.CONNECTED);

    // 드라이버에 재등록되었는지 확인
    const peer = await repo.findById('CAM-ACTION-1');
    const driverPeer = await driver.getPeer(peer.wg_pubkey);
    assert.ok(driverPeer);
  });

  await t.test('잘못된 action 전달 시 400 Bad Request', async () => {
    const res = await request(app)
      .post('/v1/vpn/connections/CAM-ACTION-1/action')
      .set('x-user-id', 'user-owner')
      .send({ action: 'restart' });

    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  await t.test('타인의 기기 action 시도 시 403 Forbidden', async () => {
    const res = await request(app)
      .post('/v1/vpn/connections/CAM-ACTION-1/action')
      .set('x-user-id', 'attacker')
      .send({ action: 'disconnect' });

    assert.equal(res.status, 403);
  });

  await t.test('VPN 서버 복구 요청 (POST /v1/vpn/connections/:deviceId/recover, ICD 2.5.3)', async () => {
    // 에러 상태 유발
    await repo.update('CAM-ACTION-1', {
      vpn_status: VPN_STATUS.ERROR,
      error_type: 'error_handshake_timeout',
    });

    const res = await request(app)
      .post('/v1/vpn/connections/CAM-ACTION-1/recover')
      .set('x-user-id', 'user-owner');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.vpn_status, VPN_STATUS.CONNECTED);
    assert.ok(res.body.recovered_at);

    // 복구 후 DB 확인
    const updated = await repo.findById('CAM-ACTION-1');
    assert.equal(updated.vpn_status, VPN_STATUS.CONNECTED);
    assert.equal(updated.error_type, null);
  });

  await t.test('VPN 상태 및 IP 풀 통계 조회 (GET /v1/vpn/status)', async () => {
    const res = await request(app).get('/v1/vpn/status');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
    assert.ok(res.body.server_endpoint);
    assert.ok(res.body.ip_pool);
    assert.equal(res.body.ip_pool.capacity, 241);
    assert.equal(res.body.ip_pool.allocated_count, 1);
  });
});
