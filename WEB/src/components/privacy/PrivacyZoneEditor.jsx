import { useRef, useState } from "react";
import { FiTrash2, FiEye, FiEyeOff } from "react-icons/fi";
import Toggle from "../Toggle";
import "./PrivacyZoneEditor.css";

export const MAX_ZONES = 4;
const MIN_SIZE = 0.03; // 너무 작은 영역 방지 (비율)

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

// 프라이버시 존 편집기
// 영상 위에서 드래그하여 영역 추가, 선택 후 이름 / 활성화 / 삭제
// zones 좌표는 영상 크기 대비 비율 (0 ~ 1)
function PrivacyZoneEditor({ zones, onChange, cameraName }) {
  const stageRef = useRef(null);

  const [drawing, setDrawing] = useState(null); // { startX, startY, x, y }
  const [selectedId, setSelectedId] = useState(zones[0]?.id ?? null);
  const [showMask, setShowMask] = useState(true);

  const isFull = zones.length >= MAX_ZONES;

  function getPoint(e) {
    const rect = stageRef.current.getBoundingClientRect();

    return {
      x: clamp((e.clientX - rect.left) / rect.width),
      y: clamp((e.clientY - rect.top) / rect.height),
    };
  }

  function handleMouseDown(e) {
    // 기존 영역 클릭은 선택만
    if (e.target.closest(".pz-zone")) return;
    if (isFull) return;

    const point = getPoint(e);

    setDrawing({ startX: point.x, startY: point.y, x: point.x, y: point.y });
    setSelectedId(null);
  }

  function handleMouseMove(e) {
    if (!drawing) return;

    const point = getPoint(e);

    setDrawing((prev) => ({ ...prev, x: point.x, y: point.y }));
  }

  function handleMouseUp() {
    if (!drawing) return;

    const rect = toRect(drawing);

    setDrawing(null);

    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) return;

    const newZone = {
      id: `zone-${Date.now()}`,
      name: `영역 ${zones.length + 1}`,
      ...rect,
      enabled: true,
    };

    onChange([...zones, newZone]);
    setSelectedId(newZone.id);
  }

  function updateZone(id, patch) {
    onChange(zones.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone)));
  }

  function removeZone(id) {
    onChange(zones.filter((zone) => zone.id !== id));

    if (selectedId === id) setSelectedId(null);
  }

  const draftRect = drawing ? toRect(drawing) : null;

  return (
    <div className="pz-editor">
      <div className="pz-stage-wrapper">
        <div
          ref={stageRef}
          className={`pz-stage ${isFull ? "full" : ""}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <span className="pz-stage-placeholder">{cameraName ?? "Video Stream"}</span>

          {zones.map((zone, index) => (
            <button
              type="button"
              key={zone.id}
              className={[
                "pz-zone",
                selectedId === zone.id ? "selected" : "",
                zone.enabled ? "" : "disabled",
                showMask && zone.enabled ? "masked" : "",
              ].join(" ")}
              style={toStyle(zone)}
              onClick={() => setSelectedId(zone.id)}
            >
              <span className="pz-zone-label">
                {index + 1}. {zone.name}
              </span>
            </button>
          ))}

          {draftRect && <div className="pz-zone drawing" style={toStyle(draftRect)} />}
        </div>

        <div className="pz-stage-help">
          <span>
            {isFull
              ? `프라이버시 존은 최대 ${MAX_ZONES}개까지 설정할 수 있습니다.`
              : "영상 위를 드래그하여 가릴 영역을 추가하세요."}
          </span>

          <button type="button" className="btn small" onClick={() => setShowMask((prev) => !prev)}>
            {showMask ? <FiEyeOff /> : <FiEye />}
            {showMask ? "마스킹 미리보기 끄기" : "마스킹 미리보기"}
          </button>
        </div>
      </div>


      <div className="pz-list">
        <div className="pz-list-header">
          <strong>영역 목록</strong>
          <span>
            {zones.length} / {MAX_ZONES}
          </span>
        </div>

        {zones.length === 0 && <p className="pz-empty">설정된 프라이버시 존이 없습니다.</p>}

        {zones.map((zone, index) => (
          <div
            key={zone.id}
            className={`pz-item ${selectedId === zone.id ? "selected" : ""}`}
            onClick={() => setSelectedId(zone.id)}
          >
            <span className="pz-item-index">{index + 1}</span>

            <div className="pz-item-body">
              <input
                className="field-input"
                value={zone.name}
                maxLength={20}
                onChange={(e) => updateZone(zone.id, { name: e.target.value })}
                aria-label="영역 이름"
              />
              <small>
                x {pct(zone.x)} · y {pct(zone.y)} · {pct(zone.width)} × {pct(zone.height)}
              </small>
            </div>

            <Toggle
              checked={zone.enabled}
              onChange={() => updateZone(zone.id, { enabled: !zone.enabled })}
            />

            <button
              type="button"
              className="pz-item-delete"
              onClick={(e) => {
                e.stopPropagation();
                removeZone(zone.id);
              }}
              aria-label="영역 삭제"
            >
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}


function toRect({ startX, startY, x, y }) {
  return {
    x: Math.min(startX, x),
    y: Math.min(startY, y),
    width: Math.abs(x - startX),
    height: Math.abs(y - startY),
  };
}

function toStyle(rect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  };
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

export default PrivacyZoneEditor;
