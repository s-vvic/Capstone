// ICD 8장 공통 오류 코드
// ⚠ 임시본: Component 1의 errorCodes.js를 받으면 그 파일로 교체
export const ERROR_CODES = Object.freeze({
  BAD_REQUEST:           { status: 400, code: 'BAD_REQUEST' },
  UNAUTHORIZED:          { status: 401, code: 'UNAUTHORIZED' },
  FORBIDDEN:             { status: 403, code: 'FORBIDDEN' },
  NOT_FOUND:             { status: 404, code: 'NOT_FOUND' },
  CONFLICT:              { status: 409, code: 'CONFLICT' },
  TOO_MANY_REQUESTS:     { status: 429, code: 'TOO_MANY_REQUESTS' },
  INTERNAL_SERVER_ERROR: { status: 500, code: 'INTERNAL_SERVER_ERROR' },
  SERVICE_UNAVAILABLE:   { status: 503, code: 'SERVICE_UNAVAILABLE' },
});