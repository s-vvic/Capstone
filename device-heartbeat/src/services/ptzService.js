import { deviceRepository } from '../repositories/index.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export const VALID_PTZ_ACTIONS = [
  'up',
  'down',
  'left',
  'right',
  'home',
  'zoom_in',
  'zoom_out',
  'stop',
];

export class PtzService {
  /**
   * PTZ 제어 명령 전달 (WC-F-033, ICD 3.4.1)
   */
  async executePtzCommand(deviceId, userId, { action, speed = 5, zoom_scale = 1.0 }) {
    if (!action || !VALID_PTZ_ACTIONS.includes(action)) {
      throw AppError.badRequest(
        `action은 다음 중 하나여야 합니다: ${VALID_PTZ_ACTIONS.join(', ')}`
      );
    }

    const numSpeed = parseInt(speed, 10);
    if (isNaN(numSpeed) || numSpeed < 1 || numSpeed > 10) {
      throw AppError.badRequest('speed는 1에서 10 사이의 정수여야 합니다.');
    }

    const numZoom = parseFloat(zoom_scale);
    if (isNaN(numZoom) || numZoom < 1.0 || numZoom > 10.0) {
      throw AppError.badRequest('zoom_scale은 1.0에서 10.0 사이의 실수여야 합니다.');
    }

    const device = await deviceRepository.findById(deviceId);
    if (!device) {
      throw AppError.notFound(`보드 ID '${deviceId}'를 찾을 수 없습니다.`);
    }

    if (userId && device.user_id && device.user_id !== userId) {
      throw AppError.forbidden('해당 보드의 PTZ를 제어할 권한이 없습니다.');
    }

    if (device.status !== 'online') {
      throw AppError.badRequest(
        '보드가 오프라인 상태입니다. 온라인 상태의 기기에서만 PTZ 명령을 수행할 수 있습니다.'
      );
    }

    logger.info(
      `[PTZ] 명령 중계 성공: ${deviceId} -> action=${action}, speed=${numSpeed}, zoom=${numZoom}`
    );

    return {
      success: true,
      device_id: deviceId,
      command: {
        action,
        speed: numSpeed,
        zoom_scale: numZoom,
      },
      relayed_at: new Date().toISOString(),
    };
  }
}

export const ptzService = new PtzService();
