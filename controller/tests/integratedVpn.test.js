import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createControllerApp } from '../src/app.js';
import { setVpnRepository } from '../../vpn/src/repositories/index.js';
import { setWireguardDriver } from '../../vpn/src/drivers/index.js';
import { InMemoryVpnRepository } from '../../vpn/src/repositories/inMemoryVpnRepository.js';
import { VirtualWireguardDriver } from '../../vpn/src/drivers/virtualWireguardDriver.js';
import { defaultIpPoolManager } from '../../vpn/src/services/ipPoolManager.js';
import { VPN_STATUS } from '../../vpn/src/constants/vpnConstants.js';
import { setInMemoryDriver as resetAuth } from '../../user-auth/src/repositories/index.js';
import { authService } from '../../user-auth/src/services/authService.js';

describe('마스터 컨트롤러 - 컴포넌트 4 (WireGuard VPN) 통합 연동 테스트 (ICD 2.5, SV-F-014)', () => {
  let app;
  let vpnRepo;
  let vpnDriver;
  let testToken;
  let testUserId;

  beforeEach(async () => {
    resetAuth();
    defaultIpPoolManager.clear();
    vpnRepo = new InMemoryVpnRepository();
    vpnDriver = new VirtualWireguardDriver();

    setVpnRepository(vpnRepo);
    setWireguardDriver(vpnDriver);

    app = createControllerApp();
    const user = await authService.register({ email: 'vpn-controller@example.com', password: 'VpnTest!2026', name: 'VPN owner' });
    testUserId = user.user_id;
    testToken = (await authService.login({ email: user.email, password: 'VpnTest!2026' })).access_token;
  });

  it('GET /v1/vpn/status - VPN 서버 헬스 및 IP 풀 가용성 통계 확인', async () => {
    await request(app).get('/v1/vpn/status').expect(401);
    const res = await request(app).get('/v1/vpn/status').set('Authorization', `Bearer ${testToken}`).expect(200);

    assert.equal(res.body.status, 'healthy');
    assert.ok(res.body.server_endpoint);
    assert.equal(res.body.ip_pool.capacity, 241);
    assert.equal(res.body.ip_pool.available_count, 241);
  });

  it('통합 워크플로우: 피어 등록 -> 연결 상태 조회 -> 수동 disconnect/connect -> 복구 요청', async () => {
    // 1. 피어 신규 등록 (보드 프로비저닝 또는 앱 등록)
    const regRes = await request(app)
      .post('/v1/vpn/peers/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        peer_id: 'CAM-CTRL-01',
        peer_type: 'device',
        name: '컨트롤러 테스트 카메라',
      })
      .expect(201);

    assert.equal(regRes.body.peer.peer_id, 'CAM-CTRL-01');
    assert.equal(regRes.body.peer.vpn_ip, '10.0.0.10');
    assert.ok(regRes.body.peer.wg_pubkey);

    // 2. VPN 연결 상태 목록 조회 (ICD 2.5.1)
    const listRes = await request(app)
      .get('/v1/vpn/connections')
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    assert.ok(Array.isArray(listRes.body));
    assert.equal(listRes.body.length, 1);
    assert.equal(listRes.body[0].device_id, 'CAM-CTRL-01');
    assert.equal(listRes.body[0].vpn_ip, '10.0.0.10');
    assert.equal(listRes.body[0].vpn_status, VPN_STATUS.CONNECTED);

    // 3. 수동 연결 끊기 (ICD 2.5.2)
    const disconnectRes = await request(app)
      .post('/v1/vpn/connections/CAM-CTRL-01/action')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ action: 'disconnect' })
      .expect(200);

    assert.equal(disconnectRes.body.vpn_status, VPN_STATUS.DISCONNECTED);

    // 4. 수동 재연결 (ICD 2.5.2)
    const reconnectRes = await request(app)
      .post('/v1/vpn/connections/CAM-CTRL-01/action')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ action: 'connect' })
      .expect(200);

    assert.equal(reconnectRes.body.vpn_status, VPN_STATUS.CONNECTED);

    // 5. 서버 복구 요청 (ICD 2.5.3)
    await vpnRepo.update('CAM-CTRL-01', {
      vpn_status: VPN_STATUS.ERROR,
      error_type: 'error_handshake_timeout',
    });

    const recoverRes = await request(app)
      .post('/v1/vpn/connections/CAM-CTRL-01/recover')
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    assert.equal(recoverRes.body.success, true);
    assert.equal(recoverRes.body.vpn_status, VPN_STATUS.CONNECTED);
  });
});

