import express from "express";
import { configureSecurityMiddleware } from "./middleware/securityMiddleware.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import routes from "./routes/index.js";
import { env } from "./config/env.js";
import {
  deviceRequestLogger,
  deviceRequestErrorLogger,
} from "../../device-heartbeat/src/middleware/requestLogger.js";
import { createVpnStatusHandler } from "./routes/vpnStatus.js";

export function createControllerApp({ mediaRuntime } = {}) {
  const app = express();
  app.set("trust proxy", false);

  // Log C2 access before parsing; router-only logging would miss malformed JSON.
  app.use(["/v1/devices", "/devices"], deviceRequestLogger);

  // JSON 및 URL-encoded 파서 (Base64 스냅샷 등 미디어 전송 고려 15MB 한도)
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ extended: true, limit: "15mb" }));

  // 보안 미들웨어 설정 (Helmet, CORS)
  configureSecurityMiddleware(app);

  // 통합 헬스체크 엔드포인트 (NF-A-001)
  app.get("/health", async (req, res) => {
    const media = mediaRuntime
      ? await mediaRuntime.health()
      : { status: "disabled" };
    const mediaOk = ["running", "disabled"].includes(media.status);
    res.status(mediaOk ? 200 : 503).json({
      status: mediaOk ? "UP" : "DEGRADED",
      timestamp: new Date().toISOString(),
      service: "securecam-master-controller",
      components: {
        component_1_user_auth: "UP",
        component_2_device_heartbeat: "UP",
        component_3_event_notification: "UP",
        component_4_wireguard_vpn: "UP",
        component_5_storage_retention: "UP",
        component_7_mediamtx: media.status,
      },
      environment: {
        node_env: env.NODE_ENV,
        db_driver: env.DB_DRIVER,
      },
    });
  });

  // I2: no JWT check; only the socket address is trusted, never forwarded headers.
  app.get("/v1/status", createVpnStatusHandler(env.CLIENT_VPN_SUBNET));

  // ICD-01 베이스 URL 규격 지원: /v1 및 루트 / 모두 지원
  app.use("/v1", routes);
  app.use("/", routes);

  // 404 및 ICD 8.0 표준 오류 핸들러
  app.use(notFoundHandler);
  app.use(deviceRequestErrorLogger);
  app.use(errorHandler);

  return app;
}

export default createControllerApp;
