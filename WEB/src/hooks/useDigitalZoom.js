import { useCallback, useEffect, useRef, useState } from "react";

/*
  디지털 줌 (영상 자체를 CSS transform 으로 확대 / 이동)
  - 위치(x, y)는 화면 크기 대비 비율로 저장 → 창 크기가 바뀌어도 보던 영역이 그대로 유지
  - 마우스 휠: 커서 위치 기준 확대/축소, 드래그: 이동, 더블클릭: 2배 ↔ 원래대로
  - 터치: 두 손가락 핀치 확대 / 한 손가락 이동
*/

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
const BUTTON_STEP = 0.5;
const WHEEL_SENSITIVITY = 0.0015;

const INITIAL_VIEW = { scale: 1, x: 0, y: 0 };

// 확대된 영상이 항상 화면을 꽉 채우도록 (가장자리 밖 빈 공간이 보이지 않게)
function clampView({ scale, x, y }) {
  const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
  const min = 1 - s;

  return {
    scale: s,
    x: Math.min(0, Math.max(min, x)),
    y: Math.min(0, Math.max(min, y)),
  };
}

// (px, py) 지점이 확대 전후에 같은 자리에 머물도록 이동량 보정
function zoomAround(view, nextScale, px, py) {
  const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextScale));
  const ratio = s / view.scale;

  return clampView({
    scale: s,
    x: px - (px - view.x) * ratio,
    y: py - (py - view.y) * ratio,
  });
}

function useDigitalZoom(stageRef) {
  const [view, setView] = useState(INITIAL_VIEW);
  const [isPanning, setIsPanning] = useState(false);

  // 화면에 닿아 있는 포인터들 (pointerId → {x, y})
  const pointersRef = useRef(new Map());

  // 화면 좌표 → 스테이지 기준 비율 좌표
  const toRatio = useCallback(
    (clientX, clientY) => {
      const rect = stageRef.current.getBoundingClientRect();

      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height,
        width: rect.width,
        height: rect.height,
      };
    },
    [stageRef]
  );

  const reset = useCallback(() => setView(INITIAL_VIEW), []);

  // 버튼 확대/축소는 화면 가운데 기준
  const zoomIn = useCallback(
    () => setView((prev) => zoomAround(prev, prev.scale + BUTTON_STEP, 0.5, 0.5)),
    []
  );

  const zoomOut = useCallback(
    () => setView((prev) => zoomAround(prev, prev.scale - BUTTON_STEP, 0.5, 0.5)),
    []
  );

  // 휠은 페이지 스크롤을 막아야 해서 passive: false 로 직접 등록
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    function handleWheel(event) {
      event.preventDefault();

      const point = toRatio(event.clientX, event.clientY);
      const factor = Math.exp(-event.deltaY * WHEEL_SENSITIVITY);

      setView((prev) => zoomAround(prev, prev.scale * factor, point.x, point.y));
    }

    stage.addEventListener("wheel", handleWheel, { passive: false });

    return () => stage.removeEventListener("wheel", handleWheel);
  }, [stageRef, toRatio]);

  function handlePointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    setIsPanning(true);
  }

  function handlePointerMove(event) {
    const pointers = pointersRef.current;
    const prevPoint = pointers.get(event.pointerId);
    if (!prevPoint) return;

    const nextPoint = { x: event.clientX, y: event.clientY };

    if (pointers.size >= 2) {
      // 핀치: 두 손가락 사이 거리 변화만큼 확대, 가운데 지점 이동만큼 이동
      const [otherId] = [...pointers.keys()].filter((id) => id !== event.pointerId);
      const other = pointers.get(otherId);

      const prevDist = Math.hypot(prevPoint.x - other.x, prevPoint.y - other.y);
      const nextDist = Math.hypot(nextPoint.x - other.x, nextPoint.y - other.y);

      const prevMid = toRatio((prevPoint.x + other.x) / 2, (prevPoint.y + other.y) / 2);
      const nextMid = toRatio((nextPoint.x + other.x) / 2, (nextPoint.y + other.y) / 2);

      if (prevDist > 0) {
        setView((prev) => {
          const zoomed = zoomAround(prev, prev.scale * (nextDist / prevDist), prevMid.x, prevMid.y);

          return clampView({
            ...zoomed,
            x: zoomed.x + (nextMid.x - prevMid.x),
            y: zoomed.y + (nextMid.y - prevMid.y),
          });
        });
      }
    } else {
      // 이동: 확대 안 된 상태면 clampView 가 0 으로 고정
      const { width, height } = toRatio(0, 0);
      const dx = (nextPoint.x - prevPoint.x) / width;
      const dy = (nextPoint.y - prevPoint.y) / height;

      setView((prev) => clampView({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    }

    pointers.set(event.pointerId, nextPoint);
  }

  function handlePointerUp(event) {
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size === 0) setIsPanning(false);
  }

  function handleDoubleClick(event) {
    if (view.scale > MIN_ZOOM) {
      reset();
      return;
    }

    const point = toRatio(event.clientX, event.clientY);
    setView((prev) => zoomAround(prev, 2, point.x, point.y));
  }

  return {
    scale: view.scale,
    isZoomed: view.scale > MIN_ZOOM,
    isPanning,

    // translate 퍼센트는 레이어 자기 크기(= 스테이지 크기) 기준
    layerStyle: {
      transform: `translate(${view.x * 100}%, ${view.y * 100}%) scale(${view.scale})`,
    },

    zoomIn,
    zoomOut,
    reset,

    stageHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onDoubleClick: handleDoubleClick,
    },
  };
}

export default useDigitalZoom;
