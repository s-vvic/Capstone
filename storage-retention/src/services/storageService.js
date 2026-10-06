// 저장소 관리 비즈니스 로직 (SV-F-030 ~ 031)
import { fileRepository, userRepository, blobStore } from '../repositories/index.js';
import { PLAN_LIMITS } from '../constants/planLimits.js';
import { FILE_TYPES } from '../constants/fileTypes.js';
import { parseFileListQuery, parseFileIds, isUuid } from '../utils/validators.js';
import { normalizeNewFileName } from '../utils/fileName.js';
import { createDownloadUrl, verifyDownloadSignature } from '../utils/signedUrl.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

const GiB = 1024 ** 3;
const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;

// SV-F-030: 저장소 사용량 조회
export async function getUsage(userId) {
  const plan = await userRepository.findPlanByUserId(userId);
  if (!plan) {
    throw new AppError(ERROR_CODES.NOT_FOUND, '사용자를 찾을 수 없습니다.');
  }
  const { quotaBytes, retentionDays } = PLAN_LIMITS[plan];

  const byFileType = {
    image: { file_count: 0, used_bytes: 0 },
    video: { file_count: 0, used_bytes: 0 },
  };
  for (const row of await fileRepository.sumUsageByUser(userId)) {
    byFileType[row.fileType] = { file_count: row.fileCount, used_bytes: row.usedBytes };
  }

  const usedBytes = byFileType.image.used_bytes + byFileType.video.used_bytes;
  const fileCount = byFileType.image.file_count + byFileType.video.file_count;

  return {
    plan,
    quota_bytes: quotaBytes,
    used_bytes: usedBytes,
    remaining_bytes: Math.max(quotaBytes - usedBytes, 0),
    quota_gb: quotaBytes / GiB,
    used_gb: round(usedBytes / GiB, 2),
    usage_percent: round((usedBytes / quotaBytes) * 100, 1),
    is_over_quota: usedBytes > quotaBytes,
    retention_days: retentionDays,
    file_count: fileCount,
    by_file_type: byFileType,
    calculated_at: new Date().toISOString(),
  };
}

// DB 행 → 응답 모양 (ICD 2.4.1)
function toFileResponse(row) {
  const downloadUrl = createDownloadUrl(row.file_id);
  return {
    file_id: row.file_id,
    file_name: row.file_name,
    file_type: row.file_type,
    device_id: row.device_id,
    device_name: row.device_name,
    created_at: row.created_at,
    file_size_bytes: Number(row.file_size_bytes),
    duration_sec: row.duration_sec,
    resolution: row.resolution,
    event_id: row.event_id,
    event_type: row.event_type,
    is_shared: row.is_shared,
    thumbnail_url: row.file_type === 'image' ? downloadUrl : null, // 영상 썸네일은 아직 없음
    download_url: downloadUrl,
  };
}

// SV-F-031: 파일 목록
export async function listFiles(userId, query) {
  const filters = parseFileListQuery(query);
  const { total, items } = await fileRepository.list(userId, filters);
  return { total, page: filters.page, size: filters.size, items: items.map(toFileResponse) };
}

// SV-F-031: 다운로드 — 서명 확인 후 실제 파일 위치를 돌려줌
export async function openDownload(fileId, exp, sig) {
  if (!verifyDownloadSignature(fileId, exp, sig)) {
    throw new AppError(ERROR_CODES.FORBIDDEN, '다운로드 링크가 올바르지 않거나 만료되었습니다.');
  }
  const file = await fileRepository.findById(fileId);
  if (!file || !(await blobStore.exists(file.storage_key))) {
    throw new AppError(ERROR_CODES.NOT_FOUND, '파일을 찾을 수 없습니다.');
  }
  return { path: blobStore.getFilePath(file.storage_key), fileName: file.file_name };
}

// SV-F-031: 단건·다중 삭제 (ICD 2.4.2)
export async function deleteFiles(userId, body) {
  const fileIds = parseFileIds(body);

  // ① DB에서 먼저 지움 (내 파일만)  ② 실제 파일 삭제
  const deleted = await fileRepository.deleteByIds(userId, fileIds);
  for (const row of deleted) {
    try {
      await blobStore.deleteFile(row.storage_key);
    } catch (err) {
      console.error(`[storage] 실제 파일 삭제 실패 (DB 기록은 삭제됨): ${row.storage_key}`, err);
    }
  }

  const deletedIds = deleted.map((row) => row.file_id);
  return {
    deleted_count: deleted.length,
    deleted_ids: deletedIds,
    not_found_ids: fileIds.filter((id) => !deletedIds.includes(id)), // 없거나 남의 파일
    freed_bytes: deleted.reduce((sum, row) => sum + Number(row.file_size_bytes), 0),
  };
}

// SV-F-031: 이름 변경
export async function renameFile(userId, fileId, body) {
  if (!isUuid(fileId)) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, 'fileId 형식이 올바르지 않습니다.');
  }
  const file = await fileRepository.findByIdForUser(fileId, userId);
  if (!file) {
    throw new AppError(ERROR_CODES.NOT_FOUND, '파일을 찾을 수 없습니다.'); // 남의 파일도 404
  }

  const newName = normalizeNewFileName(body?.file_name, FILE_TYPES[file.file_type].extension);
  const updated = await fileRepository.rename(userId, fileId, newName);
  return { file_id: updated.file_id, file_name: updated.file_name, updated_at: updated.updated_at };
}