import { AppError } from '../errors/AppError.js';
import { VALID_PTZ_ACTIONS } from '../services/ptzService.js';

export const validator = {
  /**
   * 보드 등록 요청 본문 검증 (ICD 2.2.2)
   */
  validateRegister(req, res, next) {
    const { register_type, serial_no, register_code } = req.body || {};

    if (!register_type || !['qr', 'serial', 'code'].includes(register_type)) {
      return next(
        AppError.badRequest("register_type은 'qr', 'serial', 'code' 중 하나여야 합니다.")
      );
    }

    if ((register_type === 'qr' || register_type === 'serial') && !serial_no) {
      return next(AppError.badRequest('serial_no는 필수 항목입니다.'));
    }

    if (register_type === 'code' && !register_code) {
      return next(AppError.badRequest('register_code는 필수 항목입니다.'));
    }

    next();
  },

  /**
   * 보드 프로비저닝 본문 검증 (ICD 3.1.1)
   */
  validateProvision(req, res, next) {
    const { serial_no, wg_pubkey } = req.body || {};
    if (!serial_no) {
      return next(AppError.badRequest('serial_no는 필수 항목입니다.'));
    }
    if (!wg_pubkey) {
      return next(AppError.badRequest('wg_pubkey는 필수 항목입니다.'));
    }
    next();
  },

  /**
   * Heartbeat 본문 검증 (ICD 3.2.1)
   */
  validateHeartbeat(req, res, next) {
    const { serial_no, provision_token, status } = req.body || {};
    if (!serial_no) {
      return next(AppError.badRequest('serial_no는 필수 항목입니다.'));
    }
    if (!provision_token) {
      return next(AppError.badRequest('provision_token은 필수 항목입니다.'));
    }
    if (status && status !== 'online') {
      return next(AppError.badRequest("Heartbeat status는 'online'이어야 합니다."));
    }
    next();
  },

  /**
   * PTZ 제어 본문 검증 (ICD 3.4.1)
   */
  validatePtz(req, res, next) {
    const { action } = req.body || {};
    if (!action || !VALID_PTZ_ACTIONS.includes(action)) {
      return next(
        AppError.badRequest(
          `action이 유효하지 않습니다. 가능한 값: ${VALID_PTZ_ACTIONS.join(', ')}`
        )
      );
    }
    next();
  },

  /**
   * VPN 액션 본문 검증 (ICD 2.5.2)
   */
  validateVpnAction(req, res, next) {
    const { action } = req.body || {};
    if (!action || !['connect', 'disconnect'].includes(action)) {
      return next(AppError.badRequest("action은 'connect' 또는 'disconnect'여야 합니다."));
    }
    next();
  },
};
