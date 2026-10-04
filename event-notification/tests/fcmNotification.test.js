import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createEventNotificationApp } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';
import { fcmNotificationService } from '../src/services/fcmNotificationService.js';

describe('FCM Push 알림 및 SLA 테스트 (ICD-07, SV-F-023, NF-P-002)', () => {
  let app;
  let driver;
  const testUserId = 'fcm-test-user-001';

  beforeEach(() => {
    driver = setInMemoryDriver();
    app = createEventNotificationApp();

    driver.deviceRepo.seedDevice({
      device_id: 'CAM-0001',
      user_id: testUserId,
      name: '거실 카메라',
      location: '거실 창가',
      mac_no: 'AA:BB:CC:DD:EE:01',
      provision_token: 'tok-123',
    });
  });

  it('움직임 감지 시 ICD-07 규격에 맞는 FCM 알림 페이로드가 5초 이내(NF-P-002)에 생성 및 발송되어야 한다', async () => {
    const event = {
      event_id: 'ev-test-1001',
      device_id: 'CAM-0001',
      event_type: 'motion',
      occurred_at: new Date().toISOString(),
      snapshot_url: 'https://api.securecam.com/v1/snapshots/ev-test-1001.jpg',
      is_important: false,
    };

    const device = {
      device_id: 'CAM-0001',
      user_id: testUserId,
      name: '거실 카메라',
      location: '거실 창가',
    };

    const result = await fcmNotificationService.dispatchNotification(event, device);

    assert.equal(result.sent, true);
    assert.equal(result.within_sla, true);
    assert.ok(result.latency_ms < 5000, `전송 지연 시간(${result.latency_ms}ms)이 5초 미만이어야 합니다.`);

    // 페이로드 구조 검증 (ICD-07 6.2 & 6.3)
    const { notification, data } = result.payload;
    assert.equal(notification.title, '거실 카메라 움직임 감지');
    assert.equal(notification.body, '거실 창가에서 움직임이 감지되었습니다.');
    assert.equal(data.event_id, 'ev-test-1001');
    assert.equal(data.device_id, 'CAM-0001');
    assert.equal(data.event_type, 'motion');
    assert.equal(data.action, 'open_event');
    assert.equal(data.snapshot_url, 'https://api.securecam.com/v1/snapshots/ev-test-1001.jpg');

    // 발송 이력 저장 확인
    const history = await driver.historyRepo.getRecent();
    assert.equal(history.length, 1);
    assert.equal(history[0].event_id, 'ev-test-1001');
  });

  it('사용자 설정에서 해당 이벤트 알림이 비활성화된 경우 알림이 필터링되어야 한다', async () => {
    // 사용자가 motion_alert를 끔
    await driver.settingsRepo.upsert(testUserId, {
      motion_alert: false,
    });

    const event = {
      event_id: 'ev-test-1002',
      device_id: 'CAM-0001',
      event_type: 'motion',
      occurred_at: new Date().toISOString(),
    };

    const device = {
      device_id: 'CAM-0001',
      user_id: testUserId,
      name: '거실 카메라',
      location: '거실',
    };

    const result = await fcmNotificationService.dispatchNotification(event, device);
    assert.equal(result.sent, false);
    assert.equal(result.reason, 'FILTERED_BY_SETTINGS');
  });

  it('대시보드 통계 요약 엔드포인트(GET /events/summary)가 올바른 수치를 반환해야 한다 (WEB-F-001, APP-F-002)', async () => {
    // 2건의 이벤트 추가
    await driver.eventRepo.create({
      device_id: 'CAM-0001',
      event_type: 'motion',
      occurred_at: new Date().toISOString(),
      status: 'unconfirmed',
    });
    await driver.eventRepo.create({
      device_id: 'CAM-0001',
      event_type: 'sound',
      occurred_at: new Date().toISOString(),
      status: 'confirmed',
    });

    const res = await request(app)
      .get('/events/summary')
      .set('x-user-id', testUserId)
      .expect(200);

    assert.equal(res.body.today_events_count, 2);
    assert.equal(res.body.unconfirmed_count, 1);
    assert.equal(res.body.total_events_count, 2);
  });
});
