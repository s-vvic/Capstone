import { useState } from "react";
import { FiX } from "react-icons/fi";

import "./CameraRegisterModal.css";

const CAMERA_NAME_PATTERN = /^[가-힣a-zA-Z0-9 _()-]*$/;


function CameraRegisterModal({ onClose, onRegister }) {
  const [ serialNumber, setSerialNumber ] = useState("");
  const [ activationCode, setActivationCode ] = useState("");
  const [ cameraName, setCameraName ] = useState("");
  const [ location, setLocation ] = useState("");

  const [ errorMessage, setErrorMessage ] = useState("");
  const [ submitted, setSubmitted ] = useState(false);
  const [ cameraNameError, setCameraNameError ] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    setSubmitted(true);

    const isSerialEmpty = !serialNumber.trim();
    const isCodeEmpty = !activationCode.trim();
    const isNameEmpty = !cameraName.trim();

    if (isSerialEmpty || isCodeEmpty || isNameEmpty) {
      setErrorMessage("필수 항목을 모두 입력해주세요.");
      return;
    }

    if (!CAMERA_NAME_PATTERN.text(cameraName.trim())) {
      setErrorMessage(
        "카메라 이름은 한글, 영문, 숫자, 공백, -, _, (, )만 사용할 수 있습니다."
      );
      return;
    }

    setErrorMessage("");

    const newCamera = {
      serialNumber: serialNumber.trim(),
      activationCode: activationCode.trim(),
      name: cameraName.trim(),
      location: location.trim() || "미설정",
    };

    onRegister(newCamera);
  }

  return (
    <div 
      className="register-modal-overlay"
      onMouseDown={onClose}
    >
      <div
        className="register-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="register-modal-header">
          <div>
            <h2>카메라 등록</h2>
            <p>새로운 카메라 보드를 계정에 등록합니다.</p>
          </div>

          <button
            type="button"
            className="modal-close-button"
            onClick={onClose}
          >
            <FiX />
          </button>
        </div>

        <form
          className="register-form"
          onSubmit={handleSubmit}
        >
          <div className="register-field">
            <label>
              시리얼 번호 
              <span className="required-mark">*</span>
            </label>
            <input
              type="text"
              placeholder="보드 시리얼 번호"
              value={serialNumber}
              className={
                submitted && !serialNumber.trim()
                  ? "input-error"
                  : ""
              }
              onChange={(event) => {
                setSerialNumber(event.target.value);
                setErrorMessage("");
              }}
            />
          </div>

          <div className="register-field">
            <label>
              등록 코드
              <span className="required-mark">*</span>
            </label>
            <input
              type="text"
              placeholder="Activation Code"
              value={activationCode}
              className={
                submitted && !activationCode.trim()
                  ? "input-error"
                  : ""
              }
              onChange={(event) => {
                setActivationCode(event.target.value);
                setErrorMessage("");
              }}
            />
          </div>

          <div className="register-devider" />

          <div className="register-field">
            <label>
              카메라 이름
              <span className="required-mark">*</span>
            </label>
            <div className="camera-name-input-wrapper">
              <input
                type="text"
                placeholder="예: CAM-01 (출입구)"
                maxLength={15}
                value={cameraName}
                className={
                  (submitted && !cameraName.trim()) || cameraNameError
                    ? "input-error"
                    : ""
                }
                onChange={(event) => {
                  const value = event.target.value;

                  setCameraName(value);
                  setErrorMessage("");

                  if (!CAMERA_NAME_PATTERN.text(value)) {
                    setCameraNameError(
                      "한글, 영문, 숫자, 공백, -, _, (, )만 사용할 수 있습니다."
                    );
                  } else {
                    setCameraNameError("");
                  }
                }}
              />

              <span className={`input-character-count ${
                  cameraName.length === 15 ? "limit" : ""
                }`}
              >
                {String(cameraName.length).padStart(2, "0")}/15
              </span>
            </div>
            {cameraNameError && (
              <p className="field-error-message">
                {cameraNameError}
              </p>
            )}
          </div>

          <div className="register-field">
            <label>설치 위치</label>
            <div className="camera-location-input-wrapper">
              <input
                type="text"
                placeholder="예: 1층 출입구"
                maxLength={30}
                value={location}
                onChange={(event) =>
                  setLocation(event.target.value)
                }
              />
              <span className={`input-character-count ${
                  location.length === 30 ? "limit" : ""
                }`}
              >
                {String(location.length).padStart(2, "0")}/30
              </span>
            </div>  
          </div>

          {errorMessage && (
            <p className="register-error-message">
              {errorMessage}
            </p>
          )}

          <div className="register-modal-actions">
            <button
              type="button"
              className="cancel-register-button"
              onClick={onClose}
            >
              취소
            </button>
            <button
              type="submit"
              className="confirm-register-button"
            >
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CameraRegisterModal;
