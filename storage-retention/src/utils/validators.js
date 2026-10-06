// 요청 값 검사 — 잘못된 값이면 400 BAD_REQUEST
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILE_TYPE_VALUES = ['image', 'video'];
const EVENT_TYPE_VALUES = ['motion', 'sound', 'connection', 'system'];
const SORT_VALUES = ['created_at_desc', 'created_at_asc', 'file_size_desc', 'file_name_asc'];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const badRequest = (message) => new AppError(ERROR_CODES.BAD_REQUEST, message);

export function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

// 'YYYY-MM-DD' → 그날 한국시간 0시
function parseKstDate(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`${name}은 YYYY-MM-DD 형식이어야 합니다.`);
  }
  const date = new Date(`${value}T00:00:00+09:00`);
  const roundTrip = Number.isNaN(date.getTime())
    ? null
    : new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (roundTrip !== value) {
    throw badRequest(`${name} 날짜가 올바르지 않습니다.`); // 예: 2026-02-30
  }
  return date;
}

// 값이 없으면 null, 있으면 허용 목록 중 하나인지 확인
function optionalOneOf(query, name, allowed) {
  const value = query[name];
  if (value === undefined || value === '') return null;
  if (!allowed.includes(value)) {
    throw badRequest(`${name}은 ${allowed.join(' / ')} 중 하나여야 합니다.`);
  }
  return value;
}

function positiveInt(query, name, defaultValue, max) {
  const value = query[name];
  if (value === undefined || value === '') return defaultValue;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
    throw badRequest(`${name}은 1 ~ ${max} 사이의 숫자여야 합니다.`);
  }
  return Number(value);
}

// GET /v1/storage/files 의 쿼리 파라미터 (ICD 2.4.1)
export function parseFileListQuery(query) {
  const deviceId = query.device_id;
  if (deviceId !== undefined && (typeof deviceId !== 'string' || deviceId.length > 50)) {
    throw badRequest('device_id 형식이 올바르지 않습니다.');
  }

  const from = query.start_date ? parseKstDate(query.start_date, 'start_date') : null;
  const to = query.end_date
    ? new Date(parseKstDate(query.end_date, 'end_date').getTime() + ONE_DAY_MS) // 종료일 하루 전체 포함
    : null;
  if (from && to && from >= to) {
    throw badRequest('end_date는 start_date와 같거나 이후여야 합니다.');
  }

  return {
    deviceId: deviceId || null,
    fileType: optionalOneOf(query, 'file_type', FILE_TYPE_VALUES),
    eventType: optionalOneOf(query, 'event_type', EVENT_TYPE_VALUES),
    sort: optionalOneOf(query, 'sort', SORT_VALUES) ?? 'created_at_desc',
    from,
    to,
    page: positiveInt(query, 'page', 1, 1000000),
    size: positiveInt(query, 'size', 20, 100),
  };
}

// DELETE /v1/storage/files 의 file_ids (ICD 2.4.2)
export function parseFileIds(body) {
  const ids = body?.file_ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
    throw badRequest('file_ids는 1 ~ 100개의 ID 배열이어야 합니다.');
  }
  if (!ids.every(isUuid)) {
    throw badRequest('file_ids에 올바르지 않은 ID가 있습니다.');
  }
  return [...new Set(ids.map((id) => id.toLowerCase()))]; // 중복 제거
}

// POST /v1/storage/files/:fileId/share 의 expires_in_hours (없으면 기본값)
export function parseExpiresInHours(value, defaultHours, maxHours) {
  if (value === undefined || value === null) return defaultHours;
  if (!Number.isInteger(value) || value < 1 || value > maxHours) {
    throw badRequest(`expires_in_hours는 1 ~ ${maxHours} 사이의 정수여야 합니다.`);
  }
  return value;
}