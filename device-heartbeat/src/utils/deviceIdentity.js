import { macAddress } from "./validation.js";

export function deviceIdFromMac(mac) {
  return `CAM-${macAddress(mac).slice(-4)}`;
}

export function deviceIdentity(device) {
  return { device_id: deviceIdFromMac(device.mac), mac: device.mac };
}
