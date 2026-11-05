import { randomUUID } from "node:crypto";
import { logger } from "../utils/logger.js";

// Shared by the standalone app, exported router and controller. Log each request once.
const contextKey = Symbol("deviceHeartbeatRequestLog");

export function deviceRequestLogger(req, res, next) {
  if (req[contextKey]) return next();
  const context = {
    request_id: randomUUID(),
    method: req.method,
    path: (req.originalUrl || req.url || "").split("?")[0],
    remote_ip: (req.socket.remoteAddress || "").replace(/^::ffff:/, ""),
  };
  req[contextKey] = { context, errorLogged: false };
  if (!res.headersSent) res.setHeader("X-Request-Id", context.request_id);
  const started = process.hrtime.bigint();
  logger.info("[C2][REQUEST] Incoming request", context);

  let finished = false;
  res.once("finish", () => {
    finished = true;
    logger.info("[C2][RESPONSE] Request completed", {
      ...context,
      status: res.statusCode,
      duration_ms: Number((Number(process.hrtime.bigint() - started) / 1e6).toFixed(2)),
    });
  });
  res.once("close", () => {
    if (!finished) logger.warn("[C2][ABORTED] Connection closed before response completed", context);
  });
  next();
}

// Observe errors without changing the owning application's response contract.
export function deviceRequestErrorLogger(error, req, res, next) {
  const entry = req[contextKey];
  if (entry && !entry.errorLogged) {
    entry.errorLogged = true;
    const status = error.type === "entity.parse.failed" || error.type === "entity.too.large"
      ? 400
      : error.code === "23505" ? 409 : error.httpStatus || error.statusCode || error.status || 500;
    const metadata = { ...entry.context, status, error_code: error.code || error.type || "INTERNAL_SERVER_ERROR" };
    if (status >= 500) logger.error("[C2][ERROR] Request failed", error, metadata);
    else logger.warn("[C2][REJECTED] Request rejected", {
      ...metadata,
      // JSON parser messages may contain a fragment of the original request body.
      message: error.type === "entity.parse.failed" ? "Invalid JSON" : error.message,
    });
  }
  next(error);
}
