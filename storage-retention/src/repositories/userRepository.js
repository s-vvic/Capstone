// users 테이블 조회 (Component 1 소유 테이블 → 읽기만 함)
import { pool } from '../config/database.js';

// 사용자의 구독 플랜 (basic / standard / premium). 사용자가 없으면 null
export async function findPlanByUserId(userId) {
  const { rows } = await pool.query('SELECT plan FROM users WHERE user_id = $1', [userId]);
  return rows[0]?.plan ?? null;
}