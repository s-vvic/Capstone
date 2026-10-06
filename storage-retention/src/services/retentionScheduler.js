// SV-F-033 자동 삭제 예약 (기본: 매일 00:00 한국시간)
import cron from 'node-cron';
import { runRetention } from './retentionService.js';

export function startRetentionScheduler() {
  if (process.env.RETENTION_ENABLED === 'false') {
    console.log('[retention] 자동 삭제 꺼짐 (RETENTION_ENABLED=false)');
    return;
  }

  const schedule = process.env.RETENTION_CRON ?? '0 0 * * *';
  if (!cron.validate(schedule)) {
    throw new Error(`RETENTION_CRON 형식이 올바르지 않습니다: ${schedule}`);
  }

  cron.schedule(
    schedule,
    async () => {
      try {
        await runRetention();
      } catch (err) {
        console.error('[retention] 자동 삭제 실패', err);
      }
    },
    { name: 'storage-retention', timezone: 'Asia/Seoul', noOverlap: true },
  );
  console.log(`[retention] 자동 삭제 예약됨: "${schedule}" (Asia/Seoul)`);
}