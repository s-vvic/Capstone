import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * ICD 8.0 공통 오류 규격 응답 핸들러
 */
export function errorHandler(err, req, res, next) {
  let appError = err;

  // AppError가 아닌 일반 Error나 기타 예외 처리
  if (!(err instanceof AppError)) {
    logger.error(`[UnhandledError] ${err.message}`, err, {
      path: req.originalUrl,
      method: req.method,
    });
    appError = AppError.internal('서버 내부 오류가 발생했습니다.');
  } else {
    logger.warn(`[ClientError] [${appError.code}] ${appError.message} (${req.method} ${req.originalUrl})`);
  }

  const responseBody = {
    code: appError.code,
    message: appError.message,
    action: appError.action,
  };

  if (appError.details && env.NODE_ENV === 'development') {
    responseBody.details = appError.details;
  }

  res.status(appError.status).json(responseBody);
}

/**
 * 404 Not Found 핸들러
 */
export function notFoundHandler(req, res, next) {
  const notFoundError = AppError.notFound(
    `요청한 경로 '${req.originalUrl}'를 찾을 수 없습니다.`,
    '요청 URL 및 메서드를 확인하세요.'
  );
  next(notFoundError);
}
