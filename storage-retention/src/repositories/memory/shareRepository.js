// file_shares — In-Memory 버전 (../shareRepository.js 와 같은 함수·같은 결과)
import { randomUUID } from 'node:crypto';
import { store } from './store.js';

export async function replaceActiveShare({ fileId, userId, tokenHash, expiresAt }) {
  const file = store.files.get(fileId);
  if (!file || file.user_id !== userId) return null;

  const now = new Date();
  for (const share of store.shares.values()) {
    if (share.file_id === fileId && !share.revoked_at) share.revoked_at = now;
  }

  const share = {
    share_id: randomUUID(), file_id: fileId, user_id: userId,
    token_hash: tokenHash, expires_at: expiresAt, revoked_at: null, created_at: now,
  };
  store.shares.set(share.share_id, share);
  return { share_id: share.share_id, file_id: fileId, expires_at: expiresAt, created_at: now };
}

export async function revokeActiveShare(fileId, userId) {
  let revoked = false;
  for (const share of store.shares.values()) {
    if (share.file_id === fileId && share.user_id === userId && !share.revoked_at && share.expires_at > new Date()) {
      share.revoked_at = new Date();
      revoked = true;
    }
  }
  return revoked;
}

export async function findActiveByTokenHash(tokenHash) {
  const share = [...store.shares.values()].find(
    (s) => s.token_hash === tokenHash && !s.revoked_at && s.expires_at > new Date(),
  );
  const file = share && store.files.get(share.file_id);
  return file
    ? { share_id: share.share_id, file_id: file.file_id, file_name: file.file_name, storage_key: file.storage_key }
    : null;
}