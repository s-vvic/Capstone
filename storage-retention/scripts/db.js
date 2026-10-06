// 로컬 개발용 SQL 실행 도구 (psql 없이 .env의 DB 정보로 실행)
// 사용법:
//   node scripts/db.js sql/schema.sql              ← SQL 파일 실행 (여러 개 나열 가능)
//   node scripts/db.js -c "SELECT * FROM files"    ← SQL 한 줄 실행
import { readFile } from 'node:fs/promises';
import { pool } from '../src/config/database.js';

const args = process.argv.slice(2);
const jobs = args[0] === '-c'
  ? [{ name: 'SQL', sql: args.slice(1).join(' ') }]
  : await Promise.all(args.map(async (file) => ({ name: file, sql: await readFile(file, 'utf8') })));

if (jobs.length === 0) {
  console.log('사용법: node scripts/db.js <파일.sql ...>  또는  node scripts/db.js -c "SQL"');
  process.exit(1);
}

try {
  for (const { name, sql } of jobs) {
    const result = await pool.query(sql);
    const results = Array.isArray(result) ? result : [result];
    for (const r of results) {
      if (r.rows?.length) console.table(r.rows);
    }
    console.log(`✔ ${name} 실행 완료`);
  }
} catch (err) {
  console.error(`✘ 실패: ${err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}