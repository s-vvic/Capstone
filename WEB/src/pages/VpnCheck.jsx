import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle} from "react-icons/fa";
import "./VpnCheck.css";

function VpnCheck() {
  const navigate = useNavigate();

  const [ status, setStatus ] = useState("checking");

  useEffect(() => {
    async function checkVpnStatus() {
      try {
        
        /*
        const token = localStorage.getItem("accessToken");
        
        const response = await fetch("/api/status", {
          method: "GET",
          headrs: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();

      const vpnConnected = data.connected;
      */

        const vpnConnected = false;  /* 임시 테스트용 */

        setTimeout(() => {
          if (vpnConnected) {
            //success
            setStatus("success");

            setTimeout(() => {
              navigate("/dashboard", {replace: true});
            }, 1200);
          } else {
            //fail
            setStatus("fail");
            setTimeout(() => {
              navigate("/vpn-manage", {replace: true});
            }, 1500);
          }
        }, 1500);

      } catch (error) {
        console.error("VPN 상태 확인 실패:", error);
        setStatus("fail");
        setTimeout(() => {
          navigate("/vpn-manage", {replace: true});
        }, 1500);
      }
    }
    checkVpnStatus();
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

