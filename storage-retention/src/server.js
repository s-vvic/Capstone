import 'dotenv/config';
import { createApp } from './app.js';
import { startRetentionScheduler } from './services/retentionScheduler.js';

const app = createApp();

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
  startRetentionScheduler(); // SV-F-033 자동 삭제 예약
});