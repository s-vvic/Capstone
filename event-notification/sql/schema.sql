-- SecureCam Component 3: Event Ingestion & Push Notification Engine
-- Database Schema for PostgreSQL 17.X (ICD_v2 7.1.3, DB-F-003, NF-F-001)

-- 1. 이벤트 유형 및 상태 ENUM 타입 (필요 시)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type_enum') THEN
    CREATE TYPE event_type_enum AS ENUM ('motion', 'sound', 'connection', 'system');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status_enum') THEN
    CREATE TYPE event_status_enum AS ENUM ('unconfirmed', 'confirmed');
  END IF;
END $$;

-- 2. 이벤트 테이블 (ICD_v2 7.1.3)
CREATE TABLE IF NOT EXISTS events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('motion', 'sound', 'connection', 'system')),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'unconfirmed' CHECK (status IN ('unconfirmed', 'confirmed')),
    is_important BOOLEAN NOT NULL DEFAULT false,
    zone_id VARCHAR(50),
    sound_level_db INTEGER,
    snapshot_url VARCHAR(500),
    clip_url VARCHAR(500),
    memo VARCHAR(500),
    detail TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_device_id ON events(device_id);
CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_status ON events(event_type, status);
CREATE INDEX IF NOT EXISTS idx_events_is_important ON events(is_important);

-- 3. 사용자 알림 설정 테이블 (ICD_v2 2.7)
CREATE TABLE IF NOT EXISTS notification_settings (
    user_id UUID PRIMARY KEY,
    motion_alert BOOLEAN NOT NULL DEFAULT true,
    sound_alert BOOLEAN NOT NULL DEFAULT true,
    offline_alert BOOLEAN NOT NULL DEFAULT true,
    reconnect_alert BOOLEAN NOT NULL DEFAULT true,
    important_only BOOLEAN NOT NULL DEFAULT false,
    device_alerts JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. FCM 알림 전송 이력 테이블 (ICD-07, NF-P-002: 5초 이내 전송 검증용)
CREATE TABLE IF NOT EXISTS notification_history (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(event_id) ON DELETE CASCADE,
    user_id UUID,
    device_id VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'delivered',
    latency_ms INTEGER NOT NULL DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notif_hist_event ON notification_history(event_id);
CREATE INDEX IF NOT EXISTS idx_notif_hist_user ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_hist_sent ON notification_history(sent_at DESC);
