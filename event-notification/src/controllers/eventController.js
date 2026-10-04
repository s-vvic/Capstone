import { eventService } from '../services/eventService.js';

export class EventController {
  /**
   * 이벤트 목록 조회 (ICD_v2 2.3.1, WEB-F-030, APP-F-030)
   * GET /events
   */
  async listEvents(req, res, next) {
    try {
      const userId = req.user.userId || req.user.user_id;
      const result = await eventService.getEvents(userId, req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 이벤트 상세 및 상태 처리 (ICD_v2 2.3.2, WEB-F-031, APP-F-033)
   * PATCH /events/:eventId
   */
  async updateEvent(req, res, next) {
    try {
      const userId = req.user.userId || req.user.user_id;
      const { eventId } = req.params;
      const updated = await eventService.updateEventStatus(userId, eventId, req.body);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 이벤트 다중/일괄 확인 처리 (WEB-F-033, APP-F-034)
   * PATCH /events/batch
   */
  async batchConfirm(req, res, next) {
    try {
      const userId = req.user.userId || req.user.user_id;
      const { event_ids } = req.body;
      const result = await eventService.batchConfirmEvents(userId, event_ids);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * 대시보드 통계 요약 (WEB-F-001, WEB-F-004, APP-F-002)
   * GET /events/summary
   */
  async getSummary(req, res, next) {
    try {
      const userId = req.user.userId || req.user.user_id;
      const summary = await eventService.getSummary(userId);
      res.status(200).json(summary);
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();
