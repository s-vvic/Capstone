import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

/**
 * JWT 보안 토큰 유틸리티 (NF-S-003, ICD 1.3: 1년 525,600분 유효기간 지원)
 */
export const jwtUtil = {
  /**
   * 고유 세션 JTI(JWT ID) 생성
   */
  generateJti() {
    return crypto.randomUUID();
  },

  /**
   * ISO 8601 형식 만료일 계산
   * @param {boolean} isAutoLogin - SV-F-003 자동 로그인 여부
   */
  getExpirationDate(isAutoLogin = false) {
    const now = new Date();
    if (isAutoLogin) {
      // ICD 1.3: 1년 (525,600분)
      now.setMinutes(now.getMinutes() + env.JWT_EXPIRES_IN_MINUTES);
    } else {
      // 일반 로그인: 기본 24시간
      now.setHours(now.getHours() + 24);
    }
    return now.toISOString();
  },

  /**
   * JWT Access Token 발급
   * @param {object} payload - { userId, email, name, plan, jti, isAutoLogin }
   * @param {boolean} isAutoLogin - 자동 로그인 여부
   */
  generateToken(payload, isAutoLogin = false) {
    const jti = payload.jti || this.generateJti();
    const expiresIn = isAutoLogin ? env.JWT_EXPIRES_IN : env.JWT_NORMAL_EXPIRES_IN;

    const tokenPayload = {
      sub: payload.userId,
      email: payload.email,
      name: payload.name,
      plan: payload.plan,
      jti,
      is_auto_login: Boolean(isAutoLogin),
    };

    const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
      algorithm: env.JWT_ALGORITHM,
      expiresIn,
    });

    return { token, jti };
  },

  /**
   * JWT 토큰 검증
   * @param {string} token
   * @returns {object} decoded payload
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, env.JWT_SECRET, {
        algorithms: [env.JWT_ALGORITHM],
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw AppError.unauthorized('인증 토큰이 만료되었습니다.', '다시 로그인하세요.');
      }
      throw AppError.unauthorized('유효하지 않은 인증 토큰입니다.', '올바른 토큰을 전송하세요.');
    }
  },

  /**
   * 토큰 디코딩 (검증 없이 페이로드 확인용)
   */
  decodeToken(token) {
    return jwt.decode(token);
  },
};
