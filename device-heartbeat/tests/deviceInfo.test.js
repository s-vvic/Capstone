import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import {
  reset,
  token,
  mac,
  other,
  seed,
  deviceRepository,
  env,
} from "./helpers.js";
let app;
beforeEach(() => {
  app = reset();
});
const get = (path, auth = token()) =>
  request(app)
    .get(path)
    .set("Authorization", "Bearer " + auth);
test("JWT required; development headers cannot bypass auth", async () => {
  assert.equal(
    (await request(app).get("/v1/devices").set("x-user-id", "attacker")).status,
    401,
  );
  assert.equal(
    (await get("/v1/devices", token(undefined, { expiresIn: -1 }))).status,
    401,
  );
  assert.equal((await get("/v1/devices", "invalid")).status, 401);
});
test("owner-only list and status; unowned records are not public", async () => {
  await seed();
  assert.equal((await get("/v1/devices", token(other))).body.length, 0);
  assert.equal(
    (await get("/v1/devices/" + mac + "/status", token(other))).status,
    403,
  );
  await deviceRepository.update(mac, { user_id: null });
  assert.equal((await get("/v1/devices/" + mac + "/status")).status, 403);
});
test("status derives expiration without monitor; no fabricated uptime or handshake", async () => {
  await seed({
    last_seen: new Date(Date.now() - 16000).toISOString(),
    status: "online",
    vpn_ip: "10.0.1.11",
  });
  const res = await get("/v1/devices/" + mac + "/status");
  assert.equal(res.status, 200);
  assert.equal(res.body.mac, mac);
  assert.equal(res.body.device_id, "CAM-4D5E");
  assert.equal(res.body.status, "offline");
  assert.equal(
    res.body.rtsp_url,
    "rtsp://10.0.1.11:" + env.RTSP_PORT + "/live/0",
  );
  assert.equal(
    res.body.rtsp_url_sub,
    "rtsp://10.0.1.11:" + env.RTSP_PORT + "/live/1",
  );
  assert.equal(res.body.uptime_seconds, null);
  assert.equal(res.body.last_handshake, null);
  assert.equal(res.body.storage_total_gb, null);
});
test("patch validates strings and cannot change ownership/VPN/config", async () => {
  await seed();
  const patch = (body) =>
    request(app)
      .patch("/v1/devices/" + mac)
      .set("Authorization", "Bearer " + token())
      .send(body);
  for (const body of [
    {},
    { name: "" },
    { name: "a".repeat(51) },
    { location: [] },
    { description: {} },
    { config_version: 5 },
    { user_id: other },
    { vpn_ip: "10.0.1.5" },
  ])
    assert.equal((await patch(body)).status, 400);
  const res = await patch({ name: "거실", location: "거실", description: "" });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, "거실");
  assert.equal(res.body.mac, mac);
  assert.equal(res.body.device_id, "CAM-4D5E");
});
test("unknown/invalid MAC and malformed JSON return ICD error_code", async () => {
  assert.equal((await get("/v1/devices/AAAAAAAAAAAA/status")).status, 404);
  assert.equal((await get("/v1/devices/CAM-4D5E/status")).status, 400);
  const res = await request(app)
    .post("/v1/devices/register")
    .set("Content-Type", "application/json")
    .send("{");
  assert.equal(res.status, 400);
  assert.equal(res.body.error_code, "BAD_REQUEST");
  assert.equal("code" in res.body, false);
});
