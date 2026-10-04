import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDeviceHeartbeatApp } from '../src/index.js';
import { setInMemoryDriver, deviceRepository } from '../src/repositories/index.js';

describe('SV-F-013 & ICD 3.1 / 3.2 보드 프로비저닝 및 Heartbeat 처리 테스트', () => {
  let app;

  beforeEach(() => {
    setInMemoryDriver();
    app = createDeviceHeartbeatApp();
  });

  test('보드 최초 부팅 시 프로비저닝 요청 성공 (POST /devices/provision-by-serial, ICD 3.1)', async () => {
    const res = await request(app)
      .post('/v1/devices/provision-by-serial')
      .send({
        serial_no: 'VPNCAM-000001',
        wg_pubkey: 'boardWireGuardPubKeyBase64=',
        firmware_version: 'v1.0.0',
        model: 'RV-1106',
      });

    assert.equal(res.status, 200);
    assert.ok(res.body.device_id.startsWith('CAM-'));
    assert.ok(res.body.vpn_ip.startsWith('10.0.0.'));
    assert.ok(res.body.server_pubkey);
    assert.ok(res.body.server_endpoint);
    assert.ok(res.body.provision_token.startsWith('prov_'));
    assert.ok(res.body.rtsp_proxy_ip);
  });

  test('정상 Heartbeat 전송 시 204 No Content 반환 및 상태 갱신 (POST /devices/heartbeat, ICD 3.2, SV-F-013)', async () => {
    // 1. 사전 프로비저닝
    const provRes = await request(app)
      .post('/v1/devices/provision-by-serial')
      .send({
        serial_no: 'VPNCAM-000001',
        wg_pubkey: 'boardWireGuardPubKeyBase64=',
        firmware_version: 'v1.0.0',
        model: 'RV-1106',
      });

    const { provision_token, device_id } = provRes.body;

    // 2. 30초 주기 Heartbeat 전송
    const hbRes = await request(app)
      .post('/v1/devices/heartbeat')
      .send({
        serial_no: 'VPNCAM-000001',
        provision_token,
        status: 'online',
        rtsp_ok: true,
        wg_ok: true,
        storage_used_bytes: 1073741824, // 1GB
        firmware_version: 'v1.0.1',
        latency_ms: 15,
      });

    assert.equal(hbRes.status, 204);

    // 3. 저장소 상태 갱신 확인
    const device = await deviceRepository.findById(device_id);
    assert.equal(device.status, 'online');
    assert.equal(device.vpn_status, 'connected');
    assert.ok(device.last_seen);
    assert.ok(device.last_handshake);
    assert.equal(device.storage_used_bytes, 1073741824);
    assert.equal(device.storage_used_gb, 1.0);
    assert.equal(device.firmware_version, 'v1.0.1');
    assert.equal(device.latency_ms, 15);
    assert.equal(device.uptime_seconds, 30);
  });

  test('Heartbeat 전송 시 provision_token 불일치 시 403 Forbidden 반환 (ICD 3.2.1)', async () => {
    // 1. 프로비저닝
    await request(app)
      .post('/v1/devices/provision-by-serial')
      .send({
        serial_no: 'VPNCAM-000002',
        wg_pubkey: 'boardWireGuardPubKeyBase64=',
      });

    // 2. 잘못된 토큰으로 Heartbeat 전송
    const hbRes = await request(app)
      .post('/v1/devices/heartbeat')
      .send({
        serial_no: 'VPNCAM-000002',
        provision_token: 'wrong_invalid_token',
        status: 'online',
        rtsp_ok: true,
        wg_ok: true,
      });

    assert.equal(hbRes.status, 403);
    assert.equal(hbRes.body.code, 'FORBIDDEN');
    assert.ok(hbRes.body.message.includes('토큰 불일치'));
  });

  test('미등록 시리얼 번호로 Heartbeat 전송 시 403 Forbidden 반환', async () => {
    const hbRes = await request(app)
      .post('/v1/devices/heartbeat')
      .send({
        serial_no: 'VPNCAM-UNREGISTERED',
        provision_token: 'some_token',
        status: 'online',
        rtsp_ok: true,
        wg_ok: true,
      });

    assert.equal(hbRes.status, 403);
    assert.equal(hbRes.body.code, 'FORBIDDEN');
  });

  test('보드 최초 부팅 시 MAC 기반 프로비저닝 및 SV-F-015 식별 번호 부여 성공 (POST /devices/provision-by-mac, ICD_v2 3.1)', async () => {
    const res = await request(app)
      .post('/v1/devices/provision-by-mac')
      .send({
        mac_no: '11:22:33:44:AA:99',
        wg_pubkey: 'wgPublicKeyBase64Test1234=',
        firmware_version: 'v1.2.0',
        model: 'RV-1106',
      });

    assert.equal(res.status, 200);
    // SV-F-015: MAC 주소 기반 고유 식별 번호 부여 (CAM-AA99)
    assert.equal(res.body.device_id, 'CAM-AA99');
    assert.ok(res.body.vpn_ip.startsWith('10.0.0.'));
    assert.ok(res.body.server_pubkey);
    assert.ok(res.body.server_endpoint);
    assert.ok(res.body.provision_token);
    assert.ok(res.body.rtsp_proxy_ip);
  });

  test('MAC_no 기반 30초 주기 Heartbeat 전송 및 상태 갱신 성공 (ICD_v2 3.2, SV-F-013)', async () => {
    // 1. provision-by-mac
    const provRes = await request(app)
      .post('/v1/devices/provision-by-mac')
      .send({
        mac_no: 'AA:BB:CC:DD:EE:77',
        wg_pubkey: 'wgKey77=',
      });
    assert.equal(provRes.status, 200);
    const { device_id, provision_token } = provRes.body;

    // 2. MAC_no 필드로 Heartbeat 전송 (ICD_v2 3.2.1 규격)
    const hbRes = await request(app)
      .post('/v1/devices/heartbeat')
      .send({
        MAC_no: 'AA:BB:CC:DD:EE:77',
        provision_token,
        status: 'online',
        rtsp_ok: true,
        wg_ok: true,
        latency_ms: 12,
      });

    assert.equal(hbRes.status, 204);

    // 3. 상태 검증
    const device = await deviceRepository.findById(device_id);
    assert.equal(device.status, 'online');
    assert.equal(device.latency_ms, 12);
  });
});
