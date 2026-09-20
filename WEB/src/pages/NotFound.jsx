
import { useNavigate } from "react-router-dom";

function NotFound() {
  const navigate = useNavigate();

  return (
    <main>
      <h1>404</h1>
      <p>페이지를 찾을 수 없습니다.</p>

      <button
        type="button"
        onClick={() => navigate("/login", { replace: true })}
      >
        첫 화면으로 이동
      </button>
    </main>
  );
}

export default NotFound;