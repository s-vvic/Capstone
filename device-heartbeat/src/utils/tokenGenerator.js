import crypto from 'crypto';

export const tokenGenerator = {
  /**
   * 보드 고유 ID 생성 (SV-F-015, ICD 2.2.1)
   * 보드 MAC 주소 기반 식별 번호 부여 (예: AA:BB:CC:DD:EE:01 -> CAM-EE01)
   * macOrIndex가 숫자인 경우 기존 index 패딩 방식(CAM-0001) 지원 (하위 호환)
   */
  generateDeviceId(macOrIndex = 1) {
    if (typeof macOrIndex === 'string' && macOrIndex.trim().length > 0) {
      return this.generateDeviceIdFromMac(macOrIndex);
    }
    const padded = String(macOrIndex).padStart(4, '0');
    return `CAM-${padded}`;
  },

  /**
   * 보드 MAC 주소 기반 고유 식별 번호 생성 (SV-F-015)
   * 예: "AA:BB:CC:DD:EE:01" -> "CAM-EE01"
   */
  generateDeviceIdFromMac(macNo) {
    if (!macNo || typeof macNo !== 'string') {
      return 'CAM-0001';
    }
    const cleanMac = macNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (cleanMac.length >= 4) {
      return `CAM-${cleanMac.slice(-4)}`;
    }
    return `CAM-${cleanMac.padStart(4, '0')}`;
  },

  /**
   * Heartbeat 인증용 provision_token 생성 (ICD 3.1.1)
   */
  generateProvisionToken() {
    return `prov_${crypto.randomBytes(24).toString('hex')}`;
  },

  /**
   * 보드 등록용 6자리 등록 코드 생성 (SV-F-010, register_type=code)
   */
  generateRegisterCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },
};
