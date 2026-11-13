import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { webrtcUrls, warnMissingWebRtcBase } from "../src/utils/webrtcUrls.js";
import { env, reset, seed, token, mac } from "./helpers.js";

test("I2 URL generation handles missing base/IP, trailing slash and offline boards", () => {
  const board = { mac: "7424CAAAE099", vpn_ip: "10.0.1.2", last_seen: null };
  assert.deepEqual(webrtcUrls(board, "http://10.0.0.100:8889///"), {
    webrtc_url: "http://10.0.0.100:8889/CAM-E099/whep",
    webrtc_url_sub: "http://10.0.0.100:8889/CAM-E099_sub/whep",
  });
  assert.deepEqual(webrtcUrls(board, ""), {
    webrtc_url: null,
    webrtc_url_sub: null,
  });
  assert.deepEqual(
    webrtcUrls({ ...board, vpn_ip: null }, "http://10.0.0.100:8889"),
    { webrtc_url: null, webrtc_url_sub: null },
  );
  const warnings = [];
  warnMissingWebRtcBase("", { warn: (message) => warnings.push(message) });
  warnMissingWebRtcBase("http://10.0.0.100:8889", {
    warn() {
      throw new Error("Unexpected warning");
    },
  });
  assert.equal(warnings.length, 1);
});

test("list, status and registration return WHEP fields without adding DB columns", async (t) => {
  const previous = env.WEBRTC_BASE_URL;
  env.WEBRTC_BASE_URL = "http://10.0.0.100:8889";
  t.after(() => {
    env.WEBRTC_BASE_URL = previous;
  });
  const app = reset();
  await seed({ last_seen: null });
  const list = await request(app)
    .get("/v1/devices")
    .set("Authorization", `Bearer ${token()}`)
    .expect(200);
  assert.equal(list.body[0].webrtc_url, "http://10.0.0.100:8889/CAM-4D5E/whep");
  const status = await request(app)
    .get(`/v1/devices/${mac}/status`)
    .set("Authorization", `Bearer ${token()}`)
    .expect(200);
  assert.equal(
    status.body.webrtc_url_sub,
    "http://10.0.0.100:8889/CAM-4D5E_sub/whep",
  );
  const registered = await request(app)
    .post("/v1/devices/register")
    .set("Authorization", `Bearer ${token()}`)
    .send({ mac, location: "Room" })
    .expect(201);
  assert.equal(registered.body.webrtc_url, list.body[0].webrtc_url);
});
