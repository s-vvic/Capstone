import dotenv from 'dotenv';
import { apiBaseUrl } from '../../../shared/config.mjs';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3002', 10),
  API_BASE_URL: apiBaseUrl(process.env, 3002),

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

  // FCM Configuration (ICD-07, NF-P-002: 5초 이내)
  FCM_SERVER_KEY: process.env.FCM_SERVER_KEY || 'mock-fcm-server-key-2026',
  FCM_PROJECT_ID: process.env.FCM_PROJECT_ID || 'securecam-fcm-project',
  FCM_MOCK_DELAY_MS: parseInt(process.env.FCM_MOCK_DELAY_MS || '50', 10),

  // Snapshot Storage Configuration
  SNAPSHOT_UPLOAD_DIR: process.env.SNAPSHOT_UPLOAD_DIR || './uploads/snapshots',
  SNAPSHOT_BASE_URL: process.env.SNAPSHOT_BASE_URL || `${apiBaseUrl(process.env, 3002)}/snapshots`,
};
