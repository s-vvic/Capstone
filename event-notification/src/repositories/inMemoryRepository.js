import { randomUUID } from 'crypto';

/**
 * 인메모리 이벤트 저장소 (테스트 및 독립 실행용)
 */
export class InMemoryEventRepository {
  constructor() {
    this.events = new Map();
  }

  async create(data) {
    const eventId = data.event_id || randomUUID();
    const now = new Date().toISOString();
    const event = {
      event_id: eventId,
      device_id: data.device_id,
      device_name: data.device_name || data.device_id,
      event_type: data.event_type,
      occurred_at: data.occurred_at || now,
      status: data.status || 'unconfirmed',
      is_important: Boolean(data.is_important),
      zone_id: data.zone_id || null,
      sound_level_db: data.sound_level_db !== undefined ? data.sound_level_db : null,
      snapshot_url: data.snapshot_url || null,
      clip_url: data.clip_url || null,
      memo: data.memo || null,
      detail: data.detail || null,
      created_at: now,
    };

    this.events.set(eventId, event);
    return { ...event };
  }

  async findById(eventId) {
    const e = this.events.get(eventId);
    return e ? { ...e } : null;
  }

  async findMany(filters = {}, pagination = { page: 1, size: 20 }) {
    let list = Array.from(this.events.values());

    if (filters.device_ids && Array.isArray(filters.device_ids)) {
      list = list.filter((e) => filters.device_ids.includes(e.device_id));
    }
    if (filters.device_id) {
      list = list.filter((e) => e.device_id === filters.device_id);
    }
    if (filters.event_type) {
      list = list.filter((e) => e.event_type === filters.event_type);
    }
    if (filters.status) {
      list = list.filter((e) => e.status === filters.status);
    }
    if (filters.start_date) {
      const start = new Date(filters.start_date).getTime();
      list = list.filter((e) => new Date(e.occurred_at).getTime() >= start);
    }
    if (filters.end_date) {
      const end = new Date(filters.end_date).getTime();
      list = list.filter((e) => new Date(e.occurred_at).getTime() <= end);
    }

    // 최신 발생 시간 순 정렬
    list.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));

    const total = list.length;
    const page = Math.max(1, parseInt(pagination.page || 1, 10));
    const size = Math.max(1, parseInt(pagination.size || 20, 10));
    const offset = (page - 1) * size;
    const items = list.slice(offset, offset + size);

    return { total, page, size, items };
  }

  async updateStatus(eventId, { status, is_important, memo }) {
    const event = this.events.get(eventId);
    if (!event) return null;

    if (status !== undefined) event.status = status;
    if (is_important !== undefined) event.is_important = Boolean(is_important);
    if (memo !== undefined) event.memo = memo;

    return { ...event };
  }

  async batchUpdateStatus(eventIds, status = 'confirmed') {
    let updatedCount = 0;
    for (const id of eventIds) {
      const e = this.events.get(id);
      if (e) {
        e.status = status;
        updatedCount++;
      }
    }
    return updatedCount;
  }

  async getSummary(deviceIds = []) {
    const all = Array.from(this.events.values()).filter((e) =>
      deviceIds.length === 0 || deviceIds.includes(e.device_id)
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayEventsCount = all.filter((e) => e.occurred_at.startsWith(todayStr)).length;
    const unconfirmedCount = all.filter((e) => e.status === 'unconfirmed').length;

    return {
      today_events_count: todayEventsCount,
      unconfirmed_count: unconfirmedCount,
      total_events_count: all.length,
    };
  }

  clear() {
    this.events.clear();
  }
}

/**
 * 인메모리 알림 설정 저장소 (ICD_v2 2.7)
 */
export class InMemoryNotificationSettingsRepository {
  constructor() {
    this.settings = new Map();
  }

  async findByUserId(userId) {
    const s = this.settings.get(userId);
    if (s) return { ...s };

    // 기본 설정값 (ICD_v2 2.7.1)
    return {
      user_id: userId,
      motion_alert: true,
      sound_alert: true,
      offline_alert: true,
      reconnect_alert: true,
      important_only: false,
      device_alerts: [],
    };
  }

  async upsert(userId, data) {
    const current = await this.findByUserId(userId);
    const updated = {
      user_id: userId,
      motion_alert: data.motion_alert !== undefined ? Boolean(data.motion_alert) : current.motion_alert,
      sound_alert: data.sound_alert !== undefined ? Boolean(data.sound_alert) : current.sound_alert,
      offline_alert: data.offline_alert !== undefined ? Boolean(data.offline_alert) : current.offline_alert,
      reconnect_alert: data.reconnect_alert !== undefined ? Boolean(data.reconnect_alert) : current.reconnect_alert,
      important_only: data.important_only !== undefined ? Boolean(data.important_only) : current.important_only,
      device_alerts: Array.isArray(data.device_alerts) ? data.device_alerts : current.device_alerts,
      updated_at: new Date().toISOString(),
    };
    this.settings.set(userId, updated);
    return { ...updated };
  }

  clear() {
    this.settings.clear();
  }
}

/**
 * 보드 정보 모의 저장소 (ICD_v2 3.3.1 mac_no 및 provision_token 검증용)
 */
export class InMemoryDeviceLookupRepository {
  constructor() {
    this.devices = new Map();
  }

  seedDevice(device) {
    this.devices.set(device.device_id, { ...device });
  }

  async findByMacAndToken(macNo, token) {
    for (const d of this.devices.values()) {
      if (d.mac_no === macNo && d.provision_token === token) {
        return { ...d };
      }
    }
    return null;
  }

  async findById(deviceId) {
    const d = this.devices.get(deviceId);
    return d ? { ...d } : null;
  }

  async findByUserId(userId) {
    const res = [];
    for (const d of this.devices.values()) {
      if (d.user_id === userId) {
        res.push({ ...d });
      }
    }
    return res;
  }

  clear() {
    this.devices.clear();
  }
}

/**
 * 알림 발송 이력 저장소 (지연시간 검증 및 로깅용)
 */
export class InMemoryNotificationHistoryRepository {
  constructor() {
    this.history = [];
  }

  async record(item) {
    const record = {
      notification_id: randomUUID(),
      event_id: item.event_id,
      user_id: item.user_id,
      device_id: item.device_id,
      title: item.title,
      body: item.body,
      payload: item.payload,
      latency_ms: item.latency_ms || 0,
      sent_at: new Date().toISOString(),
      status: 'delivered',
    };
    this.history.push(record);
    return { ...record };
  }

  async getRecent(limit = 50) {
    return this.history.slice(-limit).reverse();
  }

  clear() {
    this.history = [];
  }
}
