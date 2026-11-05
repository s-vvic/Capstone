import { useEffect } from "react";
import { FiX } from "react-icons/fi";
import "./Modal.css";

// 공통 모달
function Modal({ title, onClose, children, footer, width = 520 }) {
  // ESC로 닫기
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="app-modal-overlay" onMouseDown={onClose}>
      <div
        className="app-modal"
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="app-modal-header">
          <h2>{title}</h2>

          <button
            type="button"
            className="app-modal-close"
            onClick={onClose}
            aria-label="닫기"
          >
            <FiX />
          </button>
        </div>

        <div className="app-modal-body">{children}</div>

        {footer && <div className="app-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
