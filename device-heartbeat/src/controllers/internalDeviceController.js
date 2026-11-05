import { heartbeatService } from "../services/heartbeatService.js";
export const internalDeviceController = {
  async provision(req, res, next) {
    try {
      res.json(
        await heartbeatService.provisionByMac(
          req.body,
          req.socket.remoteAddress,
          req.app.locals.provisionBoard,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
  async heartbeat(req, res, next) {
    try {
      res.json(
        await heartbeatService.processHeartbeat(
          req.body,
          req.socket.remoteAddress,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
};
