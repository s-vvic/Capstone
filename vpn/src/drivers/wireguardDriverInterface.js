/**
 * WireGuard Driver 추상 인터페이스
 */
export class WireguardDriverInterface {
  /**
   * 피어 추가 또는 업데이트
   * @param {string} publicKey - WireGuard 피어 공개키
   * @param {string} allowedIp - 허용할 사설 IP (예: '10.0.0.15/32')
   * @param {number} [persistentKeepalive=25]
   */
  async addPeer(publicKey, allowedIp, persistentKeepalive = 25) {
    throw new Error('Not implemented');
  }

  /**
   * 피어 제거
   * @param {string} publicKey
   */
  async removePeer(publicKey) {
    throw new Error('Not implemented');
  }

  /**
   * 특정 피어의 WireGuard 상태 조회 (핸드셰이크, 트래픽 등)
   * @param {string} publicKey
   */
  async getPeer(publicKey) {
    throw new Error('Not implemented');
  }

  /**
   * 모든 활성 피어 목록 조회
   */
  async getPeers() {
    throw new Error('Not implemented');
  }

  /**
   * 서버 /etc/wireguard/wg0.conf 파일 전체 동기화 생성
   * @param {Array<object>} peers - 피어 목록 [{ publicKey, allowedIp, comment }]
   */
  async syncConfigFile(peers) {
    throw new Error('Not implemented');
  }

  /**
   * 클라이언트용 wg0.conf 텍스트 생성 (ICD-06 5.2)
   * @param {string} clientPrivateKey
   * @param {string} clientIp
   */
  generateClientConfig(clientPrivateKey, clientIp) {
    throw new Error('Not implemented');
  }

  /**
   * WireGuard 인터페이스 재시작 / 리로드 (wg syncconf 또는 wg-quick down/up)
   */
  async reloadInterface() {
    throw new Error('Not implemented');
  }
}
