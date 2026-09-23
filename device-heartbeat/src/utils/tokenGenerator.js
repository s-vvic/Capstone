import crypto from 'crypto';

export const tokenGenerator = {
  /**
   * 보드 고유 ID 생성 (예: CAM-0001, ICD 2.2.1)
   */
  generateDeviceId(index = 1) {
    const padded = String(index).padStart(4, '0');
    return `CAM-${padded}`;
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
