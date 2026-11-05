import { apiClient } from "./client.js";

// A separate VPN deployment may override the shared controller /v1 base.
const VPN_BASE_URL = (import.meta.env?.VITE_VPN_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
const endpoint = (path) =>
  VPN_BASE_URL ? `${VPN_BASE_URL}/vpn${path}` : `/vpn${path}`;
const optionsWithTimeout = (options = {}) => ({ timeoutMs: 15000, ...options });

export function normalizeConnections(connections) {
  if (!Array.isArray(connections))
    throw new Error("VPN 연결 목록 응답 형식이 올바르지 않습니다.");
  return connections.map((connection) => {
    // Current C4 uses device_id; canonical MAC responses are also supported.
    const id = connection.device_id || connection.peer_id || connection.mac;
    if (
      !id ||
      !["connected", "disconnected", "error"].includes(connection.vpn_status)
    ) {
      throw new Error("VPN 기기 식별자 또는 연결 상태가 올바르지 않습니다.");
    }
    const handshake = connection.last_handshake
      ? new Date(connection.last_handshake)
      : null;
    return {
      id,
      name: connection.device_name || connection.name || id,
      mac:
        connection.mac ||
        connection.mac_no?.replaceAll(":", "").toUpperCase() ||
        "-",
      vpnStatus: connection.vpn_status,
      vpnIp: connection.vpn_ip || "-",
      lastHandshake:
        handshake && !Number.isNaN(handshake.getTime())
          ? handshake.toLocaleString()
          : "-",
      duration: Number.isFinite(connection.connected_duration_sec)
        ? `${connection.connected_duration_sec}초`
        : "-",
      error: connection.error_type || null,
    };
  });
}

export const vpnApi = {
  getVpnStatus: (options) =>
    apiClient.get(endpoint("/status"), optionsWithTimeout(options)),
  getVpnConnections: (options) =>
    apiClient.get(endpoint("/connections"), optionsWithTimeout(options)),
  getVpnConnection: (id, options) =>
    apiClient.get(
      endpoint(`/connections/${encodeURIComponent(id)}`),
      optionsWithTimeout(options),
    ),
  executeVpnAction: (id, action, options) =>
    apiClient.post(
      endpoint(`/connections/${encodeURIComponent(id)}/action`),
      { action },
      optionsWithTimeout(options),
    ),
  recoverVpnConnection: (id, options) =>
    apiClient.post(
      endpoint(`/connections/${encodeURIComponent(id)}/recover`),
      {},
      optionsWithTimeout(options),
    ),
  registerVpnPeer: (peerData, options) =>
    apiClient.post(
      endpoint("/peers/register"),
      peerData,
      optionsWithTimeout(options),
    ),
  unregisterVpnPeer: (id, options) =>
    apiClient.delete(
      endpoint(`/peers/${encodeURIComponent(id)}`),
      {},
      optionsWithTimeout(options),
    ),
  // The management UI never sends private keys to the server.
  getVpnPeerConfig: (id, options) =>
    apiClient.get(
      endpoint(`/peers/${encodeURIComponent(id)}/config`),
      optionsWithTimeout(options),
    ),
};

export async function loadVpnData(options) {
  const [connections, server] = await Promise.all([
    vpnApi.getVpnConnections(options),
    vpnApi.getVpnStatus(options),
  ]);
  if (server?.status !== "healthy")
    throw new Error("VPN 서버가 정상 상태가 아닙니다.");
  return { devices: normalizeConnections(connections), server };
}
export default vpnApi;
