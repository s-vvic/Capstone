import Modal from "../Modal";
import "../Modal.css";
import "./VpnDeviceDetailModal.css";
// import { getVpnDeviceDetail } from "../../api/vpnApi";  // 서버 연결 후 주석 해제

const STATUS_TEXT = {
  connected: "정상",
  disconnected: "연결 끊김",
  error: "오류",
};

// 오류 코드별 안내 (시연용)
const ERROR_GUIDE = {
  "Handshake Timeout":
    "보드와 VPN 서버 간 Handshake 응답이 없습니다. 보드의 네트워크 연결 및 방화벽(UDP 포트) 설정을 확인하세요.",
};

// Device VPN 상세 정보 (WEB-F-054)
function VpnDeviceDetailModal({ device, onClose, onRecoveryRequest }) {
  /* 서버 연결 후
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    getVpnDeviceDetail(device.id).then(setDetail).catch(console.error);
  }, [device.id]);
  */

  const rows = [
    { label: "VPN 상태", value: STATUS_TEXT[device.vpnStatus] ?? "-", className: device.vpnStatus },
    { label: "VPN IP", value: device.vpnIp || "-" },
    { label: "최근 Handshake", value: device.lastHandshake || "-" },
    { label: "연결 시간", value: device.duration || "-" },
    { label: "VPN 서버", value: device.server || "-" },
    { label: "시리얼 번호", value: device.serial || device.serialNumber || "-" },
  ];

  // 시연용 연결 이력
  const history = device.history || [];

  return (
    <Modal
      title={`Device VPN 상세 · ${device.name}`}
      width={560}
      onClose={onClose}
      footer={
        <>
          {device.vpnStatus !== "connected" && onRecoveryRequest && (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                onRecoveryRequest(device.id);
                onClose();
              }}
            >
              복구 요청
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            닫기
          </button>
        </>
      }
    >
      <dl className="vpn-detail-list">
        {rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd className={row.className ?? ""}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="vpn-detail-section">
        <h3>오류 상세</h3>

        {device.error ? (
          <div className="vpn-detail-error">
            <strong>{device.error}</strong>
            <p>{ERROR_GUIDE[device.error] ?? "오류 원인을 확인 중입니다."}</p>
            <small>마지막 정상 Handshake: {device.lastHandshake || "-"}</small>
          </div>
        ) : (
          <p className="vpn-detail-empty">최근 오류가 없습니다.</p>
        )}
      </div>

      <div className="vpn-detail-section">
        <h3>최근 연결 이력</h3>

        {!history.length && <p className="vpn-detail-empty">서버에서 제공한 연결 이력이 없습니다.</p>}
        <ul className="vpn-detail-history">
          {history.map((item) => (
            <li key={item.at + item.message}>
              <span className={`history-dot ${item.status}`} />
              <span className="history-time">{item.at}</span>
              <span>{item.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}


export default VpnDeviceDetailModal;

