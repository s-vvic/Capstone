import { ERROR_CODES } from '../constants/errorCodes.js';

export class AppError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.status = statusCode;
    this.httpStatus = statusCode;
    this.code = code;
    this.errorCode = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = '잘못된 요청입니다.', details = null) {
    return new AppError(400, ERROR_CODES.BAD_REQUEST, message, details);
  }

  static unauthorized(message = '인증이 필요합니다.', code = ERROR_CODES.UNAUTHORIZED) {
    return new AppError(401, code, message);
  }

  static forbidden(message = '접근 권한이 없습니다.', code = ERROR_CODES.FORBIDDEN) {
    return new AppError(403, code, message);
  }

  static notFound(message = '요청한 리소스를 찾을 수 없습니다.', code = ERROR_CODES.NOT_FOUND) {
    return new AppError(404, code, message);
  }

  static conflict(message = '리소스 충돌이 발생했습니다.', code = ERROR_CODES.CONFLICT) {
    return new AppError(409, code, message);
  }

  static internal(message = '서버 내부 오류가 발생했습니다.') {
    return new AppError(500, ERROR_CODES.INTERNAL_ERROR, message);
  }
}
