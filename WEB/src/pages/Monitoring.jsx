import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import "./Monitoring.css";
import { cameras } from "../data/cameras";
import EditableCameraName from "../components/EditableCameraName";

function Monitoring() {
  const { cameraId } = useParams();
  const navigate = useNavigate();

  const originalCamera = cameras.find(
    (item) => item.id === Number(cameraId)
  );

  const [camera, setCamera] = useState(originalCamera || null);

  const [currentTime, setCurrentTime] = useState(new Date());

  const [isEditingName, setIsEditingName] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [streamKey, setStreamKey] = useState(0);


  // URL에서 다른 카메라로 이동했을 때 정보 갱신
  useEffect(() => {
    setCamera(originalCamera || null);
    setIsEditingName(false);
  }, [cameraId]);


  // 현재 날짜 / 시간
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);


  if (!camera) {
    return (
      <main className="monitoring-page">
        <p>찾을 수 없는 카메라입니다.</p>

        <button
          type="button"
          onClick={() => navigate("/multiview")}
        >
          Back to MultiView
        </button>
      </main>
    );
  }


  // 이름 수정
  function handleNameSave(newName) {
    setCamera((prev) => ({
      ...prev,
      name: newName,
    }));

    setIsEditingName(false);

    // 나중에 API
    // await updateCameraName(camera.id, newName);
  }


  // 스트림 새로고침
  function handleStreamRefresh() {
    if (isRefreshing) return;

    setIsRefreshing(true);

    // 스트림 컴포넌트를 다시 mount
    setStreamKey((prev) => prev + 1);

    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);

    /*
      나중에 실제 HLS / WebRTC 연결 시에는
      여기서 player 재연결 로직 호출
    */
  }


  const formattedTime = currentTime.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });


  const isOnline = camera.status === "online";

  const isVpnConnected =
    camera.vpnStatus === "connected";


  return (
    <main className="monitoring-page">

      {/* 상단 카메라 상태 */}
      <div className="monitoring-header">

        <div className="monitoring-title-area">
          <h2>{camera.name}</h2>

          <span className="live-badge">
            LIVE
          </span>

          <span
            className={`connection-badge ${
              isOnline ? "connected" : "disconnected"
            }`}
          >
            <span className="status-dot" />
            {isOnline ? "Online" : "Offline"}
          </span>

          <span
            className={`connection-badge ${
              isVpnConnected
                ? "connected"
                : "disconnected"
            }`}
          >
            <span className="status-dot" />
            {isVpnConnected
              ? "VPN Connected"
              : "VPN Disconnected"}
          </span>
        </div>

      </div>


      <div className="monitoring-content">

        {/* ================= 영상 영역 ================= */}

        <section className="video-section">

          <div
            key={streamKey}
            className="real-time-video"
          >

            {/* 나중에 실제 영상 */}

            {/*
            <video
              className="video-player"
              autoPlay
              muted
              controls
            >
              <source
                src={camera.videoUrl}
                type="video/mp4"
              />
            </video>
            */}

            <div className="video-placeholder">
              Video Stream
            </div>


            {/* 좌측 상단 LIVE + 현재시간 */}

            <div className="video-time">

              <span className="video-live">
                LIVE
              </span>

              <span>
                {formattedTime}
              </span>

            </div>


            {/* 오른쪽 하단 새로고침 */}

            <button
              type="button"
              className="stream-refresh-button"
              onClick={handleStreamRefresh}
            >
              <span
                className={
                  isRefreshing
                    ? "refresh-icon rotating"
                    : "refresh-icon"
                }
              >
                ↻
              </span>

              {isRefreshing
                ? "재연결 중"
                : "새로고침"}
            </button>

          </div>

        </section>


        {/* ================= 정보 영역 ================= */}

        <aside className="camera-info-panel">

          <div className="info-panel-header">

            <h3>카메라 정보</h3>

            <button
              type="button"
              className="edit-name-button"
              onClick={() => setIsEditingName(true)}
              disabled={isEditingName}
              aria-hidden={isEditingName}
              tabIndex={isEditingName ? -1 : 0}
            >
              ✎ 이름 수정
            </button>

          </div>


          {/* 이름 */}

          <div className="info-row">

            <span className="info-label">
              카메라 이름
            </span>

            <EditableCameraName
              className="info-name"
              initialName={camera.name}
              isEditing={isEditingName}
              onSave={handleNameSave}
              onCancel={() => setIsEditingName(false)}
            />

          </div>


          <div className="info-row">
            <span className="info-label">
              설치 위치
            </span>

            <span className="info-value">
              {camera.location ?? "-"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              보드 ID
            </span>

            <span className="info-value">
              {camera.boardId ?? "-"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              시리얼 번호
            </span>

            <span className="info-value">
              {camera.serialNumber ??
                camera.hwnum ??
                "-"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              모델
            </span>

            <span className="info-value">
              {camera.model ?? "-"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              펌웨어 버전
            </span>

            <span className="info-value">
              {camera.firmwareVersion ?? "-"}
            </span>
          </div>


          {/* 상태 정보 */}

          <div className="info-section-title">
            상태 정보
          </div>


          <div className="info-row">
            <span className="info-label">
              온라인 상태
            </span>

            <span
              className={`status-value ${
                isOnline ? "online" : "offline"
              }`}
            >
              <span className="status-dot" />

              {isOnline
                ? "Online"
                : "Offline"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              VPN 상태
            </span>

            <span
              className={`status-value ${
                isVpnConnected
                  ? "online"
                  : "offline"
              }`}
            >
              <span className="status-dot" />

              {isVpnConnected
                ? "Connected"
                : "Disconnected"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              마지막 접속 시간
            </span>

            <span className="info-value">
              {camera.lastConnectedAt ?? "-"}
            </span>
          </div>


          <div className="info-row">
            <span className="info-label">
              업타임
            </span>

            <span className="info-value">
              {camera.uptime ?? "-"}
            </span>
          </div>

        </aside>

      </div>

    </main>
  );
}

export default Monitoring;