import dotenv from "dotenv";
import { apiBaseUrl } from "../../../shared/config.mjs";

dotenv.config();

// 하위 컴포넌트(storage-retention 등)의 process.env 직접 참조를 위한 기본값 주입
process.env.DB_DRIVER = process.env.DB_DRIVER || "memory";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "securecam-cloud-super-secret-jwt-key-2026-v1.0";
process.env.STORAGE_ROOT = process.env.STORAGE_ROOT || "./storage-data";

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3000", 10),
  API_BASE_URL: apiBaseUrl(process.env, 3000),

  // Authentication & Security (NF-S-003)
  JWT_SECRET: process.env.JWT_SECRET,

  // Database (PostgreSQL 17.X / In-Memory Dual Driver)
  DB_DRIVER: process.env.DB_DRIVER,
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_PORT: parseInt(process.env.DB_PORT || "5432", 10),
  DB_USER: process.env.DB_USER || "postgres",
  DB_PASSWORD: process.env.DB_PASSWORD || "postgres",
  DB_NAME: process.env.DB_NAME || "securecam_db",
  DB_SSL: process.env.DB_SSL === "true",

  // Storage Root (Component 5)
  STORAGE_ROOT: process.env.STORAGE_ROOT,
  CLIENT_VPN_SUBNET: process.env.CLIENT_VPN_SUBNET || "10.0.2.0/24",
};
