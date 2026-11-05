import { deviceRepository } from "../repositories/index.js";
import { AppError } from "../errors/AppError.js";
import { env } from "../config/env.js";
import {
  bodyObject,
  macAddress,
  text,
  onlyFields,
} from "../utils/validation.js";
export function onlineStatus(device, now = Date.now()) {
  return device.is_active &&
    device.last_seen &&
    now - new Date(device.last_seen).getTime() <=
      env.OFFLINE_TIMEOUT_SECONDS * 1000
    ? "online"
    : "offline";
}
export function deviceView(d) {
  return {
    mac: d.mac,
    name: d.name,
    location: d.location,
    firmware_version: d.firmware_version,
    status: onlineStatus(d),
    vpn_status: d.vpn_status,
    vpn_ip: d.vpn_ip,
    last_seen: d.last_seen,
    latest_event_time: d.latest_event_time,
    thumbnail_url: d.thumbnail_url,
  };
}
export class DeviceService {
  async ownedDevice(mac, userId) {
    macAddress(mac);
    if (!userId) throw AppError.unauthorized("User identity required");
    const device = await deviceRepository.findByMac(mac);
    if (!device || !device.is_active)
      throw AppError.notFound("Board not found");
    if (device.user_id !== userId)
      throw AppError.forbidden("Board ownership required");
    return device;
  }
  async registerDevice(userId, data) {
    if (!userId) throw AppError.unauthorized("User identity required");
    bodyObject(data);
    onlyFields(data, ["mac", "name", "location"]);
    macAddress(data.mac);
    const fields = { location: text(data.location, "location", 200) };
    if (data.name !== undefined) fields.name = text(data.name, "name", 50);
    const result = await deviceRepository.register(data.mac, userId, fields);
    if (!result)
      throw AppError.conflict("Board already registered or inactive");
    return deviceView(result);
  }
  async listDevices(userId) {
    if (!userId) throw AppError.unauthorized("User identity required");
    return (await deviceRepository.findByUserId(userId)).map(deviceView);
  }
  async getDeviceStatus(mac, userId) {
    const d = await this.ownedDevice(mac, userId);
    return {
      status: onlineStatus(d),
      vpn_status: d.vpn_status,
      vpn_ip: d.vpn_ip,
      last_handshake: d.last_handshake,
      uptime_seconds: d.uptime_seconds,
      storage_total_gb: d.storage_total_gb,
      storage_used_gb: Number(d.storage_used_bytes) / 1073741824,
      rtsp_url: d.vpn_ip
        ? "rtsp://" + d.vpn_ip + ":" + env.RTSP_PORT + "/live/0"
        : null,
      rtsp_url_sub: d.vpn_ip
        ? "rtsp://" + d.vpn_ip + ":" + env.RTSP_PORT + "/live/1"
        : null,
    };
  }
  async updateDevice(mac, userId, data) {
    await this.ownedDevice(mac, userId);
    bodyObject(data);
    onlyFields(data, ["name", "location", "description"]);
    if (!Object.keys(data).length)
      throw AppError.badRequest("At least one field required");
    const fields = {};
    if (data.name !== undefined) fields.name = text(data.name, "name", 50);
    if (data.location !== undefined)
      fields.location = text(data.location, "location", 200);
    if (data.description !== undefined) {
      if (typeof data.description !== "string" || data.description.length > 200)
        throw AppError.badRequest("description must be at most 200 characters");
      fields.description = data.description.trim();
    }
    const result = await deviceRepository.updateOwned(mac, userId, fields);
    if (!result) throw AppError.forbidden("Board ownership changed");
    return { ...deviceView(result), description: result.description };
  }
}
export const deviceService = new DeviceService();
