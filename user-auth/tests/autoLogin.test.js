import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthApp } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';
import { jwtUtil } from '../src/utils/jwt.js';

describe('SV-F-003 자동 로그인(세션 유지) 및 토큰 갱신 기능 테스트', () => {
  let app;

  beforeEach(async () => {
    setInMemoryDriver();
    app = createAuthApp();

    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'autouser@securecam.com',
        password: 'password123!',
        name: '자동로그인유저',
      });
  });

  test('auto_login: true 설정 시 유효기간이 1년(약 365일)으로 생성됨 (ICD 1.3)', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'autouser@securecam.com',
        password: 'password123!',
        auto_login: true,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.is_auto_login, true);

    const token = res.body.access_token;
    const decoded = jwtUtil.verifyToken(token);

    assert.equal(decoded.is_auto_login, true);

    // 만료 시간이 현재로부터 대략 365일(364일 이상) 후인지 확인
    const nowSec = Math.floor(Date.now() / 1000);
    const diffDays = (decoded.exp - nowSec) / (24 * 60 * 60);
    assert.ok(diffDays >= 364 && diffDays <= 366, `diffDays: ${diffDays}`);
  });

  test('auto_login: false (일반 로그인) 시 기본 24시간 세션 생성', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'autouser@securecam.com',
        password: 'password123!',
        auto_login: false,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.is_auto_login, false);

    const token = res.body.access_token;
    const decoded = jwtUtil.verifyToken(token);
    const nowSec = Math.floor(Date.now() / 1000);
    const diffHours = (decoded.exp - nowSec) / 3600;
    assert.ok(diffHours >= 23 && diffHours <= 25, `diffHours: ${diffHours}`);
  });

  test('/auth/refresh 호출 시 세션 유지 및 새 액세스 토큰 정상 발급', async () => {
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'autouser@securecam.com',
        password: 'password123!',
        auto_login: true,
      });

    const oldToken = loginRes.body.access_token;

    const refreshRes = await request(app)
      .post('/v1/auth/refresh')
      .set('Authorization', `Bearer ${oldToken}`);

    assert.equal(refreshRes.status, 200);
    assert.ok(refreshRes.body.access_token);
    assert.notEqual(refreshRes.body.access_token, oldToken); // 새로운 토큰이어야 함

    // 새 토큰으로 /auth/me 인증 성공 확인
    const meRes = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${refreshRes.body.access_token}`);

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.email, 'autouser@securecam.com');
  });
});
