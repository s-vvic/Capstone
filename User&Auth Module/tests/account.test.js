import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthApp } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('SV-F-002 아이디/비밀번호 찾기 및 계정 관리 기능 테스트', () => {
  let app;

  beforeEach(async () => {
    setInMemoryDriver();
    app = createAuthApp();

    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'findme@securecam.com',
        password: 'initialPassword123!',
        name: '김보안',
      });
  });

  test('이름으로 아이디(마스킹된 이메일) 찾기 성공 (POST /auth/find-id)', async () => {
    const res = await request(app)
      .post('/v1/auth/find-id')
      .send({ name: '김보안' });

    assert.equal(res.status, 200);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.items[0].name, '김보안');
    assert.ok(res.body.items[0].masked_email.includes('@securecam.com'));
    assert.ok(res.body.items[0].masked_email.includes('*'));
  });

  test('일치하지 않는 이름으로 아이디 찾기 시 404 NOT_FOUND 반환', async () => {
    const res = await request(app)
      .post('/v1/auth/find-id')
      .send({ name: '없는사람' });

    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'NOT_FOUND');
  });

  test('비밀번호 재설정 요청 및 새 비밀번호로 재설정 완료 시 로그인 성공 (POST /auth/forgot-password, /auth/reset-password)', async () => {
    // 1. 비밀번호 재설정 토큰 요청
    const forgotRes = await request(app)
      .post('/v1/auth/forgot-password')
      .send({ email: 'findme@securecam.com' });

    assert.equal(forgotRes.status, 200);
    const resetToken = forgotRes.body.reset_token;
    assert.ok(resetToken);

    // 2. 새 비밀번호로 재설정
    const resetRes = await request(app)
      .post('/v1/auth/reset-password')
      .send({
        reset_token: resetToken,
        new_password: 'brandNewPassword999!',
      });

    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.success, true);

    // 3. 기존 비밀번호로는 로그인 불가
    const oldLoginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'findme@securecam.com',
        password: 'initialPassword123!',
      });
    assert.equal(oldLoginRes.status, 400);

    // 4. 새 비밀번호로 로그인 성공
    const newLoginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'findme@securecam.com',
        password: 'brandNewPassword999!',
      });
    assert.equal(newLoginRes.status, 200);
    assert.ok(newLoginRes.body.access_token);
  });

  test('로그인 상태에서 비밀번호 직접 변경 성공 (PATCH /auth/password)', async () => {
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'findme@securecam.com',
        password: 'initialPassword123!',
      });
    const token = loginRes.body.access_token;

    const changeRes = await request(app)
      .patch('/v1/auth/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        current_password: 'initialPassword123!',
        new_password: 'changedPassword777!',
      });

    assert.equal(changeRes.status, 200);
    assert.equal(changeRes.body.success, true);

    // 새 비밀번호로 로그인 확인
    const newLoginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'findme@securecam.com',
        password: 'changedPassword777!',
      });
    assert.equal(newLoginRes.status, 200);
  });

  test('프로필 수정 성공 (PATCH /auth/profile)', async () => {
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'findme@securecam.com',
        password: 'initialPassword123!',
      });
    const token = loginRes.body.access_token;

    const updateRes = await request(app)
      .patch('/v1/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '김스마클' });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.name, '김스마클');
  });
});
