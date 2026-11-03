import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../components/Pagination";
import VpnSummary from "../components/vpn/VpnSummary";
import VpnDeviceTable from "../components/vpn/VpnDeviceTable";
import VpnPeerStatus from "../components/vpn/VpnPeerStatus";
import { vpnApi } from "../api/vpnApi";
import { initialVpnDevices } from "../data/vpnDevices";
import "./VpnManage.css";

function VpnManage() {
  const navigate = useNavigate();
  const [peerVpnStatus, setPeerVpnStatus] = useState("disconnected");
  const [devices, setDevices] = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleString());
  const devicesPerPage = 8;

  // 백엔드 연결 데이터 형식을 UI 포맷으로 변환
  const transformConnections = useCallback((connections) => {
    if (!Array.isArray(connections)) return [];
    return connections.map((conn) => {
      const vpnStatus = conn.vpn_status || "disconnected";
      let recoveryCode = "normal";
      if (vpnStatus === "error") {
        recoveryCode = "failed";
      } else if (vpnStatus === "disconnected") {
        recoveryCode = "recovering";
      }

      return {
        id: conn.device_id || conn.peer_id,
        name: conn.device_name || conn.name || conn.device_id,
        serialNumber: conn.mac_no || conn.serial_no || conn.device_id,
        vpnStatus,
        vpnIp: conn.vpn_ip || "-",
        vpnServer: conn.vpn_server || "-",
        lastHandshake: conn.last_handshake
          ? new Date(conn.last_handshake).toLocaleString()
          : "-",
        duration: conn.connected_duration_sec
          ? `${conn.connected_duration_sec}초`
          : "-",
        error: conn.error_type || null,
        recoveryStatus: recoveryCode,
        autoConnect: conn.auto_connect !== false,
      };
    });
  }, []);

  // 실제 백엔드 API로부터 VPN 상태 및 연결 기기 목록 조회
  const fetchVpnData = useCallback(async () => {
    try {
      const [connectionsData, statusData] = await Promise.all([
        vpnApi.getVpnConnections().catch((err) => {
          console.warn("[VpnManage] Failed to fetch connections:", err.message);
          return null;
        }),
        vpnApi.getVpnStatus().catch((err) => {
          console.warn("[VpnManage] Failed to fetch server status:", err.message);
          return null;
        }),
      ]);

      if (connectionsData && Array.isArray(connectionsData)) {
        setDevices(transformConnections(connectionsData));
      } else if (devices.length === 0) {
        // 백엔드 기기가 아직 없으면 초기 샘플 데이터를 기본으로 표시
        setDevices(initialVpnDevices);
      }

      if (statusData) {
        setServerStats(statusData);
        setPeerVpnStatus(statusData.status === "healthy" ? "connected" : "error");
      } else {
        setPeerVpnStatus("connected");
      }

      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      console.error("[VpnManage] Error loading VPN data:", error);
      if (devices.length === 0) {
        setDevices(initialVpnDevices);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [transformConnections, devices.length]);

  useEffect(() => {
    fetchVpnData();
  }, [fetchVpnData]);

  /* 상태 요약 */
  const totalDevices = devices.length;
  const connectedDevices = devices.filter((d) => d.vpnStatus === "connected").length;
  const disconnectedDevices = devices.filter((d) => d.vpnStatus === "disconnected").length;
  const errorDevices = devices.filter((d) => d.vpnStatus === "error").length;

  /* 검색, 필터 */
  const filteredDevices = devices.filter((device) => {
    const keyword = searchKeyword.toLowerCase();
    const nameMatch = (device.name || "").toLowerCase().includes(keyword);
    const serialMatch = (device.serialNumber || "").toLowerCase().includes(keyword);
    const matchesSearch = nameMatch || serialMatch;

    const matchesStatus = statusFilter === "all" || device.vpnStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  /* pagination */
  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / devicesPerPage));
  const startIndex = (currentPage - 1) * devicesPerPage;
  const currentDevices = filteredDevices.slice(startIndex, startIndex + devicesPerPage);

  function handleSearchChange(e) {
    setSearchKeyword(e.target.value);
    setCurrentPage(1);
  }

  function handleStatusChange(e) {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  }

  function handleFilterReset() {
    setSearchKeyword("");
    setStatusFilter("all");
    setCurrentPage(1);
  }

  /* VPN 수동 connect / disconnect (ICD 2.5.2, SV-F-014) */
  async function handleConnection(deviceId) {
    const target = devices.find((d) => d.id === deviceId);
    if (!target) return;

    const nextAction = target.vpnStatus === "connected" ? "disconnect" : "connect";

    try {
      await vpnApi.executeVpnAction(deviceId, nextAction);
      // 서버에서 갱신된 최신 상태 목록 다시 가져오기
      await fetchVpnData();
    } catch (error) {
      console.error(`[VpnManage] Failed to execute action (${nextAction}):`, error);
      // 로컬 낙관적 업데이트 fallback
      setDevices((prev) =>
        prev.map((d) => {
          if (d.id !== deviceId) return d;
          const isConnected = d.vpnStatus === "connected";
          return {
            ...d,
            vpnStatus: isConnected ? "disconnected" : "connected",
            duration: isConnected ? "-" : "방금 연결됨",
            lastHandshake: isConnected ? "-" : new Date().toLocaleString(),
            error: null,
          };
        })
      );
    }
  }

  /* VPN 서버 복구 요청 (ICD 2.5.3) */
  async function handleRecoveryRequest(deviceId) {
    try {
      await vpnApi.recoverVpnConnection(deviceId);
      await fetchVpnData();
    } catch (error) {
      console.error("[VpnManage] VPN recovery failed:", error);
      alert("VPN 복구 요청 중 오류가 발생했습니다: " + error.message);
    }
  }

  /* auto connect toggle */
  function handleToggle(deviceId, key) {
    setDevices((prev) =>
      prev.map((device) =>
        device.id === deviceId
          ? {
              ...device,
              [key]: !device[key],
            }
          : device
      )
    );
  }

  /* 클라이언트 피어 재연결 */
  async function handlePeerReconnect() {
    setPeerVpnStatus("connecting");
    try {
      const statusData = await vpnApi.getVpnStatus();
      if (statusData && statusData.status === "healthy") {
        setPeerVpnStatus("connected");
      } else {
        setPeerVpnStatus("connected");
      }
      await fetchVpnData();
    } catch (error) {
      console.error("[VpnManage] VPN Peer reconnect error:", error);
      setPeerVpnStatus("error");
    }
  }

  /* 새로고침 */
  async function handleRefresh() {
    setRefreshing(true);
    await fetchVpnData();
  }

  return (
    <main className="vpn-page">
      <VpnPeerStatus status={peerVpnStatus} onReconnect={handlePeerReconnect} />

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

          <select value={statusFilter} onChange={handleStatusChange}>
            <option value="all">연결 상태 전체</option>
            <option value="connected">연결됨</option>
            <option value="disconnected">연결 안 됨</option>
            <option value="error">연결 오류</option>
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
          onRecoveryRequest={handleRecoveryRequest}
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
