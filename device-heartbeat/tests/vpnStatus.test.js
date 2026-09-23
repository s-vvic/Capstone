import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createDeviceHeartbeatApp, env } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('SV-F-014 & ICD 2.5 VPN 연결 상태 모니터링 및 수동 연결/끊기 테스트', () => {
  let app;
  let testToken;
  const testUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    setInMemoryDriver();
    app = createDeviceHeartbeatApp();

    testToken = jwt.sign(
      { sub: testUserId, email: 'vpnuser@securecam.com', name: 'VPN유저' },
      env.JWT_SECRET
    );
  });

  test('VPN 연결 상태 목록 전체 조회 (GET /vpn/connections, ICD 2.5.1)', async () => {
    await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ register_type: 'serial', serial_no: 'VPN-CAM-01', name: 'VPN 테스트 카메라' });

    const res = await request(app)
      .get('/v1/vpn/connections')
      .set('Authorization', `Bearer ${testToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    assert.equal(res.body[0].device_name, 'VPN 테스트 카메라');
    assert.equal(res.body[0].serial_no, 'VPN-CAM-01');
    assert.equal(res.body[0].vpn_status, 'disconnected');
    assert.ok(res.body[0].vpn_ip.startsWith('10.0.0.'));
    assert.ok(res.body[0].vpn_server);
    assert.equal(res.body[0].auto_connect, true);
  });

  test('VPN 수동 연결 및 끊기 액션 실행 (POST /vpn/connections/:id/action, SV-F-014, ICD 2.5.2)', async () => {
    const regRes = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ register_type: 'serial', serial_no: 'VPN-ACTION-01', name: '제어 대상 카메라' });

    const deviceId = regRes.body.device_id;

    // 1. 수동 연결 (connect)
    const connectRes = await request(app)
      .post(`/v1/vpn/connections/${deviceId}/action`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ action: 'connect' });

    assert.equal(connectRes.status, 200);
    assert.equal(connectRes.body.success, true);
    assert.equal(connectRes.body.vpn_status, 'connected');

    // 상태 확인
    const checkConnect = await request(app)
      .get(`/v1/devices/${deviceId}/status`)
      .set('Authorization', `Bearer ${testToken}`);
    assert.equal(checkConnect.body.vpn_status, 'connected');

    // 2. 수동 끊기 (disconnect)
    const disconnectRes = await request(app)
      .post(`/v1/vpn/connections/${deviceId}/action`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ action: 'disconnect' });

    assert.equal(disconnectRes.status, 200);
    assert.equal(disconnectRes.body.success, true);
    assert.equal(disconnectRes.body.vpn_status, 'disconnected');
  });
});
