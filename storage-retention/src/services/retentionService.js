// SV-F-033 오래된 파일 자동 삭제
// 플랜별 보관 기간(basic 7일 / standard 30일 / premium 90일)이 지난 파일을 DB와 저장소에서 지움
import { fileRepository, blobStore } from '../repositories/index.js';
import { PLAN_LIMITS } from '../constants/planLimits.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// now: 기준 시각 (기본은 지금)
export async function runRetention({ now = new Date() } = {}) {
  const batchSize = Number(process.env.RETENTION_BATCH_SIZE ?? 500);

  const summary = await fileRepository.withRetentionLock(async () => {
    const result = {};

    for (const [plan, { retentionDays }] of Object.entries(PLAN_LIMITS)) {
      const cutoff = new Date(now.getTime() - retentionDays * ONE_DAY_MS);
      let deletedCount = 0;
      let freedBytes = 0;

      // 한 번에 batchSize개씩, 더 지울 게 없을 때까지 반복
      while (true) {
        const deleted = await fileRepository.deleteExpiredBatch(plan, cutoff, batchSize);

        for (const row of deleted) {
          try {
            await blobStore.deleteFile(row.storage_key);
          } catch (err) {
            console.error(`[retention] 실제 파일 삭제 실패 (DB 기록은 삭제됨): ${row.storage_key}`, err);
          }
        }

        deletedCount += deleted.length;
        freedBytes += deleted.reduce((sum, row) => sum + Number(row.file_size_bytes), 0);
        if (deleted.length < batchSize) break;
      }

      result[plan] = {
        retention_days: retentionDays,
        cutoff: cutoff.toISOString(),
        deleted_count: deletedCount,
        freed_bytes: freedBytes,
      };
    }
    return result;
  });

  if (!summary) {
    console.log('[retention] 다른 곳에서 이미 실행 중이라 이번 실행은 건너뜀');
    return null;
  }
  const total = Object.values(summary).reduce((sum, p) => sum + p.deleted_count, 0);
  console.log(`[retention] 완료: 총 ${total}개 삭제`);
  return summary;
}