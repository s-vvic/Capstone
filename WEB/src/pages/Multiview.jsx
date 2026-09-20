//카메라 32대 보여주는 화면
import "./Multiview.css";

import { useState } from "react";
import CameraCard from "../components/CameraCard";
import Pagination from "../components/Pagination";
import { cameras as initialCameras } from "../data/cameras";

function Multiview() {

  const [cameras, setCameras] = useState(initialCameras);
  const [channelCount, setChannelCount] = useState(4);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

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

  // const [cameras, setCameras] = useState([]);

  // useEffect(() => {
  //   async function getCameras() {
  //     const response = await fetch("/api/cameras");
  //     const data = await response.json();

  //     setCameras(data);
  //   }

  //   getCameras();
  // }, []);

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