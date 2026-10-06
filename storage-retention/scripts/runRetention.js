// 자동 삭제(SV-F-033)를 지금 바로 한 번 실행 — 자정까지 기다리지 않고 테스트·시연할 때 사용
// 사용법: node scripts/runRetention.js
import 'dotenv/config';
import { pool } from '../src/config/database.js';
import { runRetention } from '../src/services/retentionService.js';

try {
  const summary = await runRetention();
  if (summary) console.table(summary);
} catch (err) {
  console.error(`✘ 실패: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}