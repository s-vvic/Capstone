import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";
import { createMediaRuntime } from "../src/runtime.js";

const logger = { info() {}, error() {} };
function fakeProcess() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.exitCode = null;
  child.kill = (signal) => {
    child.exitCode = 0;
    queueMicrotask(() => child.emit("exit", 0, signal));
  };
  return child;
}

test("disabled runtime never spawns a process", async () => {
  const runtime = createMediaRuntime({
    config: loadConfig({}),
    spawnImpl() {
      throw new Error("Unexpected spawn");
    },
    logger,
  });
  await runtime.start();
  assert.equal((await runtime.health()).status, "disabled");
  await runtime.stop();
});

test("managed child is validated, health checked, stopped, and reports unexpected exit", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "c7-runtime-"));
  const file = join(directory, "mediamtx.yml");
  t.after(async () => {
    await unlink(file);
    await rmdir(directory);
  });
  let media;
  let spawned = false;
  const runtime = createMediaRuntime({
    config: loadConfig({
      MEDIAMTX_ENABLED: "true",
      MEDIAMTX_CONFIG_PATH: file,
    }),
    logger,
    spawnImpl(binary, args) {
      const child = fakeProcess();
      if (args[0].startsWith("--validate-conf="))
        queueMicrotask(() => child.emit("exit", 0));
      else {
        media = child;
        spawned = true;
      }
      return child;
    },
    async fetchImpl() {
      if (!spawned) throw new Error("No listener yet");
      return Response.json({});
    },
  });
  await runtime.start();
  assert.equal(runtime.status, "running");
  assert.equal((await runtime.health()).status, "running");
  media.exitCode = 1;
  media.emit("exit", 1);
  assert.equal((await runtime.health()).status, "failed");
  await runtime.stop();
});

test("configuration errors fail startup before a media child is launched", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "c7-invalid-"));
  const file = join(directory, "config.yml");
  t.after(async () => {
    await unlink(file);
    await rmdir(directory);
  });
  let calls = 0;
  const runtime = createMediaRuntime({
    config: loadConfig({
      MEDIAMTX_ENABLED: "true",
      MEDIAMTX_CONFIG_PATH: file,
    }),
    logger,
    spawnImpl() {
      calls++;
      const child = fakeProcess();
      queueMicrotask(() => child.emit("exit", 1));
      return child;
    },
  });
  await assert.rejects(runtime.start(), /configuration rejected/);
  assert.equal(runtime.status, "failed");
  assert.equal(calls, 1);
});
