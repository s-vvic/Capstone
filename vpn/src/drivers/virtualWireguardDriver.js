import { WireguardDriverInterface } from './wireguardDriverInterface.js';
import { VPN_CONFIG, VPN_STATUS } from '../constants/vpnConstants.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * 인메모리 가상 WireGuard 드라이버 (개발, Windows, 테스트 전용)
 */
export class VirtualWireguardDriver extends WireguardDriverInterface {
  constructor(options = {}) {
    super();
    this.serverPublicKey = options.serverPublicKey || config.wgServerPublicKey;
    this.serverEndpoint = options.serverEndpoint || config.wgServerEndpoint;
    this.serverIp = options.serverIp || config.wgServerIp;
    this.keepalive = options.keepalive || config.wgKeepalive;

    // publicKey -> peerData
    this.peers = new Map();
    this.configContent = '';
    logger.info(`[VirtualWireguardDriver] 가상 WireGuard 인터페이스 준비 완료 (${this.serverEndpoint})`);
  }

  async addPeer(publicKey, allowedIp, persistentKeepalive = 25) {
    const normalizedAllowedIp = allowedIp.includes('/') ? allowedIp : `${allowedIp}/32`;
    const now = new Date();

    const peerData = {
      publicKey,
      allowedIp: normalizedAllowedIp,
      persistentKeepalive,
      vpnStatus: VPN_STATUS.CONNECTED,
      lastHandshake: now.toISOString(),
      rxBytes: 1024,
      txBytes: 2048,
      connectedAt: now.toISOString(),
      errorType: null,
    };

    this.peers.set(publicKey, peerData);
    logger.info(`[VirtualWireguardDriver] 가상 피어 등록: ${publicKey.substring(0, 8)}... (IP: ${normalizedAllowedIp})`);
    return peerData;
  }

  async removePeer(publicKey) {
    const deleted = this.peers.delete(publicKey);
    if (deleted) {
      logger.info(`[VirtualWireguardDriver] 가상 피어 삭제: ${publicKey.substring(0, 8)}...`);
    }
    return deleted;
  }

  async getPeer(publicKey) {
    return this.peers.get(publicKey) || null;
  }

  async getPeers() {
    return Array.from(this.peers.values());
  }

  async syncConfigFile(peers) {
    const lines = [
      '# SecureCam WireGuard Server Configuration (Virtual Sync)',
      '[Interface]',
      `Address = ${this.serverIp}/24`,
      `ListenPort = ${config.wgPort}`,
      `PrivateKey = ${config.wgServerPrivateKey}`,
      '',
    ];

    for (const p of peers) {
      lines.push('[Peer]');
      if (p.name || p.deviceId) {
        lines.push(`# Name: ${p.name || p.deviceId}`);
      }
      lines.push(`PublicKey = ${p.publicKey || p.wg_pubkey}`);
      const ip = p.allowedIp || p.vpn_ip;
      lines.push(`AllowedIPs = ${ip.includes('/') ? ip : `${ip}/32`}`);
      lines.push(`PersistentKeepalive = ${p.persistentKeepalive || this.keepalive}`);
      lines.push('');
    }

    this.configContent = lines.join('\n');
    return this.configContent;
  }

  generateClientConfig(clientPrivateKey, clientIp) {
    const ipOnly = clientIp.includes('/') ? clientIp.split('/')[0] : clientIp;

    return [
      '[Interface]',
      `PrivateKey = ${clientPrivateKey}`,
      `Address = ${ipOnly}/24`,
      '',
      '[Peer]',
      `PublicKey = ${this.serverPublicKey}`,
      `Endpoint = ${this.serverEndpoint}`,
      `AllowedIPs = ${VPN_CONFIG.SUBNET}`,
      `PersistentKeepalive = ${this.keepalive}`,
      '',
    ].join('\n');
  }

  async reloadInterface() {
    logger.info('[VirtualWireguardDriver] 가상 인터페이스 리로드 완료');
    return true;
  }

  // --- 시뮬레이션 도우미 메서드 ---

  simulateDisconnect(publicKey) {
    const peer = this.peers.get(publicKey);
    if (peer) {
      peer.vpnStatus = VPN_STATUS.DISCONNECTED;
      peer.errorType = null;
    }
  }

  simulateHandshake(publicKey) {
    const peer = this.peers.get(publicKey);
    if (peer) {
      peer.vpnStatus = VPN_STATUS.CONNECTED;
      peer.lastHandshake = new Date().toISOString();
      peer.errorType = null;
    }
  }

  simulateTimeout(publicKey) {
    const peer = this.peers.get(publicKey);
    if (peer) {
      peer.vpnStatus = VPN_STATUS.ERROR;
      peer.errorType = 'error_handshake_timeout';
    }
  }

  clear() {
    this.peers.clear();
    this.configContent = '';
  }
}
