import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "../constants/errorCodes.js";

/**
 * JWT Bearer 인증 미들웨어
 * 개발 및 테스트 모드에서는 x-user-id 헤더를 통한 모의 인증 지원
 */
export function authenticate(req, res, next) {
  // 1. 테스트 / 개발 모드 x-user-id 헤더 지원
  if (
    !req.headers.authorization &&
    config.nodeEnv !== "production" &&
    req.headers["x-user-id"]
  ) {
    req.user = {
      userId: req.headers["x-user-id"],
      user_id: req.headers["x-user-id"],
      email: req.headers["x-user-email"] || "test@securecam.com",
      role: req.headers["x-user-role"] || "user",
    };
    return next();
  }

  // 2. Authorization Header 확인
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      AppError.unauthorized(
        "인증 토큰이 누락되었습니다.",
        ERROR_CODES.UNAUTHORIZED,
      ),
    );
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const userId = decoded.sub || decoded.userId || decoded.user_id;

    if (!userId) {
      return next(
        AppError.unauthorized(
          "유효하지 않은 토큰입니다.",
          ERROR_CODES.INVALID_TOKEN,
        ),
      );
    }

    req.user = {
      userId,
      user_id: userId,
      email: decoded.email,
      name: decoded.name,
      plan: decoded.plan,
      role: decoded.role || "user",
    };

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(
        AppError.unauthorized(
          "토큰이 만료되었습니다.",
          ERROR_CODES.EXPIRED_TOKEN,
        ),
      );
    }
    return next(
      AppError.unauthorized(
        "유효하지 않은 토큰입니다.",
        ERROR_CODES.INVALID_TOKEN,
      ),
    );
  }
}

/**
 * 선택적 인증 (토큰이 없어도 에러를 내지 않고 req.user만 비움)
 */
export function optionalAuthenticate(req, res, next) {
  if (req.headers.authorization || req.headers["x-user-id"]) {
    return authenticate(req, res, next);
  }
  req.user = null;
  next();
}
