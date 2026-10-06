// HTTP 요청 → 서비스 호출 → 응답
import * as storageService from '../services/storageService.js';
import * as shareService from '../services/shareService.js';

// 파일 내려주기 (다운로드 · 공유 링크 공통)
function sendFile(res, file) {
  res.set('Cache-Control', 'private, no-store');
  res.download(file.path, file.fileName, { cacheControl: false });
}

// GET /v1/storage/usage  (SV-F-030)
export async function getUsage(req, res) {
  const usage = await storageService.getUsage(req.user.userId);
  res.json(usage);
}

// GET /v1/storage/files  (SV-F-031 목록)
export async function listFiles(req, res) {
  const result = await storageService.listFiles(req.user.userId, req.query);
  res.json(result);
}

// GET /v1/storage/files/:fileId/download?exp=...&sig=...  (SV-F-031 다운로드)
export async function downloadFile(req, res) {
  const { exp, sig } = req.query;
  const file = await storageService.openDownload(req.params.fileId, exp, sig);
  sendFile(res, file);
}

// DELETE /v1/storage/files  (SV-F-031 삭제)
export async function deleteFiles(req, res) {
  const result = await storageService.deleteFiles(req.user.userId, req.body);
  res.json(result);
}

// PATCH /v1/storage/files/:fileId  (SV-F-031 이름 변경)
export async function renameFile(req, res) {
  const result = await storageService.renameFile(req.user.userId, req.params.fileId, req.body);
  res.json(result);
}

// POST /v1/storage/files/:fileId/share  (SV-F-031 공유 링크 만들기)
export async function createShare(req, res) {
  const result = await shareService.createShare(req.user.userId, req.params.fileId, req.body);
  res.status(201).json(result);
}

// DELETE /v1/storage/files/:fileId/share  (SV-F-031 공유 해제)
export async function revokeShare(req, res) {
  await shareService.revokeShare(req.user.userId, req.params.fileId);
  res.status(204).end();
}

// GET /v1/storage/shared/:shareToken  (공유 링크로 열기 — 로그인 없음)
export async function openSharedFile(req, res) {
  const file = await shareService.openSharedFile(req.params.shareToken);
  res.set('Referrer-Policy', 'no-referrer'); // 링크 주소가 다른 사이트로 새지 않게
  res.set('X-Robots-Tag', 'noindex');         // 검색엔진 수집 금지
  sendFile(res, file);
}