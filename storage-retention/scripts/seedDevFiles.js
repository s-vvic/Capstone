// 로컬 테스트용 파일 만들기 (이벤트 모듈 대신 storeFile()을 직접 호출)
// 사용법: node scripts/seedDevFiles.js           ← 테스트 사용자 3명 모두
//         node scripts/seedDevFiles.js basic     ← 한 명만 (basic / standard / premium)
import 'dotenv/config';
import { pool } from '../src/config/database.js';
import { storeFile } from '../src/services/fileService.js';

const DEVICES = { basic: 'CAM-0001', standard: 'CAM-0002', premium: 'CAM-0003' };

// 실제로 열리는 아주 작은 JPG (32x18, 파란 바탕에 흰 네모)
const SAMPLE_JPG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAASACADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUG/8QAHhABAAAFBQAAAAAAAAAAAAAAAAIFFRZUZKKj0eH/xAAWAQEBAQAAAAAAAAAAAAAAAAAAAwT/xAAaEQADAAMBAAAAAAAAAAAAAAAAAQIDERIx/9oADAMBAAIRAxEAPwCav2zq+P1Aa+ty/I2RdNeR0tcmeFL9J9s6vj9QGvrcvyNkXTIGN099C1K8ACpMAAP/2Q==',
  'base64',
);

// 재생은 안 되지만 MP4 표시('ftyp')는 들어 있는 가짜 영상
function fakeMp4(sizeBytes) {
  const buffer = Buffer.alloc(sizeBytes);
  buffer.writeUInt32BE(24, 0);
  buffer.write('ftypisom', 4, 'ascii');
  return buffer;
}

const minutesAgo = (m) => new Date(Date.now() - m * 60 * 1000);
const plans = process.argv[2] ? [process.argv[2]] : Object.keys(DEVICES);

try {
  for (const plan of plans) {
    const deviceId = DEVICES[plan];
    if (!deviceId) throw new Error('basic / standard / premium 중 하나를 적어 주세요.');

    const results = [
      await storeFile({ deviceId, fileType: 'image', buffer: SAMPLE_JPG, eventType: 'motion', capturedAt: minutesAgo(30), resolution: '32x18' }),
      await storeFile({ deviceId, fileType: 'image', buffer: SAMPLE_JPG, eventType: 'sound', capturedAt: minutesAgo(20), resolution: '32x18' }),
      await storeFile({ deviceId, fileType: 'video', buffer: fakeMp4(3 * 1024 * 1024), eventType: 'motion', capturedAt: minutesAgo(10), resolution: '1920x1080', durationSec: 10 }),
    ];

    console.log(`\n[${plan}] ${deviceId}`);
    console.table(results);
  }
} catch (err) {
  console.error(`✘ 실패: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}