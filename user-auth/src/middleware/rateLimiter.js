import { loginAttemptRepository } from '../repositories/index.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

/**
 * 로그인 요청 Brute-force 차단 미들웨어 (ICD 2.1.1 429 TOO_MANY_REQUESTS, NF-S-005)
 */
export async function loginRateLimiter(req, res, next) {
  try {
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : '';
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

    if (!email) {
      return next();
    }

    const failedCount = await loginAttemptRepository.getRecentFailedAttempts(
      email,
      clientIp,
      env.LOGIN_LOCKOUT_WINDOW_MINUTES
    );

    if (failedCount >= env.LOGIN_MAX_FAILED_ATTEMPTS) {
      logger.security('LOGIN_RATE_LIMIT_EXCEEDED', {
        email,
        ip: clientIp,
        failedCount,
        reason: `${env.LOGIN_MAX_FAILED_ATTEMPTS}회 로그인 실패 초과 차단`,
      });

      return next(
        AppError.tooManyRequests(
          `로그인 시도 횟수를 초과했습니다. ${env.LOGIN_LOCKOUT_WINDOW_MINUTES}분 후 다시 시도하세요.`,
          '잠시 후 다시 로그인하거나 비밀번호 찾기를 이용하세요.'
        )
      );
    }

    next();
  } catch (error) {
    next(error);
  }
}
