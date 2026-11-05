import "./VpnDeviceTable.css";

function VpnDeviceTable({
  devices,
  onConnection,
  onRecoveryRequest,
  onSelect,
  pending,
  disabled,
  emptyMessage,
}) {
  const statusText = {
    connected: "정상",
    disconnected: "연결 끊김",
    error: "오류",
  };
  return (
    <div className="vpn-table-wrapper">
      <table className="vpn-table">
        <thead>
          <tr>
            <th>카메라 이름</th>
            <th>MAC / 기기 ID</th>
            <th>VPN 상태</th>
            <th>VPN IP</th>
            <th>최근 Handshake</th>
            <th>연결 시간</th>
            <th>오류 상태</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {!devices.length && (
            <tr>
              <td colSpan={8}>{emptyMessage || "등록된 기기가 없습니다."}</td>
            </tr>
          )}
          {devices.map((device) => (
            <tr key={device.id} className="vpn-row-clickable"
              onClick={(event) => { if (!event.target.closest("button")) onSelect?.(device); }}>
              <td title={device.name}><button type="button" className="vpn-device-detail-button" onClick={() => onSelect?.(device)} aria-label={`${device.name} 상세 정보`}>{device.name}</button></td>
              <td title={device.mac !== "-" ? device.mac : device.id}>
                {device.mac !== "-" ? device.mac : device.id}
              </td>
              <td>
                <span className={`vpn-status ${device.vpnStatus}`}>
                  <span className="status-dot" />
                  {statusText[device.vpnStatus] || "확인 중"}
                </span>
              </td>
              <td>{device.vpnIp}</td>
              <td title={device.lastHandshake}>{device.lastHandshake}</td>
              <td>{device.duration}</td>
              <td
                className={device.error ? "vpn-error" : ""}
                title={device.error || ""}
              >
                {device.error || "-"}
              </td>
              <td>
                {pending?.id === device.id ? (
                  <span role="status">
                    {pending.action === "recover"
                      ? "복구 요청 중..."
                      : "처리 중..."}
                  </span>
                ) : (
                  <div className="vpn-row-actions">
                    <button
                      type="button"
                      className="vpn-recovery-button request"
                      disabled={disabled}
                      aria-label={`${device.name} ${device.vpnStatus === "connected" ? "연결 해제" : "연결"}`}
                      onClick={() => onConnection(device.id)}
                    >
                      {device.vpnStatus === "connected" ? "연결 해제" : "연결"}
                    </button>
                    {device.vpnStatus === "error" && (
                      <button
                        type="button"
                        className="vpn-recovery-button request"
                        disabled={disabled}
                        aria-label={`${device.name} 복구 요청`}
                        onClick={() => onRecoveryRequest(device.id)}
                      >
                        복구 요청
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default VpnDeviceTable;
