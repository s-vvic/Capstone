// 파일 이름 관련 도구
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

// 기본 파일 이름: {보드ID}_{한국시간 yyyyMMdd_HHmmss}.{확장자}
// 예: CAM-0001_20261005_121245.jpg
export function makeDefaultFileName(deviceId, capturedAt, extension) {
  const kst = new Date(new Date(capturedAt).getTime() + 9 * 60 * 60 * 1000);
  const stamp = kst.toISOString()          // 2026-10-05T12:12:45.000Z
    .slice(0, 19)                          // 2026-10-05T12:12:45
    .replace(/-/g, '')                     // 20261005T12:12:45
    .replace('T', '_')                     // 20261005_12:12:45
    .replace(/:/g, '');                    // 20261005_121245
  return `${deviceId}_${stamp}.${extension}`;
}

const FORBIDDEN_CHARS = /[/\\:*?"<>|\u0000-\u001f\u007f]/;
const EXTENSION_AT_END = /\.([A-Za-z0-9]{1,5})$/;

// 이름 변경(SV-F-031): 사용자가 보낸 새 이름 검사 + 확장자는 원래 것으로 유지
// 예: '현관_택배' → '현관_택배.jpg',  '현관.JPG' → '현관.jpg',  'a.exe' → 400
export function normalizeNewFileName(input, extension) {
  const badRequest = (message) => new AppError(ERROR_CODES.BAD_REQUEST, message);

  if (typeof input !== 'string') throw badRequest('file_name은 문자열이어야 합니다.');
  let name = input.trim();

  if (FORBIDDEN_CHARS.test(name)) throw badRequest('파일 이름에 / \\ : * ? " < > | 는 쓸 수 없습니다.');
  if (name.startsWith('.')) throw badRequest('파일 이름은 . 으로 시작할 수 없습니다.');

  const match = name.match(EXTENSION_AT_END);
  if (match) {
    if (match[1].toLowerCase() !== extension) {
      throw badRequest(`확장자는 바꿀 수 없습니다. (.${extension})`);
    }
    name = name.slice(0, -match[0].length).trim();
  }

  if (name.length < 1 || name.length > 100) throw badRequest('파일 이름은 1 ~ 100자여야 합니다.');
  return `${name}.${extension}`;
}