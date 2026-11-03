/**
 * 사용자 인증 및 계정 관리 REST API (Component 1, ICD 2.1, SV-F-001 ~ SV-F-008)
 */
import { apiClient, setAuthToken } from "./client.js";

/**
 * 로그인 (POST /auth/login, ICD 2.1.1, SV-F-001)
 * @param {string|Object} emailOrUserId - 이메일 또는 아이디 (객체로 전달 시 전체 payload)
 * @param {string} [password] - 비밀번호
 * @param {boolean} [autoLogin=false] - 자동 로그인 여부
 */
export async function login(emailOrUserId, password, autoLogin = false) {
  let payload;
  if (typeof emailOrUserId === "object" && emailOrUserId !== null) {
    payload = {
      email: emailOrUserId.email || emailOrUserId.userId,
      password: emailOrUserId.password,
      auto_login: Boolean(emailOrUserId.auto_login ?? emailOrUserId.autoLogin ?? false),
      device_name: emailOrUserId.device_name || emailOrUserId.deviceName || "Web Dashboard",
      device_type: "web",
    };
  } else {
    payload = {
      email: emailOrUserId,
      password,
      auto_login: Boolean(autoLogin),
      device_name: "Web Dashboard",
      device_type: "web",
    };
  }

  const response = await apiClient.post("/auth/login", payload);

  const token = response.access_token || response.token;
  if (token) {
    setAuthToken(token);
    if (response.user_id) localStorage.setItem("userId", response.user_id);
    if (response.email) localStorage.setItem("userEmail", response.email);
    if (response.name) localStorage.setItem("userName", response.name);
  }

  return response;
}

/**
 * 회원가입 (POST /auth/register, ICD 2.1.3, SV-F-001, SV-F-007)
 */
export async function signup(userIdOrData, email, password, name) {
  let payload;
  if (typeof userIdOrData === "object" && userIdOrData !== null) {
    payload = {
      email: userIdOrData.email,
      password: userIdOrData.password,
      name: userIdOrData.name || userIdOrData.userId || "사용자",
      plan: userIdOrData.plan || "basic",
      verification_code: userIdOrData.verification_code || userIdOrData.verificationCode,
    };
  } else {
    payload = {
      email: email || userIdOrData,
      password,
      name: name || userIdOrData || "사용자",
      plan: "basic",
    };
  }

  return apiClient.post("/auth/register", payload);
}

/**
 * 아이디 중복 확인 (호환용)
 */
export async function checkUserId(emailOrUserId) {
  // 백엔드 중복 체크 또는 기본 응답
  return { available: true };
}

/**
 * 로그아웃 (POST /auth/logout, ICD 2.1.2)
 */
export async function logout() {
  try {
    await apiClient.post("/auth/logout", {});
  } finally {
    setAuthToken(null);
    localStorage.removeItem("userId");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
  }
}

/**
 * 현재 로그인 사용자 프로필 조회 (GET /auth/me)
 */
export async function getMe() {
  return apiClient.get("/auth/me");
}

/**
 * 본인 인증 코드 발송 요청 (POST /auth/send-verification-code, SV-F-007)
 */
export async function sendVerificationCode(target, type = "signup") {
  return apiClient.post("/auth/send-verification-code", {
    target,
    type,
  });
}

/**
 * 본인 인증 코드 검증 (POST /auth/verify-code, SV-F-007)
 */
export async function verifyCode(target, code, type = "signup") {
  return apiClient.post("/auth/verify-code", {
    target,
    code,
    type,
  });
}

/**
 * 아이디 찾기 (POST /auth/find-id, SV-F-002, ICD 2.1.4)
 */
export async function findId(name, phoneNumber, verificationCode) {
  return apiClient.post("/auth/find-id", {
    name,
    phone_number: phoneNumber,
    verification_code: verificationCode,
  });
}

/**
 * 비밀번호 찾기(인증코드 요청) (POST /auth/forgot-password, SV-F-002)
 */
export async function forgotPassword(email) {
  return apiClient.post("/auth/forgot-password", { email });
}

/**
 * 비밀번호 재설정 실행 (POST /auth/reset-password, SV-F-002, ICD 2.1.5)
 */
export async function resetPassword({ email, verificationCode, newPassword, resetToken }) {
  return apiClient.post("/auth/reset-password", {
    email,
    verification_code: verificationCode,
    reset_token: resetToken,
    new_password: newPassword,
  });
}

export const authApi = {
  login,
  signup,
  logout,
  getMe,
  checkUserId,
  sendVerificationCode,
  verifyCode,
  findId,
  forgotPassword,
  resetPassword,
};

export default authApi;
