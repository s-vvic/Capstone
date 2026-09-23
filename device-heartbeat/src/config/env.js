import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  API_BASE_URL: process.env.API_BASE_URL || 'https://api.securecam.com/v1',

  // Database (PostgreSQL 17.X - NF-F-001)
  DB_DRIVER: process.env.DB_DRIVER || 'memory', // 'postgres' | 'memory'
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  DB_NAME: process.env.DB_NAME || 'securecam_db',
  DB_SSL: process.env.DB_SSL === 'true',

  // Authentication (NF-S-003)
  JWT_SECRET: process.env.JWT_SECRET || 'securecam-cloud-super-secret-jwt-key-2026-v1.0',

  // Heartbeat & Offline Detection (SV-F-011, SV-F-013, NF-P-003)
  HEARTBEAT_INTERVAL_SECONDS: parseInt(process.env.HEARTBEAT_INTERVAL_SECONDS || '30', 10),
  OFFLINE_TIMEOUT_SECONDS: parseInt(process.env.OFFLINE_TIMEOUT_SECONDS || '60', 10),
  OFFLINE_CHECK_INTERVAL_SECONDS: parseInt(process.env.OFFLINE_CHECK_INTERVAL_SECONDS || '10', 10),

  // WireGuard VPN Configuration (ICD 3.1.1, 5.1, NF-S-001)
  WG_SERVER_PUBKEY: process.env.WG_SERVER_PUBKEY || 'BM8aXkG2HwW9QZ3y4j6kLmN1PqRsTuVwXyZ01234567=',
  WG_SERVER_ENDPOINT: process.env.WG_SERVER_ENDPOINT || 'vpn.securecam.com:443',
  WG_SERVER_VPN_IP: process.env.WG_SERVER_VPN_IP || '10.0.0.1',
  WG_SUBNET: process.env.WG_SUBNET || '10.0.0.0/24',
  WG_IP_POOL_START: process.env.WG_IP_POOL_START || '10.0.0.10',
  WG_IP_POOL_END: process.env.WG_IP_POOL_END || '10.0.0.250',

  // Media Streaming Proxy Configuration (ICD 3.1.1, 4.1, 4.2)
  MEDIAMTX_RTSP_PROXY_IP: process.env.MEDIAMTX_RTSP_PROXY_IP || '10.0.0.1',
  RTSP_PORT: parseInt(process.env.RTSP_PORT || '8554', 10),
};
