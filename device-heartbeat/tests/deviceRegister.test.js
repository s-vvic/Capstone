import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createDeviceHeartbeatApp, env } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('SV-F-010 & ICD 2.2 보드 등록 및 관리 기능 테스트', () => {
  let app;
  let testToken;
  const testUserId = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    setInMemoryDriver();
    app = createDeviceHeartbeatApp();

    testToken = jwt.sign(
      { sub: testUserId, email: 'user@securecam.com', name: '홍길동', plan: 'basic' },
      env.JWT_SECRET
    );
  });

  test('시리얼 번호(serial) 방식으로 신규 보드 등록 시 201 Created와 보드 정보 반환 (SV-F-010, ICD 2.2.2)', async () => {
    const res = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        register_type: 'serial',
        serial_no: 'VPNCAM-000001',
        name: '거실 웹캠',
        location: '거실 창문',
        group_id: 'GROUP-A',
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.device_id.startsWith('CAM-'));
    assert.equal(res.body.serial_no, 'VPNCAM-000001');
    assert.equal(res.body.name, '거실 웹캠');
    assert.equal(res.body.location, '거실 창문');
    assert.equal(res.body.group_id, 'GROUP-A');
    assert.equal(res.body.user_id, testUserId);
    assert.ok(res.body.vpn_ip.startsWith('10.0.0.'));
    assert.ok(res.body.rtsp_url.includes(':8554/'));
  });

  test('QR 코드(qr) 방식으로 보드 등록 성공 (SV-F-010, ICD 2.2.2)', async () => {
    const res = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        register_type: 'qr',
        serial_no: 'VPNCAM-000002',
        name: '현관 카메라',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.serial_no, 'VPNCAM-000002');
    assert.equal(res.body.name, '현관 카메라');
  });

  test('사전 프로비저닝된 보드를 등록 코드(code) 방식으로 계정에 등록 성공 (SV-F-010)', async () => {
    // 1. 보드 최초 부팅 프로비저닝 발생 (코드 생성됨)
    const provRes = await request(app)
      .post('/v1/devices/provision-by-serial')
      .send({
        serial_no: 'VPNCAM-CODE-001',
        wg_pubkey: 'pubkey1234567890=',
        firmware_version: 'v1.0.0',
        model: 'RV-1106',
      });
    assert.equal(provRes.status, 200);

    // 저장소에서 생성된 등록 코드 조회
    const { deviceRepository } = await import('../src/repositories/index.js');
    const device = await deviceRepository.findBySerial('VPNCAM-CODE-001');
    assert.ok(device.register_code);

    // 2. 사용자가 등록 코드로 보드 등록
    const res = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        register_type: 'code',
        register_code: device.register_code,
        name: '내 코드 보드',
        location: '서재',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.device_id, device.device_id);
    assert.equal(res.body.user_id, testUserId);
    assert.equal(res.body.name, '내 코드 보드');
  });

  test('이미 타 사용자에게 등록된 보드 재등록 시 409 CONFLICT 오류 반환 (ICD 8.0)', async () => {
    // 사용자 A가 등록
    await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        register_type: 'serial',
        serial_no: 'VPNCAM-DUPLICATE',
      });

    // 다른 사용자 B 토큰
    const otherToken = jwt.sign(
      { sub: '99999999-9999-9999-9999-999999999999', email: 'other@securecam.com' },
      env.JWT_SECRET
    );

    // 사용자 B가 동일 시리얼 번호 등록 시도 -> 409 Conflict
    const res = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        register_type: 'serial',
        serial_no: 'VPNCAM-DUPLICATE',
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'CONFLICT');
    assert.ok(res.body.message.includes('이미 다른 계정에 등록'));
  });

  test('필수 파라미터(serial_no) 누락 시 400 BAD_REQUEST 오류 반환 (ICD 8.0)', async () => {
    const res = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        register_type: 'serial',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'BAD_REQUEST');
  });
});
