import { sessionService } from '../services/sessionService.js';

export const sessionController = {
  /**
   * 다중 기기 로그인 현황 목록 조회 (GET /auth/sessions, SV-F-004)
   */
  async getSessions(req, res, next) {
    try {
      const result = await sessionService.getActiveSessions({
        userId: req.user.userId,
        currentSessionId: req.session.sessionId,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 특정 기기 강제 로그아웃 (DELETE /auth/sessions/:sessionId, SV-F-004)
   */
  async revokeSession(req, res, next) {
    try {
      const { sessionId } = req.params;
      const result = await sessionService.revokeSession({
        userId: req.user.userId,
        targetSessionId: sessionId,
        currentSessionId: req.session.sessionId,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 다른 모든 기기 일괄 로그아웃 (DELETE /auth/sessions/other, SV-F-004)
   */
  async revokeAllOtherSessions(req, res, next) {
    try {
      const result = await sessionService.revokeAllOtherSessions({
        userId: req.user.userId,
        currentSessionId: req.session.sessionId,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
