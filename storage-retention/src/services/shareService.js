// 공유 링크 (SV-F-031 공유)
// - 토큰은 무작위 32바이트. DB에는 SHA-256 해시만 저장 → DB가 털려도 링크를 만들 수 없음
// - 무기한 공유 금지 (보안 카메라 영상 = 개인영상정보)
import { randomBytes, createHash } from 'node:crypto';
import { shareRepository, blobStore } from '../repositories/index.js';
import { isUuid, parseExpiresInHours } from '../utils/validators.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

function checkFileId(fileId) {
  if (!isUuid(fileId)) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, 'fileId 형식이 올바르지 않습니다.');
  }
}

// POST /v1/storage/files/:fileId/share
export async function createShare(userId, fileId, body) {
  checkFileId(fileId);
  const hours = parseExpiresInHours(
    body?.expires_in_hours,
    Number(process.env.SHARE_DEFAULT_HOURS ?? 24),
    Number(process.env.SHARE_MAX_HOURS ?? 168),
  );

  const token = `sh_${randomBytes(32).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  const share = await shareRepository.replaceActiveShare({
    fileId, userId, tokenHash: hashToken(token), expiresAt,
  });
  if (!share) {
    throw new AppError(ERROR_CODES.NOT_FOUND, '파일을 찾을 수 없습니다.');
  }

  const baseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3002';
  return {
    share_id: share.share_id,
    file_id: share.file_id,
    share_url: `${baseUrl}/v1/storage/shared/${token}`, // 원본 토큰은 이 응답에서 한 번만 보여 줌
    expires_at: share.expires_at,
    created_at: share.created_at,
  };
}

// DELETE /v1/storage/files/:fileId/share
export async function revokeShare(userId, fileId) {
  checkFileId(fileId);
  const revoked = await shareRepository.revokeActiveShare(fileId, userId);
  if (!revoked) {
    throw new AppError(ERROR_CODES.NOT_FOUND, '활성화된 공유 링크가 없습니다.');
  }
}

// GET /v1/storage/shared/:shareToken — 로그인 없이 접근
export async function openSharedFile(token) {
  // 없음·만료·해제를 구분하지 않고 모두 같은 404 (어떤 토큰이 있었는지 알려 주지 않음)
  const notFound = new AppError(ERROR_CODES.NOT_FOUND, '공유 링크가 없거나 만료되었습니다.');

  if (typeof token !== 'string' || !token.startsWith('sh_') || token.length > 100) throw notFound;
  const share = await shareRepository.findActiveByTokenHash(hashToken(token));
  if (!share || !(await blobStore.exists(share.storage_key))) throw notFound;

  return { path: blobStore.getFilePath(share.storage_key), fileName: share.file_name };
}