import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { createAuthenticator, createDeviceStore } from './adapters.js';
import { MediaClient } from './mediaClient.js';

const config = loadConfig();
const devices = createDeviceStore();
const gateway = createApp({ config, devices, authenticate: createAuthenticator(config), media: new MediaClient(config) });
const server = gateway.app.listen(config.port, config.host, () => console.log(`[C7] Listening on ${config.host}:${config.port}`));
server.requestTimeout = 20000;
server.headersTimeout = 10000;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 20000); deadline.unref();
  const stopped = new Promise(resolve => server.close(resolve));
  await stopped;
  await gateway.close();
  await devices.close();
  clearTimeout(deadline);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
server.on('error', async error => { console.error(`[C7] ${error.code || 'LISTEN_ERROR'}`); await gateway.close(); await devices.close(); process.exitCode = 1; });
