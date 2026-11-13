import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, mediaMtxConfig } from "../src/config.js";

test("HTTPS domain is external only; native listeners and trusted proxy stay VPN-scoped", () => {
  const config = loadConfig({
    HTTPS_PROXY_ENABLED: "true",
    WG_SERVER_IP: "10.0.0.100",
    WEBRTC_BASE_URL: "https://api.securecam.com",
  });
  const native = mediaMtxConfig(config);
  assert.equal(config.webRtcBase, "https://api.securecam.com");
  assert.equal(native.webrtcAddress, "10.0.0.100:8889");
  assert.equal(native.webrtcLocalUDPAddress, "10.0.0.100:8189");
  assert.deepEqual(native.webrtcTrustedProxies, ["10.0.0.100/32"]);
  assert.deepEqual(native.authInternalUsers[0].ips, ["10.0.2.0/24"]);
  assert.throws(
    () =>
      loadConfig({
        HTTPS_PROXY_ENABLED: "true",
        WEBRTC_BASE_URL: "http://10.0.0.100:8889",
      }),
    /HTTPS origin/,
  );
});

test("I2 binds WHEP and ICE only to VPN, advertises only VPN candidates, and disables unused outputs", () => {
  const config = mediaMtxConfig(loadConfig({}));
  assert.equal(config.webrtcAddress, "10.0.0.100:8889");
  assert.equal(config.webrtcLocalUDPAddress, "10.0.0.100:8189");
  assert.equal(config.webrtcIPsFromInterfaces, false);
  assert.deepEqual(config.webrtcAdditionalHosts, ["10.0.0.100"]);
  assert.deepEqual(config.webrtcICEServers2, []);
  for (const key of [
    "rtsp",
    "rtmp",
    "hls",
    "srt",
    "moq",
    "metrics",
    "pprof",
    "playback",
  ])
    assert.equal(config[key], false);
  assert.equal(config.apiAddress, "127.0.0.1:9997");
});

test("exact I2 device_id paths use TCP, high always pulls and sub pulls on demand", () => {
  const config = mediaMtxConfig(loadConfig({}));
  assert.deepEqual(Object.keys(config.paths), [
    "CAM-E099",
    "CAM-E099_sub",
    "CAM-04AF",
    "CAM-04AF_sub",
  ]);
  assert.equal(config.paths["CAM-E099"].source, "rtsp://10.0.1.2:554/live/0");
  assert.equal(
    config.paths["CAM-04AF_sub"].source,
    "rtsp://10.0.1.1:554/live/1",
  );
  for (const [name, path] of Object.entries(config.paths))
    assert.equal(path.sourceOnDemand, name.endsWith("_sub"));
  assert.equal(config.pathDefaults.rtspTransport, "tcp");
  assert.equal(config.pathDefaults.record, false);
});

test("only the client subnet gets read, localhost gets API, nobody gets publish", () => {
  const users = mediaMtxConfig(loadConfig({})).authInternalUsers;
  assert.deepEqual(users[0].ips, ["10.0.2.0/24"]);
  assert.deepEqual(
    users[0].permissions.map((p) => p.action),
    ["read"],
  );
  assert.deepEqual(users[1].ips, ["127.0.0.1", "::1"]);
  assert.deepEqual(users[1].permissions, [{ action: "api" }]);
  assert.ok(
    users.every((user) =>
      user.permissions.every((permission) => permission.action !== "publish"),
    ),
  );
});

test("reject inconsistent listener URLs, invalid subnets and unsupported options", () => {
  assert.throws(
    () => loadConfig({ WEBRTC_BASE_URL: "http://0.0.0.0:8889" }),
    /WEBRTC_BASE_URL/,
  );
  assert.throws(
    () => loadConfig({ MTX_API_URL: "http://10.0.0.100:9997" }),
    /loopback/,
  );
  assert.throws(() => loadConfig({ CLIENT_VPN_SUBNET: "10.0.2.0/33" }), /CIDR/);
  assert.throws(() => loadConfig({ MEDIAMTX_ENABLED: "yes" }), /true or false/);
});

test("static boards outside their VPN subnet or with duplicate IDs are rejected", async () => {
  const directory = await mkdtemp(join(tmpdir(), "c7-boards-"));
  const file = join(directory, "boards.json");
  try {
    await writeFile(
      file,
      JSON.stringify([{ device_id: "CAM-E099", vpn_ip: "169.254.169.254" }]),
    );
    assert.throws(
      () => loadConfig({ MEDIAMTX_BOARDS_FILE: file }),
      /static MediaMTX board/,
    );
    await writeFile(
      file,
      JSON.stringify([
        { device_id: "CAM-E099", vpn_ip: "10.0.1.2" },
        { device_id: "CAM-E099", vpn_ip: "10.0.1.1" },
      ]),
    );
    assert.throws(
      () => loadConfig({ MEDIAMTX_BOARDS_FILE: file }),
      /duplicate/,
    );
  } finally {
    await unlink(file);
    await rmdir(directory);
  }
});
