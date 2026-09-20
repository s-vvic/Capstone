import { accountService } from '../services/accountService.js';

export const accountController = {
  /**
   * 아이디 찾기 (POST /auth/find-id, SV-F-002)
   */
  async findId(req, res, next) {
    try {
      const { name } = req.body;
      const result = await accountService.findId({ name });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 비밀번호 찾기/재설정 요청 (POST /auth/forgot-password, SV-F-002)
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await accountService.requestPasswordReset({ email });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 비밀번호 재설정 실행 (POST /auth/reset-password, SV-F-002)
   */
  async resetPassword(req, res, next) {
    try {
      const { reset_token, new_password } = req.body;
      const result = await accountService.resetPassword({
        resetToken: reset_token,
        newPassword: new_password,
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
   * 회원 탈퇴 (DELETE /auth/account, WEB-F-060)
   */
  async deleteAccount(req, res, next) {
    try {
      const { password } = req.body;
      const result = await accountService.deleteAccount({
        userId: req.user.userId,
        password,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
