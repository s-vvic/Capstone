import { VpnRepositoryInterface } from './vpnRepositoryInterface.js';
import { VPN_STATUS } from '../constants/vpnConstants.js';

export class InMemoryVpnRepository extends VpnRepositoryInterface {
  constructor() {
    super();
    this.peers = new Map();
  }

  async create(peerData) {
    const peerId = peerData.peer_id || peerData.device_id || peerData.phone_id || `PEER-${Date.now()}`;
    const now = new Date().toISOString();

    const record = {
      peer_id: peerId,
      device_id: peerData.device_id || (peerData.peer_type === 'device' ? peerId : null),
      phone_id: peerData.phone_id || (peerData.peer_type === 'phone' ? peerId : null),
      user_id: peerData.user_id || null,
      peer_type: peerData.peer_type || 'device',
      name: peerData.name || peerData.device_name || '기기',
      device_name: peerData.device_name || peerData.name || '기기',
      mac_no: peerData.mac_no || null,
      serial_no: peerData.serial_no || peerData.serial || null,
      wg_pubkey: peerData.wg_pubkey,
      vpn_ip: peerData.vpn_ip,
      vpn_server: peerData.vpn_server || 'vpn.securecam.com:443',
      vpn_status: peerData.vpn_status || VPN_STATUS.DISCONNECTED,
      connected_duration_sec: peerData.connected_duration_sec || 0,
      last_handshake: peerData.last_handshake || null,
      error_type: peerData.error_type || null,
      auto_connect: peerData.auto_connect !== false,
      reconnect_on_start: peerData.reconnect_on_start !== false,
      reconnect_on_network_change: peerData.reconnect_on_network_change !== false,
      is_active: peerData.is_active !== false,
      created_at: peerData.created_at || now,
      updated_at: peerData.updated_at || now,
    };

    this.peers.set(peerId, record);
    return { ...record };
  }

  async findById(peerId) {
    const record = this.peers.get(peerId);
    if (record) return { ...record };

    // device_id or phone_id로도 조회 지원
    for (const p of this.peers.values()) {
      if (p.device_id === peerId || p.phone_id === peerId) {
        return { ...p };
      }
    }
    return null;
  }

  async findByPublicKey(publicKey) {
    for (const p of this.peers.values()) {
      if (p.wg_pubkey === publicKey) {
        return { ...p };
      }
    }
    return null;
  }

  async findByVpnIp(vpnIp) {
    for (const p of this.peers.values()) {
      if (p.vpn_ip === vpnIp) {
        return { ...p };
      }
    }
    return null;
  }

  async findByUserId(userId) {
    const results = [];
    for (const p of this.peers.values()) {
      if (p.user_id === userId) {
        results.push({ ...p });
      }
    }
    return results;
  }

  async findAll() {
    return Array.from(this.peers.values()).map((p) => ({ ...p }));
  }

  async update(peerId, updateData) {
    const record = await this.findById(peerId);
    if (!record) return null;

    const actualKey = record.peer_id;
    const updated = {
      ...record,
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    this.peers.set(actualKey, updated);
    return { ...updated };
  }

  async delete(peerId) {
    const record = await this.findById(peerId);
    if (!record) return false;
    return this.peers.delete(record.peer_id);
  }

  async clear() {
    this.peers.clear();
  }
}
