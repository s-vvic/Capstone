/**
 * WireGuard VPN 규격 및 상수 (ICD-06 5.1, 5.2, 5.3)
 */
export const VPN_CONFIG = {
  PROTOCOL: 'WireGuard',
  TRANSPORT: 'UDP',
  DEFAULT_PORT: 443,
  DEFAULT_SERVER_ENDPOINT: 'vpn.securecam.com:443',
  SERVER_IP: '10.0.0.1',
  SUBNET: '10.0.0.0/24',
  SUBNET_MASK: '255.255.255.0',
  SUBNET_CIDR: 24,
  MTU: 1420,
  KEEPALIVE_INTERVAL_SEC: 25,
  ENCRYPTION_ALGORITHM: 'ChaCha20Poly1305',

  // IP Pool: 10.0.0.10 ~ 10.0.0.250 (ICD-06 5.1)
  POOL_START_IP: '10.0.0.10',
  POOL_END_IP: '10.0.0.250',
  POOL_START_NUM: 10,
  POOL_END_NUM: 250,
  TOTAL_POOL_CAPACITY: 241, // 250 - 10 + 1

  // 자동 재연결 허용 한계 시간 (NF-A-002, NF-A-003: 60초 이내)
  RECONNECT_TIMEOUT_SEC: 60,
  // 핸드셰이크 만료 기준 시간 (120초 동안 핸드셰이크 없으면 타임아웃 판정)
  HANDSHAKE_STALE_SEC: 120,
};

/**
 * VPN 연결 상태 코드 (ICD-06 5.3)
 */
export const VPN_STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
};

/**
 * VPN 오류 상세 유형 (ICD-06 5.3)
 */
export const VPN_ERROR_TYPE = {
  HANDSHAKE_TIMEOUT: 'error_handshake_timeout',
  AUTH_FAILED: 'error_auth_failed',
  NO_ROUTE: 'error_no_route',
  RECONNECT_FAILED: 'error_reconnect_failed',
};

/**
 * 피어 구분 (보드 or 모바일/웹 폰)
 */
export const PEER_TYPE = {
  DEVICE: 'device',
  PHONE: 'phone',
};

/**
 * 수동 제어 액션
 */
export const VPN_ACTION = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
};
