import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { vpnApi } from "../api/vpnApi";
import { getAuthToken } from "../api/client";
import "./VpnCheck.css";

function VpnCheck() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let isMounted = true;

    async function checkVpnStatus() {
      try {
        const token = getAuthToken();
        if (!token) {
          // 미로그인 상태인 경우 로그인 페이지로 이동
          if (isMounted) {
            setStatus("fail");
            setTimeout(() => navigate("/login", { replace: true }), 1000);
          }
          return;
        }

        // 실제 VPN 서버 헬스체크 및 연결 상태 조회 (GET /vpn/status)
        const serverStatus = await vpnApi.getVpnStatus().catch((err) => {
          console.warn("[VpnCheck] VPN status check warning:", err.message);
          return null;
        });

        // 서버 헬스 응답이 'healthy'이거나 최소한 통신이 이루어진 경우 성공으로 판단
        const isHealthy =
          serverStatus?.status === "healthy" || Boolean(serverStatus?.server_endpoint);

        if (isMounted) {
          if (isHealthy) {
            setStatus("success");
            setTimeout(() => {
              navigate("/dashboard", { replace: true });
            }, 1200);
          } else {
            setStatus("fail");
            setTimeout(() => {
              navigate("/vpn-manage", { replace: true });
            }, 1500);
          }
        }
      } catch (error) {
        console.error("VPN 상태 확인 실패:", error);
        if (isMounted) {
          setStatus("fail");
          setTimeout(() => {
            navigate("/vpn-manage", { replace: true });
          }, 1500);
        }
      }
    }

    checkVpnStatus();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <main className="vpn-check-page">
      <div className="vpn-check-box">
        {status === "checking" && (
          <>
            <div className="vpn-loader"></div>
            <h1>VPN Connection</h1>
            <p className="vpn-message checking">
              VPN 연결 상태를 확인하고 있습니다...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <FaCheckCircle className="vpn-success-icon" />
            <h1>VPN Connection</h1>
            <p className="vpn-message success">
              VPN이 연결되었습니다.
            </p>
          </>
        )}

        {status === "fail" && (
          <>
            <div className="vpn-loader"></div>
            <h1>VPN Connection</h1>
            <p className="vpn-message fail">
              VPN 연결에 실패했습니다.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default VpnCheck;
