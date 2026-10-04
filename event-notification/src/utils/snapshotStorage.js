import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Base64 스냅샷 데이터를 파싱하여 이미지 파일로 저장하거나 URL을 생성합니다.
 */
export async function saveSnapshot(eventId, base64OrUrl) {
  if (!base64OrUrl) {
    return null;
  }

  // 이미 HTTP/HTTPS URL인 경우 그대로 반환
  if (base64OrUrl.startsWith('http://') || base64OrUrl.startsWith('https://')) {
    return base64OrUrl;
  }

  try {
    // data:image/jpeg;base64,... 프리픽스 제거
    const cleanBase64 = base64OrUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    const fileName = `${eventId}.jpg`;
    const uploadDir = path.resolve(env.SNAPSHOT_UPLOAD_DIR);

    // 디렉토리가 없으면 생성 (메모리 테스트 시에도 폴더 안전 처리)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    await fs.promises.writeFile(filePath, buffer);

    return `${env.SNAPSHOT_BASE_URL}/${fileName}`;
  } catch (error) {
    logger.warn('Failed to save snapshot file, using fallback URL', { error: error.message });
    return `${env.SNAPSHOT_BASE_URL}/${eventId}.jpg`;
  }
}
