// 테스트 공통 준비물
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { resetStore, seedDevData } from '../../src/repositories/memory/store.js';

// 실제 파일은 테스트마다 새 임시 폴더에 저장 (storage-data 폴더는 건드리지 않음)
process.env.STORAGE_ROOT = mkdtempSync(path.join(tmpdir(), 'securecam-test-'));

export const USERS = {
  basic: '11111111-1111-1111-1111-111111111111',
  standard: '22222222-2222-2222-2222-222222222222',
  premium: '33333333-3333-3333-3333-333333333333',
};
export const DEVICES = { basic: 'CAM-0001', standard: 'CAM-0002', premium: 'CAM-0003' };

// 로그인한 것처럼 Authorization 헤더 만들기
export function authHeader(plan) {
  const token = jwt.sign({ user_id: USERS[plan] }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
}

// 매 테스트 전: 사용자 3명 + 보드 3대만 있는 상태로
export function resetData() {
  resetStore();
  seedDevData();
}

// 모든 테스트가 끝나면 임시 폴더 삭제
export function removeTestStorage() {
  rmSync(process.env.STORAGE_ROOT, { recursive: true, force: true });
}

// 테스트용 가짜 JPG / MP4 (앞부분 시그니처만 진짜와 같음)
export const fakeJpg = (size = 1000) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size - 4)]);
export function fakeMp4(size = 2000) {
  const buffer = Buffer.alloc(size);
  buffer.write('ftypisom', 4, 'ascii');
  return buffer;
}

// 응답의 전체 URL(http://localhost:3002/v1/...) → 경로(/v1/...)
export const pathOf = (url) => {
  const { pathname, search } = new URL(url);
  return pathname + search;
};