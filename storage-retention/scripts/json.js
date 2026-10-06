// curl 결과(JSON)를 보기 좋게 출력하거나, 값 하나만 꺼내는 도구
// 사용법: curl ... | node scripts/json.js                    ← 전체를 보기 좋게
//         curl ... | node scripts/json.js items.0.file_id    ← 값 하나만 (items 첫 번째의 file_id)
import { readFileSync } from 'node:fs';

const raw = readFileSync(0, 'utf8');
let data;
try {
  data = JSON.parse(raw);
} catch {
  console.error('JSON이 아닌 응답입니다 (서버가 켜져 있는지 확인):');
  console.error(raw);
  process.exit(1);
}

const path = process.argv[2];
const value = path ? path.split('.').reduce((obj, key) => obj?.[key], data) : data;
console.log(typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : value);