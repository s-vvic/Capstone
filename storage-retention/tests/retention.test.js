// SV-F-033 자동 삭제 테스트 — 기준 시각(now)을 미래로 바꿔서 "8일 뒤", "31일 뒤"를 흉내 냄
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resetData, removeTestStorage, DEVICES, fakeJpg } from './helpers/testSetup.js';
import { storeFile } from '../src/services/fileService.js';
import { runRetention } from '../src/services/retentionService.js';
import { fileRepository, blobStore } from '../src/repositories/index.js';

const daysLater = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

beforeEach(resetData);
after(removeTestStorage);

test('플랜별 보관 기간: 8일 뒤엔 basic만, 31일 뒤엔 standard도 삭제', async () => {
  const basic = await storeFile({ deviceId: DEVICES.basic, fileType: 'image', buffer: fakeJpg() });
  const standard = await storeFile({ deviceId: DEVICES.standard, fileType: 'image', buffer: fakeJpg() });
  const premium = await storeFile({ deviceId: DEVICES.premium, fileType: 'image', buffer: fakeJpg() });
  const basicKey = (await fileRepository.findById(basic.file_id)).storage_key;

  let summary = await runRetention({ now: daysLater(8) });
  assert.equal(summary.basic.deleted_count, 1);
  assert.equal(summary.standard.deleted_count, 0);
  assert.equal(await fileRepository.findById(basic.file_id), null);
  assert.equal(existsSync(blobStore.getFilePath(basicKey)), false); // 실제 파일도 삭제

  summary = await runRetention({ now: daysLater(31) });
  assert.equal(summary.standard.deleted_count, 1);
  assert.equal(await fileRepository.findById(standard.file_id), null);
  assert.ok(await fileRepository.findById(premium.file_id)); // premium은 90일이라 남음
});

test('동시에 두 번 실행하면 하나는 건너뜀', async () => {
  const [first, second] = await Promise.all([runRetention(), runRetention()]);
  assert.ok(first);
  assert.equal(second, null);
});