import express from "express";
import { configureSecurityMiddleware } from "./middleware/securityMiddleware.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import routes from "./routes/index.js";
import { deviceRequestLogger, deviceRequestErrorLogger } from "./middleware/requestLogger.js";
export * from "./config/env.js";
export * from "./config/database.js";
export * from "./constants/errorCodes.js";
export * from "./errors/AppError.js";
export * from "./repositories/index.js";
export * from "./services/deviceService.js";
export * from "./services/heartbeatService.js";
export * from "./services/heartbeatMonitor.js";
export * from "./middleware/authMiddleware.js";
export * from "./middleware/errorHandler.js";
export * from "./middleware/requestLogger.js";
export function createDeviceHeartbeatApp({
  provisionBoard,
  authenticateClient,
} = {}) {
  const app = express();
  // Source identity always uses the TCP peer, never request forwarding headers.
  app.set("trust proxy", false);
  app.locals.provisionBoard = provisionBoard;
  app.locals.authenticateClient = authenticateClient;
  // Before JSON/security middleware so malformed bodies and OPTIONS are visible too.
  app.use(deviceRequestLogger);
  configureSecurityMiddleware(app);
  app.use(express.json({ limit: "64kb" }));
  app.get("/health", (req, res) =>
    res.json({
      status: "UP",
      service: "securecam-device-heartbeat-module",
      timestamp: new Date().toISOString(),
    }),
  );
  app.use("/v1", routes);
  app.use(notFoundHandler);
  app.use(deviceRequestErrorLogger);
  app.use(errorHandler);
  return app;
}
export default createDeviceHeartbeatApp;
