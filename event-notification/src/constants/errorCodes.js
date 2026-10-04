/**
 * ICD_v2 제8장 공통 오류 코드 정의
 */
export const ERROR_CODES = {
  BAD_REQUEST: {
    httpStatus: 400,
    errorCode: 'BAD_REQUEST',
    message: '요청 파라미터가 올바르지 않습니다.',
  },
  UNAUTHORIZED: {
    httpStatus: 401,
    errorCode: 'UNAUTHORIZED',
    message: '인증 토큰이 없거나 만료되었습니다.',
  },
  FORBIDDEN: {
    httpStatus: 403,
    errorCode: 'FORBIDDEN',
    message: '접근 권한이 없습니다.',
  },
  NOT_FOUND: {
    httpStatus: 404,
    errorCode: 'NOT_FOUND',
    message: '리소스를 찾을 수 없습니다.',
  },
  CONFLICT: {
    httpStatus: 409,
    errorCode: 'CONFLICT',
    message: '중복된 데이터가 존재합니다.',
  },
  TOO_MANY_REQUESTS: {
    httpStatus: 429,
    errorCode: 'TOO_MANY_REQUESTS',
    message: '요청 횟수를 초과했습니다.',
  },
  INTERNAL_SERVER_ERROR: {
    httpStatus: 500,
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: '서버 내부 오류가 발생했습니다.',
  },
  SERVICE_UNAVAILABLE: {
    httpStatus: 503,
    errorCode: 'SERVICE_UNAVAILABLE',
    message: '서버 점검 중입니다.',
  },
};
