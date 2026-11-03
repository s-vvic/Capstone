import crypto from 'crypto';
import { userRepository, sessionRepository, passwordResetRepository } from '../repositories/index.js';
import { verificationService } from './verificationService.js';
import { passwordUtil } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../errors/AppError.js';

export class AccountService {
  /**
   * 이메일 마스킹 헬퍼 (예: te***@example.com)
   */
  maskEmail(email) {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    if (local.length <= 2) {
      return `${local[0]}*@${domain}`;
    }
    const visible = local.slice(0, 2);
    const masked = '*'.repeat(Math.max(1, local.length - 2));
    return `${visible}${masked}@${domain}`;
  }

  /**
   * 아이디(이메일) 찾기 (SV-F-002, ICD 2.1.4)
   */
  async findId({ name, phone_number, phone, verification_code }) {
    if (!name || typeof name !== 'string') {
      throw AppError.badRequest('이름을 입력해주세요.');
    }

    const phoneTarget = phone_number || phone;
    // ICD 2.1.4: 본인 인증 코드가 제공된 경우 검증
    if (phoneTarget && verification_code) {
      await verificationService.consumeVerification({
        target: phoneTarget,
        code: verification_code,
        type: 'find_id',
      });
    }

    const users = await userRepository.findByName(name.trim());
    if (!users || users.length === 0) {
      throw AppError.notFound('일치하는 회원 정보를 찾을 수 없습니다.');
    }

    const primaryUser = users[0];
    const masked = this.maskEmail(primaryUser.email);

    const maskedResults = users.map((u) => ({
      name: u.name,
      masked_email: this.maskEmail(u.email),
      created_at: u.created_at,
    }));

    // ICD 2.1.4 응답 규격: email(마스킹) 반환 및 기존 하위 호환 items/count 지원
    return {
      email: masked,
      masked_email: masked,
      count: maskedResults.length,
      items: maskedResults,
    };
  }

