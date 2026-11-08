import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mock } from "node:test";
import { createControllerApp } from "../../controller/src/app.js";
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
  assert.equal(res.body.device_id, "CAM-4D5E");
  assert.equal((await deviceRepository.findByMac(mac)).device_id, "CAM-4D5E");
  assert.equal(res.body.vpn_ip, null);
  assert.equal(res.body.name, "보드 " + mac);
  for (const key of [
    "mac_no",
    "MAC_no",
    "provision_token",
    "wg_pubkey",
  ])
    assert.equal(key in res.body, false);
  const second = await register({ mac: "AA1122334D5F", location: "거실" });
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
test("different MACs with the same suffix are rejected without overwriting the first board", async () => {
  await register({ mac, location: "A" });
  const collision = await register({ mac: "AA1122334D5E", location: "B" });
  assert.equal(collision.status, 409);
  assert.equal(collision.body.error_code, "CONFLICT");
  assert.equal(await deviceRepository.findByMac("AA1122334D5E"), null);
  assert.equal((await deviceRepository.findByMac(mac)).location, "A");
});
test("clients cannot override the derived device ID", async () => {
  assert.equal((await register({ mac, location: "A", device_id: "CAM-FFFF" })).status, 400);
  const created = await deviceRepository.create({ mac, name: "Board", location: "A", device_id: "CAM-FFFF" });
  assert.equal(created.device_id, "CAM-4D5E");
  await assert.rejects(deviceRepository.update(mac, { device_id: "CAM-0000" }));
});
test("PostgreSQL uniqueness violations return 409 in standalone and controller hosts", async () => {
  const spy = mock.method(deviceRepository, "register", async () => { throw Object.assign(new Error("duplicate key"), { code: "23505" }); });
  try {
    for (const target of [app, createControllerApp()]) {
      const result = await request(target).post("/v1/devices/register").set("Authorization", "Bearer " + token()).send({ mac, location: "Room" });
      assert.equal(result.status, 409);
    }
  } finally { spy.mock.restore(); }
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
