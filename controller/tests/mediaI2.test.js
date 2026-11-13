import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createControllerApp } from "../src/app.js";
import { createVpnStatusHandler } from "../src/routes/vpnStatus.js";
import { clientAddress } from "../../shared/network.mjs";

test("HTTPS proxy mode trusts only a single IP from the local Nginx socket", () => {
  const req = (socket, header) => ({
    socket: { remoteAddress: socket },
    headers: { "x-forwarded-for": header },
  });
  assert.equal(clientAddress(req("127.0.0.1", "10.0.2.3"), true), "10.0.2.3");
  assert.equal(clientAddress(req("127.0.0.1", "10.0.2.3"), false), "127.0.0.1");
  assert.equal(clientAddress(req("10.0.1.2", "10.0.2.3"), true), "10.0.1.2");
  assert.equal(
    clientAddress(req("::ffff:127.0.0.1", "10.0.2.3"), true),
    "10.0.2.3",
  );
  assert.equal(
    clientAddress(req("127.0.0.1", "10.0.2.3, 1.2.3.4"), true),
    "127.0.0.1",
  );
  let result;
  createVpnStatusHandler("10.0.2.0/24", true)(req("127.0.0.1", "10.0.2.3"), {
    set() {},
    status() {
      return this;
    },
    json(body) {
      result = body;
    },
  });
  assert.deepEqual(result, { connected: true, client_ip: "10.0.2.3" });
});

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
