import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

/**
 * JWT Bearer 인증 미들웨어 (NF-S-003, ICD 1.3)
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    // 테스트 및 개발 편의성을 위한 x-user-id 헤더 지원
    if (!authHeader && req.headers['x-user-id'] && env.NODE_ENV !== 'production') {
      req.user = {
        userId: req.headers['x-user-id'],
        email: 'dev@securecam.com',
        name: '개발자',
      };
      return next();
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('인증 헤더(Bearer Token)가 누락되었습니다.');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw AppError.unauthorized('인증 토큰이 유효하지 않습니다.');
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      userId: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      plan: decoded.plan,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error.name === 'TokenExpiredError') {
      return next(AppError.unauthorized('인증 토큰이 만료되었습니다.', '다시 로그인하세요.'));
    }
    return next(AppError.unauthorized('유효하지 않은 인증 토큰입니다.', '올바른 토큰을 전송하세요.'));
  }
}
