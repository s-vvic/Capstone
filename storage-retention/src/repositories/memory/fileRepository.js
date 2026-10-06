// files — In-Memory 버전 (../fileRepository.js 와 같은 함수·같은 결과)
import { store, removeFile } from './store.js';

const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const hasActiveShare = (fileId) =>
  [...store.shares.values()].some((s) => s.file_id === fileId && !s.revoked_at && s.expires_at > new Date());

// 메모리 버전은 테스트용이라 잠금을 흉내 내지 않음 (동시 저장은 PostgreSQL 버전에서 확인)
export async function withUserLock(userId, work) {
  return work(null);
}

export async function sumUsageByUser(userId) {
  const byType = new Map();
  for (const file of store.files.values()) {
    if (file.user_id !== userId) continue;
    const row = byType.get(file.file_type) ?? { fileType: file.file_type, fileCount: 0, usedBytes: 0 };
    row.fileCount += 1;
    row.usedBytes += file.file_size_bytes;
    byType.set(file.file_type, row);
  }
  return [...byType.values()];
}

export async function create(file) {
  const now = new Date();
  const row = {
    file_id: file.fileId,
    user_id: file.userId,
    device_id: file.deviceId,
    event_id: file.eventId ?? null,
    event_type: file.eventType ?? null,
    file_name: file.fileName,
    file_type: file.fileType,
    storage_key: file.storageKey,
    file_size_bytes: file.fileSizeBytes,
    duration_sec: file.durationSec ?? null,
    resolution: file.resolution ?? null,
    created_at: now,
    updated_at: now,
  };
  store.files.set(row.file_id, row);
  return { file_id: row.file_id, file_name: row.file_name, file_size_bytes: row.file_size_bytes };
}

const SORTERS = {
  created_at_desc: (a, b) => b.created_at - a.created_at || compareText(b.file_id, a.file_id),
  created_at_asc: (a, b) => a.created_at - b.created_at || compareText(a.file_id, b.file_id),
  file_size_desc: (a, b) => b.file_size_bytes - a.file_size_bytes || compareText(b.file_id, a.file_id),
  file_name_asc: (a, b) => compareText(a.file_name, b.file_name) || compareText(a.file_id, b.file_id),
};

export async function list(userId, { deviceId, fileType, eventType, from, to, sort, page, size }) {
  const matched = [...store.files.values()].filter((f) =>
    f.user_id === userId
    && (!deviceId || f.device_id === deviceId)
    && (!fileType || f.file_type === fileType)
    && (!eventType || f.event_type === eventType)
    && (!from || f.created_at >= from)
    && (!to || f.created_at < to));

  matched.sort(SORTERS[sort] ?? SORTERS.created_at_desc);

  const items = matched.slice((page - 1) * size, page * size).map((f) => ({
    ...f,
    device_name: store.devices.get(f.device_id)?.name ?? null,
    is_shared: hasActiveShare(f.file_id),
  }));
  return { total: matched.length, items };
}

const pickFile = (f) => ({ file_id: f.file_id, file_name: f.file_name, file_type: f.file_type, storage_key: f.storage_key });

export async function findById(fileId) {
  const file = store.files.get(fileId);
  return file ? pickFile(file) : null;
}

export async function findByIdForUser(fileId, userId) {
  const file = store.files.get(fileId);
  return file && file.user_id === userId ? pickFile(file) : null;
}

export async function deleteByIds(userId, fileIds) {
  const deleted = [];
  for (const fileId of fileIds) {
    const file = store.files.get(fileId);
    if (!file || file.user_id !== userId) continue;
    removeFile(fileId);
    deleted.push({ file_id: file.file_id, storage_key: file.storage_key, file_size_bytes: file.file_size_bytes });
  }
  return deleted;
}

export async function rename(userId, fileId, fileName) {
  const file = store.files.get(fileId);
  if (!file || file.user_id !== userId) return null;
  file.file_name = fileName;
  file.updated_at = new Date();
  return { file_id: file.file_id, file_name: file.file_name, updated_at: file.updated_at };
}

let retentionRunning = false;
export async function withRetentionLock(work) {
  if (retentionRunning) return null;
  retentionRunning = true;
  try {
    return await work();
  } finally {
    retentionRunning = false;
  }
}

export async function deleteExpiredBatch(plan, cutoff, limit) {
  const targets = [...store.files.values()]
    .filter((f) => store.users.get(f.user_id)?.plan === plan && f.created_at < cutoff)
    .sort((a, b) => a.created_at - b.created_at)
    .slice(0, limit);

  for (const file of targets) removeFile(file.file_id);
  return targets.map((f) => ({
    file_id: f.file_id, user_id: f.user_id, storage_key: f.storage_key, file_size_bytes: f.file_size_bytes,
  }));
}