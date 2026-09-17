import { planService } from '../services/planService.js';

export const planController = {
  /**
   * 내 구독 플랜 조회 (GET /auth/plan, SV-F-005)
   */
  async getMyPlan(req, res, next) {
    try {
      const result = await planService.getUserPlan(req.user.userId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 전체 구독 플랜 및 혜택 비교 조회 (GET /auth/plan/tiers, WEB-F-061)
   */
  async getAllPlans(req, res, next) {
    try {
      const result = planService.getAllPlanTiers();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 구독 플랜 변경 (PATCH /auth/plan, SV-F-005, WEB-F-061)
   */
  async changePlan(req, res, next) {
    try {
      const { plan } = req.body;
      const result = await planService.changePlan(req.user.userId, plan);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
