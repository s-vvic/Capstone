import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { loadVpnData } from "../api/vpnApi";
import { getAuthToken, setAuthToken } from "../api/client";
import { useVpn } from "../context/VpnContext";
import "./VpnCheck.css";

function VpnCheck() {
  const navigate = useNavigate();
  const { setPeerVpnStatus } = useVpn();
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("");
  const requestController = useRef(null);
  const redirectTimer = useRef(null);
  const check = useCallback(async () => {
    requestController.current?.abort();
    clearTimeout(redirectTimer.current);
    const controller = new AbortController();
    requestController.current = controller;
    if (!getAuthToken()) {
      navigate("/login", { replace: true });
      return;
    }
    setStatus("checking");
    try {
      await loadVpnData({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setStatus("success");
      setPeerVpnStatus("connected");
      setMessage("VPN 서버에 접근할 수 있습니다. 대시보드로 이동합니다.");
      redirectTimer.current = setTimeout(
        () => navigate("/dashboard", { replace: true }),
        1200,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error.status === 401) {
        setAuthToken(null);
        navigate("/login", { replace: true });
        return;
      }
      setStatus("fail");
      setPeerVpnStatus("error");
      setMessage(
        "VPN 서버에 접근하지 못했습니다. WireGuard 앱에서 VPN을 연결한 후 다시 확인해주세요.",
      );
    }
  }, [navigate, setPeerVpnStatus]);
  useEffect(() => {
    check();
    return () => {
      requestController.current?.abort();
      clearTimeout(redirectTimer.current);
    };
  }, [check]);
  return (
    <main className="vpn-check-page">
      <div className="vpn-check-box">
        {status === "checking" ? (
          <div className="vpn-loader" />
        ) : status === "success" ? (
          <FaCheckCircle className="vpn-success-icon" />
        ) : (
          <FaTimesCircle className="vpn-fail-icon" />
        )}
        <h1>VPN 서버 연결 확인</h1>
        <p
          className={`vpn-message ${status}`}
          role={status === "fail" ? "alert" : "status"}
        >
          {status === "checking"
            ? "VPN 서버 응답을 확인하고 있습니다..."
            : message}
        </p>
        {status === "fail" && (
          <div className="vpn-check-actions">
            <button type="button" onClick={check}>
              다시 확인
            </button>
            <button type="button" onClick={() => navigate("/vpn-manage")}>
              VPN 관리로 이동
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
export default VpnCheck;
