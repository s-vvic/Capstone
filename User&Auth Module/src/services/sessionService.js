import { sessionRepository, userRepository } from '../repositories/index.js';
import { getPlanDetails } from '../config/plans.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export class SessionService {
  /**
   * 다중 기기 로그인 현황 조회 (SV-F-004)
   */
  async getActiveSessions({ userId, currentSessionId }) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('사용자를 찾을 수 없습니다.');
    }

    const planInfo = getPlanDetails(user.plan);
    const sessions = await sessionRepository.findActiveByUserId(userId);

    const formatted = sessions.map((s) => ({
      session_id: s.session_id,
      device_name: s.device_name,
      device_type: s.device_type,
      client_ip: s.client_ip,
      is_current: s.session_id === currentSessionId,
      is_auto_login: s.is_auto_login,
      last_active_at: s.last_active_at,
      created_at: s.created_at,
      expires_at: s.expires_at,
    }));

    return {
      user_id: userId,
      plan: user.plan,
      max_allowed_sessions: planInfo.maxConcurrentSessions,
      active_count: formatted.length,
      sessions: formatted,
    };
  }

  /**
   * 특정 기기 강제 로그아웃 (SV-F-004)
   */
  async revokeSession({ userId, targetSessionId, currentSessionId }) {
    const session = await sessionRepository.findById(targetSessionId);
    if (!session) {
      throw AppError.notFound('해당 세션을 찾을 수 없습니다.');
    }

    if (session.user_id !== userId) {
      throw AppError.forbidden('자신의 로그인 세션만 종료할 수 있습니다.');
    }

    await sessionRepository.deactivate(targetSessionId);

    const isCurrent = targetSessionId === currentSessionId;
    logger.info(`[Session] 기기 강제 로그아웃 완료: ${targetSessionId} (현재 기기 여부: ${isCurrent})`);

    return {
      success: true,
      message: '해당 기기의 세션이 강제 종료(로그아웃)되었습니다.',
      target_session_id: targetSessionId,
      is_current_session: isCurrent,
    };
  }

  /**
   * 현재 기기를 제외한 다른 모든 기기 강제 로그아웃 (SV-F-004)
   */
  async revokeAllOtherSessions({ userId, currentSessionId }) {
    const count = await sessionRepository.deactivateAllOtherSessions(userId, currentSessionId);
    logger.info(`[Session] 다른 기기 일괄 로그아웃 완료: ${count}개 세션 종료`);

    return {
      success: true,
      message: `다른 모든 기기(${count}대)에서 로그아웃되었습니다.`,
      revoked_count: count,
    };
  }
}

export const sessionService = new SessionService();
