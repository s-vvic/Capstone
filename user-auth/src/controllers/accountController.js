import { accountService } from '../services/accountService.js';

export const accountController = {
  /**
   * 아이디 찾기 (POST /auth/find-id, SV-F-002, ICD 2.1.4)
   */
  async findId(req, res, next) {
    try {
      const { name, phone_number, phone, verification_code } = req.body || {};
      const result = await accountService.findId({
        name,
        phone_number,
        phone,
        verification_code,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 비밀번호 찾기/재설정 요청 (POST /auth/forgot-password, SV-F-002, SV-F-007)
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body || {};
      const result = await accountService.requestPasswordReset({ email });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 비밀번호 재설정 실행 (POST /auth/reset-password, SV-F-002, SV-F-007, ICD 2.1.5)
   */
  async resetPassword(req, res, next) {
    try {
      const { email, verification_code, reset_token, resetToken, new_password, newPassword } =
        req.body || {};
      const result = await accountService.resetPassword({
        email,
        verification_code,
        resetToken: reset_token || resetToken,
        newPassword: new_password || newPassword,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 비밀번호 직접 변경 (PATCH /auth/password, WEB-F-060, APP-F-061)
   */
  async changePassword(req, res, next) {
    try {
      const { current_password, new_password } = req.body;
      const result = await accountService.changePassword({
        userId: req.user.userId,
        currentPassword: current_password,
        newPassword: new_password,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 프로필 수정 (PATCH /auth/profile, WEB-F-060)
   */
  async updateProfile(req, res, next) {
    try {
      const { name } = req.body;
      const result = await accountService.updateProfile(req.user.userId, { name });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 회원 탈퇴 (DELETE /auth/account, SV-F-006, ICD 2.1.7)
   */
  async deleteAccount(req, res, next) {
    try {
      const { password, reason } = req.body || {};
      const result = await accountService.deleteAccount({
        userId: req.user.userId,
        password,
        reason,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
