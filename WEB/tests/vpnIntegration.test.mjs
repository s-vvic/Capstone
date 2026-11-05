import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createControllerApp } from "../../controller/src/app.js";
import { setInMemoryDriver } from "../../user-auth/src/repositories/index.js";
import { setVpnRepository } from "../../vpn/src/repositories/index.js";
import { InMemoryVpnRepository } from "../../vpn/src/repositories/inMemoryVpnRepository.js";
import { setWireguardDriver } from "../../vpn/src/drivers/index.js";
import { VirtualWireguardDriver } from "../../vpn/src/drivers/virtualWireguardDriver.js";
import { defaultIpPoolManager } from "../../vpn/src/services/ipPoolManager.js";
import { signup, login, logout } from "../src/api/authApi.js";
import {
  vpnApi,
  loadVpnData,
  normalizeConnections,
} from "../src/api/vpnApi.js";
import { apiClient, setAuthToken, getAuthToken } from "../src/api/client.js";
import { saveSession, getAccessToken } from "../src/storage/authStorage.js";
import { getCameras, registerCamera, updateCamera } from "../src/api/cameraApi.js";

test("WEB client -> controller -> C1 session and C4 VPN lifecycle", async (t) => {
  setInMemoryDriver();
  defaultIpPoolManager.clear();
  const repo = new InMemoryVpnRepository();
  const driver = new VirtualWireguardDriver();
  setVpnRepository(repo);
  setWireguardDriver(driver);
  const app = createControllerApp();
  let failRead = false;
  let failAction = false;
  const server = http.createServer((req, res) => {
    if (
      (failRead && req.url === "/v1/vpn/connections") ||
      (failAction && req.url.endsWith("/action"))
    ) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error_code: "SERVICE_UNAVAILABLE",
          message: "VPN unavailable",
        }),
      );
      return;
    }
    app(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const realFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;
  const session = new Map();
  globalThis.sessionStorage = { getItem: (key) => session.get(key) || null, setItem: (key, value) => session.set(key, String(value)), removeItem: (key) => session.delete(key) };
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.fetch = (url, options) => realFetch(new URL(url, base), options);
  try {
    const user = await signup({
      email: "web-vpn@example.com",
      password: "VpnTest!2026",
      name: "VPN owner",
    });
    await login("web-vpn@example.com", "VpnTest!2026");
    const ownerToken = getAuthToken();
    assert.ok(ownerToken);
    await t.test("remember-me and session-only login share the same API authentication", async () => {
      saveSession(user.email, ownerToken, false);
      assert.equal(storage.get("accessToken"), undefined);
      assert.equal(getAccessToken(), ownerToken);
      await loadVpnData();
      saveSession(user.email, ownerToken, true);
      assert.equal(session.get("accessToken"), undefined);
      assert.equal(storage.get("accessToken"), ownerToken);
    });
    await t.test("new camera UI retains C2 MAC registration, list and rename", async () => {
      const camera = await registerCamera({ mac: "00:1a:2b:3c:4d:5e", name: "UI camera", location: "Room" });
      assert.equal(camera.mac, "001A2B3C4D5E");
      assert.equal(camera.device_id, "001A2B3C4D5E");
      await updateCamera(camera.mac, { name: "Renamed camera" });
      assert.equal((await getCameras())[0].name, "Renamed camera");
    });
    await t.test("empty inventory stays empty", async () => {
      const data = await loadVpnData();
      assert.deepEqual(data.devices, []);
      assert.equal(data.server.driver_mode, "virtual");
    });
    await vpnApi.registerVpnPeer({
      peer_id: "CAM-WEB",
      peer_type: "device",
      name: "Web camera",
      mac_no: "00:1A:2B:3C:4D:5E",
    });
    // A phone and an unowned board must not appear in the camera management list.
    await vpnApi.registerVpnPeer({
      peer_id: "PHONE-WEB",
      peer_type: "phone",
      name: "Phone",
    });
    await repo.create({
      peer_id: "UNOWNED",
      peer_type: "device",
      name: "Unowned",
      user_id: null,
    });
    await t.test("authenticated inventory maps current C4 fields", async () => {
      const data = await loadVpnData();
      assert.equal(data.devices.length, 1);
      assert.equal(data.devices[0].id, "CAM-WEB");
      assert.equal(data.devices[0].mac, "001A2B3C4D5E");
      assert.equal(data.devices[0].vpnStatus, "connected");
      assert.equal((await repo.findById("CAM-WEB")).user_id, user.user_id);
    });
    await t.test(
      "disconnect/connect/recovery really modify the driver",
      async () => {
        const peer = await repo.findById("CAM-WEB");
        await vpnApi.executeVpnAction("CAM-WEB", "disconnect");
        assert.equal(await driver.getPeer(peer.wg_pubkey), null);
        assert.equal(
          (await loadVpnData()).devices[0].vpnStatus,
          "disconnected",
        );
        await vpnApi.executeVpnAction("CAM-WEB", "connect");
        assert.ok(await driver.getPeer(peer.wg_pubkey));
        driver.simulateTimeout(peer.wg_pubkey);
        assert.equal((await loadVpnData()).devices[0].vpnStatus, "error");
        await vpnApi.recoverVpnConnection("CAM-WEB");
        assert.equal((await loadVpnData()).devices[0].vpnStatus, "connected");
      },
    );
    await t.test(
      "failed requests surface errors without invented status or rows",
      async () => {
        failAction = true;
        await assert.rejects(
          vpnApi.executeVpnAction("CAM-WEB", "disconnect"),
          (e) => e.status === 503 && e.code === "SERVICE_UNAVAILABLE",
        );
        failAction = false;
        assert.equal((await loadVpnData()).devices[0].vpnStatus, "connected");
        failRead = true;
        await assert.rejects(loadVpnData(), (e) => e.status === 503);
        failRead = false;
      },
    );
    await t.test(
      "WireGuard driver failure propagates through the real HTTP API",
      async () => {
        const getPeers = driver.getPeers;
        driver.getPeers = async () => { throw new Error("WireGuard unavailable"); };
        try { await assert.rejects(loadVpnData(), (error) => error.status === 500); }
        finally { driver.getPeers = getPeers; }
      },
    );
    await t.test(
      "unowned and foreign devices cannot be operated; auth headers cannot override JWT",
      async () => {
        await assert.rejects(
          vpnApi.executeVpnAction("UNOWNED", "connect"),
          (e) => e.status === 403,
        );
        await signup({
          email: "other-vpn@example.com",
          password: "VpnTest!2026",
          name: "Other",
        });
        await login("other-vpn@example.com", "VpnTest!2026");
        assert.deepEqual((await loadVpnData()).devices, []);
        await assert.rejects(
          vpnApi.getVpnConnection("CAM-WEB"),
          (e) => e.status === 403,
        );
        await assert.rejects(
          vpnApi.executeVpnAction("CAM-WEB", "disconnect"),
          (e) => e.status === 403,
        );
        const response = await realFetch(
          base + "/v1/vpn/connections/CAM-WEB/action",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer " + getAuthToken(),
              "x-user-id": user.user_id,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "disconnect" }),
          },
        );
        assert.equal(response.status, 403);
        setAuthToken(ownerToken);
      },
    );
    await t.test(
      "logout invalidates VPN access, not just local token storage",
      async () => {
        await logout();
        setAuthToken(ownerToken);
        await assert.rejects(loadVpnData(), (e) => e.status === 401);
      },
    );
    await t.test(
      "normalization rejects malformed payloads and handles canonical MAC responses",
      () => {
        assert.throws(() => normalizeConnections({ items: [] }));
        assert.throws(() => normalizeConnections([{}]));
        const [device] = normalizeConnections([
          {
            mac: "001A2B3C4D5E",
            device_name: "Canonical",
            vpn_status: "disconnected",
            connected_duration_sec: 0,
          },
        ]);
        assert.equal(device.id, "001A2B3C4D5E");
        assert.equal(device.duration, "0초");
      },
    );
    await t.test("client supports abort and cleans legacy tokens", async () => {
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(
        vpnApi.getVpnConnections({ signal: controller.signal }),
        (e) => e.name === "AbortError",
      );
      storage.set("token", "old-token");
      setAuthToken(null);
      assert.equal(getAuthToken(), "");
      await assert.rejects(
        apiClient.get("/vpn/connections"),
        (e) => e.status === 401,
      );
    });
  } finally {
    globalThis.fetch = realFetch;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
    if (originalSessionStorage === undefined) delete globalThis.sessionStorage;
    else globalThis.sessionStorage = originalSessionStorage;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
