import { deviceRepository } from "../repositories/index.js";
import { heartbeatMonitor } from "./heartbeatMonitor.js";
import { AppError } from "../errors/AppError.js";
import { deviceIdentity } from "../utils/deviceIdentity.js";
import {
  bodyObject,
  macAddress,
  nonnegative,
  onlyFields,
  sourceIp,
  text,
} from "../utils/validation.js";
export class HeartbeatService {
  async authenticateBoard(mac, remoteAddress) {
    const ip = sourceIp(remoteAddress);
    const device = ip ? await deviceRepository.findByVpnIp(ip) : null;
    if (!device || device.mac !== mac)
      throw AppError.forbidden("Unregistered VPN source or mac mismatch");
    return { device, ip };
  }
  async provisionByMac(data, remoteAddress, provisionBoard) {
    bodyObject(data);
    onlyFields(data, ["mac", "wg_pubkey", "firmware_version", "model"]);
    macAddress(data.mac);
    for (const key of ["wg_pubkey", "firmware_version", "model"])
      text(
        data[key],
        key,
        key === "wg_pubkey" ? 255 : key === "model" ? 100 : 50,
      );
    const { device, ip } = await this.authenticateBoard(
      data.mac,
      remoteAddress,
    );
    // Bootstrap is unresolved in ICD. This route only supports an existing authenticated VPN board.
    if (!provisionBoard)
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "C4 provisioning adapter is not configured; initial bootstrap remains TBR",
      );
    const result = await provisionBoard({ ...data, source_ip: ip, device });
    if (
      !result ||
      result.vpn_ip !== ip ||
      !result.server_pubkey ||
      !result.server_endpoint ||
      !result.rtsp_proxy_ip
    )
      throw new AppError(
        "SERVICE_UNAVAILABLE",
        "Invalid C4 provisioning response",
      );
    await deviceRepository.update(data.mac, {
      wg_pubkey: data.wg_pubkey,
      firmware_version: data.firmware_version,
      model: data.model,
    });
    return {
      ...deviceIdentity(device),
      vpn_ip: result.vpn_ip,
      server_pubkey: result.server_pubkey,
      server_endpoint: result.server_endpoint,
      rtsp_proxy_ip: result.rtsp_proxy_ip,
    };
  }
  async processHeartbeat(data, remoteAddress, now = Date.now()) {
    bodyObject(data);
    onlyFields(data, [
      "mac",
      "status",
      "rtsp_ok",
      "wg_ok",
      "config_version",
      "storage_used_bytes",
      "firmware_version",
      "latency_ms",
    ]);
    macAddress(data.mac);
    if (
      data.status !== "online" ||
      typeof data.rtsp_ok !== "boolean" ||
      typeof data.wg_ok !== "boolean"
    )
      throw AppError.badRequest(
        "status=online and boolean rtsp_ok/wg_ok are required",
      );
    nonnegative(data.config_version, "config_version", 2147483647);
    for (const key of ["storage_used_bytes", "latency_ms"])
      if (data[key] !== undefined)
        nonnegative(
          data[key],
          key,
          key === "latency_ms" ? 2147483647 : Number.MAX_SAFE_INTEGER,
        );
    if (data.firmware_version !== undefined)
      text(data.firmware_version, "firmware_version", 50);
    const { ip } = await this.authenticateBoard(data.mac, remoteAddress);
    const metrics = {
      rtsp_ok: data.rtsp_ok,
      wg_ok: data.wg_ok,
      applied_config_version: data.config_version,
    };
    for (const key of ["storage_used_bytes", "latency_ms", "firmware_version"])
      if (data[key] !== undefined) metrics[key] = data[key];
    const receivedAt = new Date(now).toISOString();
    const updated = await deviceRepository.updateHeartbeat(
      data.mac,
      ip,
      metrics,
      receivedAt,
    );
    if (!updated) throw AppError.forbidden("Board VPN identity changed");
    if (!updated.was_online)
      await heartbeatMonitor.publish(updated, "offline", "online", receivedAt);
    // No heartbeat history, fabricated handshake, uptime or VPN connection state.
    return { ...deviceIdentity(updated), config_version: updated.config_version };
  }
}
export const heartbeatService = new HeartbeatService();
