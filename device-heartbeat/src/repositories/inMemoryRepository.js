import { AppError } from "../errors/AppError.js";
export function newDevice(data) {
  return {
    user_id: null,
    name: "보드 " + data.mac,
    location: "미지정",
    description: "",
    model: null,
    firmware_version: null,
    wg_pubkey: null,
    vpn_ip: null,
    config_version: 0,
    applied_config_version: 0,
    last_seen: null,
    is_active: true,
    registered_at: null,
    created_at: new Date().toISOString(),
    status: "offline",
    vpn_status: "disconnected",
    rtsp_ok: null,
    wg_ok: null,
    storage_used_bytes: 0,
    latency_ms: null,
    last_handshake: null,
    uptime_seconds: null,
    storage_total_gb: null,
    latest_event_time: null,
    thumbnail_url: null,
    ...data,
  };
}
export class InMemoryDeviceRepository {
  constructor() {
    this.devices = new Map();
  }
  async create(data) {
    if (this.devices.has(data.mac)) throw AppError.conflict("Duplicate mac");
    if (
      data.vpn_ip &&
      [...this.devices.values()].some((d) => d.vpn_ip === data.vpn_ip)
    )
      throw AppError.conflict("Duplicate VPN IP");
    const device = newDevice(data);
    this.devices.set(device.mac, device);
    return { ...device };
  }
  async findByMac(mac) {
    const d = this.devices.get(mac);
    return d ? { ...d } : null;
  }
  async findByVpnIp(ip) {
    const d = [...this.devices.values()].find(
      (d) => d.vpn_ip === ip && d.is_active,
    );
    return d ? { ...d } : null;
  }
  async findByUserId(userId) {
    return [...this.devices.values()]
      .filter((d) => d.user_id === userId && d.is_active)
      .map((d) => ({ ...d }));
  }
  async findAll() {
    return [...this.devices.values()].map((d) => ({ ...d }));
  }
  async register(mac, userId, fields) {
    const existing = this.devices.get(mac);
    if (
      existing &&
      (!existing.is_active || (existing.user_id && existing.user_id !== userId))
    )
      throw AppError.conflict("Board already registered or inactive");
    const data = {
      ...fields,
      user_id: userId,
      registered_at: new Date().toISOString(),
    };
    if (existing) {
      Object.assign(existing, data);
      return { ...existing };
    }
    return this.create({ mac, ...data });
  }
  async update(mac, fields) {
    const d = this.devices.get(mac);
    if (!d) return null;
    if (
      fields.vpn_ip &&
      [...this.devices.values()].some(
        (other) => other.mac !== mac && other.vpn_ip === fields.vpn_ip,
      )
    )
      throw AppError.conflict("Duplicate VPN IP");
    Object.assign(d, fields);
    return { ...d };
  }
  async updateOwned(mac, userId, fields) {
    const d = this.devices.get(mac);
    if (!d?.is_active || d.user_id !== userId) return null;
    return this.update(mac, fields);
  }
  async updateHeartbeat(mac, ip, metrics, now) {
    const d = this.devices.get(mac);
    if (!d?.is_active || !ip || d.vpn_ip !== ip) return null;
    const wasOnline =
      d.last_seen && new Date(now) - new Date(d.last_seen) <= 15000;
    Object.assign(d, metrics, { last_seen: now, status: "online" });
    return { ...d, was_online: Boolean(wasOnline) };
  }
  async markStaleDevicesOffline(cutoffTime) {
    const changed = [];
    for (const d of this.devices.values()) {
      if (
        d.is_active &&
        d.status === "online" &&
        (!d.last_seen || new Date(d.last_seen) < new Date(cutoffTime))
      ) {
        d.status = "offline";
        changed.push({ ...d });
      }
    }
    return changed;
  }
  clear() {
    this.devices.clear();
  }
}
