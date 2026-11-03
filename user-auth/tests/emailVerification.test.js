import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createAuthApp } from '../src/index.js';
import { setInMemoryDriver } from '../src/repositories/index.js';

describe('SV-F-007 이메일 인증(본인 확인) 및 ICD_v2 규격 테스트', () => {
  let app;

  beforeEach(() => {
    setInMemoryDriver();
    app = createAuthApp();
  });

  test('본인 인증 코드 발송 및 검증 성공 (POST /auth/send-verification-code, /auth/verify-code)', async () => {
    // 1. 인증 코드 발송
    const sendRes = await request(app)
      .post('/v1/auth/send-verification-code')
      .send({
        email: 'newuser@securecam.com',
        type: 'signup',
      });

    assert.equal(sendRes.status, 200);
    assert.equal(sendRes.body.success, true);
    assert.ok(sendRes.body.verification_code);
    assert.equal(sendRes.body.verification_code.length, 6);

    const code = sendRes.body.verification_code;

    // 2. 잘못된 코드로 검증 시 400 INVALID_VERIFICATION_CODE
    const failVerifyRes = await request(app)
      .post('/v1/auth/verify-code')
      .send({
        email: 'newuser@securecam.com',
        code: '999999',
        type: 'signup',
      });

    assert.equal(failVerifyRes.status, 400);
    assert.equal(failVerifyRes.body.code, 'INVALID_VERIFICATION_CODE');

    // 3. 올바른 코드로 검증 성공
    const successVerifyRes = await request(app)
      .post('/v1/auth/verify-code')
      .send({
        email: 'newuser@securecam.com',
        code,
        type: 'signup',
      });

    assert.equal(successVerifyRes.status, 200);
    assert.equal(successVerifyRes.body.verified, true);
  });

  test('회원가입 시 이메일 인증 코드 검증 연계 (POST /auth/register, SV-F-007)', async () => {
    // 1. 인증 코드 발급
    const sendRes = await request(app)
      .post('/v1/auth/send-verification-code')
      .send({
        email: 'verify-signup@securecam.com',
        type: 'signup',
      });
    const code = sendRes.body.verification_code;

    // 2. 잘못된 인증 코드로 가입 시 400 INVALID_VERIFICATION_CODE
    const badSignupRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'verify-signup@securecam.com',
        password: 'password123!',
        name: '인증테스터',
        verification_code: '000000',
      });

    assert.equal(badSignupRes.status, 400);
    assert.equal(badSignupRes.body.code, 'INVALID_VERIFICATION_CODE');

    // 3. 올바른 인증 코드로 가입 성공
    const goodSignupRes = await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'verify-signup@securecam.com',
        password: 'password123!',
        name: '인증테스터',
        verification_code: code,
      });

    assert.equal(goodSignupRes.status, 201);
    assert.equal(goodSignupRes.body.email, 'verify-signup@securecam.com');
  });

  test('비밀번호 찾기/재설정 시 이메일 인증 및 ICD 2.1.5 규격 검증', async () => {
    // 사용자 사전 가입
    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'pwtest@securecam.com',
        password: 'initialPass123!',
        name: '비번테스터',
      });

    // 1. 등록되지 않은 이메일로 비밀번호 재설정 요청 시 404 USER_NOT_FOUND (ICD 2.1.5)
    const notFoundRes = await request(app)
      .post('/v1/auth/forgot-password')
      .send({ email: 'unknown@securecam.com' });

    assert.equal(notFoundRes.status, 404);
    assert.equal(notFoundRes.body.code, 'USER_NOT_FOUND');

    // 2. 등록된 이메일로 요청 시 200 OK와 6자리 verification_code 발급
    const forgotRes = await request(app)
      .post('/v1/auth/forgot-password')
      .send({ email: 'pwtest@securecam.com' });

    assert.equal(forgotRes.status, 200);
    assert.ok(forgotRes.body.verification_code);
    const validCode = forgotRes.body.verification_code;

    // 3. 잘못된 인증 코드로 재설정 시도 시 400 INVALID_VERIFICATION_CODE (ICD 2.1.5)
    const badResetRes = await request(app)
      .post('/v1/auth/reset-password')
      .send({
        email: 'pwtest@securecam.com',
        verification_code: '111111',
        new_password: 'newValidPassword123!',
      });

    assert.equal(badResetRes.status, 400);
    assert.equal(badResetRes.body.code, 'INVALID_VERIFICATION_CODE');

    // 4. 올바른 인증 코드로 재설정 성공 (ICD 2.1.5)
    const goodResetRes = await request(app)
      .post('/v1/auth/reset-password')
      .send({
        email: 'pwtest@securecam.com',
        verification_code: validCode,
        new_password: 'newValidPassword123!',
      });

    assert.equal(goodResetRes.status, 200);
    assert.ok(goodResetRes.body.message);

    // 5. 변경된 비밀번호로 로그인 성공 확인
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'pwtest@securecam.com',
        password: 'newValidPassword123!',
      });

    assert.equal(loginRes.status, 200);
    assert.ok(loginRes.body.access_token);
  });

  test('아이디 찾기 시 ICD 2.1.4 규격 검증 (POST /auth/find-id)', async () => {
    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'hong-gildong@securecam.com',
        password: 'password123!',
        name: '홍길동',
      });

    // 1. 인증 코드 발급 (전화번호)
    const phoneRes = await request(app)
      .post('/v1/auth/send-verification-code')
      .send({
        target: '010-1234-5678',
        type: 'find_id',
      });
    const code = phoneRes.body.verification_code;

    // 2. ICD 2.1.4 규격 요청 (name, phone_number, verification_code)
    const findRes = await request(app)
      .post('/v1/auth/find-id')
      .send({
        name: '홍길동',
        phone_number: '010-1234-5678',
        verification_code: code,
      });

    assert.equal(findRes.status, 200);
    // ICD 2.1.4 응답 규격: { email: "마스킹 처리된 형식" }
    assert.ok(findRes.body.email);
    assert.ok(findRes.body.email.includes('*'));
    assert.ok(findRes.body.email.includes('@securecam.com'));
  });

  test('회원 탈퇴 시 비밀번호 불일치 오류 400 INVALID_PASSWORD 반환 (ICD 2.1.7)', async () => {
    // 1. 가입 및 로그인
    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'delete-user@securecam.com',
        password: 'deletePassword123!',
        name: '탈퇴유저',
      });

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'delete-user@securecam.com',
        password: 'deletePassword123!',
      });

    const token = loginRes.body.access_token;

    // 2. 틀린 비밀번호로 탈퇴 시도 시 400 INVALID_PASSWORD
    const failRes = await request(app)
      .delete('/v1/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({
        password: 'wrongPassword999!',
        reason: '서비스 불만족',
      });

    assert.equal(failRes.status, 400);
    assert.equal(failRes.body.code, 'INVALID_PASSWORD');

    // 3. 올바른 비밀번호로 탈퇴 성공
    const successRes = await request(app)
      .delete('/v1/auth/account')
      .set('Authorization', `Bearer ${token}`)
      .send({
        password: 'deletePassword123!',
        reason: '개인 사유',
      });

    assert.equal(successRes.status, 200);
    assert.ok(successRes.body.message);
  });

  test('존재하지 않거나 만료된 세션 강제 로그아웃 시 404 SESSION_NOT_FOUND (ICD 2.1.6.2)', async () => {
    // 1. 가입 및 로그인
    await request(app)
      .post('/v1/auth/register')
      .send({
        email: 'session-user@securecam.com',
        password: 'password123!',
        name: '세션유저',
      });

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({
        email: 'session-user@securecam.com',
        password: 'password123!',
      });

    const token = loginRes.body.access_token;

    // 2. 존재하지 않는 세션 ID 삭제 시도
    const res = await request(app)
      .delete('/v1/auth/sessions/non-existent-session-id')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.code, 'SESSION_NOT_FOUND');
  });
});
