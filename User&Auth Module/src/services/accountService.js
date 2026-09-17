import crypto from 'crypto';
import { userRepository, sessionRepository, passwordResetRepository } from '../repositories/index.js';
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
   * 아이디(이메일) 찾기 (SV-F-002)
   */
  async findId({ name }) {
    if (!name || typeof name !== 'string') {
      throw AppError.badRequest('이름을 입력해주세요.');
    }

    const users = await userRepository.findByName(name.trim());
    if (!users || users.length === 0) {
      throw AppError.notFound('일치하는 회원 정보를 찾을 수 없습니다.');
    }

    const maskedResults = users.map((u) => ({
      name: u.name,
      masked_email: this.maskEmail(u.email),
      created_at: u.created_at,
    }));

    return {
      count: maskedResults.length,
      items: maskedResults,
    };
  }

  /**
   * 비밀번호 찾기/재설정 요청 (SV-F-002)
   * 비밀번호 재설정 일회용 보안 토큰 발급
   */
  async requestPasswordReset({ email }) {
    if (!email) {
      throw AppError.badRequest('이메일을 입력해주세요.');
    }

    const user = await userRepository.findByEmail(email.toLowerCase().trim());
    if (!user) {
      // 보안상 계정 존재 여부를 노출하지 않기 위해 동일한 성공 응답 또는 안내
      logger.info(`[Account] 비밀번호 재설정 요청 실패 (존재하지 않는 이메일): ${email}`);
      return {
        message: '등록된 이메일인 경우 비밀번호 재설정 안내가 발송되었습니다.',
      };
    }

    // 보안 토큰 생성 (1시간 유효)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await passwordResetRepository.create({
      userId: user.user_id,
      resetToken,
      expiresAt,
    });

    logger.info(`[Account] 비밀번호 재설정 토큰 발급 완료: ${user.email}`);

    return {
      message: '비밀번호 재설정 링크가 생성되었습니다.',
      reset_token: resetToken, // 실제 운영에서는 이메일/SMS 전송
      expires_at: expiresAt,
    };
  }

  /**
   * 비밀번호 재설정 실행 (SV-F-002)
   */
  async resetPassword({ resetToken, newPassword }) {
    if (!resetToken) {
      throw AppError.badRequest('재설정 토큰이 필요합니다.');
    }

    const pwValidation = passwordUtil.validate(newPassword);
    if (!pwValidation.valid) {
      throw AppError.badRequest(pwValidation.message);
    }

    const record = await passwordResetRepository.findByToken(resetToken);
    if (!record) {
      throw AppError.badRequest('유효하지 않거나 만료된 비밀번호 재설정 토큰입니다.');
    }

    // 비밀번호 해시 생성 및 사용자 갱신
    const passwordHash = await passwordUtil.hash(newPassword);
    await userRepository.update(record.user_id, { passwordHash });

    // 토큰 사용 완료 처리
    await passwordResetRepository.markUsed(record.reset_id);

    // 보안을 위해 기존 로그인된 모든 기기 세션 강제 종료 (SV-F-004 연계)
    await sessionRepository.deactivateAllUserSessions(record.user_id);

    logger.security('PASSWORD_RESET_SUCCESS', {
      userId: record.user_id,
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
   * 회원 탈퇴 (WEB-F-060)
   */
  async deleteAccount({ userId, password }) {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw AppError.notFound('사용자를 찾을 수 없습니다.');
    }

    const isValid = await passwordUtil.compare(password, user.password_hash);
    if (!isValid) {
      throw AppError.badRequest('비밀번호가 일치하지 않아 탈퇴할 수 없습니다.');
    }

    // 모든 세션 비활성화
    await sessionRepository.deactivateAllUserSessions(userId);
    // 계정 삭제
    await userRepository.delete(userId);

    logger.info(`[Account] 회원 탈퇴 처리 완료: ${user.email}`);

    return { success: true, message: '회원 탈퇴가 완료되었습니다.' };
  }
}

export const accountService = new AccountService();
