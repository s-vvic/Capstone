import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDeviceHeartbeatApp } from '../src/index.js';
import { setInMemoryDriver, deviceRepository } from '../src/repositories/index.js';
import { heartbeatMonitor } from '../src/services/heartbeatMonitor.js';

describe('SV-F-011 & NF-P-003 보드 온라인/오프라인 실시간 감시 및 타임아웃 감지 테스트', () => {
  let app;

  beforeEach(() => {
    setInMemoryDriver();
    app = createDeviceHeartbeatApp();
  });

  test('Heartbeat 수신 후 온라인 유지 및 타임아웃 경과 시 자동 오프라인 전환 (SV-F-011)', async () => {
    // 1. 프로비저닝
    const provRes = await request(app)
      .post('/v1/devices/provision-by-serial')
      .send({
        serial_no: 'VPNCAM-ONLINE-01',
        wg_pubkey: 'pubkey1=',
      });
    const { device_id, provision_token } = provRes.body;

    // 2. Heartbeat 전송 -> 온라인 상태 확인
    await request(app)
      .post('/v1/devices/heartbeat')
      .send({
        serial_no: 'VPNCAM-ONLINE-01',
        provision_token,
        status: 'online',
        rtsp_ok: true,
        wg_ok: true,
      });

    let device = await deviceRepository.findById(device_id);
    assert.equal(device.status, 'online');
    assert.equal(device.vpn_status, 'connected');

    // 3. 상태 변경 이벤트 리스너 등록
    let notifiedEvent = null;
    heartbeatMonitor.onStatusChange((evt) => {
      notifiedEvent = evt;
    });

    // 4. 시간을 과거(70초 전)로 시뮬레이션
    const staleTime = new Date(Date.now() - 70 * 1000).toISOString();
    await deviceRepository.update(device_id, { last_seen: staleTime });

    // 5. 생존 감시 검사 실행
    const changed = await heartbeatMonitor.checkStaleDevices();

    assert.equal(changed.length, 1);
    assert.equal(changed[0].device_id, device_id);

    // 6. DB 상태가 offline / disconnected로 전환되었는지 확인
    device = await deviceRepository.findById(device_id);
    assert.equal(device.status, 'offline');
    assert.equal(device.vpn_status, 'disconnected');
    assert.equal(device.error_type, 'heartbeat_timeout');

    // 7. 상태 변경 알림 이벤트 발행 확인
    assert.ok(notifiedEvent);
    assert.equal(notifiedEvent.deviceId, device_id);
    assert.equal(notifiedEvent.oldStatus, 'online');
    assert.equal(notifiedEvent.newStatus, 'offline');
  });
});
