
function AccountSettings() {
  return (
    <div className="settings-section">
      <h2>계정 설정</h2>

      <div className="account-field">
        <label>사용자 이름</label>
        <input type="text" defaultValue="admin" />
      </div>

      <div className="account-field">
        <label>이메일</label>
        <input
          type="email"
          defaultValue="admin@example.com"
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