  /**
   * 비밀번호 찾기/재설정 요청 (SV-F-002, SV-F-007, ICD 2.1.5)
   * 이메일 본인 확인 6자리 인증 코드 및 보안 재설정 토큰 발급
   */
  async requestPasswordReset({ email }) {
    if (!email) {
      throw AppError.badRequest('이메일을 입력해주세요.');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      logger.warn(`[Account] 비밀번호 재설정 요청 실패 (존재하지 않는 이메일): ${normalizedEmail}`);
      throw AppError.userNotFound('등록되지 않은 이메일입니다.');
    }

    // 1. SV-F-007 & ICD 2.1.5용 6자리 인증 코드 발급
    const verification = await verificationService.sendVerificationCode({
      target: normalizedEmail,
      type: 'password_reset',
    });

    // 2. 기존 resetToken 호환 생성 (1시간 유효)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await passwordResetRepository.create({
      userId: user.user_id,
      resetToken,
      expiresAt,
    });

    logger.info(`[Account] 비밀번호 재설정 인증 코드 및 토큰 발급 완료: ${user.email} (코드: ${verification.verification_code})`);

    return {
      message: '비밀번호 재설정 링크 및 인증 코드가 전송되었습니다.',
      verification_code: verification.verification_code,
      reset_token: resetToken,
      expires_at: expiresAt,
    };
  }

  /**
   * 비밀번호 재설정 실행 (SV-F-002, SV-F-007, ICD 2.1.5)
   */
  async resetPassword({ email, verification_code, resetToken, newPassword }) {
    const pwValidation = passwordUtil.validate(newPassword);
    if (!pwValidation.valid) {
      throw AppError.badRequest(pwValidation.message);
    }

    let targetUserId = null;

    // 경로 A: ICD 2.1.5 본인 인증 코드 방식 (email + verification_code)
    if (email && verification_code) {
      const normalizedEmail = email.toLowerCase().trim();
      const user = await userRepository.findByEmail(normalizedEmail);
      if (!user) {
        throw AppError.userNotFound('등록되지 않은 이메일입니다.');
      }

      await verificationService.consumeVerification({
        target: normalizedEmail,
        code: verification_code,
        type: 'password_reset',
      });

      targetUserId = user.user_id;
    }
    // 경로 B: 기존 resetToken 방식 (호환성)
    else if (resetToken) {
      const record = await passwordResetRepository.findByToken(resetToken);
      if (!record) {
        throw AppError.badRequest('유효하지 않거나 만료된 비밀번호 재설정 토큰입니다.');
      }
      targetUserId = record.user_id;
      await passwordResetRepository.markUsed(record.reset_id);
    } else {
      throw AppError.badRequest('인증 코드 또는 재설정 토큰이 필요합니다.');
    }

    // 비밀번호 해시 생성 및 사용자 갱신
    const passwordHash = await passwordUtil.hash(newPassword);
    await userRepository.update(targetUserId, { passwordHash });

    // 보안을 위해 기존 로그인된 모든 기기 세션 강제 종료 (SV-F-004 연계)
    await sessionRepository.deactivateAllUserSessions(targetUserId);

    logger.security('PASSWORD_RESET_SUCCESS', {
      userId: targetUserId,
      reason: '비밀번호 재설정 완료 및 모든 세션 무효화',
    });

    return {
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다. 모든 기기에서 다시 로그인해주세요.',
    };
  }

  /**
   * 로그인 상태에서 비밀번호 변경 (WEB-F-060, APP-F-061)
   */
  async changePassword({ userId, currentPassword, newPassword }) {
    if (!currentPassword || !newPassword) {
      throw AppError.badRequest('현재 비밀번호와 새 비밀번호를 모두 입력해주세요.');
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('사용자를 찾을 수 없습니다.');
    }

    const isValid = await passwordUtil.compare(currentPassword, user.password_hash);
    if (!isValid) {
      throw AppError.badRequest('현재 비밀번호가 일치하지 않습니다.');
    }

    const pwValidation = passwordUtil.validate(newPassword);
    if (!pwValidation.valid) {
      throw AppError.badRequest(pwValidation.message);
    }

    const passwordHash = await passwordUtil.hash(newPassword);
    await userRepository.update(userId, { passwordHash });

    logger.info(`[Account] 비밀번호 직접 변경 완료: ${user.email}`);

    return { success: true, message: '비밀번호가 성공적으로 변경되었습니다.' };
  }

  /**
   * 사용자 프로필 조회
   */
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('사용자를 찾을 수 없습니다.');
    }
    return {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  /**
   * 사용자 프로필 수정 (WEB-F-060)
   */
  async updateProfile(userId, { name }) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw AppError.badRequest('이름을 입력해주세요.');
    }

    const updated = await userRepository.update(userId, { name: name.trim() });
    return {
      user_id: updated.user_id,
      email: updated.email,
      name: updated.name,
      plan: updated.plan,
      updated_at: updated.updated_at,
    };
  }

  /**
   * 회원 탈퇴 (SV-F-006, ICD 2.1.7)
   */
  async deleteAccount({ userId, password, reason }) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('사용자를 찾을 수 없습니다.');
    }

    const isValid = await passwordUtil.compare(password, user.password_hash);
    if (!isValid) {
      throw AppError.invalidPassword('비밀번호가 일치하지 않아 탈퇴할 수 없습니다.');
    }

    // 모든 세션 비활성화
    await sessionRepository.deactivateAllUserSessions(userId);
    // 계정 삭제
    await userRepository.delete(userId);

    logger.info(`[Account] 회원 탈퇴 처리 완료: ${user.email} (사유: ${reason || '미기재'})`);

    return {
      success: true,
      message: '회원 탈퇴가 완료되었습니다.',
      deleted_user_id: userId,
      deleted_at: new Date().toISOString(),
    };
  }
}

export const accountService = new AccountService();
