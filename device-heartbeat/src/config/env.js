import dotenv from "dotenv";
dotenv.config();
const positive = (key, fallback) => {
  const value = Number(process.env[key] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(key + " must be a positive integer");
  return value;
};
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET)
  throw new Error("JWT_SECRET is required");
export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: positive("PORT", 3001),
  DB_DRIVER: process.env.DB_DRIVER || "memory",
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_PORT: positive("DB_PORT", 5432),
  DB_USER: process.env.DB_USER || "postgres",
  DB_PASSWORD: process.env.DB_PASSWORD || "postgres",
  DB_NAME: process.env.DB_NAME || "securecam_db",
  DB_SSL: process.env.DB_SSL === "true",
  DB_SSL_CA_FILE: process.env.DB_SSL_CA_FILE || "",
  C2_ACCESS_LOG_ENABLED: process.env.C2_ACCESS_LOG_ENABLED === "true",
  JWT_SECRET:
    process.env.JWT_SECRET || "securecam-cloud-super-secret-jwt-key-2026-v1.0",
  HEARTBEAT_INTERVAL_SECONDS: 5,
  OFFLINE_TIMEOUT_SECONDS: 15,
  OFFLINE_CHECK_INTERVAL_SECONDS: positive("OFFLINE_CHECK_INTERVAL_SECONDS", 1),
  RTSP_PORT: positive("RTSP_PORT", 554),
  WEBRTC_BASE_URL: (process.env.WEBRTC_BASE_URL || "")
    .trim()
    .replace(/\/+$/, ""),
};
if (!["memory", "postgres"].includes(env.DB_DRIVER))
  throw new Error("Unsupported DB_DRIVER");
