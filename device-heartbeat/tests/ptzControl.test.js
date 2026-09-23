import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createDeviceHeartbeatApp, env } from '../src/index.js';
import { setInMemoryDriver, deviceRepository } from '../src/repositories/index.js';

describe('WC-F-033 & ICD 3.4 PTZ 원격 제어 명령 중계 테스트', () => {
  let app;
  let testToken;
  const testUserId = '55555555-5555-5555-5555-555555555555';

  beforeEach(() => {
    setInMemoryDriver();
    app = createDeviceHeartbeatApp();

    testToken = jwt.sign(
      { sub: testUserId, email: 'ptzuser@securecam.com', name: 'PTZ유저' },
      env.JWT_SECRET
    );
  });

  test('온라인 상태 보드에 PTZ 명령 전달 성공 (POST /devices/:id/ptz, ICD 3.4)', async () => {
    // 1. 보드 등록
    const regRes = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ register_type: 'serial', serial_no: 'PTZ-CAM-01', name: 'PTZ 지원 웹캠' });

    const deviceId = regRes.body.device_id;

    // 2. 보드를 온라인 상태로 변경
    await deviceRepository.update(deviceId, { status: 'online' });

    // 3. PTZ 명령 전달
    const res = await request(app)
      .post(`/v1/devices/${deviceId}/ptz`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        action: 'left',
        speed: 7,
        zoom_scale: 1.5,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.device_id, deviceId);
    assert.equal(res.body.command.action, 'left');
    assert.equal(res.body.command.speed, 7);
    assert.equal(res.body.command.zoom_scale, 1.5);
  });

  test('오프라인 상태 보드에 PTZ 명령 전달 시 400 BAD_REQUEST 오류 반환', async () => {
    const regRes = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ register_type: 'serial', serial_no: 'PTZ-OFFLINE-01', name: '오프라인 웹캠' });

    const deviceId = regRes.body.device_id; // 기본 offline 상태

    const res = await request(app)
      .post(`/v1/devices/${deviceId}/ptz`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ action: 'up' });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'BAD_REQUEST');
    assert.ok(res.body.message.includes('오프라인'));
  });

  test('유효하지 않은 PTZ action 전송 시 400 BAD_REQUEST 반환', async () => {
    const regRes = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ register_type: 'serial', serial_no: 'PTZ-INVALID-01' });

    const deviceId = regRes.body.device_id;

    const res = await request(app)
      .post(`/v1/devices/${deviceId}/ptz`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ action: 'invalid_dance_action' });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'BAD_REQUEST');
  });
});
