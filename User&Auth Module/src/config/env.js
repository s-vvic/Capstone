import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  API_BASE_URL: process.env.API_BASE_URL || 'https://api.securecam.com/v1',

  // Database (PostgreSQL 17.X)
  DB_DRIVER: process.env.DB_DRIVER || 'memory', // 'postgres' | 'memory'
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  DB_NAME: process.env.DB_NAME || 'securecam_db',
  DB_SSL: process.env.DB_SSL === 'true',

  // JWT (NF-S-003, ICD 1.3: 1 year = 525,600 minutes)
  JWT_SECRET: process.env.JWT_SECRET || 'securecam-cloud-super-secret-jwt-key-2026-v1.0',
  JWT_ALGORITHM: process.env.JWT_ALGORITHM || 'HS256',
  JWT_EXPIRES_IN_MINUTES: 525600, // 1 year (ICD 1.3)
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '365d',
  JWT_NORMAL_EXPIRES_IN: process.env.JWT_NORMAL_EXPIRES_IN || '1d',

  // Password Hash (NF-S-002: bcrypt salt rounds >= 10)
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),

  // Rate Limiting & Anomaly Detection (ICD 2.1.1, NF-S-005)
  LOGIN_MAX_FAILED_ATTEMPTS: parseInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS || '5', 10),
  LOGIN_LOCKOUT_WINDOW_MINUTES: parseInt(process.env.LOGIN_LOCKOUT_WINDOW_MINUTES || '15', 10),
};
