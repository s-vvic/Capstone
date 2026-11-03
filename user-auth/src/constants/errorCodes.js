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
  INVALID_CREDENTIALS: {
    status: 400,
    code: 'INVALID_CREDENTIALS',
    defaultMessage: '이메일 또는 비밀번호 불일치',
    action: '이메일과 비밀번호를 다시 확인하세요.',
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
    defaultMessage: '접근 권한 없음',
    action: '계정 권한 및 구독 플랜을 확인하세요.',
  },
  NOT_FOUND: {
    status: 404,
    code: 'NOT_FOUND',
    defaultMessage: '리소스를 찾을 수 없음',
    action: '요청한 식별자(ID) 또는 경로를 확인하세요.',
  },
  CONFLICT: {
    status: 409,
    code: 'CONFLICT',
    defaultMessage: '중복 데이터 (이메일 등)',
    action: '데이터 중복 여부를 확인하세요.',
  },
  INVALID_VERIFICATION_CODE: {
    status: 400,
    code: 'INVALID_VERIFICATION_CODE',
    defaultMessage: '인증 코드가 유효하지 않거나 만료되었습니다.',
    action: '인증 코드를 다시 발송받아 입력해주세요.',
  },
  USER_NOT_FOUND: {
    status: 404,
    code: 'USER_NOT_FOUND',
    defaultMessage: '등록되지 않은 이메일 계정입니다.',
    action: '가입된 이메일인지 확인하거나 회원가입을 진행하세요.',
  },
  SESSION_NOT_FOUND: {
    status: 404,
    code: 'SESSION_NOT_FOUND',
    defaultMessage: '존재하지 않거나 이미 만료된 세션입니다.',
    action: '세션 목록을 새로고침하세요.',
  },
  INVALID_PASSWORD: {
    status: 400,
    code: 'INVALID_PASSWORD',
    defaultMessage: '비밀번호가 일치하지 않습니다.',
    action: '비밀번호를 다시 확인해주세요.',
  },
  TOO_MANY_REQUESTS: {
    status: 429,
    code: 'TOO_MANY_REQUESTS',
    defaultMessage: '로그인 시도 횟수 초과',
    action: '보안을 위해 일정 시간(15분) 후 재시도하세요.',
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
