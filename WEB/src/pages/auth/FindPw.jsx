import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/authApi";

function FindPassword() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await authApi.forgotPassword(email.trim());
      setMessage("비밀번호 재설정 인증코드가 이메일로 전송되었습니다.");
    } catch (err) {
      setError(err.message || "인증 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-container">
      <h1>비밀번호 찾기</h1>

      {message && <p style={{ color: "#22c55e", marginBottom: "1rem" }}>{message}</p>}
      {error && <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>}

      <form className="login-form" onSubmit={handleSubmit}>
        <label htmlFor="userId">아이디</label>

        <input
          id="userId"
          type="text"
          placeholder="아이디를 입력하세요"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />

        <label htmlFor="email">이메일</label>

        <input
          id="email"
          type="email"
          placeholder="이메일을 입력하세요"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button type="submit" disabled={loading}>
          {loading ? "전송 중..." : "인증 요청"}
        </button>
      </form>

      <div className="login-links">
        <Link to="/login">로그인으로 돌아가기</Link>
      </div>
    </section>
  );
}

export default FindPassword;