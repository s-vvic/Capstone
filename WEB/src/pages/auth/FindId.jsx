import { Link } from "react-router-dom";

function FindId() {
  return (
    <section className="login-container">
      <h1>아이디 찾기</h1>

      <form className="login-form">
        <label htmlFor="name">이름</label>

        <input
          id="name"
          type="text"
          placeholder="이름을 입력하세요"
        />

        <label htmlFor="email">이메일</label>

        <input
          id="email"
          type="email"
          placeholder="이메일을 입력하세요"
        />

        <button type="submit">
          아이디 찾기
        </button>
      </form>

      <div className="login-links">
        <Link to="/login">로그인으로 돌아가기</Link>
      </div>
    </section>
  );
}

export default FindId;