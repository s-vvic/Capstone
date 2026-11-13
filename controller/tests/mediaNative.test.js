import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { loadConfig } from "../../mediamtx/src/config.js";
import { createMediaRuntime } from "../../mediamtx/src/runtime.js";
import { startController } from "../src/lifecycle.js";

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test(
  "controller starts official MediaMTX, exposes I2 WHEP with CORS/IP restrictions, and stops its child",
  { skip: !process.env.MTX_TEST_BINARY, timeout: 30000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "controller-c7-"));
    const file = join(directory, "mediamtx.yml");
    const apiPort = await freePort();
    const whepPort = await freePort();
    const icePort = await freePort();
    const rtspPort = await freePort();
    const config = loadConfig({
      MEDIAMTX_ENABLED: "true",
      MEDIAMTX_BINARY: process.env.MTX_TEST_BINARY,
      MEDIAMTX_CONFIG_PATH: file,
      WG_SERVER_IP: "127.0.0.1",
      WEBRTC_BASE_URL: `http://127.0.0.1:${whepPort}`,
      MTX_API_URL: `http://127.0.0.1:${apiPort}`,
      MTX_ICE_UDP_PORT: String(icePort),
      RTSP_PORT: String(rtspPort),
      MTX_LOG_LEVEL: "error",
    });
    // Local-only source fixture; no real board or VPN is contacted by this test.
    config.boards = [{ device_id: "CAM-1111", vpn_ip: "127.0.0.1" }];
    const mediaRuntime = createMediaRuntime({
      config,
      logger: { info() {}, error() {} },
    });
    let controller;
    t.after(async () => {
      await controller?.close();
      await mediaRuntime.stop();
      await unlink(file);
      await rmdir(directory);
    });
    controller = await startController({
      mediaRuntime,
      port: 0,
      logger: { info() {}, warn() {} },
    });
    const base = `http://127.0.0.1:${controller.server.address().port}`;
    const health = await (await fetch(`${base}/health`)).json();
    assert.equal(health.components.component_7_mediamtx, "running");
    const status = await fetch(`${base}/v1/status`, {
      headers: { authorization: "Bearer ignored" },
    });
    assert.equal(status.status, 200);
    const paths = await (
      await fetch(`${config.apiUrl}/v3/config/paths/list`)
    ).json();
    assert.deepEqual(paths.items.map((path) => path.name).sort(), [
      "CAM-1111",
      "CAM-1111_sub",
    ]);
    const main = paths.items.find((path) => path.name === "CAM-1111");
    assert.equal(main.sourceOnDemand, false);
    assert.equal(main.rtspTransport, "tcp");
    const cors = await fetch(`${config.webRtcBase}/CAM-1111/whep`, {
      method: "OPTIONS",
      headers: {
        origin: "https://dashboard.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    assert.equal(cors.status, 204);
    assert.equal(
      cors.headers.get("access-control-allow-origin"),
      "https://dashboard.example",
    );
    await cors.body?.cancel();
    // Untrusted client IP cannot gain read access by spoofing forwarded headers.
    const denied = await fetch(`${config.webRtcBase}/CAM-1111/whep`, {
      method: "POST",
      headers: {
        "content-type": "application/sdp",
        "x-forwarded-for": "10.0.2.3",
        origin: "https://dashboard.example",
      },
      body: "v=0\r\n",
    });
    assert.equal(denied.status, 401);
    // A rejected request creates no session; Location is exposed only on 201.
    await denied.body?.cancel();
    await controller.close();
    assert.equal(mediaRuntime.status, "stopped");
    await assert.rejects(fetch(`${config.apiUrl}/v3/config/global/get`));
  },
);
