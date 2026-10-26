import dotenv from 'dotenv';
import { VPN_CONFIG } from '../constants/vpnConstants.js';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'securecam-cloud-super-secret-jwt-key-2026-v1.0',

  // Database
  dbDriver: (process.env.DB_DRIVER || 'memory').toLowerCase(),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://securecam:securecam_dev_2026@localhost:5432/securecam_db',

  // WireGuard Driver: 'virtual' or 'linux'
  wgDriver: (process.env.WG_DRIVER || 'virtual').toLowerCase(),
  wgInterface: process.env.WG_INTERFACE || 'wg0',
  wgPort: parseInt(process.env.WG_PORT || String(VPN_CONFIG.DEFAULT_PORT), 10),
  wgServerEndpoint: process.env.WG_SERVER_ENDPOINT || VPN_CONFIG.DEFAULT_SERVER_ENDPOINT,
  wgServerIp: process.env.WG_SERVER_IP || VPN_CONFIG.SERVER_IP,
  wgSubnet: process.env.WG_SUBNET || VPN_CONFIG.SUBNET,
  wgMtu: parseInt(process.env.WG_MTU || String(VPN_CONFIG.MTU), 10),
  wgKeepalive: parseInt(process.env.WG_KEEPALIVE || String(VPN_CONFIG.KEEPALIVE_INTERVAL_SEC), 10),
  wgConfigPath: process.env.WG_CONFIG_PATH || '/etc/wireguard/wg0.conf',

  // Server Keys (기본 더미 키 페어)
  wgServerPublicKey: process.env.WG_SERVER_PUBLIC_KEY || 'mQZq8v6eX2o9A1t8y4U5i6o7P8q9R0s1T2u3V4w5X6Y=',
  wgServerPrivateKey: process.env.WG_SERVER_PRIVATE_KEY || '4A7b8C9d0E1f2G3h4I5j6K7l8M9n0O1p2Q3r4S5t6U8=',

  // IP Pool
  ipPoolStart: process.env.IP_POOL_START || VPN_CONFIG.POOL_START_IP,
  ipPoolEnd: process.env.IP_POOL_END || VPN_CONFIG.POOL_END_IP,
};
