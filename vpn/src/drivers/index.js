import { config } from '../config/env.js';
import { VirtualWireguardDriver } from './virtualWireguardDriver.js';
import { LinuxWireguardDriver } from './linuxWireguardDriver.js';
import { logger } from '../utils/logger.js';

let driverInstance = null;

export function getWireguardDriver() {
  if (!driverInstance) {
    if (config.wgDriver === 'linux' && process.platform === 'linux') {
      logger.info('[DriverFactory] Linux WireGuard 드라이버 활성화');
      driverInstance = new LinuxWireguardDriver();
    } else {
      logger.info('[DriverFactory] Virtual (In-Memory) WireGuard 드라이버 활성화');
      driverInstance = new VirtualWireguardDriver();
    }
  }
  return driverInstance;
}

export function setWireguardDriver(driver) {
  driverInstance = driver;
}
