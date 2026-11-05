import jwt from "jsonwebtoken";
import {
  env,
  createDeviceHeartbeatApp,
  deviceRepository,
  setInMemoryDriver,
  heartbeatMonitor,
} from "../src/index.js";
export { env, createDeviceHeartbeatApp, deviceRepository, heartbeatMonitor };
export const mac = "001A2B3C4D5E";
export const user = "11111111-2222-3333-4444-555555555555";
export const other = "99999999-9999-9999-9999-999999999999";
export const token = (sub = user, options = {}) =>
  jwt.sign({}, env.JWT_SECRET, { subject: sub, expiresIn: "1h", ...options });
export function reset() {
  setInMemoryDriver();
  heartbeatMonitor.listeners.clear();
  return createDeviceHeartbeatApp();
}
export async function seed(fields = {}) {
  return deviceRepository.create({
    mac,
    user_id: user,
    name: "거실",
    location: "거실",
    vpn_ip: "127.0.0.1",
    ...fields,
  });
}
export const heartbeat = (fields = {}) => ({
  mac,
  status: "online",
  rtsp_ok: true,
  wg_ok: true,
  config_version: 0,
  ...fields,
});
