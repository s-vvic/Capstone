// files 테이블 SQL 모음
import { pool } from '../config/database.js';

// 같은 사용자의 작업을 한 줄로 세워서 실행 (트랜잭션 + 사용자별 잠금)
// → 파일 2개가 동시에 들어와도 "용량 확인 → 저장"이 겹치지 않음
export async function withUserLock(userId, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// SV-F-030: 사용자의 저장 용량 합계를 파일 유형(image/video)별로
// db: 평소엔 pool, withUserLock 안에서는 잠금을 잡은 client
export async function sumUsageByUser(userId, db = pool) {
  const { rows } = await db.query(
    `SELECT file_type,
            COUNT(*)::int                             AS file_count,
            COALESCE(SUM(file_size_bytes), 0)::bigint AS used_bytes
       FROM files
      WHERE user_id = $1
      GROUP BY file_type`,
    [userId],
  );

  // pg는 bigint를 문자열로 돌려주므로 숫자로 바꿔 줌
  return rows.map((row) => ({
    fileType: row.file_type,
    fileCount: row.file_count,
    usedBytes: Number(row.used_bytes),
  }));
}

// 파일 1개 기록
export async function create(file, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO files (file_id, user_id, device_id, event_id, event_type, file_name,
                        file_type, storage_key, file_size_bytes, duration_sec, resolution)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING file_id, file_name, file_size_bytes`,
    [
      file.fileId, file.userId, file.deviceId, file.eventId, file.eventType, file.fileName,
      file.fileType, file.storageKey, file.fileSizeBytes, file.durationSec, file.resolution,
    ],
  );
  return rows[0];
}

// ───────── 6단계: SV-F-031 목록 · 다운로드 · 삭제 · 이름변경 ─────────

// 정렬은 사용자 입력을 SQL에 넣지 않고, 정해진 문장 중에서만 고름 (SQL Injection 방지)
const ORDER_BY = {
  created_at_desc: 'f.created_at DESC, f.file_id DESC',
  created_at_asc: 'f.created_at ASC, f.file_id ASC',
  file_size_desc: 'f.file_size_bytes DESC, f.file_id DESC',
  file_name_asc: 'f.file_name ASC, f.file_id ASC',
};

// 파일 목록 + 전체 개수 (ICD 2.4.1)
export async function list(userId, { deviceId, fileType, eventType, from, to, sort, page, size }) {
  const where = ['f.user_id = $1'];
  const params = [userId];

  // 조건을 하나씩 추가. 값은 params에 넣고 SQL에는 $번호만 들어감
  const addFilter = (condition, value) => {
    params.push(value);
    where.push(condition.replace('?', `$${params.length}`));
  };
  if (deviceId) addFilter('f.device_id = ?', deviceId);
  if (fileType) addFilter('f.file_type = ?', fileType);
  if (eventType) addFilter('f.event_type = ?', eventType);
  if (from) addFilter('f.created_at >= ?', from);
  if (to) addFilter('f.created_at < ?', to);
  const whereSql = where.join(' AND ');

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM files f WHERE ${whereSql}`, params);

  const { rows } = await pool.query(
    `SELECT f.file_id, f.file_name, f.file_type, f.device_id, d.name AS device_name,
            f.created_at, f.file_size_bytes, f.duration_sec, f.resolution,
            f.event_id, f.event_type,
            EXISTS (SELECT 1 FROM file_shares s
                     WHERE s.file_id = f.file_id
                       AND s.revoked_at IS NULL
                       AND s.expires_at > now()) AS is_shared
       FROM files f
       JOIN devices d ON d.device_id = f.device_id
      WHERE ${whereSql}
      ORDER BY ${ORDER_BY[sort] ?? ORDER_BY.created_at_desc}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, size, (page - 1) * size],
  );

  return { total: countResult.rows[0].total, items: rows };
}

// 파일 1개 (다운로드용 — 서명 URL이 권한 확인을 대신함)
export async function findById(fileId) {
  const { rows } = await pool.query(
    'SELECT file_id, file_name, file_type, storage_key FROM files WHERE file_id = $1',
    [fileId],
  );
  return rows[0] ?? null;
}

// 파일 1개 (내 파일인지까지 확인)
export async function findByIdForUser(fileId, userId) {
  const { rows } = await pool.query(
    'SELECT file_id, file_name, file_type, storage_key FROM files WHERE file_id = $1 AND user_id = $2',
    [fileId, userId],
  );
  return rows[0] ?? null;
}

// 여러 개 삭제 — 내 파일만 지워지고, 지운 행 정보를 돌려줌
export async function deleteByIds(userId, fileIds) {
  const { rows } = await pool.query(
    `DELETE FROM files
      WHERE user_id = $1
        AND file_id = ANY($2::uuid[])
      RETURNING file_id, storage_key, file_size_bytes`,
    [userId, fileIds],
  );
  return rows;
}

// 이름 변경 — 표시 이름만 바뀌고 storage_key(실제 위치)는 그대로
export async function rename(userId, fileId, fileName) {
  const { rows } = await pool.query(
    `UPDATE files
        SET file_name = $3, updated_at = now()
      WHERE file_id = $1 AND user_id = $2
      RETURNING file_id, file_name, updated_at`,
    [fileId, userId, fileName],
  );
  return rows[0] ?? null;
}

// ───────── 8단계: SV-F-033 오래된 파일 자동 삭제 ─────────

// 자동 삭제가 동시에 두 번 돌지 않게 잠금 (서버 여러 대 / 수동 실행과 예약 실행이 겹칠 때)
// 이미 다른 곳에서 돌고 있으면 work를 실행하지 않고 null
export async function withRetentionLock(work) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query("SELECT pg_try_advisory_lock(hashtext('c3_retention')) AS locked");
    if (!rows[0].locked) return null;
    try {
      return await work();
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext('c3_retention'))");
    }
  } finally {
    client.release();
  }
}

// 해당 플랜 사용자의 파일 중 cutoff보다 오래된 것을 최대 limit개 삭제하고, 지운 행을 돌려줌
export async function deleteExpiredBatch(plan, cutoff, limit) {
  const { rows } = await pool.query(
    `DELETE FROM files
      WHERE file_id IN (
        SELECT f.file_id
          FROM files f
          JOIN users u ON u.user_id = f.user_id
         WHERE u.plan = $1
           AND f.created_at < $2
         ORDER BY f.created_at
         LIMIT $3
      )
      RETURNING file_id, user_id, storage_key, file_size_bytes`,
    [plan, cutoff, limit],
  );
  return rows;
}