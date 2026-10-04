import { ERROR_CODES } from '../constants/errorCodes.js';

export class AppError extends Error {
  constructor(errorDef = ERROR_CODES.INTERNAL_SERVER_ERROR, customMessage = null, details = null) {
    super(customMessage || errorDef.message);
    this.name = 'AppError';
    this.httpStatus = errorDef.httpStatus;
    this.errorCode = errorDef.errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details = null) {
    return new AppError(ERROR_CODES.BAD_REQUEST, message, details);
  }

  static unauthorized(message) {
    return new AppError(ERROR_CODES.UNAUTHORIZED, message);
  }

  static forbidden(message) {
    return new AppError(ERROR_CODES.FORBIDDEN, message);
  }

  static notFound(message) {
    return new AppError(ERROR_CODES.NOT_FOUND, message);
  }

  static conflict(message) {
    return new AppError(ERROR_CODES.CONFLICT, message);
  }

  static internal(message, details = null) {
    return new AppError(ERROR_CODES.INTERNAL_SERVER_ERROR, message, details);
  }
}
