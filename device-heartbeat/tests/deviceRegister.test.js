import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { reset, token, mac, other, seed, deviceRepository } from "./helpers.js";
let app;
beforeEach(() => {
  app = reset();
});
const register = (body, auth = token()) =>
  request(app)
    .post("/v1/devices/register")
    .set("Authorization", "Bearer " + auth)
    .send(body);
test("MAC registration uses full identity and does not allocate VPN credentials", async () => {
  const res = await register({ mac, location: "거실" });
  assert.equal(res.status, 201);
  assert.equal(res.body.mac, mac);
  assert.equal(res.body.vpn_ip, null);
  assert.equal(res.body.name, "보드 " + mac);
  for (const key of [
    "device_id",
    "mac_no",
    "MAC_no",
    "provision_token",
    "wg_pubkey",
  ])
    assert.equal(key in res.body, false);
  const second = await register({ mac: "AA1122334D5E", location: "거실" });
  assert.equal(second.status, 201);
  assert.equal(
    (
      await request(app)
        .get("/v1/devices")
        .set("Authorization", "Bearer " + token())
    ).body.length,
    2,
  );
});
test("required fields, canonical MAC and legacy fields are rejected", async () => {
  for (const body of [
    { mac },
    { location: "거실" },
    { mac: mac.toLowerCase(), location: "거실" },
    { mac: "00:1A:2B:3C:4D:5E", location: "거실" },
    { mac, location: 42 },
    { mac, location: "거실", register_type: "qr" },
    { mac, location: "거실", name: "a".repeat(51) },
  ]) {
    const res = await register(body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.body.error_code, "BAD_REQUEST");
  }
});
test("claim preserves C4 registration and refuses foreign ownership", async () => {
  await seed({ user_id: null, wg_pubkey: "existing", config_version: 9 });
  assert.equal(
    (await register({ mac, location: "새 위치", name: "새 위치" })).status,
    201,
  );
  const saved = await deviceRepository.findByMac(mac);
  assert.equal(saved.wg_pubkey, "existing");
  assert.equal(saved.config_version, 9);
  assert.equal(
    (await register({ mac, location: "거실" }, token(other))).status,
    409,
  );
});
test("concurrent claims cannot overwrite ownership", async () => {
  const results = await Promise.all([
    register({ mac, location: "A" }),
    register({ mac, location: "B" }, token(other)),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
});
test("inactive board cannot be reactivated by registration", async () => {
  await seed({ is_active: false });
  assert.equal((await register({ mac, location: "A" })).status, 409);
});
