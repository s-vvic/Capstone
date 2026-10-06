// devices 테이블 조회 (Component 2 소유 테이블 → 읽기만 함)
import { pool } from '../config/database.js';

// 사용 중인 보드 1대 (없거나 비활성이면 null)
export async function findActiveById(deviceId) {
  const { rows } = await pool.query(
    `SELECT device_id, user_id, name
       FROM devices
      WHERE device_id = $1
        AND is_active IS NOT FALSE`,
    [deviceId],
  );
  return rows[0] ?? null;
}