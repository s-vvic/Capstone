import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthApp } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('SV-F-001 & ICD-01 회원가입 / 로그인 / 로그아웃 기능 테스트', () => {
  let app;

  beforeEach(() => {
    setInMemoryDriver();
    app = createAuthApp();
  });

  test('정상 회원가입 시 201 Created와 생성된 사용자 정보 반환 (ICD 2.1.3)', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'user1@securecam.com',
        password: 'password123!',
        name: '홍길동',
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.user_id);
    assert.equal(res.body.email, 'user1@securecam.com');
    assert.equal(res.body.name, '홍길동');
    assert.equal(res.body.plan, 'basic');
    assert.ok(res.body.created_at);
    assert.equal(res.body.password_hash, undefined); // 비밀번호 해시는 반환되지 않아야 함
  });

  test('비밀번호가 8자 미만일 경우 400 BAD_REQUEST 오류 반환 (ICD 2.1.3)', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'shortpw@securecam.com',
        password: 'short',
        name: '이몽룡',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'BAD_REQUEST');
    assert.ok(res.body.message.includes('8자 이상'));
  });

  test('이메일 형식이 올바르지 않으면 400 BAD_REQUEST 오류 반환', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'invalid-email',
        password: 'password123!',
        name: '성춘향',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'BAD_REQUEST');
  });

  test('중복된 이메일로 회원가입 시 409 CONFLICT 오류 반환 (ICD 8.0)', async () => {
    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'duplicate@securecam.com',
        password: 'password123!',
        name: '기존회원',
      });

    const res = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'duplicate@securecam.com',
        password: 'newpassword456!',
        name: '중복시도자',
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'CONFLICT');
    assert.ok(res.body.message.includes('이미 등록된 이메일'));
  });

  test('정상 로그인 시 200 OK와 ICD 2.1.1 규격 응답 반환', async () => {
    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'login@securecam.com',
        password: 'correctPassword123!',
        name: '로그인유저',
      });

    const res = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'login@securecam.com',
        password: 'correctPassword123!',
        auto_login: false,
      });

    assert.equal(res.status, 200);
    assert.ok(res.body.access_token);
    assert.equal(res.body.token_type, 'Bearer');
    assert.ok(res.body.user_id);
    assert.equal(res.body.name, '로그인유저');
    assert.equal(res.body.email, 'login@securecam.com');
  });

  test('비밀번호 불일치 시 400 INVALID_CREDENTIALS 반환 (ICD 2.1.1)', async () => {
    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'fail@securecam.com',
        password: 'correctPassword123!',
        name: '실패테스트',
      });

    const res = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'fail@securecam.com',
        password: 'wrongPassword999!',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_CREDENTIALS');
  });

  test('존재하지 않는 이메일로 로그인 시 400 INVALID_CREDENTIALS 반환 (ICD 2.1.1)', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'nonexistent@securecam.com',
        password: 'password123!',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'INVALID_CREDENTIALS');
  });

  test('로그아웃 시 현재 세션이 무효화되고 이후 인증 실패 (ICD 2.1.2)', async () => {
    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'logout@securecam.com',
        password: 'password123!',
        name: '로그아웃테스트',
      });

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'logout@securecam.com',
        password: 'password123!',
      });

    const token = loginRes.body.access_token;

    // 정상 인증 확인
    const meResBefore = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(meResBefore.status, 200);

    // 로그아웃 호출 (POST /auth/logout)
    const logoutRes = await request(app)
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(logoutRes.status, 200);

    // 로그아웃 후 동일 토큰으로 요청 시 401 UNAUTHORIZED 발생
    const meResAfter = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    assert.equal(meResAfter.status, 401);
    assert.equal(meResAfter.body.code, 'UNAUTHORIZED');
  });
});
