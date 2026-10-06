-- Component 3 · 저장소 관리 (SRS 3.2.4, SV-F-030 ~ 033)
-- 먼저 적용되어 있어야 하는 테이블: users (Component 1), devices (Component 2)

-- 저장 파일 메타데이터 (DB-F-005, ICD 2.4.1)
CREATE TABLE IF NOT EXISTS files (
  file_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES users(user_id),
  device_id        VARCHAR(50)  NOT NULL REFERENCES devices(device_id),
  event_id         UUID,        -- 이벤트 모듈(3.2.3)의 events.event_id. 그 테이블이 생기면 FK 추가
  event_type       VARCHAR(20)  CHECK (event_type IN ('motion', 'sound', 'connection', 'system')),
  file_name        VARCHAR(200) NOT NULL,          -- 화면에 보이는 이름 (이름 변경 대상)
  file_type        VARCHAR(10)  NOT NULL CHECK (file_type IN ('image', 'video')),
  storage_key      VARCHAR(500) NOT NULL UNIQUE,   -- 실제 저장 위치 (예: {user_id}/{file_id}.jpg)
  file_size_bytes  BIGINT       NOT NULL CHECK (file_size_bytes >= 0),
  duration_sec     INTEGER,                        -- 영상만
  resolution       VARCHAR(20),                    -- 예: 1920x1080
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- SV-F-030 사용량 합계용
CREATE INDEX IF NOT EXISTS idx_files_usage   ON files (user_id, file_type) INCLUDE (file_size_bytes);
-- 파일 목록 (최신순)
CREATE INDEX IF NOT EXISTS idx_files_list    ON files (user_id, created_at DESC);
-- SV-F-033 자동 삭제 대상 검색
CREATE INDEX IF NOT EXISTS idx_files_created ON files (created_at);

-- 공유 링크 (SV-F-031 공유)
CREATE TABLE IF NOT EXISTS file_shares (
  share_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     UUID        NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(user_id),
  token_hash  CHAR(64)    NOT NULL UNIQUE,   -- 공유 토큰의 SHA-256 값 (원본 토큰은 저장 안 함)
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,                   -- 공유 해제 시각
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 파일 하나당 살아 있는 공유 링크는 1개만
CREATE UNIQUE INDEX IF NOT EXISTS uq_file_shares_active ON file_shares (file_id) WHERE revoked_at IS NULL;