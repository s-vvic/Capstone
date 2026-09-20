import "./VpnDeviceTable.css";

function VpnDeviceTable({
  devices,
  onRecoveryRequest,
  onAction, // 기존 코드 호환용
}) {

  function getStatusText(status) {
    switch (status) {
      case "connected":
        return "정상";
      case "disconnected":
        return "연결 끊김";
      case "error":
        return "오류";
      default:
        return "확인 중";
    }
  }

  function getRecoveryState(device) {
    const recoveryStatus = device.recoveryStatus;

    if (recoveryStatus === "normal" || recoveryStatus === "정상") {
      return { code: "normal", text: "정상" };
    }

    if (recoveryStatus === "recovering" || recoveryStatus === "복구 중") {
      return { code: "recovering", text: "복구 중" };
    }

    if (recoveryStatus === "failed" || recoveryStatus === "복구 실패") {
      return { code: "failed", text: "복구 실패" };
    }

    switch (device.vpnStatus) {
      case "connected":
        return { code: "normal", text: "정상" };
      case "disconnected":
        return { code: "recovering", text: "복구 중" };
      case "error":
        return { code: "failed", text: "복구 실패" };
      default:
        return { code: "unknown", text: "-" };
    }
  }

  function handleRecoveryRequest(deviceId) {
    if (onRecoveryRequest) {
      onRecoveryRequest(deviceId);
      return;
    }

    onAction?.(deviceId);
  }

  return (
    <div className="vpn-table-wrapper">
      <table className="vpn-table">

        <colgroup>
          <col className="col-name" />
          <col className="col-serial" />
          <col className="col-status" />
          <col className="col-ip" />
          <col className="col-handshake" />
          <col className="col-error" />
          <col className="col-recovery" />
          <col className="col-action" />
        </colgroup>

        <thead>
          <tr>
            <th>카메라 이름</th>
            <th>시리얼 번호</th>
            <th>VPN 상태</th>
            <th>VPN IP</th>
            <th>최근 Handshake</th>
            <th>오류 상태</th>
            <th>자동 복구 상태</th>
            <th>작업</th>
          </tr>
        </thead>

        <tbody>
          {devices.map((device) => {
            const recovery = getRecoveryState(device);

            return (
              <tr key={device.id}>
                <td>{device.name}</td>

                <td>
                  {device.serialNumber || device.hwnum || "-"}
                </td>

                <td>
                  <span className={`vpn-status ${device.vpnStatus}`}>
                    <span className="status-dot" />
                    {getStatusText(device.vpnStatus)}
                  </span>
                </td>

                <td>
                  {device.vpnIp || "-"}
                </td>

                <td>
                  {device.lastHandshake || "-"}
                </td>

                <td
                  className={device.error ? "vpn-error" : ""}
                  title={device.error || ""}
                >
                  {device.error || "-"}
                </td>

                <td>
                  <span className={`recovery-status ${recovery.code}`}>
                    <span className="recovery-dot" />
                    {recovery.text}
                  </span>
                </td>

                <td>
                  {recovery.code === "normal" && (
                    <span className="action-empty">-</span>
                  )}

                  {recovery.code === "recovering" && (
                    <button
                      type="button"
                      className="vpn-recovery-button recovering"
                      disabled
                    >
                      복구 중
                    </button>
                  )}

                  {recovery.code === "failed" && (
                    <button
                      type="button"
                      className="vpn-recovery-button request"
                      onClick={() => handleRecoveryRequest(device.id)}
                    >
                      복구 요청
                    </button>
                  )}

                  {recovery.code === "unknown" && (
                    <span className="action-empty">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>

      </table>
    </div>
  );
}

export default VpnDeviceTable;
