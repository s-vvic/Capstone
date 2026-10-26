/**
 * VPN 피어 및 연결 저장소 인터페이스
 */
export class VpnRepositoryInterface {
  async create(peerData) {
    throw new Error('Not implemented');
  }

  async findById(peerId) {
    throw new Error('Not implemented');
  }

  async findByPublicKey(publicKey) {
    throw new Error('Not implemented');
  }

  async findByVpnIp(vpnIp) {
    throw new Error('Not implemented');
  }

  async findByUserId(userId) {
    throw new Error('Not implemented');
  }

  async findAll() {
    throw new Error('Not implemented');
  }

  async update(peerId, updateData) {
    throw new Error('Not implemented');
  }

  async delete(peerId) {
    throw new Error('Not implemented');
  }

  async clear() {
    throw new Error('Not implemented');
  }
}
