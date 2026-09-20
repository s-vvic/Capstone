import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/**
 * 비밀번호 보안 유틸리티 (NF-S-002: bcrypt 해시 저장)
 */
export const passwordUtil = {
  /**
   * 비밀번호 복잡도 검증 (ICD 2.1.3: 8자 이상)
   */
  validate(password) {
    if (!password || typeof password !== 'string') {
      return { valid: false, message: '비밀번호는 문자열이어야 합니다.' };
    }
    if (password.length < 8) {
      return { valid: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' };
    }
    if (password.length > 128) {
      return { valid: false, message: '비밀번호는 128자 이하여야 합니다.' };
    }
    return { valid: true };
  },

  /**
   * 비밀번호 bcrypt 해싱 (NF-S-002)
   */
  async hash(password) {
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    return bcrypt.hash(password, salt);
  },

  /**
   * 비밀번호 비교 검증
   */
  async compare(plainPassword, passwordHash) {
    if (!plainPassword || !passwordHash) return false;
    return bcrypt.compare(plainPassword, passwordHash);
  },
};
