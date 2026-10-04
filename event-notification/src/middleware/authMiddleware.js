import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

export function authenticate(req, res, next) {
  // 1. Authorization: Bearer {token} 헤더 확인
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      return next(AppError.unauthorized('인증 토큰이 유효하지 않거나 만료되었습니다.'));
    }
  }

  // 2. 개발 및 테스트 환경용 x-user-id 헤더 fallback (비프로덕션 환경)
  if (env.NODE_ENV !== 'production' && req.headers['x-user-id']) {
    req.user = {
      userId: req.headers['x-user-id'],
      user_id: req.headers['x-user-id'],
      email: 'test@securecam.com',
      name: '테스트사용자',
    };
    return next();
  }

  return next(AppError.unauthorized('인증 토큰이 필요합니다.'));
}
