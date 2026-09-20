import { ERROR_CODES } from '../constants/errorCodes.js';

/**
 * ICD 8.0 표준 오류 처리를 위한 커스텀 애플리케이션 에러 클래스
 */
export class AppError extends Error {
  /**
   * @param {string} code - ERROR_CODES의 키 (예: 'INVALID_CREDENTIALS')
   * @param {string} [customMessage] - 커스텀 에러 메시지
   * @param {string} [customAction] - 해결 가이드/조치사항
   * @param {any} [details] - 추가 디버그 정보
   */
  constructor(code, customMessage, customAction, details = null) {
    const errorDef = ERROR_CODES[code] || ERROR_CODES.INTERNAL_SERVER_ERROR;
    super(customMessage || errorDef.defaultMessage);

    this.name = 'AppError';
    this.status = errorDef.status;
    this.code = errorDef.code;
    this.action = customAction || errorDef.action;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, action, details) {
    return new AppError('BAD_REQUEST', message, action, details);
  }

  static invalidCredentials(message, action) {
    return new AppError('INVALID_CREDENTIALS', message, action);
  }

  static unauthorized(message, action) {
    return new AppError('UNAUTHORIZED', message, action);
  }

  static forbidden(message, action) {
    return new AppError('FORBIDDEN', message, action);
  }

  static notFound(message, action) {
    return new AppError('NOT_FOUND', message, action);
  }

  static conflict(message, action) {
    return new AppError('CONFLICT', message, action);
  }

  static tooManyRequests(message, action) {
    return new AppError('TOO_MANY_REQUESTS', message, action);
  }

  static internal(message, action, details) {
    return new AppError('INTERNAL_SERVER_ERROR', message, action, details);
  }
}
