import { spawn } from "node:child_process";
import { mkdir, writeFile, rename, chmod } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { mediaMtxConfig } from "./config.js";

export async function writeConfiguration(config) {
  await mkdir(dirname(config.configPath), { recursive: true, mode: 0o700 });
  const temporary = `${config.configPath}.${randomUUID()}.tmp`;
  await writeFile(
    temporary,
    JSON.stringify(mediaMtxConfig(config), null, 2) + "\n",
    { mode: 0o600, flag: "wx" },
  );
  await rename(temporary, config.configPath);
  await chmod(config.configPath, 0o600);
  return config.configPath;
}

export function createMediaRuntime({
  config,
  spawnImpl = spawn,
  fetchImpl = fetch,
  logger = console,
}) {
  let child;
  let state = "disabled";
  let exited;
  let starting;
  let stopping = false;

  async function validate() {
    const process = spawnImpl(
      config.binary,
      [`--validate-conf=${config.configPath}`],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );
    let output = "";
    process.stdout?.on("data", (chunk) => {
      output = (output + chunk).slice(-8000);
    });
    process.stderr?.on("data", (chunk) => {
      output = (output + chunk).slice(-8000);
    });
    await new Promise((resolve, reject) => {
      process.once("error", reject);
      process.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(
              new Error(`MediaMTX configuration rejected: ${output.trim()}`),
            ),
      );
    });
  }

  async function start() {
    if (!config.enabled) return;
    if (starting) return starting;
    if (state === "running") return;
    stopping = false;
    starting = (async () => {
      state = "starting";
      try {
        await writeConfiguration(config);
        await validate();
        // Do not claim a separately running instance as this controller's child.
        try {
          const occupied = await fetchImpl(
            `${config.apiUrl}/v3/config/global/get`,
            { redirect: "error", signal: AbortSignal.timeout(500) },
          );
          await occupied.body?.cancel();
          throw new Error(
            "MediaMTX API is already occupied; stop the independent instance first",
          );
        } catch (error) {
          if (error.message.includes("already occupied")) throw error;
        }
        child = spawnImpl(config.binary, [config.configPath], {
          stdio: "inherit",
          windowsHide: true,
        });
        exited = new Promise((resolve) => {
          child.once("error", (error) => {
            state = "failed";
            logger.error(
              `[C7] Cannot execute MediaMTX: ${error.code || error.message}`,
            );
            resolve();
          });
          child.once("exit", (code, signal) => {
            state = stopping ? "stopped" : "failed";
            if (!stopping)
              logger.error(
                `[C7] MediaMTX exited (${code ?? signal}); restart controller to recover`,
              );
            resolve();
          });
        });
        for (let attempt = 0; attempt < 50; attempt++) {
          if (state === "failed")
            throw new Error("MediaMTX exited during startup");
          try {
            const response = await fetchImpl(
              `${config.apiUrl}/v3/config/global/get`,
              { redirect: "error", signal: AbortSignal.timeout(500) },
            );
            const ready = response.ok;
            await response.body?.cancel();
            if (ready && state !== "failed") {
              state = "running";
              logger.info(`[C7] MediaMTX running: ${config.webRtcBase}`);
              return;
            }
          } catch {}
          await delay(100);
        }
        throw new Error("MediaMTX startup timed out");
      } catch (error) {
        await stop();
        state = "failed";
        throw error;
      }
    })();
    try {
      await starting;
    } finally {
      starting = undefined;
    }
  }

  async function stop() {
    stopping = true;
    if (
      child &&
      child.exitCode === null &&
      !["failed", "stopped"].includes(state)
    ) {
      child.kill("SIGTERM");
      let timeout;
      const done = await Promise.race([
        exited.then(() => true),
        new Promise((resolve) => {
          timeout = setTimeout(() => resolve(false), 3000);
        }),
      ]);
      clearTimeout(timeout);
      if (!done) {
        child.kill("SIGKILL");
        await exited;
      }
    }
    state = config.enabled ? "stopped" : "disabled";
  }

  async function health() {
    if (state !== "running") return { status: state };
    try {
      const response = await fetchImpl(
        `${config.apiUrl}/v3/config/global/get`,
        { redirect: "error", signal: AbortSignal.timeout(1000) },
      );
      const ok = response.ok;
      await response.body?.cancel();
      return { status: ok ? "running" : "unhealthy" };
    } catch {
      return { status: "unhealthy" };
    }
  }
  return {
    start,
    stop,
    health,
    get status() {
      return state;
    },
  };
}
