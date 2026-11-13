import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createControllerApp } from "../src/app.js";
import { createVpnStatusHandler } from "../src/routes/vpnStatus.js";

test("VPN status uses only the socket IP, including mapped IPv4 and configured subnet", () => {
  const handler = createVpnStatusHandler("10.0.2.0/24");
  for (const [address, connected, normalized] of [
    ["10.0.2.3", true, "10.0.2.3"],
    ["::ffff:10.0.2.3", true, "10.0.2.3"],
    ["10.0.1.2", false, "10.0.1.2"],
    ["::1", false, "::1"],
  ]) {
    let body;
    handler(
      {
        socket: { remoteAddress: address },
        headers: { "x-forwarded-for": "10.0.2.3" },
      },
      {
        set() {},
        status(code) {
          assert.equal(code, 200);
          return this;
        },
        json(value) {
          body = value;
        },
      },
    );
    assert.deepEqual(body, { connected, client_ip: normalized });
  }
  assert.throws(() => createVpnStatusHandler("invalid"));
});

test("GET /v1/status ignores invalid JWT and spoofed forwarded headers", async () => {
  const app = createControllerApp();
  assert.equal(app.get("trust proxy"), false);
  const response = await request(app)
    .get("/v1/status")
    .set("Authorization", "Bearer invalid")
    .set("X-Forwarded-For", "10.0.2.3")
    .expect(200);
  assert.equal(response.body.connected, false);
  assert.equal(response.headers["cache-control"], "no-store");
});

test("controller reports managed MediaMTX failure instead of constant UP", async () => {
  const app = createControllerApp({
    mediaRuntime: {
      async health() {
        return { status: "failed" };
      },
    },
  });
  const response = await request(app).get("/health").expect(503);
  assert.equal(response.body.status, "DEGRADED");
  assert.equal(response.body.components.component_7_mediamtx, "failed");
});
