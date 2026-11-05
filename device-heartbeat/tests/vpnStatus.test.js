import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import {
  reset,
  seed,
  mac,
  token,
  createDeviceHeartbeatApp,
  deviceRepository,
} from "./helpers.js";
let app;
beforeEach(() => {
  app = reset();
});
const body = {
  mac,
  wg_pubkey: "key",
  firmware_version: "2.0",
  model: "RV-1106",
};
test("C4 control is no longer simulated by C2", async () => {
  for (const [method, path] of [
    ["get", "/v1/vpn/connections"],
    ["post", "/v1/vpn/connections/" + mac + "/action"],
    ["post", "/v1/vpn/connections/" + mac + "/recover"],
  ])
    assert.equal(
      (
        await request(app)
          [method](path)
          .set("Authorization", "Bearer " + token())
          .send({ action: "connect" })
      ).status,
      404,
    );
});
test("bootstrap fails closed, even with JWT or spoofed headers", async () => {
  const res = await request(app)
    .post("/v1/devices/provision-by-mac")
    .set("Authorization", "Bearer " + token())
    .set("X-Forwarded-For", "10.0.1.11")
    .send(body);
  assert.equal(res.status, 403);
  await seed();
  assert.equal(
    (await request(app).post("/v1/devices/provision-by-mac").send(body)).status,
    503,
  );
});
test("authenticated reprovision calls C4 adapter and returns only ICD fields", async () => {
  await seed();
  let called = false;
  app = createDeviceHeartbeatApp({
    provisionBoard: async (data) => {
      called = true;
      assert.equal(data.mac, mac);
      assert.equal(data.source_ip, "127.0.0.1");
      return {
        vpn_ip: "127.0.0.1",
        server_pubkey: "server",
        server_endpoint: "vpn.securecam.com:51820",
        rtsp_proxy_ip: "10.0.0.1",
      };
    },
  });
  const res = await request(app)
    .post("/v1/devices/provision-by-mac")
    .send(body);
  assert.equal(res.status, 200);
  assert.equal(called, true);
  assert.deepEqual(Object.keys(res.body).sort(), [
    "rtsp_proxy_ip",
    "server_endpoint",
    "server_pubkey",
    "vpn_ip",
  ]);
  assert.equal((await deviceRepository.findByMac(mac)).wg_pubkey, "key");
});
test("provision fields and adapter result are validated", async () => {
  await seed();
  for (const key of Object.keys(body)) {
    const missing = { ...body };
    delete missing[key];
    assert.equal(
      (await request(app).post("/v1/devices/provision-by-mac").send(missing))
        .status,
      400,
    );
  }
  app = createDeviceHeartbeatApp({ provisionBoard: async () => ({}) });
  assert.equal(
    (await request(app).post("/v1/devices/provision-by-mac").send(body)).status,
    503,
  );
});
