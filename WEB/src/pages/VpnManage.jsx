import { useState } from "react";
import { initialVpnDevices } from "../data/vpnDevices";
import Pagination from "../components/Pagination";
import Toggle from "../components/Toggle";
import { useNavigate } from "react-router-dom";
import VpnSummary from "../components/vpn/VpnSummary";
import VpnDeviceTable from "../components/vpn/VpnDeviceTable";
import VpnPeerStatus from "../components/vpn/VpnPeerStatus";
import "./VpnManage.css";

function VpnManage() {
  const navigate = useNavigate();
    const [ peerVpnStatus, setPeerVpnStatus ] = useState("disconnected");
    const [ devices, setDevices ] = useState(initialVpnDevices);
    const [ searchKeyword, setSearchKeyword ] = useState("");
    const [ statusFilter, setStatusFilter ] = useState("all");
    const [ currentPage, setCurrentPage ] = useState(1);
    const [refreshing, setRefreshing] = useState(false);
    const [ lastUpdated, setLastUpdated ] = useState(
        new Date().toLocaleString()
    );
    const devicesPerPage = 8;

    /* 상태 요약 */
    const totalDevices = devices.length;

    const connectedDevices = devices.filter(
        (device) => device.vpnStatus === "connected"
    ).length;

    const disconnectedDevices = devices.filter(
        (device) => device.vpnStatus === "disconnected"
    ).length;

    const errorDevices = devices.filter(
        (device) => device.vpnStatus === "error"
    ).length;

    /* 검색, 필터 */
    const filteredDevices = devices.filter((devices) => {
        const keyword = searchKeyword.toLowerCase();
        
        const matchesSearch = 
            devices.name.toLowerCase().includes(keyword) ||
            devices.serial.toLowerCase().includes(keyword);
        
        const matchesStatus = 
            statusFilter === "all" ||
            devices.vpnStatus === statusFilter;
        return matchesSearch && matchesStatus;
    });

    /* pagination */
    const totalPages = Math.max(
        1,
        Math.ceil(filteredDevices.length / devicesPerPage)
    );

    const startIndex = 
        (currentPage - 1) * devicesPerPage;
    
    const currentDevices = filteredDevices.slice(
        startIndex,
        startIndex + devicesPerPage
    );

    /* search */
    function handleSearchChange(e) {
        setSearchKeyword(e.target.value);
        setCurrentPage(1);
    }

    /* filter */
    function handleStatusChange(e) {
        setStatusFilter(e.target.value);
        setCurrentPage(1);
    }

    function handleFilterReset() {
        setSearchKeyword("");
        setStatusFilter("all");
        setCurrentPage(1);
    }

    /* VPN connected / disconnected */
    function handleConnection(deviceId) {
        setDevices((prev) => 
            prev.map((device) => {
                if (device.id !== deviceId) {
                    return device;
                }
                const isConnected = 
                    device.vpnStatus === "connected";
                return {
                    ...device,
                    vpnStatus: isConnected
                        ? "disconnected"
                        : "connected",
                    duration: isConnected
                        ? "-"
                        : "방금 연결됨",
                    vpnIp: isConnected
                        ? "-"
                        : `10.0.0.${100 + device.id}`,
                    lastHandshake: isConnected
                        ? "-"
                        : new Date().toLocaleString(),
                    error: null
                };
            })
        );
    }

    /* auto connect toggle */
    function handleToggle(deviceId, key) {
        setDevices((prev) => 
            prev.map((device) =>
              device.id === deviceId
                ? {
                    ...device,
                    [key]: !device[key]
                  }
                : device
            ) 
        );
    }

    async function handlePeerReconnect() {
      setPeerVpnStatus("connecting");
      try {

        /*  실제 서버 연동 시 사용
        const token = localStorage.getItem("accessToken");
        
        const response = await fetch("/api/vpn/connect", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!response.ok) {
          throw new Error("VPN 연결 실패");
        }
        if (data.connected) {
          setPeerVpnStatus("connected");

          setTimeout(() => {
            navigate("/dashboard", {replace: true});
          }, 1200);
        } else {
          setPeerVpnStatus("error");
        }  */

        //현재 테스트용

        setTimeout(() => {
          const connectSuccess = true;

          if (connectSuccess) {
            setPeerVpnStatus("connected");
          } else {
            setPeerVpnStatus("error");
          }
        }, 1500);
  
      } catch (error) {
        console.error("VPN 연결 실패:", error);

        setPeerVpnStatus("error");
      }
    }


/*  나중에 서버 연결 후 api 호출 */
    function handleRefresh() {
      setRefreshing(true);

      // 서버 연결 전 임시 새로고침 효과
      setTimeout(() => {
        setLastUpdated(new Date().toLocaleString());
        setRefreshing(false);
      }, 600);
    }

    /* 서버 연결 후 서버 연결 중에만 아이콘 회전
    async function handleRefresh() {
      setRefreshing(true);

      try {
        const response = await fetch("/api/vpn/devices");
        const data = await response.json();

        setDevices(data);
        setLastUpdated(new Date().toLocaleString());
      } catch (error) {
        console.error(error);
      } finally {
        setRefreshing(false);
      }
    } */

    return (
      <main className="vpn-page">

        <VpnPeerStatus
          status={peerVpnStatus}
          onReconnect={handlePeerReconnect}
        />

        <VpnSummary
          totalDevices={totalDevices}
          connectedDevices={connectedDevices}
          disconnectedDevices={disconnectedDevices}
          errorDevices={errorDevices}
          refreshing={refreshing}
          lastUpdated={lastUpdated}
          onRefresh={handleRefresh}
        />

        <section className="vpn-table-section">
          <div className="vpn-toolbar">
            <input
              type="text"
              placeholder="카메라 이름 또는 시리얼 번호 검색"
              value={searchKeyword}
              onChange={handleSearchChange}
            />

            <select
              value={statusFilter}
              onChange={handleStatusChange}
            >
              <option value="all">
                연결 상태 전체
              </option>
              <option value="connected">
                연결됨
              </option>
              <option value="disconnected">
                연결 안 됨
              </option>
              <option value="error">
                연결 오류
              </option>
            </select>
            <button
              type="button"
              className="filter-reset-button"
              onClick={handleFilterReset}
            >
              필터 초기화
            </button>
          </div>

          <VpnDeviceTable
            devices={currentDevices}
            onToggle={handleToggle}
            onConnection={handleConnection}
          />

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredDevices.length}
            itemLabel="대"
          />
        </section>
      </main>
    );
}

export default VpnManage;