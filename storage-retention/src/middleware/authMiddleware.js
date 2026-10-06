// JWT 확인 미들웨어: 통과하면 req.user.userId 에 로그인한 사용자 ID가 들어감
// ⚠ 임시본: Component 1의 authMiddleware.js를 받으면 그 파일로 교체
//    (교체 후 req.user 안의 필드 이름이 userId 인지 꼭 확인)
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';

export function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new AppError(ERROR_CODES.UNAUTHORIZED, '인증 토큰이 없습니다.'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { userId: payload.user_id ?? payload.userId ?? payload.sub };
    next();
  } catch {
    next(new AppError(ERROR_CODES.UNAUTHORIZED, '토큰이 유효하지 않거나 만료되었습니다.'));
  }
}