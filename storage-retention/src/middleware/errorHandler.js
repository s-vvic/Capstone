// 모든 오류를 ICD 8장 형식의 JSON으로 바꿔서 응답
// ⚠ 임시본: Component 1의 errorHandler.js를 받으면 그 파일로 교체
import { AppError } from '../errors/AppError.js';

export function errorHandler(err, req, res, next) {
  // 우리가 일부러 던진 오류 (400, 401, 404 ...)
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  // 요청 본문 JSON 문법이 틀린 경우
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'JSON 형식이 올바르지 않습니다.' } });
  }

  // 예상하지 못한 오류 → 터미널에 자세히 찍고, 응답에는 내부 정보를 숨김
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: '서버 내부 오류가 발생했습니다.' } });
}