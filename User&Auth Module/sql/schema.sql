-- =============================================================================
-- SecureCam Cloud Server - PostgreSQL 17.X Database Schema
-- Spec Reference:
--   - ICD.md 7.1.1 users
--   - FR/SV_F.md 3.2.1 사용자 및 인증 관리 (SV-F-001 ~ SV-F-005)
--   - NFR/NF_F.md NF-F-001 (PostgreSQL 17.X)
--   - NFR/NF_S.md NF-S-002 (bcrypt), NF-S-003 (JWT), NF-S-005 (이상 접근 감지)
-- =============================================================================

-- UUID 확장을 위한 pgcrypto 또는 uuid-ossp 활성화 (PostgreSQL 13+ 내장 gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. users 테이블 (ICD 7.1.1)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    plan VARCHAR(20) NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'standard', 'premium')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- -----------------------------------------------------------------------------
-- 2. user_sessions 테이블 (SV-F-003 자동로그인, SV-F-004 다중 기기 세션 관리)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    device_name VARCHAR(100) NOT NULL,
    device_type VARCHAR(50) NOT NULL DEFAULT 'web', -- 'web', 'android', 'tablet', etc.
    client_ip VARCHAR(50),
    user_agent TEXT,
    token_jti VARCHAR(255) NOT NULL UNIQUE,          -- JWT 고유 ID (jti)
    is_auto_login BOOLEAN NOT NULL DEFAULT false,   -- SV-F-003 자동 로그인 여부
    is_active BOOLEAN NOT NULL DEFAULT true,        -- SV-F-004 강제 로그아웃 시 false
    last_active_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_jti ON user_sessions(token_jti);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(user_id, is_active);

-- -----------------------------------------------------------------------------
-- 3. login_attempts 테이블 (ICD 2.1.1 429 TOO_MANY_REQUESTS, NF-S-005 이상 접근 감지)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
    attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    client_ip VARCHAR(50) NOT NULL,
    is_success BOOLEAN NOT NULL,
    attempt_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_time ON login_attempts(email, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(client_ip, attempt_time);

-- -----------------------------------------------------------------------------
-- 4. password_resets 테이블 (SV-F-002 아이디/비밀번호 찾기 및 재설정)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
    reset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reset_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(reset_token);

-- -----------------------------------------------------------------------------
-- 5. updated_at 자동 갱신 트리거 함수
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
