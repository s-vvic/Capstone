import { createControllerApp } from "./app.js";
import { env } from "./config/env.js";
import { env as deviceEnv } from "../../device-heartbeat/src/config/env.js";
import { warnMissingWebRtcBase } from "../../device-heartbeat/src/utils/webrtcUrls.js";
import { loadConfig } from "../../mediamtx/src/config.js";
import { createMediaRuntime } from "../../mediamtx/src/runtime.js";
import { closePool as closeAuthPool } from "../../user-auth/src/config/database.js";
import { closePool as closeDevicePool } from "../../device-heartbeat/src/config/database.js";
import { closeDatabasePool as closeEventPool } from "../../event-notification/src/config/database.js";
import { closeDatabasePool as closeVpnPool } from "../../vpn/src/config/database.js";

export async function startController({
  mediaRuntime = createMediaRuntime({ config: loadConfig() }),
  port = env.PORT,
  logger = console,
} = {}) {
  warnMissingWebRtcBase(deviceEnv.WEBRTC_BASE_URL, logger);
  let server;
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    if (server) {
      const finished = new Promise((resolve) => server.close(resolve));
      const timeout = setTimeout(() => server.closeAllConnections(), 5000);
      timeout.unref();
      await finished;
      clearTimeout(timeout);
    }
    await mediaRuntime.stop();
    await Promise.allSettled([
      closeAuthPool(),
      closeDevicePool(),
      closeEventPool(),
      closeVpnPool(),
      ...(env.DB_DRIVER === "postgres"
        ? [
            import("../../storage-retention/src/config/database.js").then(
              ({ pool }) => pool.end(),
            ),
          ]
        : []),
    ]);
  }
  try {
    await mediaRuntime.start();
    const app = createControllerApp({ mediaRuntime });
    server = app.listen(port);
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    logger.info(
      `[controller] Listening on ${server.address().port}; C1/C2/C3/C4/C5 + C7=${mediaRuntime.status}`,
    );
    return { app, server, mediaRuntime, close };
  } catch (error) {
    await close();
    throw error;
  }
}
