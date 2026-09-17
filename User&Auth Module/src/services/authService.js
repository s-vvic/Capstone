import { userRepository, sessionRepository, loginAttemptRepository } from '../repositories/index.js';
import { passwordUtil } from '../utils/password.js';
import { jwtUtil } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../errors/AppError.js';
import { env } from '../config/env.js';
import { getPlanDetails, isValidPlan, SUBSCRIPTION_PLANS } from '../config/plans.js';

export class AuthService {
  /**
   * 회원가입 (SV-F-001, ICD 2.1.3)
   */
  async register({ email, password, name, plan = SUBSCRIPTION_PLANS.BASIC }) {
    if (!email || typeof email !== 'string') {
      throw AppError.badRequest('유효한 이메일을 입력해주세요.');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw AppError.badRequest('이메일 형식이 올바르지 않습니다.');
    }

    const pwValidation = passwordUtil.validate(password);
    if (!pwValidation.valid) {
      throw AppError.badRequest(pwValidation.message);
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw AppError.badRequest('이름을 입력해주세요.');
    }

    const selectedPlan = isValidPlan(plan) ? plan : SUBSCRIPTION_PLANS.BASIC;

    // 이메일 중복 확인 (ICD 409 CONFLICT)
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw AppError.conflict('이미 등록된 이메일 주소입니다.', '다른 이메일을 사용하거나 아이디/비밀번호 찾기를 진행하세요.');
    }

    // 비밀번호 bcrypt 해싱 (NF-S-002)
    const passwordHash = await passwordUtil.hash(password);

