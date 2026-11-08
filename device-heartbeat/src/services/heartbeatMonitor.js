import { deviceRepository } from "../repositories/index.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
export class HeartbeatMonitor {
  constructor() {
    this.timer = null;
    this.isRunning = false;
    this.listeners = new Set();
    this.checking = false;
  }
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(
      () =>
        this.checkStaleDevices().catch((error) =>
          logger.error("Offline check failed", error),
        ),
      env.OFFLINE_CHECK_INTERVAL_SECONDS * 1000,
    );
    this.timer.unref();
  }
  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.isRunning = false;
  }
  onStatusChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  async publish(device, oldStatus, newStatus, now) {
    for (const listener of this.listeners) {
      try {
        await listener({
          device_id: device.device_id,
          mac: device.mac,
          device_name: device.name,
          old_status: oldStatus,
          new_status: newStatus,
          occurred_at: now,
        });
      } catch (error) {
        logger.error("Status listener failed", error);
      }
    }
  }
  async checkStaleDevices(now = Date.now()) {
    if (this.checking) return [];
    this.checking = true;
    try {
      const devices = await deviceRepository.markStaleDevicesOffline(
        new Date(now - env.OFFLINE_TIMEOUT_SECONDS * 1000).toISOString(),
      );
      for (const device of devices)
        await this.publish(
          device,
          "online",
          "offline",
          new Date(now).toISOString(),
        );
      return devices;
    } finally {
      this.checking = false;
    }
  }
}
export const heartbeatMonitor = new HeartbeatMonitor();
