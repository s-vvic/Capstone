import { ptzService } from '../services/ptzService.js';

export const ptzController = {
  /**
   * PTZ 제어 명령 전달 (POST /devices/:deviceId/ptz, ICD 3.4.1, WC-F-033)
   */
  async controlPtz(req, res, next) {
    try {
      const userId = req.user?.userId;
      const { deviceId } = req.params;
      const { action, speed, zoom_scale } = req.body;

      const result = await ptzService.executePtzCommand(deviceId, userId, {
        action,
        speed,
        zoom_scale,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};
