import { mkdir, writeFile, chmod } from "node:fs/promises";
import { loadConfig, mediaMtxConfig } from "../src/config.js";

// JSON is a YAML subset, accepted by the pinned MediaMTX YAML loader.
await mkdir(new URL("../runtime/", import.meta.url), {
  recursive: true,
  mode: 0o700,
});
const target = new URL("../runtime/mediamtx.yml", import.meta.url);
await writeFile(
  target,
  JSON.stringify(mediaMtxConfig(loadConfig()), null, 2) + "\n",
  { mode: 0o600 },
);
await chmod(target, 0o600);
console.log(
  "[C7] Generated runtime/mediamtx.yml (contains secrets; do not commit).",
);
