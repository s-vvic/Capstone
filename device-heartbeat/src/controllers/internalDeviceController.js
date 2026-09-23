import { heartbeatService } from '../services/heartbeatService.js';

export const internalDeviceController = {
  /**
   * 보드 최초 부팅 시 프로비저닝 요청 (POST /devices/provision-by-serial, ICD 3.1.1)
   */
  async provision(req, res, next) {
    try {
      const result = await heartbeatService.provisionBySerial(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 보드 30초 주기 Heartbeat 수신 (POST /devices/heartbeat, ICD 3.2.1)
   * 정상 수신 시 204 No Content 반환
   */
  async heartbeat(req, res, next) {
    try {
      await heartbeatService.processHeartbeat(req.body);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
