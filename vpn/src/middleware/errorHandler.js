import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof AppError) {
    const responsePayload = {
      error: {
        code: err.code,
        message: err.message,
      },
    };
    if (err.details) {
      responsePayload.error.details = err.details;
    }
    return res.status(err.statusCode).json(responsePayload);
  }

  logger.error(`[Unhandled Error] ${err.message}`, err.stack);

  return res.status(500).json({
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: '서버 내부 오류가 발생했습니다.',
    },
  });
}
