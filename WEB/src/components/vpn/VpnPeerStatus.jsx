import "./VpnPeerStatus.css";
function VpnPeerStatus({ status, onReconnect, disabled, simulated }) {
  const messages = {
    connecting: "VPN 서버 응답을 확인하고 있습니다...",
    connected:
      "VPN 서버에 접근할 수 있습니다. 클라이언트 터널 상태는 WireGuard 앱에서 확인해주세요.",
    error:
      "VPN 서버에 접근하지 못했습니다. WireGuard 앱에서 터널 연결을 확인한 후 다시 확인해주세요.",
    disconnected: "WireGuard 앱에서 VPN을 연결한 후 서버 상태를 확인해주세요.",
  };
  return (
    <section className={`peer-vpn-box ${status}`}>
      <div className="peer-vpn-info">
        <div className="peer-vpn-title">VPN 서버 연결 확인</div>
        <span className="peer-vpn-message">
          {messages[status] || messages.disconnected}
        </span>
        {simulated && (
          <span className="peer-vpn-message">
            개발용 가상 VPN 상태입니다. 실제 터널 연결 상태와 다릅니다.
          </span>
        )}
      </div>
      <button
        type="button"
        className="filter-reset-button"
        onClick={onReconnect}
        disabled={disabled || status === "connecting"}
      >
        상태 다시 확인
      </button>
    </section>
  );
}
export default VpnPeerStatus;
