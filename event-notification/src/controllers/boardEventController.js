import { eventService } from '../services/eventService.js';

export class BoardEventController {
  /**
   * 보드 이벤트 보고 수신 (ICD_v2 3.3.1)
   * POST /events/report
   */
  async reportEvent(req, res, next) {
    try {
      const event = await eventService.reportEvent(req.body);
      res.status(201).json({
        message: '이벤트가 성공적으로 접수되었습니다.',
        event_id: event.event_id,
        device_id: event.device_id,
        status: event.status,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const boardEventController = new BoardEventController();
