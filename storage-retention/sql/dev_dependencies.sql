-- ⚠ 로컬 개발 전용: Component 1(users) · Component 2(devices) 테이블의 최소 버전
-- 근거: ICD 7.1.1 users, 7.1.2 devices
-- 팀원들의 실제 schema.sql을 받으면 이 파일 대신 그것을 적용할 것

CREATE TABLE IF NOT EXISTS users (
  user_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(255) UNIQUE NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  name           VARCHAR(100) NOT NULL,
  plan           VARCHAR(10)  NOT NULL DEFAULT 'basic'
                 CHECK (plan IN ('basic', 'standard', 'premium')),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  device_id   VARCHAR(50)  PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES users(user_id),
  serial_no   VARCHAR(100) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  location    VARCHAR(200),
  model       VARCHAR(100) NOT NULL,
  is_active   BOOLEAN      DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 테스트용 사용자 3명 (플랜별 1명씩)
INSERT INTO users (user_id, email, password_hash, name, plan) VALUES
  ('11111111-1111-1111-1111-111111111111', 'basic@test.com',    'dev-only', '베이직 사용자',   'basic'),
  ('22222222-2222-2222-2222-222222222222', 'standard@test.com', 'dev-only', '스탠다드 사용자', 'standard'),
  ('33333333-3333-3333-3333-333333333333', 'premium@test.com',  'dev-only', '프리미엄 사용자', 'premium')
ON CONFLICT (user_id) DO NOTHING;

-- 테스트용 보드 (사용자마다 1대)
INSERT INTO devices (device_id, user_id, serial_no, name, location, model) VALUES
  ('CAM-0001', '11111111-1111-1111-1111-111111111111', 'VPNCAM-000001', '현관', '1층 현관', 'RV1106'),
  ('CAM-0002', '22222222-2222-2222-2222-222222222222', 'VPNCAM-000002', '거실', '거실',     'RV1106'),
  ('CAM-0003', '33333333-3333-3333-3333-333333333333', 'VPNCAM-000003', '창고', '지하 창고', 'RV1106')
ON CONFLICT (device_id) DO NOTHING;