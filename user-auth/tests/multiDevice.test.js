import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthApp } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('SV-F-004 다중 기기 로그인 현황 조회 및 강제 로그아웃 기능 테스트', () => {
  let app;

  beforeEach(async () => {
    setInMemoryDriver();
    app = createAuthApp();

    // Standard 플랜으로 가입 (최대 동시접속 3대)
    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'multidev@securecam.com',
        password: 'password123!',
        name: '멀티기기유저',
        plan: 'standard',
      });
  });

  test('다중 기기에서 로그인 시 세션 목록에 등록되고 현재 세션이 표시됨 (GET /auth/sessions)', async () => {
    // 1. 기기 A (웹) 로그인
    const loginA = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'multidev@securecam.com',
        password: 'password123!',
        deviceName: 'Chrome on Windows',
        deviceType: 'web',
      });
    const tokenA = loginA.body.access_token;

    // 2. 기기 B (안드로이드) 로그인
    const loginB = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'multidev@securecam.com',
        password: 'password123!',
        deviceName: 'Galaxy S24 Ultra',
        deviceType: 'android',
      });
    const tokenB = loginB.body.access_token;

    // 기기 A에서 세션 목록 조회
    const resA = await request(app)
      .get('/v1/auth/sessions')
      .set('Authorization', `Bearer ${tokenA}`);

    assert.equal(resA.status, 200);
    assert.equal(resA.body.active_count, 2);

    const sessionA = resA.body.sessions.find((s) => s.device_name === 'Chrome on Windows');
    const sessionB = resA.body.sessions.find((s) => s.device_name === 'Galaxy S24 Ultra');

    assert.ok(sessionA);
    assert.ok(sessionB);
    assert.equal(sessionA.is_current, true);  // 기기 A 관점에서는 A가 현재 세션
    assert.equal(sessionB.is_current, false); // B는 타 기기 세션
  });

  test('특정 기기 강제 로그아웃 시 해당 기기 세션이 즉시 무효화됨 (DELETE /auth/sessions/:sessionId)', async () => {
    // 기기 A 로그인
    const loginA = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'multidev@securecam.com',
        password: 'password123!',
        deviceName: 'Device A',
      });
    const tokenA = loginA.body.access_token;

    // 기기 B 로그인
    const loginB = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'multidev@securecam.com',
        password: 'password123!',
        deviceName: 'Device B',
      });
    const tokenB = loginB.body.access_token;
    const sessionBId = loginB.body.session_id;

    // 기기 B에서 정상 접근 확인
    const checkBBefore = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(checkBBefore.status, 200);

    // 기기 A에서 기기 B를 강제 로그아웃 실행
    const revokeRes = await request(app)
      .delete(`/v1/auth/sessions/${sessionBId}`)
      .set('Authorization', `Bearer ${tokenA}`);

    assert.equal(revokeRes.status, 200);
    assert.equal(revokeRes.body.success, true);

    // 기기 B의 토큰으로 접근 시도 -> 401 UNAUTHORIZED 발생
    const checkBAfter = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(checkBAfter.status, 401);
    assert.equal(checkBAfter.body.code, 'UNAUTHORIZED');

    // 기기 A는 여전히 정상 동작
    const checkA = await request(app)
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(checkA.status, 200);
  });

  test('현재 기기를 제외한 다른 모든 기기 일괄 로그아웃 (DELETE /auth/sessions/other)', async () => {
    // 기기 1, 2, 3 로그인
    const login1 = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'multidev@securecam.com', password: 'password123!', deviceName: 'Device 1' });
    const login2 = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'multidev@securecam.com', password: 'password123!', deviceName: 'Device 2' });
    const login3 = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'multidev@securecam.com', password: 'password123!', deviceName: 'Device 3' });

    const token3 = login3.body.access_token;

    // 기기 3에서 다른 모든 기기 일괄 로그아웃 요청
    const revokeOtherRes = await request(app)
      .delete('/v1/auth/sessions/other')
      .set('Authorization', `Bearer ${token3}`);

    assert.equal(revokeOtherRes.status, 200);
    assert.equal(revokeOtherRes.body.revoked_count, 2);

    // 기기 1, 2는 인증 실패 확인
    const check1 = await request(app).get('/v1/auth/me').set('Authorization', `Bearer ${login1.body.access_token}`);
    const check2 = await request(app).get('/v1/auth/me').set('Authorization', `Bearer ${login2.body.access_token}`);
    assert.equal(check1.status, 401);
    assert.equal(check2.status, 401);

    // 기기 3은 정상 유지
    const check3 = await request(app).get('/v1/auth/me').set('Authorization', `Bearer ${token3}`);
    assert.equal(check3.status, 200);
  });
});
