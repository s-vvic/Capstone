import { useState } from "react";
import { FiCheck } from "react-icons/fi";
import Modal from "../Modal";
import "../Modal.css";
import "./SettingsExtra.css";
import { subscriptionPlans } from "../../data/subscriptionMock";

// 요금제 변경 (WEB-F-061)
function PlanChangeModal({ currentPlan, onClose, onConfirm }) {
  const current = subscriptionPlans.find((plan) => plan.name === currentPlan);
  const [selectedId, setSelectedId] = useState(current?.id ?? subscriptionPlans[0].id);
  const [saving, setSaving] = useState(false);

  const selected = subscriptionPlans.find((plan) => plan.id === selectedId);
  const isSame = selected.name === currentPlan;
  const isUpgrade = current && selected.price > current.price;

  function handleConfirm() {
    setSaving(true);

    // 시연용 지연 — 서버 연결 후 changeSubscriptionPlan(selectedId) 호출
    setTimeout(() => {
      onConfirm(selected);
      onClose();
    }, 700);
  }

  return (
    <Modal
      title="요금제 변경"
      width={760}
      onClose={onClose}
      footer={
        <>
          <span className="plan-footer-note">
            {isSame
              ? "현재 이용 중인 요금제입니다."
              : isUpgrade
                ? "업그레이드는 즉시 적용되며 차액이 일할 계산되어 청구됩니다."
                : "다운그레이드는 다음 결제일부터 적용됩니다."}
          </span>
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleConfirm}
            disabled={isSame || saving}
          >
            {saving ? "변경 중..." : `${selected.name}(으)로 변경`}
          </button>
        </>
      }
    >
      <div className="plan-grid">
        {subscriptionPlans.map((plan) => (
          <button
            type="button"
            key={plan.id}
            className={`plan-card ${selectedId === plan.id ? "selected" : ""}`}
            onClick={() => setSelectedId(plan.id)}
          >
            {plan.name === currentPlan && <span className="plan-current">현재 요금제</span>}

            <strong className="plan-name">{plan.name}</strong>
            <span className="plan-price">
              ₩{plan.price.toLocaleString()}
              <small>/월</small>
            </span>

            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <FiCheck />
                  {feature}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export default PlanChangeModal;
