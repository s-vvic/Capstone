import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { heartbeatService } from "../src/services/heartbeatService.js";
import { onlineStatus } from "../src/services/deviceService.js";
import {
  reset,
  seed,
  heartbeat,
  mac,
  deviceRepository,
  heartbeatMonitor,
  env,
} from "./helpers.js";
beforeEach(reset);
test("ICD defaults are 5s heartbeat and >15s offline", () => {
  assert.equal(env.HEARTBEAT_INTERVAL_SECONDS, 5);
  assert.equal(env.OFFLINE_TIMEOUT_SECONDS, 15);
});
test("15-second boundary and one-time offline event preserve actual VPN state", async () => {
  const now = Date.now();
  await seed({
    last_seen: new Date(now).toISOString(),
    status: "online",
    vpn_status: "connected",
  });
  const events = [];
  const unsubscribe = heartbeatMonitor.onStatusChange((e) => events.push(e));
  assert.equal(
    onlineStatus(await deviceRepository.findByMac(mac), now + 15000),
    "online",
  );
  assert.equal(
    (await heartbeatMonitor.checkStaleDevices(now + 15000)).length,
    0,
  );
  assert.equal(
    (await heartbeatMonitor.checkStaleDevices(now + 15001)).length,
    1,
  );
  assert.equal(
    (await heartbeatMonitor.checkStaleDevices(now + 16000)).length,
    0,
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].mac, mac);
  assert.equal(events[0].new_status, "offline");
  assert.equal((await deviceRepository.findByMac(mac)).vpn_status, "connected");
  unsubscribe();
});
test("initial/reconnect online emitted once and listener can unsubscribe", async () => {
  await seed();
  const events = [];
  const unsubscribe = heartbeatMonitor.onStatusChange(async (e) =>
    events.push(e),
  );
  const now = Date.now();
  await heartbeatService.processHeartbeat(heartbeat(), "127.0.0.1", now);
  await heartbeatService.processHeartbeat(heartbeat(), "127.0.0.1", now + 5000);
  assert.equal(events.length, 1);
  assert.equal(events[0].new_status, "online");
  await heartbeatMonitor.checkStaleDevices(now + 21000);
  await heartbeatService.processHeartbeat(
    heartbeat(),
    "127.0.0.1",
    now + 22000,
  );
  assert.deepEqual(
    events.map((e) => e.new_status),
    ["online", "offline", "online"],
  );
  unsubscribe();
  await heartbeatMonitor.checkStaleDevices(now + 40000);
  assert.equal(events.length, 3);
});
test("monitor lifecycle is idempotent", () => {
  heartbeatMonitor.start();
  const timer = heartbeatMonitor.timer;
  heartbeatMonitor.start();
  assert.equal(heartbeatMonitor.timer, timer);
  heartbeatMonitor.stop();
  heartbeatMonitor.stop();
  assert.equal(heartbeatMonitor.isRunning, false);
});
