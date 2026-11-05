import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Pagination from "../components/Pagination";
import VpnSummary from "../components/vpn/VpnSummary";
import VpnDeviceTable from "../components/vpn/VpnDeviceTable";
import VpnPeerStatus from "../components/vpn/VpnPeerStatus";
import { vpnApi, loadVpnData } from "../api/vpnApi";
import { setAuthToken } from "../api/client";
import "./VpnManage.css";

function errorMessage(error) {
  if (error.name === "TimeoutError")
    return "VPN 서버 응답 시간이 초과되었습니다. 연결 상태를 확인하고 다시 시도해주세요.";
  if (error instanceof TypeError)
    return "VPN 서버에 접근할 수 없습니다. WireGuard 앱과 네트워크 연결을 확인해주세요.";
  return error.message || "VPN 요청을 처리하지 못했습니다.";
}

function VpnManage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [server, setServer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const mounted = useRef(false);
  const fetchController = useRef(null);
  const actionController = useRef(null);
  const mutationBusy = useRef(false);
  const devicesPerPage = 8;

  const handleUnauthorized = useCallback(
    (error) => {
      if (error.status !== 401) return false;
      setAuthToken(null);
      navigate("/login", { replace: true });
      return true;
    },
    [navigate],
  );

  const fetchVpnData = useCallback(async () => {
    fetchController.current?.abort();
    const controller = new AbortController();
    fetchController.current = controller;
    setRefreshing(true);
    try {
      const data = await loadVpnData({ signal: controller.signal });
      if (!mounted.current || controller.signal.aborted) return;
      setDevices(data.devices);
      setServer(data.server);
      setLoadError("");
      setLastUpdated(new Date().toLocaleString());
    } catch (error) {
      if (!mounted.current || controller.signal.aborted) return;
      if (!handleUnauthorized(error)) setLoadError(errorMessage(error));
    } finally {
      if (fetchController.current === controller) fetchController.current = null;
      if (mounted.current && !controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    mounted.current = true;
    fetchVpnData();
    const timer = setInterval(() => {
      if (!mutationBusy.current && !fetchController.current && !document.hidden) fetchVpnData();
    }, 10000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      fetchController.current?.abort();
      actionController.current?.abort();
    };
  }, [fetchVpnData]);

  async function performAction(device, action) {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    fetchController.current?.abort();
    const controller = new AbortController();
    actionController.current = controller;
    setPending({ id: device.id, action });
    setActionError("");
    setNotice("");
    try {
      const result =
        action === "recover"
          ? await vpnApi.recoverVpnConnection(device.id, {
              signal: controller.signal,
            })
          : await vpnApi.executeVpnAction(device.id, action, {
              signal: controller.signal,
            });
      if (!mounted.current || controller.signal.aborted) return;
      if (result?.success !== true)
        throw new Error("서버에서 VPN 요청을 완료하지 못했습니다.");
      setNotice(
        `${device.name}: ${action === "recover" ? "복구" : action === "connect" ? "연결" : "연결 해제"} 요청을 처리했습니다.`,
      );
      await fetchVpnData();
    } catch (error) {
      if (
        mounted.current &&
        !controller.signal.aborted &&
        !handleUnauthorized(error)
      )
        setActionError(errorMessage(error));
    } finally {
      mutationBusy.current = false;
      if (mounted.current) {
        setPending(null);
        setRefreshing(false);
      }
    }
  }

  const filteredDevices = devices.filter((device) => {
    const keyword = searchKeyword.trim().toLowerCase();
    return (
      [device.name, device.mac, device.id].some((value) =>
        value.toLowerCase().includes(keyword),
      ) &&
      (statusFilter === "all" || device.vpnStatus === statusFilter)
    );
  });
  const totalPages = Math.max(
    1,
    Math.ceil(filteredDevices.length / devicesPerPage),
  );
  const page = Math.min(currentPage, totalPages);
  const currentDevices = filteredDevices.slice(
    (page - 1) * devicesPerPage,
    page * devicesPerPage,
  );
  const unavailable =
    loading || refreshing || Boolean(pending) || Boolean(loadError);

  return (
    <main
      className="vpn-page"
      aria-busy={loading || refreshing || Boolean(pending)}
    >
      <VpnPeerStatus
        status={
          loading
            ? "connecting"
            : loadError
              ? "error"
              : server
                ? "connected"
                : "disconnected"
        }
        simulated={server?.driver_mode === "virtual"}
        onReconnect={fetchVpnData}
        disabled={refreshing || Boolean(pending)}
      />
      {loadError && (
        <p className="vpn-feedback error" role="alert">
          {loadError}
          {lastUpdated ? " 아래 목록은 마지막으로 조회한 상태입니다." : ""}
        </p>
      )}
      {actionError && (
        <p className="vpn-feedback error" role="alert">
          {actionError}
        </p>
      )}
      {notice && (
        <p className="vpn-feedback" role="status">
          {notice}
        </p>
      )}
      {loading && <p role="status">VPN 연결 정보를 불러오고 있습니다...</p>}
      <VpnSummary
        totalDevices={devices.length}
        connectedDevices={
          devices.filter((d) => d.vpnStatus === "connected").length
        }
        disconnectedDevices={
          devices.filter((d) => d.vpnStatus === "disconnected").length
        }
        errorDevices={devices.filter((d) => d.vpnStatus === "error").length}
        refreshing={refreshing}
        disabled={refreshing || Boolean(pending)}
        lastUpdated={lastUpdated || "아직 조회되지 않음"}
        onRefresh={fetchVpnData}
      />
      <section className="vpn-table-section">
        <div className="vpn-toolbar">
          <input
            aria-label="VPN 카메라 검색"
            type="search"
            placeholder="카메라 이름, MAC 또는 기기 ID 검색"
            value={searchKeyword}
            onChange={(event) => {
              setSearchKeyword(event.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            aria-label="VPN 연결 상태 필터"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">연결 상태 전체</option>
            <option value="connected">연결됨</option>
            <option value="disconnected">연결 안 됨</option>
            <option value="error">연결 오류</option>
          </select>
          <button
            type="button"
            className="filter-reset-button"
            onClick={() => {
              setSearchKeyword("");
              setStatusFilter("all");
              setCurrentPage(1);
            }}
          >
            필터 초기화
          </button>
        </div>
        <VpnDeviceTable
          devices={currentDevices}
          pending={pending}
          disabled={unavailable}
          emptyMessage={
            loading
              ? "조회 중입니다."
              : loadError && !lastUpdated
                ? "연결 정보를 조회하지 못했습니다."
                : devices.length
                  ? "검색 조건에 맞는 카메라가 없습니다."
                  : "등록된 카메라 VPN 기기가 없습니다."
          }
          onConnection={(id) => {
            const device = devices.find((d) => d.id === id);
            if (device)
              performAction(
                device,
                device.vpnStatus === "connected" ? "disconnect" : "connect",
              );
          }}
          onRecoveryRequest={(id) => {
            const device = devices.find((d) => d.id === id);
            if (device) performAction(device, "recover");
          }}
        />
        <Pagination
          currentPage={page}
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
