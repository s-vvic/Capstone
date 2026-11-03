//카메라 32대 보여주는 화면
import "./Multiview.css";

import { useState, useEffect } from "react";
import CameraCard from "../components/CameraCard";
import Pagination from "../components/Pagination";
import { cameras as initialCameras } from "../data/cameras";
import { cameraApi } from "../api/cameraApi";

function Multiview() {

  const [cameras, setCameras] = useState(initialCameras);
  const [channelCount, setChannelCount] = useState(4);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadCameras() {
      try {
        const data = await cameraApi.getCameras();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          const transformed = data.map((d, idx) => ({
            id: d.device_id || d.id || idx + 1,
            name: d.name || `카메라 ${idx + 1}`,
            status: d.status || (d.is_online ? "online" : "offline"),
            ip: d.vpn_ip || d.ip || `10.0.0.${10 + idx}`,
            favorite: Boolean(d.favorite),
            hwnum: d.serial_no || d.device_id || `CAM-${String(idx + 1).padStart(4, "0")}`,
            location: d.location || "기본 위치",
            boardId: d.board_id || `BRD-${String(idx + 1).padStart(4, "0")}`,
            serialNumber: d.serial_no || `SMCL-${Date.now()}`,
            model: d.model || "RV1106",
            firmwareVersion: d.firmware_version || "v1.2.3",
            vpnStatus: d.vpn_status || (d.is_online ? "connected" : "disconnected"),
            vpnConnected: d.vpn_status === "connected" || Boolean(d.vpnConnected || d.is_online),
            streamStatus: d.stream_status || (d.is_online ? "live" : "offline"),
            lastConnectedAt: d.last_connected_at || d.updated_at || "2026-08-12 20:51:32",
            recentEventAt: d.recent_event_at || "2026-08-12 20:42:15",
            uptime: d.uptime || "3일 12시간",
            rtspUrl: d.rtsp_stream_url || "",
          }));
          setCameras(transformed);
        }
      } catch (err) {
        console.warn("[Multiview] Using fallback cameras data:", err.message);
      }
    }
    loadCameras();
    return () => {
      isMounted = false;
    };
  }, []);

  const rowsPerPage = 2;

  const camerasPerPage = channelCount * rowsPerPage;

  const filteredCameras = cameras.filter((camera) => {
    const keyword = searchKeyword.toLowerCase();

    const matchesSearch = 
      camera.name.toLowerCase().includes(keyword) ||
      camera.hwnum.toLowerCase().includes(keyword);

    const matchesOnline = 
    !onlineOnly || camera.status === "online";

    return matchesSearch && matchesOnline;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCameras.length / camerasPerPage)
  );

  const startIndex = (currentPage - 1) * camerasPerPage;
  const endIndex = startIndex + camerasPerPage;

  const currentCameras = filteredCameras.slice (
    startIndex,
    endIndex
  );
  
  const totalBoards = cameras.length;

  const onlineBoards = cameras.filter(
    (camera) => camera.status === "online"
  ).length;

  const offlineBoards = cameras.filter(
    (camera) => camera.status === "offline"
  ).length;

  const vpnConnectedBoards = cameras.filter(
    (camera) => camera.vpnConnected === true
  ).length;
  
  const todayAiEvents = 18;
  const unreadAlerts = 12;

  function handleChannelChange(count) {
    setChannelCount(count);
    setCurrentPage(1);
  }

  function handleSearchChange(e) {
    setSearchKeyword(e.target.value);
    setCurrentPage(1);
  }

  function handleOnlineFilter() {
    setOnlineOnly((prev) => !prev);
    setCurrentPage(1);
  }



  return (
    <div className="multiview">
      <section className="board-summary">
        <div className="summary-card">
          <span className="summary-title">전체 보드</span>
          <strong className="summary-value">{totalBoards}</strong>
          <span className="summary-unit">대</span>
        </div>

        <div className="summary-card online">
          <span className="summary-title">온라인</span>
          <strong className="summary-value">{onlineBoards}</strong>
          <span className="summary-unit">대</span>
        </div>

        <div className="summary-card offline">
          <span className="summary-title">오프라인</span>
          <strong className="summary-value">{offlineBoards}</strong>
          <span className="summary-unit">대</span>
        </div>

        <div className="summary-card vpn">
          <span className="summary-title">VPN 연결</span>
          <strong className="summary-value">{vpnConnectedBoards}</strong>
          <span className="summary-unit">대</span>
        </div>

        <div className="summary-card event">
          <span className="summary-title">오늘 AI 이벤트</span>
          <strong className="summary-value">{todayAiEvents}</strong>
          <span className="summary-unit">건</span>
        </div>

        <div className="summary-card alert">
          <span className="summary-title">미확인 알림</span>
          <strong className="summary-value">{unreadAlerts}</strong>
          <span className="summary-unit">건</span>
        </div>
      </section>

    <div className="multiview-toolbar">
      <div className="channel-selector">
        <button
          className={channelCount === 2 ? "active" : ""}
          onClick={() => handleChannelChange(2)}
        >
          2채널
        </button>
        <button
          className={channelCount === 4 ? "active" : ""}
          onClick={() => handleChannelChange(4)}
        >
          4채널
        </button>

        <button
          className={channelCount === 8 ? "active" : ""}
          onClick={() => handleChannelChange(8)}
        >
          8채널
        </button>
      </div>

      <div className="camera-search">
        <input
          type="text"
          placeholder="카메라 검색"
          value={searchKeyword}
          onChange={handleSearchChange}
        />
      </div>

      <button
        className={`filter-button ${onlineOnly ? "active" : ""}`}
        onClick={handleOnlineFilter}
      >
        ● 온라인 기기만 보기
      </button>
    </div>

    
    <div className="camera-container">
      <main 
        className="camera-list"
        style={{
          gridTemplateColumns: `repeat(${channelCount}, 1fr)`
        }}
      >
        {currentCameras.map((camera) => (
          <CameraCard camera={camera} />
        ))}
      </main>
    </div>

    <Pagination
      currentPage={currentPage}
      totalPages={totalPages}
      onPageChange={setCurrentPage}
    />
    </div>
  );
}

export default Multiview;