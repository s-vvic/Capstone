import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createAuthApp } from "../src/index.js";
import { setInMemoryDriver } from "../src/repositories/index.js";

describe("SV-F-005 & NF-P-005 구독 플랜(Basic/Standard/Premium) 기능 차등 및 관리 테스트", () => {
  let app;

  beforeEach(async () => {
    setInMemoryDriver();
    app = createAuthApp();

    await request(app).post("/v1/auth/register").send({
      email: "planuser@securecam.com",
      password: "password123!",
      name: "플랜유저",
      plan: "basic",
    });
  });

  test("전체 구독 플랜 티어 및 차등 정책 조회 (GET /auth/plan/tiers)", async () => {
    const res = await request(app).get("/v1/auth/plan/tiers");

    assert.equal(res.status, 200);
    assert.equal(res.body.tiers.length, 3);

    const basic = res.body.tiers.find((t) => t.code === "basic");
    const standard = res.body.tiers.find((t) => t.code === "standard");
    const premium = res.body.tiers.find((t) => t.code === "premium");

    assert.ok(basic && standard && premium);

    // NF-P-005 동시 접속 수 차등 검증
    assert.equal(basic.maxConcurrentSessions, 1);
    assert.equal(standard.maxConcurrentSessions, 3);
    assert.equal(premium.maxConcurrentSessions, 10);

    // SV-F-032 저장 용량 차등 검증
    assert.equal(basic.storageQuotaGb, 5);
    assert.equal(standard.storageQuotaGb, 30);
    assert.equal(premium.storageQuotaGb, 100);

    // SV-F-033 보관 일수 차등 검증
    assert.equal(basic.retentionDays, 7);
    assert.equal(standard.retentionDays, 30);
    assert.equal(premium.retentionDays, 90);
  });

  test("내 플랜 조회 시 현재 사용량 및 플랜 정보 반환 (GET /auth/plan)", async () => {
    const loginRes = await request(app)
      .post("/v1/auth/login")
      .send({ email: "planuser@securecam.com", password: "password123!" });

    const token = loginRes.body.access_token;

    const res = await request(app)
      .get("/v1/auth/plan")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.current_plan, "basic");
    assert.equal(res.body.plan_details.maxConcurrentSessions, 1);
    assert.equal(res.body.usage.active_sessions, 1);
  });

  test("구독 플랜 변경 (Basic -> Premium) 성공 (PATCH /auth/plan)", async () => {
    const loginRes = await request(app)
      .post("/v1/auth/login")
      .send({ email: "planuser@securecam.com", password: "password123!" });

    const token = loginRes.body.access_token;

    const changeRes = await request(app)
      .patch("/v1/auth/plan")
      .set("Authorization", `Bearer ${token}`)
      .send({ plan: "premium" });

    assert.equal(changeRes.status, 200);
    assert.equal(changeRes.body.plan, "premium");
    assert.equal(changeRes.body.plan_details.maxConcurrentSessions, 10);
    assert.equal(changeRes.body.plan_details.features.aiAlerts, true);
  });

  test("Basic 플랜 동시 접속 한도(1대) 초과 시 이전 기기 자동 만료 (NF-P-005)", async () => {
    // 1. 기기 1 로그인 (Basic 플랜)
    const login1 = await request(app)
      .post("/v1/auth/login")
      .send({
        email: "planuser@securecam.com",
        password: "password123!",
        deviceName: "First Device",
      });
    const token1 = login1.body.access_token;

    // 2. 기기 2 로그인 (Basic 플랜이므로 한도 1대 초과)
    const login2 = await request(app)
      .post("/v1/auth/login")
      .send({
        email: "planuser@securecam.com",
        password: "password123!",
        deviceName: "Second Device",
      });
    const token2 = login2.body.access_token;

    // 기기 1 토큰으로 접근 시도 -> 401 만료 확인
    const check1 = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${token1}`);
    assert.equal(check1.status, 401);

    // 기기 2 토큰은 정상 유지
    const check2 = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${token2}`);
    assert.equal(check2.status, 200);
  });
});
