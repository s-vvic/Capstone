import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';

// WireGuard 키는 32바이트 curve25519 키의 base64 인코딩 (44자리 문자열, 끝이 '='로 끝남)
const WG_KEY_REGEX = /^[A-Za-z0-9+/]{43}=$/;
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

export function isValidWireGuardKey(key) {
  if (typeof key !== 'string') return false;
  return WG_KEY_REGEX.test(key.trim());
}

export function isValidIPv4(ip) {
  if (typeof ip !== 'string') return false;
  return IPV4_REGEX.test(ip.trim());
}

export const validator = {
  validateWireGuardKey(key, fieldName = 'wg_pubkey') {
    if (!key || !isValidWireGuardKey(key)) {
      throw AppError.badRequest(
        `유효한 WireGuard 공개키 형식이 아닙니다 (44자리 Base64: ${fieldName}).`,
        { field: fieldName }
      );
    }
  },

  validateVpnAction(action) {
    if (!action || !['connect', 'disconnect'].includes(action)) {
      throw AppError.badRequest(
        "action은 'connect' 또는 'disconnect'여야 합니다.",
        { field: 'action' }
      );
    }
  },

  validatePeerRegistration(body) {
    const { peer_type, name, wg_pubkey } = body;
    if (!peer_type || !['device', 'phone'].includes(peer_type)) {
      throw AppError.badRequest("peer_type은 'device' 또는 'phone'이어야 합니다.");
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw AppError.badRequest('기기 이름(name)은 필수 항목입니다.');
    }
    if (wg_pubkey) {
      validator.validateWireGuardKey(wg_pubkey, 'wg_pubkey');
    }
  },
};
