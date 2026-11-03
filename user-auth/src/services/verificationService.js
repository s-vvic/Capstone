import crypto from 'crypto';
import { verificationCodeRepository } from '../repositories/index.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export class VerificationService {
  /**
   * 6자리 난수 인증코드 생성 (100000 ~ 999999)
   */
  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 이메일 또는 전화번호로 인증 코드 발송 요청 (SV-F-007)
   */
  async sendVerificationCode({ target, type = 'signup' }) {
    if (!target || typeof target !== 'string' || target.trim().length === 0) {
      throw AppError.badRequest('인증 대상(이메일 또는 전화번호)을 입력해주세요.');
    }

    const normalizedTarget = target.toLowerCase().trim();
    const code = this.generateCode();
    // 10분 유효
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await verificationCodeRepository.create({
      target: normalizedTarget,
      code,
      type,
      expiresAt,
    });

    logger.info(`[Verification] 인증 코드 발송 완료 (${type}): ${normalizedTarget} -> ${code}`);

    return {
      success: true,
      message: '인증 코드가 성공적으로 발송되었습니다.',
      target: normalizedTarget,
      type,
      expires_in_seconds: 600,
      verification_code: code, // 개발 및 테스트 지원용 반환
    };
  }

  /**
   * 인증 코드 확인 및 인증 처리 (SV-F-007)
   */
  async verifyCode({ target, code, type = 'signup' }) {
    if (!target || !code) {
      throw AppError.badRequest('인증 대상과 인증 코드를 모두 입력해주세요.');
    }

    const normalizedTarget = target.toLowerCase().trim();
    const activeRecord = await verificationCodeRepository.findLatestActive({
      target: normalizedTarget,
      type,
    });

    if (!activeRecord || String(activeRecord.code) !== String(code).trim()) {
      logger.warn(`[Verification] 인증 코드 검증 실패: ${normalizedTarget} (입력: ${code})`);
      throw AppError.invalidVerificationCode('인증 코드가 일치하지 않거나 만료되었습니다.');
    }

    await verificationCodeRepository.markVerified(activeRecord.verification_id);
    logger.info(`[Verification] 인증 완료: ${normalizedTarget} (${type})`);

    return {
      verified: true,
      message: '성공적으로 인증되었습니다.',
      verification_id: activeRecord.verification_id,
    };
  }

  /**
   * 인증 완료 여부 확인 후 즉시 소비(사용) 처리
   */
  async consumeVerification({ target, code, type = 'signup' }) {
    if (!target) return false;
    const normalizedTarget = target.toLowerCase().trim();

    const activeRecord = await verificationCodeRepository.findLatestActive({
      target: normalizedTarget,
      type,
    });

    if (!activeRecord) {
      throw AppError.invalidVerificationCode('유효한 인증 정보가 없습니다. 인증 코드를 먼저 발송받아 확인해주세요.');
    }

    if (code && String(activeRecord.code) !== String(code).trim()) {
      throw AppError.invalidVerificationCode('인증 코드가 일치하지 않습니다.');
    }

    await verificationCodeRepository.markUsed(activeRecord.verification_id);
    return true;
  }
}

export const verificationService = new VerificationService();
