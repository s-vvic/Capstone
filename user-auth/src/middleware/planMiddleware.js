import { hasRequiredPlanLevel, getPlanDetails } from '../config/plans.js';
import { AppError } from '../errors/AppError.js';

/**
 * 특정 플랜 등급 이상 요구 미들웨어 (SV-F-005)
 * @param {string} requiredPlanCode - 'basic' | 'standard' | 'premium'
 */
export function requirePlan(requiredPlanCode) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('인증이 필요합니다.'));
    }

    const currentPlan = req.user.plan;
    if (!hasRequiredPlanLevel(currentPlan, requiredPlanCode)) {
      const current = getPlanDetails(currentPlan);
      const required = getPlanDetails(requiredPlanCode);
      return next(
        AppError.forbidden(
          `해당 기능은 ${required.name} 플랜 이상에서만 지원됩니다. (현재 플랜: ${current.name})`,
          '플랜을 업그레이드해주세요.'
        )
      );
    }

    next();
  };
}

/**
 * 플랜별 세부 기능 허용 여부 검증 미들웨어 (SV-F-005)
 * @param {string} featureKey - 'aiAlerts' | 'soundDetection' | 'ptzControl' etc.
 */
export function requireFeature(featureKey) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('인증이 필요합니다.'));
    }

    const currentPlan = req.user.plan;
    const planDetails = getPlanDetails(currentPlan);

    if (!planDetails.features[featureKey]) {
      return next(
        AppError.forbidden(
          `현재 이용 중인 ${planDetails.name} 플랜에서는 '${featureKey}' 기능을 지원하지 않습니다.`,
          '플랜 변경 페이지에서 상위 플랜으로 변경하세요.'
        )
      );
    }

    next();
  };
}
