import { deviceService } from "../services/deviceService.js";
export const deviceController = {
  async list(req, res, next) {
    try {
      res.json(await deviceService.listDevices(req.user.userId));
    } catch (e) {
      next(e);
    }
  },
  async register(req, res, next) {
    try {
      res
        .status(201)
        .json(await deviceService.registerDevice(req.user.userId, req.body));
    } catch (e) {
      next(e);
    }
  },
  async getStatus(req, res, next) {
    try {
      res.json(
        await deviceService.getDeviceStatus(req.params.mac, req.user.userId),
      );
    } catch (e) {
      next(e);
    }
  },
  async update(req, res, next) {
    try {
      res.json(
        await deviceService.updateDevice(
          req.params.mac,
          req.user.userId,
          req.body,
        ),
      );
    } catch (e) {
      next(e);
    }
  },
};
