// SV-F-031 공유 링크 테스트
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { authHeader, resetData, removeTestStorage, DEVICES, fakeJpg, pathOf } from './helpers/testSetup.js';
import { createApp } from '../src/app.js';
import { storeFile } from '../src/services/fileService.js';

const app = createApp();

beforeEach(resetData);
after(removeTestStorage);

const createShare = (fileId, body = {}) =>
  request(app).post(`/v1/storage/files/${fileId}/share`).set(authHeader('basic')).send(body);

test('공유 링크: 만들기 → 로그인 없이 열기 → 다시 만들면 예전 링크 무효 → 해제', async () => {
  const file = await storeFile({ deviceId: DEVICES.basic, fileType: 'image', buffer: fakeJpg() });

  const first = await createShare(file.file_id, { expires_in_hours: 1 });
  assert.equal(first.status, 201);
  assert.match(first.body.share_url, /\/v1\/storage\/shared\/sh_/);
  assert.equal((await request(app).get(pathOf(first.body.share_url))).status, 200);

  const second = await createShare(file.file_id);
  assert.equal((await request(app).get(pathOf(first.body.share_url))).status, 404);
  assert.equal((await request(app).get(pathOf(second.body.share_url))).status, 200);

  const list = await request(app).get('/v1/storage/files').set(authHeader('basic'));
  assert.equal(list.body.items[0].is_shared, true);

  const revoke = await request(app).delete(`/v1/storage/files/${file.file_id}/share`).set(authHeader('basic'));
  assert.equal(revoke.status, 204);
  assert.equal((await request(app).get(pathOf(second.body.share_url))).status, 404);
});

test('공유 링크: 잘못된 기간 · 남의 파일 · 가짜 토큰', async () => {
  const mine = await storeFile({ deviceId: DEVICES.basic, fileType: 'image', buffer: fakeJpg() });
  const others = await storeFile({ deviceId: DEVICES.standard, fileType: 'image', buffer: fakeJpg() });

  assert.equal((await createShare(mine.file_id, { expires_in_hours: 200 })).status, 400);
  assert.equal((await createShare(others.file_id)).status, 404);
  assert.equal((await request(app).get('/v1/storage/shared/sh_fake')).status, 404);
});