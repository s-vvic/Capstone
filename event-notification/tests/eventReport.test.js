import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createEventNotificationApp } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('보드 이벤트 보고 API 테스트 (ICD_v2 3.3, SV-F-020, SV-F-021, SV-F-024)', () => {
  let app;
  let driver;

  beforeEach(() => {
    driver = setInMemoryDriver();
    app = createEventNotificationApp();

    // 테스트용 보드 시딩
    driver.deviceRepo.seedDevice({
      device_id: 'CAM-0001',
      user_id: 'user-uuid-1234',
      name: '거실 카메라',
      location: '거실',
      mac_no: 'AA:BB:CC:DD:EE:01',
      provision_token: 'valid-token-123',
    });
  });

  it('움직임 감지 이벤트를 성공적으로 수신 및 저장해야 한다 (201 Created)', async () => {
    const payload = {
      mac_no: 'AA:BB:CC:DD:EE:01',
      provision_token: 'valid-token-123',
      event_type: 'motion',
      occurred_at: new Date().toISOString(),
      zone_id: 'ZONE-01',
      snapshot_data: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
      detail: '거실 영역 움직임 감지',
    };

    const res = await request(app)
      .post('/events/report')
      .send(payload)
      .expect(201);

    assert.equal(res.body.device_id, 'CAM-0001');
    assert.equal(res.body.status, 'unconfirmed');
    assert.ok(res.body.event_id);

    // 저장소 검증
    const stored = await driver.eventRepo.findById(res.body.event_id);
    assert.ok(stored);
    assert.equal(stored.event_type, 'motion');
    assert.equal(stored.zone_id, 'ZONE-01');
    assert.ok(stored.snapshot_url);
  });

  it('소리 감지 이벤트를 성공적으로 수신하고 데시벨을 기록해야 한다', async () => {
    const payload = {
      mac_no: 'AA:BB:CC:DD:EE:01',
      provision_token: 'valid-token-123',
      event_type: 'sound',
      occurred_at: new Date().toISOString(),
      sound_level_db: 78,
    };

    const res = await request(app)
      .post('/events/report')
      .send(payload)
      .expect(201);

    const stored = await driver.eventRepo.findById(res.body.event_id);
    assert.equal(stored.sound_level_db, 78);
    assert.equal(stored.event_type, 'sound');
  });

  it('필수 파라미터(mac_no 또는 provision_token) 누락 시 400 Bad Request를 반환해야 한다', async () => {
    const res = await request(app)
      .post('/events/report')
      .send({
        event_type: 'motion',
        occurred_at: new Date().toISOString(),
      })
      .expect(400);

    assert.equal(res.body.error.code, 'BAD_REQUEST');
  });

  it('유효하지 않은 이벤트 유형 전송 시 400 Bad Request를 반환해야 한다', async () => {
    const res = await request(app)
      .post('/events/report')
      .send({
        mac_no: 'AA:BB:CC:DD:EE:01',
        provision_token: 'valid-token-123',
        event_type: 'invalid_type',
        occurred_at: new Date().toISOString(),
      })
      .expect(400);

    assert.equal(res.body.error.code, 'BAD_REQUEST');
  });

  it('잘못된 인증 토큰으로 보고 시 403 Forbidden을 반환해야 한다', async () => {
    const res = await request(app)
      .post('/events/report')
      .send({
        mac_no: 'AA:BB:CC:DD:EE:01',
        provision_token: 'forbidden',
        event_type: 'motion',
        occurred_at: new Date().toISOString(),
      })
      .expect(403);

    assert.equal(res.body.error.code, 'FORBIDDEN');
  });
});
