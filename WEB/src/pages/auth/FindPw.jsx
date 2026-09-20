import { Link } from "react-router-dom";

function FindPassword() {
  return (
    <section className="login-container">
      <h1>비밀번호 찾기</h1>

      <form className="login-form">
        <label htmlFor="userId">아이디</label>

        <input
          id="userId"
          type="text"
          placeholder="아이디를 입력하세요"
        />

        <label htmlFor="email">이메일</label>

        <input
          id="email"
          type="email"
          placeholder="이메일을 입력하세요"
        />

        <button type="submit">
          인증 요청
        </button>
      </form>

      <div className="login-links">
        <Link to="/login">로그인으로 돌아가기</Link>
      </div>
    </section>
  );
}

export default FindPassword;