import { useEffect, useState } from "react";
import { FiX, FiCheck } from "react-icons/fi";
import "./EditableCameraName.css";

function EditableCameraName({
  initialName,
  isEditing,
  onSave,
  onCancel,
  className = "",
}) {
  const [newName, setNewName] = useState(initialName);

  useEffect(() => {
    setNewName(initialName);
  }, [initialName, isEditing]);

  function handleSaveName() {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      setNewName(initialName);
      return;
    }

    onSave(trimmedName);
  }

  function handleCancelEdit() {
    setNewName(initialName);
    onCancel();
  }

  function handleNameKeyDown(event) {
    if (event.key === "Enter") {
      handleSaveName();
    }

    if (event.key === "Escape") {
      handleCancelEdit();
    }
  }

  if (isEditing) {
    return (
      <div className={`name-edit-row ${className}`.trim()}>
        <input
          className="name-input"
          aria-label="카메라 이름"
          type="text"
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={handleNameKeyDown}
          maxLength={15}
          autoFocus
        />

        <button
          type="button"
          className="edit-action save"
          onClick={handleSaveName}
          aria-label="카메라 이름 저장"
        >
          <FiCheck />
        </button>

        <button
          type="button"
          className="edit-action"
          onClick={handleCancelEdit}
          aria-label="이름 변경 취소"
        >
          <FiX />
        </button>
      </div>
    );
  }

  return (
    <span className={`device-camera-name ${className}`.trim()}>
      {initialName}
    </span>
  );
}

export default EditableCameraName;