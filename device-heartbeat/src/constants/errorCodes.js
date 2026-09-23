/**
 * ICD 8.0 공통 오류 코드 및 HTTP 상태 매핑 규격
 */
export const ERROR_CODES = {
  BAD_REQUEST: {
    status: 400,
    code: 'BAD_REQUEST',
    defaultMessage: '요청 파라미터 오류',
    action: '요청 형식 및 필수 입력값을 확인하세요.',
  },
  UNAUTHORIZED: {
    status: 401,
    code: 'UNAUTHORIZED',
    defaultMessage: '인증 토큰 없음 또는 만료',
    action: '재로그인 후 토큰을 갱신하세요.',
  },
  FORBIDDEN: {
    status: 403,
    code: 'FORBIDDEN',
    defaultMessage: '접근 권한 없음 (인증 토큰 불일치 등)',
    action: '계정 권한 확인 또는 재프로비저닝을 진행하세요.',
  },
  NOT_FOUND: {
    status: 404,
    code: 'NOT_FOUND',
    defaultMessage: '리소스를 찾을 수 없음',
    action: '보드 ID 또는 시리얼 번호를 확인하세요.',
  },
  CONFLICT: {
    status: 409,
    code: 'CONFLICT',
    defaultMessage: '중복 데이터 (시리얼 번호, 등록 코드 등)',
    action: '이미 등록된 보드인지 확인하세요.',
  },
  INTERNAL_SERVER_ERROR: {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    defaultMessage: '서버 내부 오류',
    action: '서버 로그를 확인하거나 관리자에게 문의하세요.',
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    code: 'SERVICE_UNAVAILABLE',
    defaultMessage: '서버 점검 중',
    action: '공지사항을 확인하세요.',
  },
};
