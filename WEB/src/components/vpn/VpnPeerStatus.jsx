import "./VpnPeerStatus.css";

function VpnPeerStatus({
  status,
  onReconnect
}) {

  function getStatusMessage() {
    if (status === "connecting") {
      return "VPN 연결을 시도하고 있습니다...";
    }

    if (status === "connected") {
      return "VPN이 연결되었습니다.";
    }

    if (status === "error") {
      return "VPN 연결에 실패했습니다. 다시 시도해주세요.";
    }

    return "VPN이 연결되어 있지 않습니다.";
  }


  // function getButtonText() {
  //   if (status === "connecting") {
  //     return "연결 중...";
  //   }

  //   if (status === "connected") {
  //     return "연결 완료";
  //   }

  //   return "VPN 연결 재시도";
  // }


  return (
    <section className={`peer-vpn-box ${status}`}>

      <div className="peer-vpn-info">

        <div className="peer-vpn-title">
          클라이언트 VPN 연결
        </div>

        <span className="peer-vpn-message">
          {getStatusMessage()}
        </span>

      </div>


      {/* <button
        type="button"
        className="peer-connect-button"
        onClick={onReconnect}
        disabled={
          status === "connecting" ||
          status === "connected"
        }
      >

        {status === "connecting" && (
          <span className="peer-connect-spinner" />
        )}

        {getButtonText()}

      </button> */}

    </section>
  );
}

export default VpnPeerStatus;