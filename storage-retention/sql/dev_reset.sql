-- ⚠ 로컬 개발 DB 전용: 테이블을 지우고 처음부터 다시 만들 때 사용 (안의 데이터 전부 삭제)
-- 절대 팀 공용 DB / 운영 DB에 실행하지 말 것
DROP TABLE IF EXISTS file_shares, files, notifications, events, devices, users CASCADE;