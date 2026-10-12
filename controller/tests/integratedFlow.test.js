import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createControllerApp } from '../src/app.js';
import { setInMemoryDriver as resetAuthDb } from '../../user-auth/src/repositories/index.js';
import { setInMemoryDriver as resetDeviceDb } from '../../device-heartbeat/src/repositories/index.js';
import { setInMemoryDriver as resetEventDb } from '../../event-notification/src/repositories/index.js';
import { resetStore, seedDevData } from '../../storage-retention/src/repositories/memory/store.js';

describe('4대 컴포넌트 통합 E2E 시나리오 테스트 (C1 Auth -> C2 Device -> C3 Event -> C5 Storage)', () => {
  let app;

  beforeEach(() => {
    // 모든 하위 컴포넌트 DB 메모리 리셋
    resetAuthDb();
    resetDeviceDb();
    resetEventDb();
    resetStore();
    seedDevData();

    app = createControllerApp();
  });

  it('통합 워크플로우: 사용자 가입/로그인 -> 보드 등록 -> 이벤트 수신/조회 -> 스토리지 사용량 조회가 원활히 연동되어야 한다', async () => {
    // -------------------------------------------------------------------------
    // STEP 1: Component 1 (user-auth) - 회원가입 및 로그인
    // -------------------------------------------------------------------------
    const registerRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'tester@securecam.com',
        password: 'Password123!',
        name: '통합테스터',
        phone: '010-1234-5678',
        plan: 'standard',
      })
      .expect(201);

    assert.equal(registerRes.body.email, 'tester@securecam.com');

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'tester@securecam.com',
        password: 'Password123!',
      })
      .expect(200);

    const authToken = loginRes.body.token || loginRes.body.access_token;
    assert.ok(authToken, '로그인 후 JWT 토큰이 발급되어야 합니다.');

    // -------------------------------------------------------------------------
    // STEP 2: Component 2 (device-heartbeat) - 보드 프로비저닝 & 등록 & Heartbeat & PTZ
    // -------------------------------------------------------------------------
    const provRes = await request(app)
      .post('/v1/devices/provision-by-mac')
      .send({
        mac_no: 'AA:BB:CC:DD:11:22',
        wg_pubkey: 'wgPublicKeyBase64Test=',
        firmware_version: 'v1.0.0',
        model: 'RV-1106',
      })
      .expect(200);

    const { device_id, provision_token } = provRes.body;
    assert.ok(device_id);
    assert.ok(provision_token);

    // C1에서 발급받은 토큰으로 보드를 내 계정에 등록
    const devRegRes = await request(app)
      .post('/v1/devices/register')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        register_type: 'serial',
        mac_no: 'AA:BB:CC:DD:11:22',
        name: '거실 메인 웹캠',
        location: '거실 창문',
      })
      .expect(201);

    assert.equal(devRegRes.body.name, '거실 메인 웹캠');

    // 보드 30초 주기 Heartbeat 수신
    await request(app)
      .post('/v1/devices/heartbeat')
      .send({
        MAC_no: 'AA:BB:CC:DD:11:22',
        provision_token,
        status: 'online',
        rtsp_ok: true,
        wg_ok: true,
        latency_ms: 15,
      })
      .expect(204);

    // 등록된 보드에 대해 PTZ 제어 명령 실행
    const ptzRes = await request(app)
      .post(`/v1/devices/${device_id}/ptz`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        action: 'left',
        speed: 5,
      })
      .expect(200);

    assert.equal(ptzRes.body.success, true);
    assert.equal(ptzRes.body.command.action, 'left');

    // -------------------------------------------------------------------------
    // STEP 3: Component 3 (event-notification) - 보드 이벤트 보고 & 목록 조회 & 확인 처리
    // -------------------------------------------------------------------------
    const reportRes = await request(app)
      .post('/v1/events/report')
      .send({
        mac_no: 'AA:BB:CC:DD:11:22',
        provision_token,
        event_type: 'motion',
        occurred_at: new Date().toISOString(),
        zone_id: 'ZONE-A',
        detail: '거실 움직임 감지',
      })
      .expect(201);

    const eventId = reportRes.body.event_id;
    assert.ok(eventId);

    // C1에서 발급받은 토큰으로 이벤트 목록 조회
    const eventsRes = await request(app)
      .get('/v1/events')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    assert.ok(eventsRes.body.items.length >= 1);
    assert.equal(eventsRes.body.items[0].event_type, 'motion');

    // 이벤트 확인 처리 및 메모 저장
    const patchEventRes = await request(app)
      .patch(`/v1/events/${eventId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        status: 'confirmed',
        is_important: true,
        memo: '이상 없음 확인',
      })
      .expect(200);

    assert.equal(patchEventRes.body.status, 'confirmed');
    assert.equal(patchEventRes.body.is_important, true);

    // -------------------------------------------------------------------------
    // STEP 4: Component 5 (storage-retention) - 스토리지 사용량 및 파일 조회
    // -------------------------------------------------------------------------
    const storageUsageRes = await request(app)
      .get('/v1/storage/usage')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    assert.equal(storageUsageRes.body.plan, 'standard');
    assert.equal(storageUsageRes.body.quota_gb, 30);
    assert.equal(storageUsageRes.body.retention_days, 30);
    assert.equal(storageUsageRes.body.is_over_quota, false);

    // 파일 목록 조회 (ICD 2.4.2: total, page, size, items)
    const storageFilesRes = await request(app)
      .get('/v1/storage/files')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    assert.ok(Array.isArray(storageFilesRes.body.items));
  });
});
