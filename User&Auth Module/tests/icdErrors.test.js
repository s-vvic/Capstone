import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthApp } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('ICD 8.0 공통 오류 코드 및 응답 규격 테스트', () => {
  let app;

  beforeEach(async () => {
    setInMemoryDriver();
    app = createAuthApp();

    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'target@securecam.com',
        password: 'password123!',
        name: '타겟유저',
      });
  });

  test('400 BAD_REQUEST 오류 규격 확인 (code, message, action 포함)', async () => {
    const res = await request(app).post('/v1/auth/register').send({});

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'BAD_REQUEST');
    assert.ok(res.body.message);
    assert.ok(res.body.action);
  });

  test('401 UNAUTHORIZED 오류 규격 확인', async () => {
    const res = await request(app).get('/v1/auth/me');

    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'UNAUTHORIZED');
    assert.ok(res.body.message);
    assert.ok(res.body.action);
  });

  test('404 NOT_FOUND 오류 규격 확인', async () => {
    const res = await request(app).get('/v1/auth/non-existing-route');

    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'NOT_FOUND');
    assert.ok(res.body.message);
    assert.ok(res.body.action);
  });

  test('409 CONFLICT 오류 규격 확인', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'target@securecam.com',
        password: 'password123!',
        name: '중복시도',
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'CONFLICT');
    assert.ok(res.body.message);
    assert.ok(res.body.action);
  });

  test('429 TOO_MANY_REQUESTS 오류 규격 확인 (로그인 5회 실패 시 차단, ICD 2.1.1, NF-S-005)', async () => {
    // 5회 연속 로그인 실패 발생
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/v1/auth/login')
        .send({
          email: 'target@securecam.com',
          password: `wrongPassword${i}`,
        });
      assert.equal(res.status, 400);
      assert.equal(res.body.code, 'INVALID_CREDENTIALS');
    }

    // 6번째 로그인 시도 -> 429 TOO_MANY_REQUESTS 발생
    const blockedRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'target@securecam.com',
        password: 'password123!', // 올바른 비밀번호여도 차단 상태
      });

    assert.equal(blockedRes.status, 429);
    assert.equal(blockedRes.body.code, 'TOO_MANY_REQUESTS');
    assert.ok(blockedRes.body.message.includes('로그인 시도 횟수를 초과'));
    assert.ok(blockedRes.body.action);
  });
});
