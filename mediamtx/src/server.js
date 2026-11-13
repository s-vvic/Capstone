import { loadConfig } from "./config.js";
import { createMediaRuntime } from "./runtime.js";

const runtime = createMediaRuntime({ config: loadConfig() });
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await runtime.stop();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
runtime.start().catch((error) => {
  console.error(`[C7] ${error.message}`);
  process.exitCode = 1;
});
