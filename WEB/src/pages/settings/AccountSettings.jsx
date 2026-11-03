
import { useState, useEffect } from "react";
import { authApi } from "../../api/authApi";

function AccountSettings() {
  const [userName, setUserName] = useState(() => localStorage.getItem("userName") || "admin");
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem("userEmail") || "admin@example.com");

  useEffect(() => {
    let isMounted = true;
    async function loadUser() {
      try {
        const me = await authApi.getMe();
        if (isMounted && me) {
          if (me.name) setUserName(me.name);
          if (me.email) setUserEmail(me.email);
        }
      } catch (err) {
        // Fallback to localStorage values
      }
    }
    loadUser();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="settings-section">
      <h2>계정 설정</h2>

      <div className="account-field">
        <label>사용자 이름</label>
        <input
          type="text"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
        />
      </div>

      <div className="account-field">
        <label>이메일</label>
        <input
          type="email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
        />
      </div>

      <button type="button" className="settings-button">
        비밀번호 변경
      </button>

      <button type="button" className="danger-button">
        회원 탈퇴
      </button>
    </div>
  );
}

export default AccountSettings;