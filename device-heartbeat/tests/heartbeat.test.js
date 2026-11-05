import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { heartbeatService } from "../src/services/heartbeatService.js";
import { reset, seed, heartbeat, mac, deviceRepository } from "./helpers.js";
let app;
beforeEach(() => {
  app = reset();
});
const send = (body) => request(app).post("/v1/devices/heartbeat").send(body);
test("TCP VPN source auth returns latest config and persists applied version only", async () => {
  await seed({
    config_version: 7,
    applied_config_version: 1,
    last_handshake: "2026-01-01T00:00:00.000Z",
  });
  const res = await send(
    heartbeat({
      config_version: 3,
      storage_used_bytes: 1073741824,
      latency_ms: 12,
      firmware_version: "2.0",
    }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { config_version: 7 });
  const saved = await deviceRepository.findByMac(mac);
  assert.equal(saved.applied_config_version, 3);
  assert.equal(saved.config_version, 7);
  assert.equal(saved.storage_used_bytes, 1073741824);
  assert.equal(saved.firmware_version, "2.0");
  assert.equal(saved.latency_ms, 12);
  assert.ok(saved.last_seen);
  assert.equal(saved.last_handshake, "2026-01-01T00:00:00.000Z");
  assert.equal(saved.uptime_seconds, null);
});
test("false metrics and zero optional values are preserved; omission preserves previous values", async () => {
  await seed({
    storage_used_bytes: 1024,
    latency_ms: 9,
    vpn_status: "connected",
  });
  const res = await send(
    heartbeat({
      rtsp_ok: false,
      wg_ok: false,
      storage_used_bytes: 0,
      latency_ms: 0,
    }),
  );
  assert.equal(res.status, 200);
  await send(heartbeat());
  const d = await deviceRepository.findByMac(mac);
  assert.equal(d.storage_used_bytes, 0);
  assert.equal(d.latency_ms, 0);
  assert.equal(d.vpn_status, "connected");
  await send(heartbeat({ rtsp_ok: false, wg_ok: false }));
  const bad = await deviceRepository.findByMac(mac);
  assert.equal(bad.rtsp_ok, false);
  assert.equal(bad.wg_ok, false);
});
test("forwarding headers cannot spoof registered source and wrong MAC cannot mutate state", async () => {
  await seed({ vpn_ip: "10.0.1.11" });
  const res = await request(app)
    .post("/v1/devices/heartbeat")
    .set("X-Forwarded-For", "10.0.1.11")
    .set("X-Real-IP", "10.0.1.11")
    .send(heartbeat());
  assert.equal(res.status, 403);
  assert.equal(res.body.error_code, "FORBIDDEN");
  await deviceRepository.update(mac, { vpn_ip: "127.0.0.1" });
  assert.equal((await send(heartbeat({ mac: "AAAAAAAAAAAA" }))).status, 403);
  assert.equal((await deviceRepository.findByMac(mac)).last_seen, null);
});
test("unregistered/inactive source and missing direct source fail closed", async () => {
  assert.equal((await send(heartbeat())).status, 403);
  await seed({ is_active: false });
  assert.equal((await send(heartbeat())).status, 403);
  await assert.rejects(
    heartbeatService.processHeartbeat(heartbeat()),
    (e) => e.status === 403,
  );
});
test("required fields and malformed metrics rejected without mutation", async () => {
  await seed();
  for (const key of ["mac", "status", "rtsp_ok", "wg_ok", "config_version"]) {
    const body = heartbeat();
    delete body[key];
    assert.equal((await send(body)).status, 400, key);
  }
  for (const fields of [
    { rtsp_ok: 1 },
    { wg_ok: "true" },
    { status: "offline" },
    { config_version: -1 },
    { config_version: 1.5 },
    { config_version: "2" },
    { latency_ms: -1 },
    { storage_used_bytes: "0" },
    { firmware_version: 42 },
    { provision_token: "old" },
  ])
    assert.equal(
      (await send(heartbeat(fields))).status,
      400,
      JSON.stringify(fields),
    );
  assert.equal((await deviceRepository.findByMac(mac)).last_seen, null);
});
test("mapped IPv6 matches registered IPv4; no heartbeat history repository exists", async () => {
  await seed({ vpn_ip: "10.0.1.11" });
  await heartbeatService.processHeartbeat(heartbeat(), "::ffff:10.0.1.11");
  const exports = await import("../src/repositories/index.js");
  assert.equal("heartbeatRepository" in exports, false);
});
