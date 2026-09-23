-- =============================================================================
-- SecureCam Component 2: Device Registry & Heartbeat Schema (PostgreSQL 17.X)
-- Spec Reference:
--   - ICD.md 7.1.2 devices
--   - FR/SV_F.md 3.2.2 (SV-F-010 ~ SV-F-014)
--   - NFR/NF_F.md NF-F-001 (PostgreSQL 17.X)
--   - NFR/NF_P.md NF-P-003 (30초 이내 상태 갱신)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. devices 테이블 (ICD 7.1.2 및 실시간 상태 필드 확장)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    device_id VARCHAR(50) PRIMARY KEY,
    user_id UUID,                                       -- FK to users (임시 미할당 시 NULL 가능)
    serial_no VARCHAR(100) NOT NULL UNIQUE,
    register_code VARCHAR(50) UNIQUE,                   -- SV-F-010 등록 코드 (code 방식)
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200) NOT NULL DEFAULT '미지정',
    description VARCHAR(200) DEFAULT '',
    group_id VARCHAR(50) DEFAULT NULL,
    model VARCHAR(100) DEFAULT 'RV-1106',
    firmware_version VARCHAR(50) DEFAULT 'v1.0.0',
    wg_pubkey VARCHAR(255),
    vpn_ip VARCHAR(20),
    provision_token VARCHAR(255),                       -- ICD 3.1, 3.2 Heartbeat 인증 토큰
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- 실시간 생존 및 모니터링 상태 (SV-F-011, SV-F-013, ICD 2.2.1, 2.2.3)
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline')),
    vpn_status VARCHAR(30) NOT NULL DEFAULT 'disconnected' CHECK (vpn_status IN ('connected', 'disconnected', 'error')),
    last_seen TIMESTAMP WITH TIME ZONE,
    last_handshake TIMESTAMP WITH TIME ZONE,
    latest_event_time TIMESTAMP WITH TIME ZONE,
    uptime_seconds INTEGER NOT NULL DEFAULT 0,
    storage_total_gb FLOAT NOT NULL DEFAULT 32.0,
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    storage_used_gb FLOAT NOT NULL DEFAULT 0.0,
    latency_ms INTEGER DEFAULT 0,
    thumbnail_url VARCHAR(500) DEFAULT '',
    
    -- 스트리밍 URL (ICD 2.2.3, 4.1)
    rtsp_url VARCHAR(255),
    rtsp_url_sub VARCHAR(255),

    -- VPN 연결 관리 필드 (SV-F-014, ICD 2.5.1)
    vpn_server VARCHAR(100) DEFAULT 'vpn.securecam.com:443',
    connected_duration_sec INTEGER NOT NULL DEFAULT 0,
    error_type VARCHAR(100) DEFAULT NULL,
    auto_connect BOOLEAN NOT NULL DEFAULT true,
    reconnect_on_start BOOLEAN NOT NULL DEFAULT true,
    reconnect_on_network_change BOOLEAN NOT NULL DEFAULT true,

    registered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_serial_no ON devices(serial_no);
CREATE INDEX IF NOT EXISTS idx_devices_register_code ON devices(register_code);
CREATE INDEX IF NOT EXISTS idx_devices_provision_token ON devices(provision_token);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

-- -----------------------------------------------------------------------------
-- 2. heartbeat_history 테이블 (Heartbeat 메트릭 로그 / 감사용)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS heartbeat_history (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    serial_no VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    rtsp_ok BOOLEAN NOT NULL,
    wg_ok BOOLEAN NOT NULL,
    storage_used_bytes BIGINT,
    latency_ms INTEGER,
    firmware_version VARCHAR(50),
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_heartbeat_device_time ON heartbeat_history(device_id, received_at DESC);

-- -----------------------------------------------------------------------------
-- 3. PTZ 명령 로그 테이블 (ICD 3.4 제어 이력)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ptz_command_logs (
    command_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    user_id UUID,
    action VARCHAR(20) NOT NULL CHECK (action IN ('up', 'down', 'left', 'right', 'home', 'zoom_in', 'zoom_out', 'stop')),
    speed INTEGER DEFAULT 5,
    zoom_scale FLOAT DEFAULT 1.0,
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ptz_device_time ON ptz_command_logs(device_id, executed_at DESC);
