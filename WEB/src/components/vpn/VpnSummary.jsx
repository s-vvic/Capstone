import "./VpnSummary.css";

function VpnSummary({
  totalDevices,
  connectedDevices,
  disconnectedDevices,
  errorDevices,
  refreshing,
  lastUpdated,
  onRefresh
}) {
  return (
    <section className="vpn-summary-section">
      <h2>카메라 VPN 상태 요약</h2>

      <div className="vpn-summary">
        <div className="vpn-summary-card">
          <span>전체 기기</span>
          <strong>
            {totalDevices}
            <small>대</small>
          </strong>
        </div>

      <div className="vpn-summary-card connected">
        <span>VPN 연결됨</span>
        <strong>
          {connectedDevices}
          <small>대</small>
        </strong>
      </div>

      <div className="vpn-summary-card disconnected">
        <span>연결 안 됨</span>
        <strong>
          {disconnectedDevices}
          <small>대</small>
        </strong>
      </div>

      <div className="vpn-summary-card error">
        <span>연결 오류</span>
        <strong>
          {errorDevices}
          <small>대</small>
        </strong>
      </div>

      <div className="vpn-refresh-card">
        <button
          type="button"
          className="vpn-refresh-button"
          onClick={onRefresh}
        >
        <span
          className={`refresh-icon-wrapper ${refreshing ? "spinning" : ""}`}
        >
          <svg
            className="refresh-icon"
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
            
        <span>마지막 업데이트</span>
        <small>
          {lastUpdated}
        </small>
      </div>
    </div>
  </section>
  );
}

export default VpnSummary;