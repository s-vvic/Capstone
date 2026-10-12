import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createControllerApp } from '../src/app.js';

describe('통합 컨트롤러 시스템 헬스체크 및 기본 라우팅 테스트 (NF-A-001, ICD 8.0)', () => {
  let app;

  beforeEach(() => {
    app = createControllerApp();
  });

  it('통합 헬스체크 엔드포인트(GET /health)가 4개 컴포넌트의 가용성을 모두 정상 반환해야 한다', async () => {
    const res = await request(app).get('/health').expect(200);

    assert.equal(res.body.status, 'UP');
    assert.equal(res.body.service, 'securecam-master-controller');
    assert.ok(res.body.timestamp);
    assert.equal(res.body.components.component_1_user_auth, 'UP');
    assert.equal(res.body.components.component_2_device_heartbeat, 'UP');
    assert.equal(res.body.components.component_3_event_notification, 'UP');
    assert.equal(res.body.components.component_5_storage_retention, 'UP');
  });

  it('존재하지 않는 라우트 접근 시 ICD 8.0 표준 404 NOT_FOUND 오류를 반환해야 한다', async () => {
    const res = await request(app).get('/v1/unknown-endpoint').expect(404);

    assert.equal(res.body.error.code, 'NOT_FOUND');
    assert.ok(res.body.error.message.includes('찾을 수 없습니다'));
  });
});
