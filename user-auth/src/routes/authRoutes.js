import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { accountController } from '../controllers/accountController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { validator } from '../middleware/validator.js';

const router = Router();

// =============================================================================
// 인증 기본 API (ICD 2.1, SV-F-001)
// =============================================================================

// 회원가입 (POST /auth/register, ICD 2.1.3, SV-F-001)
router.post('/register', validator.validateRegister, authController.register);

// 로그인 (POST /auth/login, ICD 2.1.1, SV-F-001, SV-F-003)
router.post('/login', loginRateLimiter, validator.validateLogin, authController.login);

// 로그아웃 (POST /auth/logout, ICD 2.1.2, SV-F-001)
router.post('/logout', authenticate, authController.logout);

// 자동 로그인 토큰 갱신 및 세션 유지 (POST /auth/refresh, SV-F-003)
router.post('/refresh', authController.refresh);

// 현재 로그인 사용자 정보 조회 (GET /auth/me)
router.get('/me', authenticate, authController.getMe);

// =============================================================================
// 아이디/비밀번호 찾기 및 계정 관리 API (SV-F-002, WEB-F-060, APP-F-061)
// =============================================================================

// 아이디 찾기 (POST /auth/find-id, SV-F-002)
router.post('/find-id', accountController.findId);

// 비밀번호 찾기/재설정 링크 요청 (POST /auth/forgot-password, SV-F-002)
router.post('/forgot-password', validator.validateForgotPassword, accountController.forgotPassword);

// 비밀번호 재설정 실행 (POST /auth/reset-password, SV-F-002)
router.post('/reset-password', validator.validateResetPassword, accountController.resetPassword);

// 비밀번호 직접 변경 (PATCH /auth/password, WEB-F-060)
router.patch('/password', authenticate, accountController.changePassword);

// 프로필 수정 (PATCH /auth/profile, WEB-F-060)
router.patch('/profile', authenticate, accountController.updateProfile);

// 회원 탈퇴 (DELETE /auth/account, WEB-F-060)
router.delete('/account', authenticate, accountController.deleteAccount);

export default router;
