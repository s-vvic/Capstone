import { startController } from "./lifecycle.js";

let runtime;
let requestedStop = false;
async function stop() {
  requestedStop = true;
  if (runtime) await runtime.close();
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
startController()
  .then(async (controller) => {
    runtime = controller;
    if (requestedStop) await runtime.close();
  })
  .catch((error) => {
    console.error(`[controller] Startup failed: ${error.message}`);
    process.exitCode = 1;
  });
