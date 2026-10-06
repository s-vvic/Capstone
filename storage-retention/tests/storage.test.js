// SV-F-030 ~ 032 테스트: 사용량 · 저장 한도 · 목록 · 다운로드 · 이름 변경 · 삭제
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import request from 'supertest';
import { authHeader, resetData, removeTestStorage, DEVICES, USERS, fakeJpg, fakeMp4, pathOf } from './helpers/testSetup.js';
import { createApp } from '../src/app.js';
import { storeFile } from '../src/services/fileService.js';
import { fileRepository, blobStore } from '../src/repositories/index.js';

const app = createApp();
const GiB = 1024 ** 3;

beforeEach(resetData);
after(removeTestStorage);

test('인증: 토큰이 없으면 401', async () => {
  const res = await request(app).get('/v1/storage/usage');
  assert.equal(res.status, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

test('SV-F-030 사용량: 처음엔 0, 저장하면 합계가 늘어남', async () => {
  let res = await request(app).get('/v1/storage/usage').set(authHeader('basic'));
  assert.equal(res.status, 200);
  assert.equal(res.body.plan, 'basic');
  assert.equal(res.body.quota_bytes, 5 * GiB);
  assert.equal(res.body.used_bytes, 0);

  await storeFile({ deviceId: DEVICES.basic, fileType: 'image', buffer: fakeJpg(1000) });
  await storeFile({ deviceId: DEVICES.basic, fileType: 'video', buffer: fakeMp4(2000) });

  res = await request(app).get('/v1/storage/usage').set(authHeader('basic'));
  assert.equal(res.body.used_bytes, 3000);
  assert.equal(res.body.file_count, 2);
  assert.equal(res.body.by_file_type.image.used_bytes, 1000);
  assert.equal(res.body.by_file_type.video.used_bytes, 2000);
});

test('SV-F-032 플랜별 한도: basic 5GiB를 넘으면 저장하지 않음', async () => {
  // basic 사용자에게 5GiB짜리 가짜 기록을 넣어 한도를 채움
  await fileRepository.create({
    fileId: '00000000-0000-4000-8000-000000000001', userId: USERS.basic, deviceId: DEVICES.basic,
    fileName: 'big.mp4', fileType: 'video', storageKey: 'test/big.mp4', fileSizeBytes: 5 * GiB,
  });

  const result = await storeFile({ deviceId: DEVICES.basic, fileType: 'image', buffer: fakeJpg() });
  assert.equal(result.stored, false);
  assert.equal(result.reason, 'QUOTA_EXCEEDED');

  // 같은 크기라도 premium(100GiB)은 저장됨
  const premium = await storeFile({ deviceId: DEVICES.premium, fileType: 'image', buffer: fakeJpg() });
  assert.equal(premium.stored, true);
});

test('SV-F-032 파일 검사: JPG가 아니거나 없는 보드면 거부', async () => {
  await assert.rejects(
    storeFile({ deviceId: DEVICES.basic, fileType: 'image', buffer: Buffer.from('hello') }),
    { status: 400 },
  );
  await assert.rejects(
    storeFile({ deviceId: 'CAM-9999', fileType: 'image', buffer: fakeJpg() }),
    { status: 404 },
  );
});

test('SV-F-031 목록: 필터 · 잘못된 값', async () => {
  await storeFile({ deviceId: DEVICES.basic, fileType: 'image', buffer: fakeJpg(), eventType: 'motion' });
  await storeFile({ deviceId: DEVICES.basic, fileType: 'image', buffer: fakeJpg(), eventType: 'sound' });
  await storeFile({ deviceId: DEVICES.basic, fileType: 'video', buffer: fakeMp4(), eventType: 'motion' });
  await storeFile({ deviceId: DEVICES.standard, fileType: 'image', buffer: fakeJpg() }); // 남의 파일

  let res = await request(app).get('/v1/storage/files').set(authHeader('basic'));
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 3); // 남의 파일은 안 보임
  assert.equal(res.body.items[0].device_name, '현관');
  assert.ok(res.body.items[0].download_url.includes('/download?exp='));

  res = await request(app).get('/v1/storage/files?file_type=image&event_type=motion').set(authHeader('basic'));
  assert.equal(res.body.total, 1);

  res = await request(app).get('/v1/storage/files?sort=drop').set(authHeader('basic'));
  assert.equal(res.status, 400);
  res = await request(app).get('/v1/storage/files?size=500').set(authHeader('basic'));
  assert.equal(res.status, 400);
});

test('SV-F-031 다운로드: 서명이 맞으면 200, 바꾸면 403', async () => {
  await storeFile({ deviceId: DEVICES.basic, fileType: 'image', buffer: fakeJpg() });
  const list = await request(app).get('/v1/storage/files').set(authHeader('basic'));
  const url = pathOf(list.body.items[0].download_url);

  const ok = await request(app).get(url); // 토큰 없이
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['content-type'], 'image/jpeg');

  const forged = await request(app).get(`${url}x`);
  assert.equal(forged.status, 403);
});

test('SV-F-031 이름 변경: 확장자 유지 · 다른 확장자와 남의 파일은 거부', async () => {
  const mine = await storeFile({ deviceId: DEVICES.basic, fileType: 'image', buffer: fakeJpg() });
  const others = await storeFile({ deviceId: DEVICES.standard, fileType: 'image', buffer: fakeJpg() });

  let res = await request(app).patch(`/v1/storage/files/${mine.file_id}`)
    .set(authHeader('basic')).send({ file_name: '현관_택배기사' });
  assert.equal(res.status, 200);
  assert.equal(res.body.file_name, '현관_택배기사.jpg');

  res = await request(app).patch(`/v1/storage/files/${mine.file_id}`)
    .set(authHeader('basic')).send({ file_name: 'hack.exe' });
  assert.equal(res.status, 400);

  res = await request(app).patch(`/v1/storage/files/${others.file_id}`)
    .set(authHeader('basic')).send({ file_name: 'hacked' });
  assert.equal(res.status, 404);
});

test('SV-F-031 삭제: 내 파일만 지워지고 실제 파일도 사라짐', async () => {
  const mine = await storeFile({ deviceId: DEVICES.basic, fileType: 'image', buffer: fakeJpg(500) });
  const others = await storeFile({ deviceId: DEVICES.standard, fileType: 'image', buffer: fakeJpg() });
  const storageKey = (await fileRepository.findById(mine.file_id)).storage_key;
  assert.ok(existsSync(blobStore.getFilePath(storageKey)));

  const res = await request(app).delete('/v1/storage/files').set(authHeader('basic'))
    .send({ file_ids: [mine.file_id, others.file_id] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.deleted_ids, [mine.file_id]);
  assert.deepEqual(res.body.not_found_ids, [others.file_id]);
  assert.equal(res.body.freed_bytes, 500);
  assert.equal(existsSync(blobStore.getFilePath(storageKey)), false);
});