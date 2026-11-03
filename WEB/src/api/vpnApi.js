/**
 * WireGuard VPN 컨트롤러 REST API (Component 4, ICD 2.5, SV-F-014)
 */
import { apiClient } from "./client.js";

export const vpnApi = {
  /**
   * VPN 서버 헬스 상태 및 IP 풀 가용성 통계 조회 (GET /vpn/status)
   */
  async getVpnStatus() {
    return apiClient.get("/vpn/status");
  },

  /**
   * 등록 기기의 VPN 연결 상태 목록 전체 조회 (GET /vpn/connections, ICD 2.5.1, SV-F-014)
   */
  async getVpnConnections() {
    return apiClient.get("/vpn/connections");
  },

  /**
   * 특정 기기 VPN 연결 상태 단건 조회 (GET /vpn/connections/:deviceId)
   */
  async getVpnConnection(deviceId) {
    return apiClient.get(`/vpn/connections/${encodeURIComponent(deviceId)}`);
  },

  /**
   * 특정 기기 VPN 수동 연결 / 끊기 (POST /vpn/connections/:deviceId/action, ICD 2.5.2, SV-F-014)
   * @param {string} deviceId - 기기 고유 ID (예: CAM-0001)
   * @param {'connect' | 'disconnect'} action - 실행할 명령
   */
  async executeVpnAction(deviceId, action) {
    return apiClient.post(`/vpn/connections/${encodeURIComponent(deviceId)}/action`, {
      action,
    });
  },

  /**
   * 오류 상태 기기 VPN 서버 복구 요청 (POST /vpn/connections/:deviceId/recover, ICD 2.5.3)
   * @param {string} deviceId - 기기 고유 ID
   */
  async recoverVpnConnection(deviceId) {
    return apiClient.post(`/vpn/connections/${encodeURIComponent(deviceId)}/recover`, {});
  },

  /**
   * 피어(보드 또는 웹/모바일 클라이언트) 신규 등록 및 프로비저닝 (POST /vpn/peers/register)
   * @param {Object} peerData - { peer_id, peer_type, name, wg_pubkey, preferred_ip, ... }
   */
  async registerVpnPeer(peerData) {
    return apiClient.post("/vpn/peers/register", peerData);
  },

  /**
   * 피어 등록 해제 및 VPN IP 회수 (DELETE /vpn/peers/:peerId)
   */
  async unregisterVpnPeer(peerId) {
    return apiClient.delete(`/vpn/peers/${encodeURIComponent(peerId)}`);
  },

  /**
   * WireGuard 클라이언트 설정 파일(wg0.conf) 조회 (GET /vpn/peers/:peerId/config)
   */
  async getVpnPeerConfig(peerId, privateKey = null) {
    const query = privateKey ? `?private_key=${encodeURIComponent(privateKey)}` : "";
    return apiClient.get(`/vpn/peers/${encodeURIComponent(peerId)}/config${query}`);
  },
};

export default vpnApi;
