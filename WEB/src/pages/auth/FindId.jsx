import { useState } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/authApi";

function FindId() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("이름과 이메일을 모두 입력해주세요.");
      return;
    }
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await authApi.sendVerificationCode(email.trim(), "find_id");
      setMessage("아이디 확인을 위한 인증 정보가 이메일로 발송되었습니다.");
    } catch (err) {
      setError(err.message || "아이디 찾기 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="login-container">
      <h1>아이디 찾기</h1>

      {message && <p style={{ color: "#22c55e", marginBottom: "1rem" }}>{message}</p>}
      {error && <p style={{ color: "#ef4444", marginBottom: "1rem" }}>{error}</p>}

      <form className="login-form" onSubmit={handleSubmit}>
        <label htmlFor="name">이름</label>

        <input
          id="name"
          type="text"
          placeholder="이름을 입력하세요"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
          {loading ? "조회 중..." : "아이디 찾기"}
        </button>
      </form>

      <div className="login-links">
        <Link to="/login">로그인으로 돌아가기</Link>
      </div>
    </section>
  );
}

export default FindId;