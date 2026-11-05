import { useState } from "react";
import { FiDownload, FiImage, FiFilm, FiPlay, FiPause } from "react-icons/fi";
import Modal from "../Modal";
import "../Modal.css";
import "./EventMediaModal.css"; 
// import { getEventMedia, downloadEventMedia } from "../../api/eventApi";  // 서버 연결 후 주석 해제

// 이벤트 스냅샷 / 영상 상세 보기 및 다운로드 (WEB-F-032)
function EventMediaModal({ event, initialTab = "snapshot", onClose }) {
  const [tab, setTab] = useState(initialTab);
  const [imageFailed, setImageFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [downloadState, setDownloadState] = useState(null);

  /* 서버 연결 후
  const [media, setMedia] = useState(null);

  useEffect(() => {
    getEventMedia(event.id).then(setMedia).catch(console.error);
  }, [event.id]);
  */

  const occurredAt = event.occurredAt.replace("T", " ").slice(0, 19);
  const baseName = `event_${event.id}_${event.occurredAt.slice(0, 19).replace(/[-:T]/g, "")}`;

  const hasVideo = Boolean(event.videoUrl);

  function handleDownload() {
    setDownloadState("downloading");

    // 시연용: 실제 파일이 없으므로 서버 연결 전에는 대체 파일 생성
    setTimeout(() => {
      if (tab === "snapshot") {
        const svg = buildPlaceholderSvg(event, occurredAt);
        saveBlob(new Blob([svg], { type: "image/svg+xml" }), `${baseName}.svg`);
      } else {
        const info = [
          `event_id=${event.id}`,
          `camera=${event.cameraName} (${event.location})`,
          `occurred_at=${occurredAt}`,
          "※ 서버 연결 전 시연용 파일입니다. 실제 연동 시 mp4 영상이 다운로드됩니다.",
        ].join("\n");
        saveBlob(new Blob([info], { type: "text/plain;charset=utf-8" }), `${baseName}_video.txt`);
      }

      setDownloadState("done");
      setTimeout(() => setDownloadState(null), 1500);
    }, 600);

    /* 서버 연결 후
    const blob = await downloadEventMedia(event.id, tab);
    saveBlob(blob, tab === "snapshot" ? `${baseName}.jpg` : `${baseName}.mp4`);
    */
  }

  return (
    <Modal
      title="이벤트 미디어"
      width={820}
      onClose={onClose}
      footer={
        <>
          <span className="media-footer-info">
            {event.cameraName} ({event.location}) · {occurredAt}
          </span>
          <button
            type="button"
            className="btn primary"
            onClick={handleDownload}
            disabled={downloadState === "downloading"}
          >
            <FiDownload />
            {downloadState === "downloading" && "다운로드 중..."}
            {downloadState === "done" && "다운로드 완료"}
            {!downloadState && (tab === "snapshot" ? "스냅샷 다운로드" : "영상 다운로드")}
          </button>
        </>
      }
    >
      <div className="media-tabs">
        <button
          type="button"
          className={tab === "snapshot" ? "active" : ""}
          onClick={() => setTab("snapshot")}
        >
          <FiImage /> 스냅샷
        </button>
        <button
          type="button"
          className={tab === "video" ? "active" : ""}
          onClick={() => setTab("video")}
        >
          <FiFilm /> 이벤트 영상
        </button>
      </div>

      <div className="media-viewer">
        {tab === "snapshot" && (
          event.snapshotUrl && !imageFailed ? (
            <img
              src={event.snapshotUrl}
              alt="이벤트 스냅샷"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="media-placeholder">
              <FiImage />
              <span>스냅샷 미리보기</span>
              <small>{occurredAt}</small>
            </div>
          )
        )}

        {tab === "video" && (
          hasVideo ? (
            <video src={event.videoUrl} controls autoPlay />
          ) : (
            // 시연용 가짜 플레이어
            <div className="media-placeholder video">
              <button
                type="button"
                className="media-play"
                onClick={() => setIsPlaying((prev) => !prev)}
                aria-label={isPlaying ? "일시정지" : "재생"}
              >
                {isPlaying ? <FiPause /> : <FiPlay />}
              </button>
              <span>이벤트 전후 영상 (-10초 ~ +20초)</span>
              <div className="media-progress">
                <div className={`media-progress-fill ${isPlaying ? "playing" : ""}`} />
              </div>
            </div>
          )
        )}

        <span className="media-stamp">
          {event.cameraName} · {occurredAt}
        </span>
      </div>
    </Modal>
  );
}


function buildPlaceholderSvg(event, occurredAt) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
  <rect width="100%" height="100%" fill="#111316"/>
  <text x="640" y="350" fill="#BDD9D7" font-size="36" text-anchor="middle" font-family="sans-serif">Event #${event.id} Snapshot</text>
  <text x="640" y="400" fill="#9ba4ac" font-size="22" text-anchor="middle" font-family="sans-serif">${event.cameraName} · ${occurredAt}</text>
</svg>`;
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(url);
}

export default EventMediaModal;
