import "./VpnSummary.css";
import {
  FiShield,
  FiShieldOff,
  FiVideo,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
} from "react-icons/fi";
import { VPN_STATUS_META } from "../charts/chartColors";

// Client VPN(이 PC) 상태 문구
const PEER_STATUS_TEXT = {
  connected: { label: "서버 응답 정상", message: "터널 상태는 WireGuard 앱에서 확인해주세요." },
  connecting: { label: "확인 중", message: "VPN 서버 응답을 확인하고 있습니다..." },
  error: { label: "연결 오류", message: "VPN 연결에 실패했습니다. 다시 시도해주세요." },
  disconnected: { label: "연결 안 됨", message: "VPN이 연결되어 있지 않습니다." },
};

// Client VPN 연결 상태 + 카메라 VPN 상태 요약을 한 줄로 (WEB-F-041 / WEB-F-050)
function VpnSummary({
  peerStatus,
  onPeerReconnect, // 재연결 버튼용 (현재 버튼은 숨김 상태)
  totalDevices,
  connectedDevices,
  disconnectedDevices,
  errorDevices,
  refreshing,
  disabled,
  simulated,
  lastUpdated,
  onRefresh
}) {
  const peer = PEER_STATUS_TEXT[peerStatus] ?? PEER_STATUS_TEXT.disconnected;

  const stats = [
    { key: "total", label: "전체 기기", value: totalDevices, icon: <FiVideo /> },
    { key: "connected", label: VPN_STATUS_META.connected.label, value: connectedDevices, icon: <FiCheckCircle /> },
    { key: "disconnected", label: VPN_STATUS_META.disconnected.label, value: disconnectedDevices, icon: <FiXCircle /> },
    { key: "error", label: VPN_STATUS_META.error.label, value: errorDevices, icon: <FiAlertTriangle /> },
  ];

  return (
    <section className="vpn-summary-bar">

      {/* Client VPN (이 PC) */}
      <div className={`vpn-peer ${peerStatus}`}>
        <span className="vpn-peer-icon">
          {peerStatus === "connected" ? <FiShield /> : <FiShieldOff />}
        </span>

        <div className="vpn-peer-text">
          <span className="vpn-peer-caption">VPN 서버 접근</span>
          <strong className="vpn-peer-label">
            {peerStatus === "connecting" && <span className="vpn-peer-spinner" />}
            {peer.label}
          </strong>
          <small className="vpn-peer-message">{peer.message}</small>
          {simulated && <small className="vpn-peer-message">개발용 가상 VPN 상태입니다. 실제 터널 연결 상태와 다릅니다.</small>}
        </div>

        <button
          type="button"
          className="peer-connect-button"
          onClick={onPeerReconnect}
          disabled={disabled || peerStatus === "connecting"}
        >
          상태 다시 확인
        </button>
      </div>

      {/* 카메라 VPN 상태 요약 */}
      <div className="vpn-summary-stats">
        <span className="vpn-summary-caption">카메라 VPN 상태</span>

        <div className="vpn-summary-items">
          {stats.map((stat) => (
            <div key={stat.key} className={`vpn-summary-item ${stat.key}`}>
              <span className="vpn-summary-item-icon">{stat.icon}</span>

              <div className="vpn-summary-item-text">
                <span className="vpn-summary-item-label">{stat.label}</span>
                <strong>
                  {stat.value}
                  <small>대</small>
                </strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 새로고침 */}
      <div className="vpn-refresh">
        <button
          type="button"
          className="vpn-refresh-button"
          onClick={onRefresh}
          disabled={disabled}
        >
          <span
            className={`refresh-icon-wrapper ${refreshing ? "spinning" : ""}`}
          >
            <svg
              className="vpn-refresh-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 12a8 8 0 1 0-2.3 5.7" />
              <path d="M20 4v8h-8" />
            </svg>
          </span>
          새로고침
        </button>

        <small>마지막 업데이트 {lastUpdated}</small>
      </div>
    </section>
  );
}

export default VpnSummary;
