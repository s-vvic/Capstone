import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  let httpStatus = 500;
  let errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR.errorCode;
  let message = ERROR_CODES.INTERNAL_SERVER_ERROR.message;
  let details = null;

  if (err instanceof AppError) {
    httpStatus = err.httpStatus;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  } else if (err.type === 'entity.parse.failed') {
    httpStatus = 400;
    errorCode = ERROR_CODES.BAD_REQUEST.errorCode;
    message = '요청 본문의 JSON 형식이 잘못되었습니다.';
  } else {
    logger.error('Unhandled internal server error', {
      error: err.message,
      stack: err.stack,
    });
  }

  const responseBody = {
    error: {
      code: errorCode,
      message,
    },
  };

  if (details) {
    responseBody.error.details = details;
  }

  res.status(httpStatus).json(responseBody);
}

export function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: {
      code: ERROR_CODES.NOT_FOUND.errorCode,
      message: `요청하신 경로를 찾을 수 없습니다: ${req.method} ${req.originalUrl}`,
    },
  });
}
