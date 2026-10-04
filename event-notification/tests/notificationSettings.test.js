import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createEventNotificationApp } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('알림 설정 API 테스트 (ICD_v2 2.7, APP-F-070, APP-F-072, WEB-F-091)', () => {
  let app;
  let driver;
  const testUserId = 'test-user-settings-001';

  beforeEach(() => {
    driver = setInMemoryDriver();
    app = createEventNotificationApp();
  });

  it('초기 사용자 알림 설정을 조회하면 기본값이 반환되어야 한다 (GET /notifications/settings)', async () => {
    const res = await request(app)
      .get('/notifications/settings')
      .set('x-user-id', testUserId)
      .expect(200);

    assert.equal(res.body.motion_alert, true);
    assert.equal(res.body.sound_alert, true);
    assert.equal(res.body.offline_alert, true);
    assert.equal(res.body.reconnect_alert, true);
    assert.equal(res.body.important_only, false);
    assert.deepEqual(res.body.device_alerts, []);
  });

  it('알림 설정을 전체 수정할 수 있어야 한다 (PUT /notifications/settings)', async () => {
    const updatePayload = {
      motion_alert: false,
      sound_alert: true,
      offline_alert: true,
      reconnect_alert: false,
      important_only: true,
      device_alerts: [
        { device_id: 'CAM-0001', enabled: false },
        { device_id: 'CAM-0002', enabled: true },
      ],
    };

    const res = await request(app)
      .put('/notifications/settings')
      .set('x-user-id', testUserId)
      .send(updatePayload)
      .expect(200);

    assert.equal(res.body.motion_alert, false);
    assert.equal(res.body.important_only, true);
    assert.equal(res.body.reconnect_alert, false);
    assert.equal(res.body.device_alerts.length, 2);

    // 다시 조회해도 동일한 값 유지 검증
    const getRes = await request(app)
      .get('/notifications/settings')
      .set('x-user-id', testUserId)
      .expect(200);

    assert.equal(getRes.body.motion_alert, false);
    assert.equal(getRes.body.important_only, true);
    assert.equal(getRes.body.device_alerts[0].enabled, false);
  });

  it('유효하지 않은 타입(예: boolean 필드에 문자열) 전송 시 400 Bad Request를 반환해야 한다', async () => {
    const res = await request(app)
      .put('/notifications/settings')
      .set('x-user-id', testUserId)
      .send({ motion_alert: 'not_a_boolean' })
      .expect(400);

    assert.equal(res.body.error.code, 'BAD_REQUEST');
  });
});
