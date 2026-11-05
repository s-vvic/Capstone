import { useState } from "react";
import { FiCreditCard, FiPlus, FiTrash2 } from "react-icons/fi";
import Modal from "../Modal";
import "../Modal.css";
import "./SettingsExtra.css";
import { initialPaymentMethods } from "../../data/subscriptionMock";
/* 서버 연결 후 주석 해제
import {
  getPaymentMethods,
  addPaymentMethod,
  setDefaultPaymentMethod,
  deletePaymentMethod,
} from "../../api/settingsApi";
*/

// 결제 수단 관리 (WEB-F-061)
// 카드 번호는 직접 입력받지 않고 PG사 결제창에서 등록 → 서버는 빌링키만 보관
function PaymentMethods() {
  const [methods, setMethods] = useState(initialPaymentMethods);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  function handleSetDefault(id) {
    setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })));
    // await setDefaultPaymentMethod(id);
  }

  function handleDelete(id) {
    setMethods((prev) => {
      const next = prev.filter((m) => m.id !== id);

      // 기본 결제 수단 삭제 시 첫 번째를 기본으로
      if (next.length > 0 && !next.some((m) => m.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }

      return next;
    });

    setDeleteTarget(null);
    // await deletePaymentMethod(id);
  }

  // 시연용: PG 결제창 등록 완료를 가정하고 테스트 카드 추가
  function handleDemoAdd() {
    setMethods((prev) => [
      ...prev,
      {
        id: `pm-${Date.now()}`,
        type: "card",
        brand: "TEST CARD",
        last4: String(1000 + prev.length * 1111).slice(-4),
        expiry: "01/30",
        isDefault: prev.length === 0,
      },
    ]);

    setIsAddOpen(false);
    // 서버 연결 후: PG 결제창 콜백의 billingKey로 addPaymentMethod(billingKey)
  }

  return (
    <div className="payment-section">
      <div className="payment-header">
        <div>
          <strong>결제 수단</strong>
          <p>구독 요금이 청구될 결제 수단을 관리합니다.</p>
        </div>

        <button type="button" className="btn small" onClick={() => setIsAddOpen(true)}>
          <FiPlus />
          결제 수단 추가
        </button>
      </div>

      {methods.length === 0 && (
        <p className="payment-empty">등록된 결제 수단이 없습니다.</p>
      )}

      <ul className="payment-list">
        {methods.map((method) => (
          <li key={method.id} className={method.isDefault ? "default" : ""}>
            <FiCreditCard className="payment-icon" />

            <div className="payment-info">
              <strong>
                {method.brand} •••• {method.last4}
              </strong>
              <small>만료 {method.expiry}</small>
            </div>

            {method.isDefault ? (
              <span className="payment-default-badge">기본 결제 수단</span>
            ) : (
              <button
                type="button"
                className="btn small"
                onClick={() => handleSetDefault(method.id)}
              >
                기본으로 설정
              </button>
            )}

            <button
              type="button"
              className="payment-delete"
              onClick={() => setDeleteTarget(method)}
              aria-label="결제 수단 삭제"
            >
              <FiTrash2 />
            </button>
          </li>
        ))}
      </ul>


      {isAddOpen && (
        <Modal
          title="결제 수단 추가"
          width={460}
          onClose={() => setIsAddOpen(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setIsAddOpen(false)}>
                취소
              </button>
              <button type="button" className="btn primary" onClick={handleDemoAdd}>
                테스트 카드 등록 (시연)
              </button>
            </>
          }
        >
          <p className="payment-modal-text">
            결제 수단은 결제 대행사(PG) 보안 결제창에서 등록됩니다.
            <br />
            SECURE CAM은 카드 번호를 저장하지 않으며, 마지막 4자리만 표시됩니다.
          </p>
          <p className="payment-modal-note">
            <span className="demo-tag">DEMO</span> 서버 연결 전에는 PG 결제창 대신 테스트 카드가 등록됩니다.
          </p>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="결제 수단 삭제"
          width={420}
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setDeleteTarget(null)}>
                취소
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => handleDelete(deleteTarget.id)}
              >
                삭제
              </button>
            </>
          }
        >
          <p className="payment-modal-text">
            {deleteTarget.brand} •••• {deleteTarget.last4} 결제 수단을 삭제하시겠습니까?
            {deleteTarget.isDefault && (
              <>
                <br />
                기본 결제 수단을 삭제하면 다른 결제 수단이 기본으로 지정됩니다.
              </>
            )}
          </p>
        </Modal>
      )}
    </div>
  );
}

export default PaymentMethods;
