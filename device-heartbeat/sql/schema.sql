-- PostgreSQL 17.X. Apply C1 users schema first. Fresh schema only.
-- Telemetry columns below extend ICD 7.1.2; they are current state, not history.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='devices' AND column_name='device_id') THEN
    RAISE EXCEPTION 'Legacy devices detected. Use migrate-v1-to-v2.sql after backup.';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS devices (
  mac CHAR(12) PRIMARY KEY CHECK (mac ~ '^[0-9A-F]{12}$'),
  user_id UUID REFERENCES users(user_id),
  name VARCHAR(100) NOT NULL,
  location VARCHAR(200) NOT NULL,
  model VARCHAR(100),
  firmware_version VARCHAR(50),
  wg_pubkey VARCHAR(255),
  vpn_ip VARCHAR(20) UNIQUE,
  config_version INTEGER NOT NULL DEFAULT 0 CHECK (config_version >= 0),
  applied_config_version INTEGER NOT NULL DEFAULT 0 CHECK (applied_config_version >= 0),
  last_seen TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  registered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Current telemetry / client display extensions. C4 owns actual VPN state.
  description VARCHAR(200) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline')),
  vpn_status VARCHAR(30) NOT NULL DEFAULT 'disconnected' CHECK (vpn_status IN ('connected','disconnected','error')),
  rtsp_ok BOOLEAN,
  wg_ok BOOLEAN,
  storage_used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (storage_used_bytes >= 0),
  latency_ms INTEGER CHECK (latency_ms >= 0),
  last_handshake TIMESTAMPTZ,
  uptime_seconds BIGINT,
  storage_total_gb DOUBLE PRECISION,
  latest_event_time TIMESTAMPTZ,
  thumbnail_url VARCHAR(500)
);
CREATE INDEX IF NOT EXISTS c2_devices_user_idx ON devices(user_id);
CREATE INDEX IF NOT EXISTS c2_devices_online_idx ON devices(last_seen) WHERE is_active AND status='online';
