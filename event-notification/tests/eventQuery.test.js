import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createEventNotificationApp } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('이벤트 목록 조회 API 테스트 (ICD_v2 2.3.1, WEB-F-030, APP-F-030)', () => {
  let app;
  let driver;
  const testUserId = 'test-user-001';

  beforeEach(async () => {
    driver = setInMemoryDriver();
    app = createEventNotificationApp();

    driver.deviceRepo.seedDevice({
      device_id: 'CAM-0001',
      user_id: testUserId,
      name: '거실 카메라',
      mac_no: 'AA:BB:CC:DD:EE:01',
      provision_token: 'tok-1',
    });

    driver.deviceRepo.seedDevice({
      device_id: 'CAM-0002',
      user_id: testUserId,
      name: '현관 카메라',
      mac_no: 'AA:BB:CC:DD:EE:02',
      provision_token: 'tok-2',
    });

    // 샘플 이벤트 5건 생성
    await driver.eventRepo.create({
      device_id: 'CAM-0001',
      event_type: 'motion',
      occurred_at: '2026-10-01T10:00:00Z',
      status: 'unconfirmed',
      is_important: false,
    });
    await driver.eventRepo.create({
      device_id: 'CAM-0001',
      event_type: 'sound',
      occurred_at: '2026-10-02T11:00:00Z',
      status: 'confirmed',
      is_important: true,
    });
    await driver.eventRepo.create({
      device_id: 'CAM-0002',
      event_type: 'motion',
      occurred_at: '2026-10-03T12:00:00Z',
      status: 'unconfirmed',
      is_important: true,
    });
    await driver.eventRepo.create({
      device_id: 'CAM-0002',
      event_type: 'connection',
      occurred_at: '2026-10-04T09:00:00Z',
      status: 'confirmed',
      is_important: false,
    });
    await driver.eventRepo.create({
      device_id: 'CAM-0001',
      event_type: 'system',
      occurred_at: '2026-10-04T13:00:00Z',
      status: 'unconfirmed',
      is_important: false,
    });
  });

  it('인증 헤더가 없을 경우 401 Unauthorized를 반환해야 한다', async () => {
    const res = await request(app).get('/events').expect(401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('전체 이벤트 목록과 페이지네이션 메타데이터를 정상 반환해야 한다', async () => {
    const res = await request(app)
      .get('/events')
      .set('x-user-id', testUserId)
      .expect(200);

    assert.equal(res.body.total, 5);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.items.length, 5);
    // 최신 시간순 정렬 확인
    assert.equal(res.body.items[0].event_type, 'system');
  });

  it('이벤트 유형(event_type=motion) 필터링이 정상 작동해야 한다', async () => {
    const res = await request(app)
      .get('/events?event_type=motion')
      .set('x-user-id', testUserId)
      .expect(200);

    assert.equal(res.body.total, 2);
    for (const item of res.body.items) {
      assert.equal(item.event_type, 'motion');
    }
  });

  it('확인 상태(status=unconfirmed) 필터링이 정상 작동해야 한다', async () => {
    const res = await request(app)
      .get('/events?status=unconfirmed')
      .set('x-user-id', testUserId)
      .expect(200);

    assert.equal(res.body.total, 3);
    for (const item of res.body.items) {
      assert.equal(item.status, 'unconfirmed');
    }
  });

  it('기기 필터링(device_id=CAM-0001)이 정상 작동해야 한다', async () => {
    const res = await request(app)
      .get('/events?device_id=CAM-0001')
      .set('x-user-id', testUserId)
      .expect(200);

    assert.equal(res.body.total, 3);
    for (const item of res.body.items) {
      assert.equal(item.device_id, 'CAM-0001');
    }
  });

  it('페이지 크기(size=2, page=1) 페이징 처리가 정상 작동해야 한다', async () => {
    const res = await request(app)
      .get('/events?page=1&size=2')
      .set('x-user-id', testUserId)
      .expect(200);

    assert.equal(res.body.total, 5);
    assert.equal(res.body.page, 1);
    assert.equal(res.body.size, 2);
    assert.equal(res.body.items.length, 2);
  });
});
