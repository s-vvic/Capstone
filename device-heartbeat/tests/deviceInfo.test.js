import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createDeviceHeartbeatApp, env } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('SV-F-012 & ICD 2.2.1 / 2.2.3 / 2.2.4 보드 목록, 상세 상태 및 정보 수정 테스트', () => {
  let app;
  let testToken;
  const testUserId = '12345678-1234-1234-1234-123456789012';

  beforeEach(() => {
    setInMemoryDriver();
    app = createDeviceHeartbeatApp();

    testToken = jwt.sign(
      { sub: testUserId, email: 'owner@securecam.com', name: '소유자', plan: 'standard' },
      env.JWT_SECRET
    );
  });

  test('로그인 사용자의 등록 보드 목록 전체 조회 (GET /devices, ICD 2.2.1)', async () => {
    // 2대 보드 등록
    await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ register_type: 'serial', serial_no: 'SN-001', name: '카메라 1' });

    await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ register_type: 'serial', serial_no: 'SN-002', name: '카메라 2' });

    const res = await request(app)
      .get('/v1/devices')
      .set('Authorization', `Bearer ${testToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.length, 2);
    assert.equal(res.body[0].name, '카메라 1');
    assert.equal(res.body[1].name, '카메라 2');
    assert.ok(res.body[0].device_id);
    assert.ok(res.body[0].serial_no);
    assert.ok(res.body[0].status);
    assert.ok(res.body[0].vpn_status);
  });

  test('특정 보드의 현재 상세 상태 및 스트림 URL 조회 (GET /devices/:id/status, ICD 2.2.3)', async () => {
    const regRes = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ register_type: 'serial', serial_no: 'SN-STATUS-01', name: '상태 테스트 카메라' });

    const deviceId = regRes.body.device_id;

    const res = await request(app)
      .get(`/v1/devices/${deviceId}/status`)
      .set('Authorization', `Bearer ${testToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'offline');
    assert.equal(res.body.vpn_status, 'disconnected');
    assert.ok(res.body.vpn_ip.startsWith('10.0.0.'));
    assert.ok(res.body.rtsp_url.includes(':8554/'));
    assert.ok(res.body.rtsp_url_sub.includes(':8554/'));
    assert.equal(res.body.storage_total_gb, 32.0);
  });

  test('보드 이름, 위치, 설명, 그룹 정보 수정 (PATCH /devices/:id, SV-F-012, ICD 2.2.4)', async () => {
    const regRes = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({ register_type: 'serial', serial_no: 'SN-EDIT-01', name: '원래 이름' });

    const deviceId = regRes.body.device_id;

    const res = await request(app)
      .patch(`/v1/devices/${deviceId}`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        name: '수정된 거실 카메라',
        location: '거실 정면 벽면',
        description: '가족 안전 모니터링용 웹캠',
        group_id: 'LIVING_ROOM',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.name, '수정된 거실 카메라');
    assert.equal(res.body.location, '거실 정면 벽면');
    assert.equal(res.body.description, '가족 안전 모니터링용 웹캠');
    assert.equal(res.body.group_id, 'LIVING_ROOM');
  });
});
