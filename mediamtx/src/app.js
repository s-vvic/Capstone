import express from 'express';
import { randomUUID } from 'node:crypto';
import { GatewayError } from './errors.js';

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

export function createApp({ config, authenticate, devices, media, now = Date.now, logger = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  const sessions = new Map();
  let pending = 0;
  let closing = false;
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set({ 'X-Request-Id': req.requestId, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    const origin = req.get('origin');
    if (origin && !config.origins.includes(origin)) return next(new GatewayError(403, 'ORIGIN_DENIED', 'Origin is not allowed'));
    if (origin) {
      res.set({ 'Access-Control-Allow-Origin': origin, Vary: 'Origin',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Expose-Headers': 'Location, ETag, Accept-Patch, X-Request-Id' });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.get('/health', asyncRoute(async (req, res) => {
    const checks = await Promise.allSettled([devices.health(), media.health()]);
    const healthy = !closing && checks.every(check => check.status === 'fulfilled');
    res.status(healthy ? 200 : 503).json({ component: 'C7', status: healthy ? 'healthy' : 'unhealthy',
      dependencies: { database: checks[0].status === 'fulfilled', mediamtx: checks[1].status === 'fulfilled' },
      active_sessions: sessions.size });
  }));
  app.use('/v1/streams', (req, res, next) => {
    if (closing) return next(new GatewayError(503, 'SHUTTING_DOWN', 'Gateway is shutting down'));
    Promise.resolve(authenticate(req.get('authorization'))).then(user => { req.user = user; next(); }, next);
  });
  app.param('mac', (req, res, next, mac) => {
    if (!/^[A-F0-9]{12}$/.test(mac)) return next(new GatewayError(400, 'INVALID_MAC', 'MAC must be 12 uppercase hexadecimal characters'));
    req.mac = mac;
    devices.findOwned(mac, req.user.userId).then(device => {
      if (!device) throw new GatewayError(404, 'DEVICE_NOT_FOUND', 'Device not found');
      req.device = device; next();
    }).catch(next);
  });
  app.param('quality', (req, res, next, quality) => {
    if (!['high', 'low'].includes(quality)) return next(new GatewayError(400, 'INVALID_QUALITY', 'Quality must be high or low'));
    next();
  });
  app.get('/v1/streams/:mac', (req, res) => {
    const mac = req.mac;
    res.json({ device_id: req.device.device_id, mac, transport: 'webrtc',
      streams: ['high', 'low'].map(quality => ({ quality,
        whep_url: `${config.publicBase}/v1/streams/${mac}/${quality}/whep`,
        status_url: `${config.publicBase}/v1/streams/${mac}/${quality}/status`,
      })) });
  });
  app.get('/v1/streams/:mac/:quality/status', asyncRoute(async (req, res) => {
    res.json({ mac: req.mac, quality: req.params.quality, ...await media.status(req.mac, req.params.quality) });
  }));
  const sdp = express.text({ type: ['application/sdp', 'application/trickle-ice-sdpfrag'], limit: '64kb' });
  app.post('/v1/streams/:mac/:quality/whep', sdp, asyncRoute(async (req, res) => {
    if (!req.is('application/sdp') || typeof req.body !== 'string' || !req.body.startsWith('v=0'))
      throw new GatewayError(415, 'INVALID_SDP', 'An application/sdp offer is required');
    if (sessions.size + pending >= config.maxSessions) throw new GatewayError(429, 'SESSION_LIMIT', 'Gateway session capacity reached');
    pending++;
    let upstreamPath;
    try {
      const path = await media.ensure(req.device, req.params.quality);
      const response = await media.whep(`/${path}/whep`, { method: 'POST', headers: { 'content-type': 'application/sdp' }, body: req.body });
      if (response.status !== 201) {
        await response.body?.cancel();
        throw new GatewayError(response.status === 400 ? 400 : 503, response.status === 400 ? 'SDP_REJECTED' : 'STREAM_UNAVAILABLE', 'Media negotiation failed; check board source and codec compatibility');
      }
      upstreamPath = media.sessionPath(response.headers.get('location'), path);
      const answer = await response.text();
      if (!answer.startsWith('v=0')) throw new GatewayError(502, 'INVALID_MEDIA_RESPONSE', 'Invalid SDP answer');
      if (closing || req.aborted || res.destroyed) throw new GatewayError(503, 'CLIENT_DISCONNECTED', 'Viewer disconnected');
      const id = randomUUID();
      const session = { id, userId: req.user.userId, mac: req.mac, quality: req.params.quality,
        authorization: req.get('authorization'), checkedAt: now(),
        path: upstreamPath, expires: now() + config.sessionTtlMs };
      sessions.set(id, session);
      res.once('close', () => { if (!res.writableFinished) void terminate(id); });
      res.set({ Location: `${config.publicBase}/v1/streams/${req.mac}/${req.params.quality}/whep/${id}`,
        'Content-Type': 'application/sdp', 'Accept-Patch': 'application/trickle-ice-sdpfrag' });
      if (response.headers.has('etag')) res.set('ETag', response.headers.get('etag'));
      res.status(201).send(answer);
      upstreamPath = undefined;
    } finally {
      pending--;
      if (upstreamPath) {
        try { const result = await media.whep(upstreamPath, { method: 'DELETE' }); await result.body?.cancel(); } catch { /* MediaMTX also expires disconnected ICE peers. */ }
      }
    }
  }));
  async function terminate(id) {
    const session = sessions.get(id);
    if (!session) return;
    try {
      const response = await media.whep(session.path, { method: 'DELETE' });
      await response.body?.cancel();
      if (!response.ok && response.status !== 404) throw new Error('Session deletion failed');
      sessions.delete(id);
    } catch {
      session.expires = 0; // Retry at the next sweep; never silently abandon an active session.
      logger.error(JSON.stringify({ level: 'error', component: 'C7', error_code: 'SESSION_CLEANUP_FAILED', session_id: id }));
    }
  }
  app.all('/v1/streams/:mac/:quality/whep/:sessionId', sdp, asyncRoute(async (req, res) => {
    if (!['PATCH', 'DELETE'].includes(req.method)) throw new GatewayError(405, 'METHOD_NOT_ALLOWED', 'Use PATCH or DELETE');
    const session = sessions.get(req.params.sessionId);
    if (!session || session.userId !== req.user.userId || session.mac !== req.mac || session.quality !== req.params.quality || session.expires <= now())
      throw new GatewayError(404, 'SESSION_NOT_FOUND', 'Session not found');
    if (req.method === 'PATCH' && (!req.is('application/trickle-ice-sdpfrag') || typeof req.body !== 'string'))
      throw new GatewayError(415, 'INVALID_SDP', 'An application/trickle-ice-sdpfrag body is required');
    const response = await media.whep(session.path, { method: req.method,
      headers: req.method === 'PATCH' ? { 'content-type': 'application/trickle-ice-sdpfrag', 'if-match': req.get('if-match') || '*' } : {},
      ...(req.method === 'PATCH' ? { body: req.body } : {}) });
    await response.body?.cancel();
    if (response.status === 404) { sessions.delete(session.id); throw new GatewayError(404, 'SESSION_NOT_FOUND', 'Upstream session no longer exists'); }
    if (!response.ok) throw new GatewayError([400, 412].includes(response.status) ? response.status : 502, 'MEDIA_SESSION_ERROR', 'Media session operation failed');
    if (req.method === 'DELETE') sessions.delete(session.id);
    if (response.headers.has('etag')) res.set('ETag', response.headers.get('etag'));
    res.sendStatus(204);
  }));
  app.use((req, res, next) => next(new GatewayError(404, 'NOT_FOUND', 'Endpoint not found')));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.too.large' ? 413 : error.status || 500;
    const code = error.type === 'entity.too.large' ? 'BODY_TOO_LARGE' : error.code || 'INTERNAL_SERVER_ERROR';
    if (status >= 500) logger.error(JSON.stringify({ level: 'error', component: 'C7', request_id: req.requestId, method: req.method, path: req.path, status, error_code: code }));
    res.status(status).json({ error_code: code, message: status === 500 ? 'Internal server error' : error.message });
  });
  let sweeping = false;
  const sweep = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      await Promise.all([...sessions].map(async ([id, session]) => {
        if (session.expires <= now()) return terminate(id);
        if (now() - session.checkedAt < 30000) return;
        session.checkedAt = now();
        try {
          const user = await authenticate(session.authorization);
          const device = await devices.findOwned(session.mac, user.userId);
          if (user.userId !== session.userId || !device) await terminate(id);
        } catch (error) {
          if ([401, 403].includes(error.status)) await terminate(id);
          else logger.error(JSON.stringify({ level: 'error', component: 'C7', error_code: 'SESSION_RECHECK_FAILED', session_id: id }));
        }
      }));
    } finally { sweeping = false; }
  };
  const timer = setInterval(() => { void sweep(); }, 10000);
  timer.unref();
  return { app, sweep, async close() { closing = true; clearInterval(timer); await Promise.all([...sessions.keys()].map(terminate)); } };
}
