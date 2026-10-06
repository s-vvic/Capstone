// 서명된 다운로드 URL — 로그인 토큰 없이도 <img src>나 다운로드 매니저에서 쓸 수 있는 링크
// sig = HMAC-SHA256(비밀키, "{fileId}.{exp}")
// → 누가 fileId나 만료시각(exp)을 바꾸면 sig가 맞지 않아서 거부됨
import { createHmac, timingSafeEqual } from 'node:crypto';

function secret() {
  const value = process.env.SIGNED_URL_SECRET;
  if (!value) throw new Error('.env에 SIGNED_URL_SECRET이 없습니다.');
  return value;
}

function sign(fileId, exp) {
  return createHmac('sha256', secret()).update(`${fileId}.${exp}`).digest('base64url');
}

// 다운로드 URL 만들기 (기본 15분 유효)
export function createDownloadUrl(fileId, ttlSec = Number(process.env.SIGNED_URL_TTL_SEC ?? 900)) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const baseUrl = process.env.PUBLIC_BASE_URL ?? 'http://localhost:3002';
  return `${baseUrl}/v1/storage/files/${fileId}/download?exp=${exp}&sig=${sign(fileId, exp)}`;
}

// 다운로드 요청의 exp, sig 확인
export function verifyDownloadSignature(fileId, exp, sig) {
  if (typeof exp !== 'string' || typeof sig !== 'string' || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false; // 만료됨

  const expected = Buffer.from(sign(fileId, exp));
  const received = Buffer.from(sig);
  // 길이가 같을 때만 비교, 비교는 timingSafeEqual (응답 시간으로 정답을 추측하는 공격 방지)
  return expected.length === received.length && timingSafeEqual(expected, received);
}