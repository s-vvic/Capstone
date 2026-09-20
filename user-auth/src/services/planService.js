import { userRepository, sessionRepository } from '../repositories/index.js';
import { PLAN_TIERS, getPlanDetails, isValidPlan } from '../config/plans.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export class PlanService {
  /**
   * 사용자 현재 플랜 및 혜택 조회 (SV-F-005)
   */
  async getUserPlan(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('사용자를 찾을 수 없습니다.');
    }

    const planDetails = getPlanDetails(user.plan);
    const activeSessionsCount = await sessionRepository.countActiveByUserId(userId);

    return {
      user_id: user.user_id,
      current_plan: user.plan,
      plan_details: planDetails,
      usage: {
        active_sessions: activeSessionsCount,
        max_concurrent_sessions: planDetails.maxConcurrentSessions,
      },
    };
  }

  /**
   * 전체 구독 플랜 목록 및 비교 정보 조회 (WEB-F-061)
   */
  getAllPlanTiers() {
    return {
      tiers: Object.values(PLAN_TIERS),
    };
  }

  /**
   * 구독 플랜 변경 (SV-F-005, WEB-F-061)
   */
  async changePlan(userId, newPlanCode) {
    if (!isValidPlan(newPlanCode)) {
      throw AppError.badRequest('유효한 구독 플랜(basic, standard, premium)을 선택해주세요.');
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('사용자를 찾을 수 없습니다.');
    }

    if (user.plan === newPlanCode) {
      throw AppError.badRequest('이미 해당 플랜을 이용 중입니다.');
    }

    const updated = await userRepository.update(userId, { plan: newPlanCode });
    const newDetails = getPlanDetails(newPlanCode);

    logger.info(`[Plan] 사용자 구독 플랜 변경 완료: ${user.email} (${user.plan} -> ${newPlanCode})`);

    return {
      success: true,
      message: `${newDetails.name} 플랜으로 성공적으로 변경되었습니다.`,
      user_id: updated.user_id,
      plan: updated.plan,
      plan_details: newDetails,
    };
  }

  /**
   * 플랜 기능 권한 확인 (미들웨어 및 비즈니스 로직용)
   */
  async checkFeatureAccess(userId, featureKey) {
    const user = await userRepository.findById(userId);
    if (!user) return false;

    const planDetails = getPlanDetails(user.plan);
    return Boolean(planDetails.features[featureKey]);
  }
}

export const planService = new PlanService();
