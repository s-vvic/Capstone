// 파일 저장 창구 — SV-F-032 플랜별 용량 제한
// 이벤트 처리 모듈(3.2.3)이 스냅샷·클립을 저장할 때 이 storeFile()을 호출함
import { randomUUID } from 'node:crypto';
import { fileRepository, userRepository, deviceRepository, blobStore } from '../repositories/index.js';
import { PLAN_LIMITS } from '../constants/planLimits.js';
import { FILE_TYPES, matchesSignature } from '../constants/fileTypes.js';
import { makeDefaultFileName } from '../utils/fileName.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

export async function storeFile({
  deviceId,
  fileType,                 // 'image' | 'video'
  buffer,                   // 파일 내용 (Buffer)
  eventId = null,
  eventType = null,         // 'motion' | 'sound' | 'connection' | 'system'
  capturedAt = new Date(),  // 촬영 시각 (파일 이름에 사용)
  resolution = null,
  durationSec = null,
}) {
  // 1) 보드 확인 → 파일 주인(user_id) 결정
  const device = await deviceRepository.findActiveById(deviceId);
  if (!device) {
    throw new AppError(ERROR_CODES.NOT_FOUND, `보드를 찾을 수 없습니다: ${deviceId}`);
  }

  // 2) 파일 형식·크기 확인
  const spec = FILE_TYPES[fileType];
  if (!spec) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, 'file_type은 image 또는 video여야 합니다.');
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, '파일 내용이 비어 있습니다.');
  }
  if (buffer.length > spec.maxBytes) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, `파일이 너무 큽니다. (최대 ${spec.maxBytes} 바이트)`);
  }
  if (!matchesSignature(fileType, buffer)) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, `${spec.extension.toUpperCase()} 파일이 아닙니다.`);
  }
  if (Number.isNaN(new Date(capturedAt).getTime())) {
    throw new AppError(ERROR_CODES.BAD_REQUEST, 'capturedAt 날짜 형식이 올바르지 않습니다.');
  }

  // 3) 플랜 한도 (SV-F-032)
  const plan = await userRepository.findPlanByUserId(device.user_id);
  const { quotaBytes } = PLAN_LIMITS[plan];

  const fileId = randomUUID();
  const storageKey = `${device.user_id}/${fileId}.${spec.extension}`;
  const fileName = makeDefaultFileName(deviceId, capturedAt, spec.extension);

  // 4) 사용자별 잠금 안에서: 용량 확인 → 파일 저장 → DB 기록
  return fileRepository.withUserLock(device.user_id, async (db) => {
    const usage = await fileRepository.sumUsageByUser(device.user_id, db);
    const usedBytes = usage.reduce((sum, row) => sum + row.usedBytes, 0);

    if (usedBytes + buffer.length > quotaBytes) {
      // 예외가 아니라 결과로 알려줌 → 이벤트 모듈은 이벤트 자체는 계속 저장할 수 있음
      return { stored: false, reason: 'QUOTA_EXCEEDED', used_bytes: usedBytes, quota_bytes: quotaBytes };
    }

    await blobStore.saveFile(storageKey, buffer);
    try {
      const row = await fileRepository.create({
        fileId, userId: device.user_id, deviceId, eventId, eventType, fileName,
        fileType, storageKey, fileSizeBytes: buffer.length, durationSec, resolution,
      }, db);
      return { stored: true, file_id: row.file_id, file_name: row.file_name, file_size_bytes: Number(row.file_size_bytes) };
    } catch (err) {
      await blobStore.deleteFile(storageKey); // DB 기록 실패 → 방금 쓴 파일도 지워서 짝을 맞춤
      throw err;
    }
  });
}