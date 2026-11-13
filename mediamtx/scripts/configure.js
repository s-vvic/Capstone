import { loadConfig } from "../src/config.js";
import { writeConfiguration } from "../src/runtime.js";

const file = await writeConfiguration(loadConfig());
console.log(`[C7] Generated I2 configuration: ${file}`);
