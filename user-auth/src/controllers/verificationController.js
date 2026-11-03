import { verificationService } from '../services/verificationService.js';

export const verificationController = {
  /**
   * 인증 코드 발송 요청 (POST /auth/send-verification-code, SV-F-007)
   */
  async sendCode(req, res, next) {
    try {
      const { email, phone, phone_number, target, type } = req.body || {};
      const targetValue = email || phone || phone_number || target;
      const result = await verificationService.sendVerificationCode({
        target: targetValue,
        type: type || 'signup',
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 인증 코드 검증 (POST /auth/verify-code, SV-F-007)
   */
  async verifyCode(req, res, next) {
    try {
      const { email, phone, phone_number, target, code, verification_code, type } = req.body || {};
      const targetValue = email || phone || phone_number || target;
      const codeValue = code || verification_code;
      const result = await verificationService.verifyCode({
        target: targetValue,
        code: codeValue,
        type: type || 'signup',
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
