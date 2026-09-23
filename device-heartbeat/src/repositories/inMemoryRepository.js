/**
 * 완전 호환 In-Memory 저장소 (단독 실행 및 단위/통합 테스트 지원)
 */

export class InMemoryDeviceRepository {
  constructor() {
    this.devices = new Map();
  }

  async create(deviceData) {
    const now = new Date().toISOString();
    const device = {
      device_id: deviceData.deviceId,
      user_id: deviceData.userId || null,
      serial_no: deviceData.serialNo,
      register_code: deviceData.registerCode || null,
      name: deviceData.name,
      location: deviceData.location || '미지정',
      description: deviceData.description || '',
      group_id: deviceData.groupId || null,
      model: deviceData.model || 'RV-1106',
      firmware_version: deviceData.firmwareVersion || 'v1.0.0',
      wg_pubkey: deviceData.wgPubkey || null,
      vpn_ip: deviceData.vpnIp || null,
      provision_token: deviceData.provisionToken || null,
      is_active: deviceData.isActive !== false,
      status: deviceData.status || 'offline',
      vpn_status: deviceData.vpnStatus || 'disconnected',
      last_seen: deviceData.lastSeen || null,
      last_handshake: deviceData.lastHandshake || null,
      latest_event_time: deviceData.latestEventTime || null,
      uptime_seconds: deviceData.uptimeSeconds || 0,
      storage_total_gb: deviceData.storageTotalGb || 32.0,
      storage_used_bytes: deviceData.storageUsedBytes || 0,
      storage_used_gb: deviceData.storageUsedGb || 0.0,
      latency_ms: deviceData.latencyMs || 0,
      thumbnail_url: deviceData.thumbnailUrl || '',
      rtsp_url: deviceData.rtspUrl || null,
      rtsp_url_sub: deviceData.rtspUrlSub || null,
      vpn_server: deviceData.vpnServer || 'vpn.securecam.com:443',
      connected_duration_sec: deviceData.connectedDurationSec || 0,
      error_type: deviceData.errorType || null,
      auto_connect: deviceData.autoConnect !== false,
      reconnect_on_start: deviceData.reconnectOnStart !== false,
      reconnect_on_network_change: deviceData.reconnectOnNetworkChange !== false,
      registered_at: deviceData.registeredAt || null,
      created_at: now,
      updated_at: now,
    };
    this.devices.set(device.device_id, device);
    return { ...device };
  }

  async findById(deviceId) {
    const d = this.devices.get(deviceId);
    return d ? { ...d } : null;
  }

  async findBySerial(serialNo) {
    for (const d of this.devices.values()) {
      if (d.serial_no === serialNo) {
        return { ...d };
      }
    }
    return null;
  }

  async findByRegisterCode(code) {
    for (const d of this.devices.values()) {
      if (d.register_code === code) {
        return { ...d };
      }
    }
    return null;
  }

  async findByProvisionToken(token) {
    for (const d of this.devices.values()) {
      if (d.provision_token === token) {
        return { ...d };
      }
    }
    return null;
  }

  async findByUserId(userId) {
    const list = [];
    for (const d of this.devices.values()) {
      if (d.user_id === userId && d.is_active) {
        list.push({ ...d });
      }
    }
    return list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  async findAll() {
    return Array.from(this.devices.values()).map((d) => ({ ...d }));
  }

  async getAllAssignedVpnIps() {
    const ips = [];
    for (const d of this.devices.values()) {
      if (d.vpn_ip) ips.push(d.vpn_ip);
    }
    return ips;
  }

  async count() {
    return this.devices.size;
  }

  async update(deviceId, fields = {}) {
    const d = this.devices.get(deviceId);
    if (!d) return null;

    Object.assign(d, fields, { updated_at: new Date().toISOString() });
    return { ...d };
  }

  async updateHeartbeat(deviceId, metrics) {
    const d = this.devices.get(deviceId);
    if (!d) return null;

    const now = new Date().toISOString();
    d.status = 'online';
    d.vpn_status = metrics.wgOk ? 'connected' : 'error';
    d.last_seen = now;
    d.last_handshake = now;
    if (metrics.storageUsedBytes !== undefined && metrics.storageUsedBytes !== null) {
      d.storage_used_bytes = metrics.storageUsedBytes;
      d.storage_used_gb = Number((metrics.storageUsedBytes / (1024 * 1024 * 1024)).toFixed(2));
    }
    if (metrics.latencyMs !== undefined && metrics.latencyMs !== null) {
      d.latency_ms = metrics.latencyMs;
    }
    if (metrics.firmwareVersion) {
      d.firmware_version = metrics.firmwareVersion;
    }
    d.uptime_seconds += 30;
    d.connected_duration_sec += 30;
    d.error_type = null;
    d.updated_at = now;

    return { ...d };
  }

  async markStaleDevicesOffline(cutoffTime) {
    const changed = [];
    const cutoffMs = new Date(cutoffTime).getTime();

    for (const d of this.devices.values()) {
      if (d.status === 'online') {
        const lastSeenMs = d.last_seen ? new Date(d.last_seen).getTime() : 0;
        if (lastSeenMs < cutoffMs) {
          d.status = 'offline';
          d.vpn_status = 'disconnected';
          d.error_type = 'heartbeat_timeout';
          d.updated_at = new Date().toISOString();
          changed.push({
            device_id: d.device_id,
            name: d.name,
            serial_no: d.serial_no,
            last_seen: d.last_seen,
          });
        }
      }
    }
    return changed;
  }

  clear() {
    this.devices.clear();
  }
}

export class InMemoryHeartbeatRepository {
  constructor() {
    this.logs = [];
  }

  async recordHeartbeat(logData) {
    const entry = {
      log_id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      device_id: logData.deviceId,
      serial_no: logData.serialNo,
      status: logData.status || 'online',
      rtsp_ok: Boolean(logData.rtspOk),
      wg_ok: Boolean(logData.wgOk),
      storage_used_bytes: logData.storageUsedBytes || null,
      latency_ms: logData.latencyMs || null,
      firmware_version: logData.firmwareVersion || null,
      received_at: new Date().toISOString(),
    };
    this.logs.push(entry);
    return { ...entry };
  }

  async getRecentLogs(deviceId, limit = 50) {
    return this.logs
      .filter((l) => l.device_id === deviceId)
      .slice(-limit)
      .reverse();
  }

  clear() {
    this.logs = [];
  }
}
