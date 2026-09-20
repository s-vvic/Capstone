import { AppError } from '../errors/AppError.js';
import { passwordUtil } from '../utils/password.js';

export const validator = {
  /**
   * 회원가입 입력값 검증 (ICD 2.1.3)
   */
  validateRegister(req, res, next) {
    const { email, password, name } = req.body || {};

    if (!email || typeof email !== 'string') {
      return next(AppError.badRequest('이메일을 입력해주세요.'));
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return next(AppError.badRequest('유효한 이메일 형식이 아닙니다.'));
    }

    if (!password) {
      return next(AppError.badRequest('비밀번호를 입력해주세요.'));
    }
    const pwValidation = passwordUtil.validate(password);
    if (!pwValidation.valid) {
      return next(AppError.badRequest(pwValidation.message));
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return next(AppError.badRequest('이름을 입력해주세요.'));
    }

    next();
  },

  /**
   * 로그인 입력값 검증 (ICD 2.1.1)
   */
  validateLogin(req, res, next) {
    const { email, password } = req.body || {};

    if (!email || typeof email !== 'string') {
      return next(AppError.invalidCredentials('이메일을 입력해주세요.'));
    }
    if (!password || typeof password !== 'string') {
      return next(AppError.invalidCredentials('비밀번호를 입력해주세요.'));
    }

    next();
  },

  /**
   * 비밀번호 재설정 요청 검증 (SV-F-002)
   */
  validateForgotPassword(req, res, next) {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return next(AppError.badRequest('이메일을 입력해주세요.'));
    }
    next();
  },

  /**
   * 비밀번호 재설정 실행 검증 (SV-F-002)
   */
  validateResetPassword(req, res, next) {
    const { reset_token, new_password } = req.body || {};
    if (!reset_token) {
      return next(AppError.badRequest('재설정 토큰(reset_token)이 필요합니다.'));
    }
    if (!new_password) {
      return next(AppError.badRequest('새 비밀번호(new_password)를 입력해주세요.'));
    }
    const pwValidation = passwordUtil.validate(new_password);
    if (!pwValidation.valid) {
      return next(AppError.badRequest(pwValidation.message));
    }
    next();
  },
};
