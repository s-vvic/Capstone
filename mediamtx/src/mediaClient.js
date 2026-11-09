import { GatewayError } from './errors.js';
import { inBoardSubnet } from './config.js';

export class MediaClient {
  constructor(config, fetchImpl = fetch) { this.config = config; this.fetch = fetchImpl; this.locks = new Map(); }
  async request(base, path, options = {}, reader = false) {
    const password = reader ? this.config.readPassword : this.config.apiPassword;
    const user = reader ? 'c7-reader' : 'c7-api';
    try {
      return await this.fetch(`${base}${path}`, { ...options, headers: { ...options.headers, authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}` }, redirect: 'error', signal: AbortSignal.timeout(15000) });
    } catch { throw new GatewayError(503, 'MEDIA_UNAVAILABLE', 'MediaMTX is unavailable or timed out'); }
  }
  api(path, options) { return this.request(this.config.apiUrl, path, options); }
  async health() {
    const response = await this.api('/v3/config/global/get');
    if (!response.ok) throw new GatewayError(503, 'MEDIA_UNAVAILABLE', 'MediaMTX control API unavailable');
    await response.body?.cancel();
  }
  async ensure(device, quality) {
    const path = `devices/${device.mac}/${quality}`;
    const prior = this.locks.get(path) || Promise.resolve();
    const task = prior.catch(() => {}).then(async () => {
      if (!inBoardSubnet(device.vpn_ip, this.config.boardCidr)) throw new GatewayError(409, 'INVALID_BOARD_IP', 'Board VPN address is missing or outside the configured board subnet');
      const source = new URL(`rtsp://${device.vpn_ip}:${this.config.rtspPort}${this.config.rtspPaths[quality]}`);
      source.username = this.config.rtspUsername; source.password = this.config.rtspPassword;
      const key = encodeURIComponent(path);
      const current = await this.api(`/v3/config/paths/get/${key}`);
      if (current.ok) {
        const data = await current.json();
        if (data.source === source.toString() && data.rtspTransport === 'tcp') return path;
      } else if (current.status !== 404) {
        await current.body?.cancel();
        throw new GatewayError(503, 'MEDIA_UNAVAILABLE', 'Unable to read MediaMTX path');
      } else await current.body?.cancel();
      const response = await this.api(`/v3/config/paths/${current.ok ? 'patch' : 'add'}/${key}`, {
        method: current.ok ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: source.toString(), rtspTransport: 'tcp', sourceOnDemand: true, maxReaders: this.config.maxReaders, record: false }),
      });
      await response.body?.cancel();
      if (!response.ok) throw new GatewayError(503, 'MEDIA_UNAVAILABLE', 'Unable to configure MediaMTX path');
      return path;
    });
    this.locks.set(path, task);
    try { return await task; } finally { if (this.locks.get(path) === task) this.locks.delete(path); }
  }
  async status(mac, quality) {
    const response = await this.api(`/v3/paths/get/${encodeURIComponent(`devices/${mac}/${quality}`)}`);
    if (response.status === 404) { await response.body?.cancel(); return { ready: false, tracks: [], readers: 0 }; }
    if (!response.ok) { await response.body?.cancel(); throw new GatewayError(503, 'MEDIA_UNAVAILABLE', 'Unable to inspect stream'); }
    const data = await response.json();
    return { ready: (data.available ?? data.ready) === true, tracks: data.tracks || [], readers: data.readers?.length || 0 };
  }
  whep(path, options) { return this.request(this.config.whepUrl, path, options, true); }
  sessionPath(location, path) {
    const url = new URL(location, `${this.config.whepUrl}/${path}/whep`);
    if (url.origin !== this.config.whepUrl || url.search || url.hash || !url.pathname.startsWith(`/${path}/whep/`) || !/^[a-f0-9-]{36}$/i.test(url.pathname.split('/').at(-1)))
      throw new GatewayError(502, 'INVALID_MEDIA_RESPONSE', 'Invalid WHEP session location');
    return url.pathname;
  }
}
