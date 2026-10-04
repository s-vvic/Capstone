import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createEventNotificationApp } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('이벤트 상태 및 일괄 확인 API 테스트 (ICD_v2 2.3.2, WEB-F-033, APP-F-034)', () => {
  let app;
  let driver;
  const testUserId = 'test-user-001';
  let sampleEventId1;
  let sampleEventId2;

  beforeEach(async () => {
    driver = setInMemoryDriver();
    app = createEventNotificationApp();

    const ev1 = await driver.eventRepo.create({
      device_id: 'CAM-0001',
      event_type: 'motion',
      status: 'unconfirmed',
      is_important: false,
    });
    sampleEventId1 = ev1.event_id;

    const ev2 = await driver.eventRepo.create({
      device_id: 'CAM-0001',
      event_type: 'sound',
      status: 'unconfirmed',
      is_important: false,
    });
    sampleEventId2 = ev2.event_id;
  });

  it('단일 이벤트 확인 처리, 중요 지정, 메모 작성을 성공해야 한다 (PATCH /events/:eventId)', async () => {
    const res = await request(app)
      .patch(`/events/${sampleEventId1}`)
      .set('x-user-id', testUserId)
      .send({
        status: 'confirmed',
        is_important: true,
        memo: '택배 기사님 방문 확인 완료',
      })
      .expect(200);

    assert.equal(res.body.status, 'confirmed');
    assert.equal(res.body.is_important, true);
    assert.equal(res.body.memo, '택배 기사님 방문 확인 완료');

    const updated = await driver.eventRepo.findById(sampleEventId1);
    assert.equal(updated.status, 'confirmed');
    assert.equal(updated.is_important, true);
    assert.equal(updated.memo, '택배 기사님 방문 확인 완료');
  });

  it('존재하지 않는 이벤트 ID 수정 시 404 Not Found를 반환해야 한다', async () => {
    const res = await request(app)
      .patch('/events/00000000-0000-0000-0000-000000000000')
      .set('x-user-id', testUserId)
      .send({ status: 'confirmed' })
      .expect(404);

    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('메모가 500자를 초과하는 경우 400 Bad Request를 반환해야 한다', async () => {
    const longMemo = 'a'.repeat(501);
    const res = await request(app)
      .patch(`/events/${sampleEventId1}`)
      .set('x-user-id', testUserId)
      .send({ memo: longMemo })
      .expect(400);

    assert.equal(res.body.error.code, 'BAD_REQUEST');
  });

  it('여러 이벤트를 일괄 확인 처리할 수 있어야 한다 (PATCH /events/batch, WEB-F-033, APP-F-034)', async () => {
    const res = await request(app)
      .patch('/events/batch')
      .set('x-user-id', testUserId)
      .send({
        event_ids: [sampleEventId1, sampleEventId2],
      })
      .expect(200);

    assert.equal(res.body.updated_count, 2);
    assert.equal(res.body.status, 'confirmed');

    const ev1 = await driver.eventRepo.findById(sampleEventId1);
    const ev2 = await driver.eventRepo.findById(sampleEventId2);
    assert.equal(ev1.status, 'confirmed');
    assert.equal(ev2.status, 'confirmed');
  });

  it('일괄 확인 요청 시 event_ids가 비어있으면 400 Bad Request를 반환해야 한다', async () => {
    const res = await request(app)
      .patch('/events/batch')
      .set('x-user-id', testUserId)
      .send({ event_ids: [] })
      .expect(400);

    assert.equal(res.body.error.code, 'BAD_REQUEST');
  });
});
