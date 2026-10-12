export function errorHandler(err, req, res, next) {
  const httpStatus = err.httpStatus || err.status || 500;
  const errorCode = err.errorCode || err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || '서버 내부 오류가 발생했습니다.';

  const responseBody = {
    error: {
      code: errorCode,
      message,
    },
  };

  if (err.details) {
    responseBody.error.details = err.details;
  }

  res.status(httpStatus).json(responseBody);
}

export function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `요청하신 경로를 찾을 수 없습니다: ${req.method} ${req.originalUrl}`,
    },
  });
}
