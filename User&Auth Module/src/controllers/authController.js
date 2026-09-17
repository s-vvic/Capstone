import { authService } from '../services/authService.js';
import { accountService } from '../services/accountService.js';

export const authController = {
  /**
   * 회원가입 (POST /auth/register, ICD 2.1.3)
   */
  async register(req, res, next) {
    try {
      const { email, password, name, plan } = req.body;
      const result = await authService.register({ email, password, name, plan });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 로그인 (POST /auth/login, ICD 2.1.1)
   */
  async login(req, res, next) {
    try {
      const {
        email,
        password,
        auto_login,
        device_name,
        device_type,
        deviceName,
        deviceType,
      } = req.body || {};
      const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const result = await authService.login({
        email,
        password,
        auto_login,
        clientIp,
        userAgent,
        deviceName: device_name || deviceName,
        deviceType: device_type || deviceType,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 로그아웃 (POST /auth/logout, ICD 2.1.2)
   */
  async logout(req, res, next) {
    try {
      const tokenJti = req.session?.tokenJti;
      const sessionId = req.session?.sessionId;
      const result = await authService.logout({ tokenJti, sessionId });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 자동 로그인 토큰 갱신 (POST /auth/refresh, SV-F-003)
   */
  async refresh(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      const result = await authService.refreshToken(token);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 내 정보 조회 (GET /auth/me)
   */
  async getMe(req, res, next) {
    try {
      const result = await accountService.getProfile(req.user.userId);
      res.status(200).json({
        ...result,
        current_session: req.session,
      });
    } catch (error) {
      next(error);
    }
  },
};
