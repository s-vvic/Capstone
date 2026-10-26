import vpnRoutes, { vpnRouter } from './routes/index.js';
import { createApp } from './app.js';
import { vpnConnectionService } from './services/vpnConnectionService.js';
import { vpnPeerService } from './services/vpnPeerService.js';
import { defaultIpPoolManager, IpPoolManager } from './services/ipPoolManager.js';
import { keyGenerator } from './services/keyGenerator.js';
import { vpnHealthMonitor } from './services/vpnHealthMonitor.js';
import { getWireguardDriver, setWireguardDriver } from './drivers/index.js';
import { getVpnRepository, setVpnRepository } from './repositories/index.js';
import { VPN_CONFIG, VPN_STATUS, VPN_ERROR_TYPE, VPN_ACTION } from './constants/vpnConstants.js';

export {
  createApp,
  vpnRoutes,
  vpnRouter,
  vpnConnectionService,
  vpnPeerService,
  defaultIpPoolManager,
  IpPoolManager,
  keyGenerator,
  vpnHealthMonitor,
  getWireguardDriver,
  setWireguardDriver,
  getVpnRepository,
  setVpnRepository,
  VPN_CONFIG,
  VPN_STATUS,
  VPN_ERROR_TYPE,
  VPN_ACTION,
};

export default vpnRoutes;
