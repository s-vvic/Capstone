import { getPool } from "../config/database.js";
import { deviceIdFromMac } from "../utils/deviceIdentity.js";
const MUTABLE = new Set([
  "user_id",
  "name",
  "location",
  "description",
  "model",
  "firmware_version",
  "wg_pubkey",
  "vpn_ip",
  "config_version",
  "applied_config_version",
  "last_seen",
  "is_active",
  "registered_at",
  "status",
  "vpn_status",
  "rtsp_ok",
  "wg_ok",
  "storage_used_bytes",
  "latency_ms",
  "last_handshake",
  "uptime_seconds",
  "storage_total_gb",
  "latest_event_time",
  "thumbnail_url",
]);
export class PostgresDeviceRepository {
  constructor(pool = getPool()) {
    this.pool = pool;
  }
  fields(data) {
    const entries = Object.entries(data);
    if (entries.some(([k]) => k !== "mac" && k !== "device_id" && !MUTABLE.has(k)))
      throw new Error("Unsupported device column");
    return entries;
  }
  async create(data) {
    const entries = this.fields({ ...data, device_id: deviceIdFromMac(data.mac) });
    const result = await this.pool.query(
      "INSERT INTO devices (" +
        entries.map(([k]) => k).join(",") +
        ") VALUES (" +
        entries.map((_, i) => "$" + (i + 1)).join(",") +
        ") RETURNING *",
      entries.map(([, v]) => v),
    );
    return result.rows[0];
  }
  async findByMac(mac) {
    return (
      (await this.pool.query("SELECT * FROM devices WHERE mac = $1", [mac]))
        .rows[0] || null
    );
  }
  async findByVpnIp(ip) {
    return (
      (
        await this.pool.query(
          "SELECT * FROM devices WHERE vpn_ip = $1 AND is_active = true",
          [ip],
        )
      ).rows[0] || null
    );
  }
  async findByUserId(id) {
    return (
      await this.pool.query(
        "SELECT * FROM devices WHERE user_id = $1 AND is_active = true ORDER BY created_at, mac",
        [id],
      )
    ).rows;
  }
  async findAll() {
    return (
      await this.pool.query("SELECT * FROM devices ORDER BY created_at, mac")
    ).rows;
  }
  async register(mac, userId, fields) {
    // One statement prevents concurrent ownership claims from overwriting each other.
    const result = await this.pool.query(
      "INSERT INTO devices (device_id,mac,user_id,name,location,registered_at) VALUES ($6,$1,$2,COALESCE($3,$5),$4,CURRENT_TIMESTAMP) ON CONFLICT (mac) DO UPDATE SET device_id = EXCLUDED.device_id, user_id = EXCLUDED.user_id, name = COALESCE($3,devices.name), location = EXCLUDED.location, registered_at = EXCLUDED.registered_at WHERE devices.is_active = true AND (devices.user_id IS NULL OR devices.user_id = EXCLUDED.user_id) RETURNING *",
      [mac, userId, fields.name ?? null, fields.location, "보드 " + mac, deviceIdFromMac(mac)],
    );
    return result.rows[0] || null;
  }
  async update(mac, fields, userId) {
    if ("mac" in fields || "device_id" in fields) throw new Error("Device identity is immutable");
    const entries = this.fields(fields);
    if (!entries.length) return this.findByMac(mac);
    const values = entries.map(([, v]) => v);
    values.push(mac);
    let where = "mac = $" + values.length;
    if (userId !== undefined) {
      values.push(userId);
      where += " AND is_active = true AND user_id = $" + values.length;
    }
    const result = await this.pool.query(
      "UPDATE devices SET " +
        entries.map(([k], i) => k + " = $" + (i + 1)).join(",") +
        " WHERE " +
        where +
        " RETURNING *",
      values,
    );
    return result.rows[0] || null;
  }
  async updateOwned(mac, userId, fields) {
    return this.update(mac, fields, userId);
  }
  async updateHeartbeat(mac, ip, metrics, now) {
    // Lock the row so the previous status and returned latest config are consistent.
    const result = await this.pool.query(
      "WITH previous AS MATERIALIZED (SELECT mac, (last_seen IS NOT NULL AND last_seen >= $3::timestamptz - interval '15 seconds') AS was_online FROM devices WHERE mac=$1 AND vpn_ip=$2 AND is_active=true FOR UPDATE) UPDATE devices d SET device_id='CAM-' || right(d.mac,4), last_seen=$3, status='online', rtsp_ok=$4, wg_ok=$5, applied_config_version=$6, storage_used_bytes=COALESCE($7,d.storage_used_bytes), latency_ms=COALESCE($8,d.latency_ms), firmware_version=COALESCE($9,d.firmware_version) FROM previous p WHERE d.mac=p.mac RETURNING d.*, p.was_online",
      [
        mac,
        ip,
        now,
        metrics.rtsp_ok,
        metrics.wg_ok,
        metrics.applied_config_version,
        metrics.storage_used_bytes ?? null,
        metrics.latency_ms ?? null,
        metrics.firmware_version ?? null,
      ],
    );
    return result.rows[0] || null;
  }
  async markStaleDevicesOffline(cutoff) {
    return (
      await this.pool.query(
        "UPDATE devices SET status='offline' WHERE is_active=true AND status='online' AND (last_seen IS NULL OR last_seen < $1) RETURNING *",
        [cutoff],
      )
    ).rows;
  }
}
