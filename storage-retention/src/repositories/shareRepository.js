// file_shares 테이블 SQL 모음 (SV-F-031 공유)
import { pool } from '../config/database.js';

// 새 공유 링크 저장. 같은 파일의 기존 링크는 폐기 (파일당 살아 있는 링크 1개)
// 내 파일이 아니면 null
export async function replaceActiveShare({ fileId, userId, tokenHash, expiresAt }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 내 파일인지 확인 + 같은 파일에 대한 동시 요청을 한 줄로 세움 (FOR UPDATE)
    const owned = await client.query(
      'SELECT 1 FROM files WHERE file_id = $1 AND user_id = $2 FOR UPDATE',
      [fileId, userId],
    );
    if (owned.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      'UPDATE file_shares SET revoked_at = now() WHERE file_id = $1 AND revoked_at IS NULL',
      [fileId],
    );
    const { rows } = await client.query(
      `INSERT INTO file_shares (file_id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING share_id, file_id, expires_at, created_at`,
      [fileId, userId, tokenHash, expiresAt],
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// 공유 해제. 해제한 링크가 있으면 true
export async function revokeActiveShare(fileId, userId) {
  const { rowCount } = await pool.query(
    `UPDATE file_shares
        SET revoked_at = now()
      WHERE file_id = $1
        AND user_id = $2
        AND revoked_at IS NULL
        AND expires_at > now()`,
    [fileId, userId],
  );
  return rowCount > 0;
}

// 토큰 해시로 살아 있는 공유 찾기 (만료·해제된 건 안 나옴)
export async function findActiveByTokenHash(tokenHash) {
  const { rows } = await pool.query(
    `SELECT s.share_id, f.file_id, f.file_name, f.storage_key
       FROM file_shares s
       JOIN files f ON f.file_id = s.file_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()`,
    [tokenHash],
  );
  return rows[0] ?? null;
}