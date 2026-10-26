import { getVpnRepository } from '../repositories/index.js';
import { getWireguardDriver } from '../drivers/index.js';
import { defaultIpPoolManager } from './ipPoolManager.js';
import { keyGenerator } from './keyGenerator.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { VPN_STATUS, VPN_CONFIG } from '../constants/vpnConstants.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class VpnPeerService {
  constructor(options = {}) {
    this._repository = options.repository || null;
    this._driver = options.driver || null;
    this.ipPool = options.ipPool || defaultIpPoolManager;
  }

  get repository() {
    return this._repository || getVpnRepository();
  }

  get driver() {
    return this._driver || getWireguardDriver();
  }

  /**
   * 피어(보드 또는 폰/클라이언트) 신규 등록 및 VPN 프로비저닝 (ICD-02 3.1 & ICD-06)
   */
  async registerPeer(data) {
    const peerType = data.peer_type || 'device';
    const peerId = data.peer_id || data.device_id || data.phone_id || (peerType === 'device' ? `CAM-${Date.now()}` : `PHONE-${Date.now()}`);

    // 1. 이미 동일한 ID로 등록된 피어가 있는지 확인
    const existingPeer = await this.repository.findById(peerId);
    if (existingPeer) {
      throw AppError.conflict(`이미 등록된 피어 ID입니다: ${peerId}`, ERROR_CODES.PEER_ALREADY_EXISTS);
    }

    // 2. WireGuard 키 처리 (요청에 공개키가 없으면 서버에서 키 페어 자동 생성)
    let clientPrivateKey = null;
    let clientPublicKey = data.wg_pubkey;

    if (!clientPublicKey) {
      const generated = keyGenerator.generateKeyPair();
      clientPrivateKey = generated.privateKey;
      clientPublicKey = generated.publicKey;
      logger.info(`[VpnPeerService] ${peerId}용 WireGuard 키 페어 신규 자동 생성 완료`);
    } else {
      // 기존 등록된 공개키 중복 검사
      const duplicateKey = await this.repository.findByPublicKey(clientPublicKey);
      if (duplicateKey) {
        throw AppError.conflict('이미 사용 중인 WireGuard 공개키입니다.', ERROR_CODES.KEY_ALREADY_EXISTS);
      }
    }

    // 3. IP 풀에서 가상 IP 할당 (10.0.0.10 ~ 10.0.0.250)
    const assignedIp = this.ipPool.allocate(peerId, data.preferred_ip || null);

    // 4. WireGuard 인터페이스에 피어 등록
    try {
      await this.driver.addPeer(clientPublicKey, assignedIp, VPN_CONFIG.KEEPALIVE_INTERVAL_SEC);
    } catch (err) {
      this.ipPool.release(assignedIp);
      throw AppError.internal(`WireGuard 인터페이스 피어 등록 실패: ${err.message}`);
    }

    // 5. DB 영속화
    const now = new Date().toISOString();
    const peerRecord = await this.repository.create({
      peer_id: peerId,
      device_id: peerType === 'device' ? peerId : null,
      phone_id: peerType === 'phone' ? peerId : null,
      user_id: data.user_id || null,
      peer_type: peerType,
      name: data.name || data.device_name || (peerType === 'device' ? '새 웹캠' : '내 스마트폰'),
      device_name: data.device_name || data.name,
      mac_no: data.mac_no || null,
      serial_no: data.serial_no || null,
      wg_pubkey: clientPublicKey,
      vpn_ip: assignedIp,
      vpn_server: config.wgServerEndpoint,
      vpn_status: VPN_STATUS.CONNECTED,
      connected_duration_sec: 0,
      last_handshake: now,
      auto_connect: data.auto_connect !== false,
      reconnect_on_start: data.reconnect_on_start !== false,
      reconnect_on_network_change: data.reconnect_on_network_change !== false,
    });

    // 6. 클라이언트 설정 파일 텍스트 생성 (wg0.conf)
    const clientConfigText = clientPrivateKey
      ? this.driver.generateClientConfig(clientPrivateKey, assignedIp)
      : null;

    logger.info(`[VpnPeerService] 피어 등록 완료: ${peerId} -> VPN IP: ${assignedIp}`);

    return {
      peer: peerRecord,
      provision: {
        device_id: peerId,
        vpn_ip: assignedIp,
        server_pubkey: config.wgServerPublicKey,
        server_endpoint: config.wgServerEndpoint,
        allowed_ips: VPN_CONFIG.SUBNET,
        keepalive: VPN_CONFIG.KEEPALIVE_INTERVAL_SEC,
        client_private_key: clientPrivateKey,
        client_public_key: clientPublicKey,
        client_config_file: clientConfigText,
      },
    };
  }

  /**
   * 피어 등록 해제 및 IP 회수
   */
  async unregisterPeer(peerId) {
    const peer = await this.repository.findById(peerId);
    if (!peer) {
      throw AppError.notFound(`피어 ID '${peerId}'를 찾을 수 없습니다.`, ERROR_CODES.PEER_NOT_FOUND);
    }

    // 1. WireGuard 인터페이스에서 제거
    if (peer.wg_pubkey) {
      await this.driver.removePeer(peer.wg_pubkey);
    }

    // 2. IP 회수
    if (peer.vpn_ip) {
      this.ipPool.release(peer.vpn_ip);
    }

    // 3. DB 삭제
    await this.repository.delete(peer.peer_id);
    logger.info(`[VpnPeerService] 피어 삭제 및 IP 회수 완료: ${peerId} (${peer.vpn_ip})`);

    return { success: true, peer_id: peerId, released_ip: peer.vpn_ip };
  }

  /**
   * 피어의 클라이언트 wg0.conf 설정 텍스트 조회
   */
  async getClientConfigText(peerId, clientPrivateKey = null) {
    const peer = await this.repository.findById(peerId);
    if (!peer) {
      throw AppError.notFound(`피어 ID '${peerId}'를 찾을 수 없습니다.`, ERROR_CODES.PEER_NOT_FOUND);
    }

    const privKey = clientPrivateKey || '{CLIENT_PRIVATE_KEY}';
    return this.driver.generateClientConfig(privKey, peer.vpn_ip);
  }

  /**
   * 피어 상세 조회
   */
  async getPeer(peerId) {
    const peer = await this.repository.findById(peerId);
    if (!peer) {
      throw AppError.notFound(`피어 ID '${peerId}'를 찾을 수 없습니다.`, ERROR_CODES.PEER_NOT_FOUND);
    }
    return peer;
  }
}

export const vpnPeerService = new VpnPeerService();
