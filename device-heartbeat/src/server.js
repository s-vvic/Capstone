import { createDeviceHeartbeatApp } from "./index.js";
import { env } from "./config/env.js";
import { testDbConnection, closePool } from "./config/database.js";
import { heartbeatMonitor } from "./services/heartbeatMonitor.js";
async function startServer() {
  const db = await testDbConnection();
  if (!db.ok) throw new Error("Database unavailable: " + db.error);
  const app = createDeviceHeartbeatApp();
  const server = app.listen(env.PORT, () => {
    heartbeatMonitor.start();
    console.log(
      "C2 listening on /v1, port " + env.PORT + "; heartbeat 5s / offline >15s",
    );
  });
  server.on("error", async (error) => {
    heartbeatMonitor.stop();
    await closePool();
    console.error(error);
    process.exitCode = 1;
  });
  for (const signal of ["SIGTERM", "SIGINT"])
    process.once(signal, () => {
      heartbeatMonitor.stop();
      server.close(async () => {
        await closePool();
      });
    });
}
startServer().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exitCode = 1;
});
