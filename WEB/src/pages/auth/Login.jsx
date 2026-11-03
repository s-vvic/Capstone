// 로그인 화면
import "./Login.css";
import { useState, useEffect, useRef } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { login } from "../../api/authApi";

function Login({ onLogin }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loginError, setLoginError] = useState("");
  const [loginErrorType, setLoginErrorType] = useState("");

  const userIdRef = useRef(null);
  const passwordRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem("accessToken");
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();

    // 아이디 미입력
    if (!userId.trim()) {
      setLoginError("아이디 또는 이메일을 입력해 주세요.");
      setLoginErrorType("input");
      userIdRef.current?.focus();
      return;
    }

    // 비밀번호 미입력
    if (!password) {
      setLoginError("비밀번호를 입력해 주세요.");
      setLoginErrorType("input");
      passwordRef.current?.focus();
      return;
    }

    try {
      // 실제 백엔드 로그인 API 호출 (POST /auth/login)
      const data = await login(userId.trim(), password);

      const token = data.access_token || data.token || "temporary-token";
      localStorage.setItem("accessToken", token);

      setLoginError("");
      setLoginErrorType("");

      if (onLogin) onLogin(data);

      // 로그인 성공 후 VPN 연결 상태 확인 페이지로 이동
      navigate("/vpn-check", { replace: true });
    } catch (error) {
      console.warn("[Login] Login API failed:", error);

      if (error.code === "INVALID_CREDENTIALS" || error.status === 400 || error.status === 401) {
        setLoginError(
          "아이디 또는 비밀번호가 올바르지 않습니다. 입력한 정보를 다시 확인해 주세요."
        );
        setLoginErrorType("auth");
        return;
      }

      // 서버 미가동 환경에서도 프론트엔드 단독 테스트가 가능하도록 fallback 지원
      if (
        error.message &&
        (error.message.includes("Failed to fetch") || error.message.includes("NetworkError"))
      ) {
        console.warn("[Login] Backend offline, entering offline test mode");
        localStorage.setItem("accessToken", "offline-dev-token");
        navigate("/vpn-check", { replace: true });
        return;
      }

      setLoginError(error.message || "로그인 처리 중 문제가 발생했습니다.");
      setLoginErrorType("auth");
    }
  };

  return (
    <main className="login-page">
      <div className="login-container">
        <h1 className="login-title">WEBCAM Login</h1>
        <form className="login-card" onSubmit={handleLogin}>
          <div className="login-inputs">
            <input
              ref={userIdRef}
              className="login-input login-id-input"
              type="text"
              placeholder="아이디 또는 이메일"
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
                setLoginError("");
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />

            <div className="login-password-box">
              <input
                ref={passwordRef}
                className="login-input"
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setLoginError("");
                }}
              />

              <button
                type="button"
                className="eye-button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  setShowPassword(true);
                }}
                onPointerUp={() => setShowPassword(false)}
                onPointerLeave={() => setShowPassword(false)}
                onPointerCancel={() => setShowPassword(false)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {loginError && (
            <p
              className={`login-error ${
                loginErrorType === "auth" ? "login-error-auth" : ""
              }`}
            >
              {loginError}
            </p>
          )}

          <button className="login-button" type="submit">
            로그인
          </button>
        </form>

        <div className="account-links">
          <button
            type="button"
            className="account-link"
            onClick={() => navigate("/find-id")}
          >
            아이디 찾기
          </button>

          <span className="divider">|</span>

          <button
            type="button"
            className="account-link"
            onClick={() => navigate("/find-password")}
          >
            비밀번호 찾기
          </button>

          <span className="divider">|</span>

          <button
            type="button"
            className="account-link"
            onClick={() => navigate("/signup")}
          >
            회원가입
          </button>
        </div>
      </div>
    </main>
  );
}

export default Login;
