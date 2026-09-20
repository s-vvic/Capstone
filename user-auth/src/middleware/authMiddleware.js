import { jwtUtil } from '../utils/jwt.js';
import { sessionRepository, userRepository } from '../repositories/index.js';
import { AppError } from '../errors/AppError.js';

/**
 * JWT Bearer 인증 및 활성 세션 검증 미들웨어 (NF-S-003, ICD 1.3, SV-F-004)
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('인증 헤더(Bearer Token)가 누락되었습니다.');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw AppError.unauthorized('인증 토큰이 유효하지 않습니다.');
    }

    // 1. JWT 토큰 서명 및 만료 검증
    const decoded = jwtUtil.verifyToken(token);

    // 2. 세션 활성 여부 검증 (SV-F-004 강제 로그아웃 여부 확인)
    const session = await sessionRepository.findByJti(decoded.jti);
    if (!session || !session.is_active) {
      throw AppError.unauthorized('로그아웃되었거나 유효하지 않은 세션입니다.', '다시 로그인해주세요.');
    }

    // 3. 사용자 존재 여부 확인
    const user = await userRepository.findById(decoded.sub);
    if (!user) {
      throw AppError.unauthorized('존재하지 않는 사용자 계정입니다.');
    }

    // 4. 마지막 활동 시간 갱신 (비동기 처리)
    sessionRepository.updateLastActive(session.session_id).catch(() => {});

    // 5. 요청 객체에 사용자 및 세션 정보 주입
    req.user = {
      userId: user.user_id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    };

    req.session = {
      sessionId: session.session_id,
      tokenJti: session.token_jti,
      deviceName: session.device_name,
      deviceType: session.device_type,
      isAutoLogin: session.is_auto_login,
    };

    next();
  } catch (error) {
    next(error);
  }
}
