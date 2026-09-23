import { deviceService } from '../services/deviceService.js';

export const deviceController = {
  /**
   * 로그인 사용자의 등록 보드 전체 목록 조회 (GET /devices, ICD 2.2.1)
   */
  async list(req, res, next) {
    try {
      const userId = req.user.userId;
      const list = await deviceService.listDevices(userId);
      res.status(200).json(list);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 보드 등록 (POST /devices/register, ICD 2.2.2, SV-F-010)
   */
  async register(req, res, next) {
    try {
      const userId = req.user.userId;
      const result = await deviceService.registerDevice(userId, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 특정 보드의 현재 상세 상태 및 VPN 정보 조회 (GET /devices/:deviceId/status, ICD 2.2.3)
   */
  async getStatus(req, res, next) {
    try {
      const userId = req.user?.userId;
      const { deviceId } = req.params;
      const status = await deviceService.getDeviceStatus(deviceId, userId);
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 보드 이름, 설치 위치, 설명, 그룹 수정 (PATCH /devices/:deviceId, ICD 2.2.4, SV-F-012)
   */
  async update(req, res, next) {
    try {
      const userId = req.user?.userId;
      const { deviceId } = req.params;
      const updated = await deviceService.updateDevice(deviceId, userId, req.body);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  },
};
