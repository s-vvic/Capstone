import { vpnPeerService } from '../services/vpnPeerService.js';
import { defaultIpPoolManager } from '../services/ipPoolManager.js';
import { getWireguardDriver } from '../drivers/index.js';
import { validator } from '../middleware/validator.js';
import { config } from '../config/env.js';

export const vpnPeerController = {
  /**
   * 피어(보드 또는 스마트폰) 신규 등록 및 VPN 프로비저닝 (POST /vpn/peers/register)
   */
  async register(req, res, next) {
    try {
      validator.validatePeerRegistration(req.body);

      const userId = req.user?.userId;
      const result = await vpnPeerService.registerPeer({
        ...req.body,
        user_id: userId || req.body.user_id,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 피어 등록 해제 및 IP 회수 (DELETE /vpn/peers/:peerId)
   */
  async unregister(req, res, next) {
    try {
      const { peerId } = req.params;
      const result = await vpnPeerService.unregisterPeer(peerId);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 피어의 WireGuard 설정 파일 조회 (GET /vpn/peers/:peerId/config)
   */
  async getConfig(req, res, next) {
    try {
      const { peerId } = req.params;
      const clientPrivateKey = req.query.private_key || null;
      const configText = await vpnPeerService.getClientConfigText(peerId, clientPrivateKey);

      // text/plain 형식 또는 JSON으로 반환 가능
      if (req.headers.accept && req.headers.accept.includes('text/plain')) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="wg0-${peerId}.conf"`);
        return res.send(configText);
      }

      res.status(200).json({
        peer_id: peerId,
        config: configText,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * VPN 서버 상태 및 IP 풀 가용량 통계 (GET /vpn/status)
   */
  async getStatus(req, res, next) {
    try {
      const driver = getWireguardDriver();
      const livePeers = await driver.getPeers();
      const poolStats = defaultIpPoolManager.getStats();

      res.status(200).json({
        service: 'SecureCam WireGuard VPN Controller',
        status: 'healthy',
        server_endpoint: config.wgServerEndpoint,
        server_ip: config.wgServerIp,
        server_public_key: config.wgServerPublicKey,
        active_tunnels: livePeers.length,
        ip_pool: poolStats,
      });
    } catch (error) {
      next(error);
    }
  },
};