    const user = await userRepository.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      name: name.trim(),
      plan: selectedPlan,
    });

    logger.info(`[Auth] 신규 사용자 회원가입 완료: ${user.email} (${user.user_id})`);

    return {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      created_at: user.created_at,
    };
  }

  /**
   * 로그인 (SV-F-001, SV-F-003, ICD 2.1.1, NF-S-005, NF-P-005)
   */
  async login({
    email,
    password,
    auto_login = false,
    clientIp = '127.0.0.1',
    userAgent = 'unknown',
    deviceName = 'Web Browser',
    deviceType = 'web',
  }) {
    if (!email || !password) {
      throw AppError.invalidCredentials('이메일과 비밀번호를 모두 입력해주세요.');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. 로그인 실패 횟수 확인 (ICD 2.1.1 429 TOO_MANY_REQUESTS)
    const recentFailures = await loginAttemptRepository.getRecentFailedAttempts(
      normalizedEmail,
      clientIp,
      env.LOGIN_LOCKOUT_WINDOW_MINUTES
    );

    if (recentFailures >= env.LOGIN_MAX_FAILED_ATTEMPTS) {
      logger.security('LOGIN_BRUTE_FORCE_BLOCKED', {
        email: normalizedEmail,
        ip: clientIp,
        userAgent,
        reason: `${recentFailures}회 연속 로그인 실패로 인한 계정 보호 차단`,
      });
      throw AppError.tooManyRequests(
        `로그인 시도 횟수를 초과했습니다. ${env.LOGIN_LOCKOUT_WINDOW_MINUTES}분 후에 다시 시도해주세요.`
      );
    }

    // 2. 사용자 조회
    const user = await userRepository.findByEmail(normalizedEmail);
    if (!user) {
      await loginAttemptRepository.recordAttempt({
        email: normalizedEmail,
        clientIp,
        isSuccess: false,
      });
      logger.warn(`[Auth] 로그인 실패 (계정 없음): ${normalizedEmail} from ${clientIp}`);
      throw AppError.invalidCredentials('이메일 또는 비밀번호가 일치하지 않습니다.');
    }

    // 3. 비밀번호 검증 (NF-S-002)
    const isPasswordValid = await passwordUtil.compare(password, user.password_hash);
    if (!isPasswordValid) {
      await loginAttemptRepository.recordAttempt({
        email: normalizedEmail,
        clientIp,
        isSuccess: false,
      });
      logger.security('LOGIN_PASSWORD_MISMATCH', {
        email: normalizedEmail,
        userId: user.user_id,
        ip: clientIp,
        userAgent,
        reason: '비밀번호 불일치',
      });
      throw AppError.invalidCredentials('이메일 또는 비밀번호가 일치하지 않습니다.');
    }

    // 로그인 성공 시 실패 이력 초기화 및 성공 기록
    await loginAttemptRepository.clearAttempts(normalizedEmail, clientIp);
    await loginAttemptRepository.recordAttempt({
      email: normalizedEmail,
      clientIp,
      isSuccess: true,
    });

    // 4. 플랜별 동시 세션 수 검증 및 관리 (NF-P-005, SV-F-005)
    const planInfo = getPlanDetails(user.plan);
    const activeSessions = await sessionRepository.findActiveByUserId(user.user_id);

    if (activeSessions.length >= planInfo.maxConcurrentSessions) {
      // 플랜 한도를 초과하면 가장 오래된 세션을 자동으로 비활성화하고 새 기기 로그인 허용
      const oldestSession = activeSessions[activeSessions.length - 1];
      if (oldestSession) {
        await sessionRepository.deactivate(oldestSession.session_id);
        logger.info(
          `[Auth] 동시 접속 한도(${planInfo.maxConcurrentSessions}개) 초과로 오래된 세션 만료: ${oldestSession.session_id}`
        );
      }
    }

    // 5. 세션 및 JWT 생성 (ICD 1.3: 1년 유효기간 지원)
    const jti = jwtUtil.generateJti();
    const expiresAt = jwtUtil.getExpirationDate(auto_login);

    const session = await sessionRepository.create({
      userId: user.user_id,
      deviceName: deviceName || (deviceType === 'android' ? 'Android Device' : 'Web Dashboard'),
      deviceType: deviceType || 'web',
      clientIp,
      userAgent,
      tokenJti: jti,
      isAutoLogin: Boolean(auto_login),
      expiresAt,
    });

    const { token } = jwtUtil.generateToken(
      {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        jti,
      },
      auto_login
    );

    logger.info(`[Auth] 로그인 성공: ${user.email} (세션: ${session.session_id}, 기기: ${session.device_name})`);

    // ICD 2.1.1 응답 본문 규격
    return {
      access_token: token,
      token_type: 'Bearer',
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      session_id: session.session_id,
      is_auto_login: Boolean(auto_login),
      expires_at: expiresAt,
    };
  }

  /**
   * 로그아웃 (SV-F-001, ICD 2.1.2: 현재 세션 토큰 무효화)
   */
  async logout({ tokenJti, sessionId }) {
    if (tokenJti) {
      await sessionRepository.deactivateByJti(tokenJti);
    } else if (sessionId) {
      await sessionRepository.deactivate(sessionId);
    }
    logger.info(`[Auth] 세션 로그아웃 처리 완료 (JTI: ${tokenJti})`);
    return { success: true, message: '성공적으로 로그아웃되었습니다.' };
  }

  /**
   * 토큰 갱신 및 자동 로그인 세션 검증 (SV-F-003)
   */
  async refreshToken(currentToken) {
    const decoded = jwtUtil.verifyToken(currentToken);
    const session = await sessionRepository.findByJti(decoded.jti);

    if (!session) {
      throw AppError.unauthorized('세션이 만료되었거나 유효하지 않습니다.', '다시 로그인해주세요.');
    }

    const user = await userRepository.findById(decoded.sub);
    if (!user) {
      throw AppError.unauthorized('사용자 계정을 찾을 수 없습니다.');
    }

    // 세션 활성 시간 업데이트
    await sessionRepository.updateLastActive(session.session_id);

    // 새 토큰 발급
    const newJti = jwtUtil.generateJti();
    const expiresAt = jwtUtil.getExpirationDate(session.is_auto_login);

    // 기존 세션에 새 jti 갱신 또는 신규 세션 등록
    await sessionRepository.deactivate(session.session_id);
    const newSession = await sessionRepository.create({
      userId: user.user_id,
      deviceName: session.device_name,
      deviceType: session.device_type,
      clientIp: session.client_ip,
      userAgent: session.user_agent,
      tokenJti: newJti,
      isAutoLogin: session.is_auto_login,
      expiresAt,
    });

    const { token } = jwtUtil.generateToken(
      {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        jti: newJti,
      },
      session.is_auto_login
    );

    return {
      access_token: token,
      token_type: 'Bearer',
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      session_id: newSession.session_id,
      expires_at: expiresAt,
    };
  }
}

export const authService = new AuthService();
