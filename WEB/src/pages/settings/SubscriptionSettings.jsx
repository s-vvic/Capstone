import { useState } from "react";

function SubscriptionSettings() {
  const [subscription, setSubscription] = useState({
    plan: "Standard",
    status: "active",
    nextPaymentDate: "2026-09-10",
    autoRenew: true
  });

  // 서버 연결 전 임시 상태 변경
  function handleAutoRenew() {
    setSubscription((prev) => ({
      ...prev,
      autoRenew: !prev.autoRenew
    }));
  }

  /*  서버 연결 후 
  async function handleAutoRenew() {
    const newValue = !subscription.autoRenew;

    setSubscription((prev) => ({
      ...prev,
      autoRenew: newValue
    }));

    try {
      const response = await fetch(
        "/api/subscriptions/auto-renew",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            enabled: newValue
          })
        }
      );

      if (!response.ok) {
        throw new Error("자동 갱신 변경 실패");
      }
    } catch (error) {
      setSubscription((prev) => ({
        ...prev,
        autoRenew: !newValue
      }));
    }
  } */

  return (
    <div className="settings-section">
      <h2>구독 설정</h2>

      <div className="setting-card">
        <div>
          <strong>현재 요금제</strong>
          <p>현재 이용 중인 구독 요금제입니다.</p>
        </div>

        <span className="subscription-value">
          {subscription.plan}
        </span>
      </div>


      <div className="setting-card">
        <div>
          <strong>구독 상태</strong>
          <p>현재 구독 서비스 이용 상태입니다.</p>
        </div>

        <span className="subscription-status">
          {subscription.status === "active"
            ? "이용 중"
            : "만료"}
        </span>
      </div>


      <div className="setting-card">
        <div>
          <strong>다음 결제일</strong>
          <p>다음 구독 결제 예정일입니다.</p>
        </div>

        <span className="subscription-value">
          {subscription.nextPaymentDate}
        </span>
      </div>


      <div className="setting-card">
        <div>
          <strong>자동 갱신</strong>
          <p>
            구독 기간 종료 시 현재 요금제를 자동으로 갱신합니다.
          </p>
        </div>

        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={subscription.autoRenew}
            onChange={handleAutoRenew}
          />

          <span className="toggle-slider"></span>
        </label>
      </div>


      <div className="setting-card">
        <div>
          <strong>요금제 변경</strong>
          <p>현재 이용 중인 구독 요금제를 변경합니다.</p>
        </div>

        <button
          type="button"
          className="settings-button"
        >
          요금제 변경
        </button>
      </div>

    </div>
  );
}

export default SubscriptionSettings;