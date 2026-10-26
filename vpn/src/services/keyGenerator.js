import crypto from 'crypto';

/**
 * WireGuard 호환 x25519 키 페어 생성 및 검증 유틸리티
 */
export const keyGenerator = {
  /**
   * 새로운 WireGuard x25519 키 페어 생성
   * @returns {{ privateKey: string, publicKey: string }} 44자리 Base64 문자열
   */
  generateKeyPair() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('x25519', {
      publicKeyEncoding: { type: 'spki', format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });

    // DER 포맷에서 원시 32바이트 키 추출
    // x25519 PKCS#8 der 헤더는 16바이트, SPKI der 헤더는 12바이트
    const rawPrivateKey = privateKey.subarray(privateKey.length - 32);
    const rawPublicKey = publicKey.subarray(publicKey.length - 32);

    return {
      privateKey: rawPrivateKey.toString('base64'),
      publicKey: rawPublicKey.toString('base64'),
    };
  },

  /**
   * PresharedKey 생성 (옵션: 32바이트 난수 Base64)
   */
  generatePresharedKey() {
    return crypto.randomBytes(32).toString('base64');
  },

  /**
   * WireGuard Base64 키 유효성 검사 (32바이트 디코딩 가능 여부)
   */
  isValidKey(key) {
    if (typeof key !== 'string' || key.length !== 44) return false;
    try {
      const buf = Buffer.from(key, 'base64');
      return buf.length === 32 && key.endsWith('=');
    } catch {
      return false;
    }
  },
};
