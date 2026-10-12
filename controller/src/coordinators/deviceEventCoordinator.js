import { EventEmitter } from 'events';

export class DeviceEventCoordinator extends EventEmitter {
  constructor() {
    super();
  }

  /**
   * Component 2의 Heartbeat 오프라인/재연결 상태 변화를 감지하여
   * Component 3의 Event Ingestion & Push Notification으로 전달합니다. (ICD_v2 3.3, 6.3)
   */
  async handleDeviceStatusChange({ device, oldStatus, newStatus, eventService, fcmService }) {
    if (!device) return;

    if (oldStatus === 'online' && newStatus === 'offline') {
      const eventPayload = {
        mac_no: device.mac_no || 'AA:BB:CC:DD:EE:00',
        provision_token: device.provision_token || 'prov_auto',
        event_type: 'connection',
        occurred_at: new Date().toISOString(),
        detail: `${device.name || device.device_id} offline (Heartbeat 타임아웃)`,
      };

      if (eventService) {
        try {
          const created = await eventService.reportEvent(eventPayload);
          this.emit('offlineEventLogged', { device, event: created });
          return created;
        } catch (e) {
          // background non-blocking
        }
      }
    } else if (oldStatus === 'offline' && newStatus === 'online') {
      const eventPayload = {
        mac_no: device.mac_no || 'AA:BB:CC:DD:EE:00',
        provision_token: device.provision_token || 'prov_auto',
        event_type: 'connection',
        occurred_at: new Date().toISOString(),
        detail: `${device.name || device.device_id} reconnect (Heartbeat 수신 재개)`,
      };

      if (eventService) {
        try {
          const created = await eventService.reportEvent(eventPayload);
          this.emit('reconnectEventLogged', { device, event: created });
          return created;
        } catch (e) {
          // background non-blocking
        }
      }
    }
  }
}

export const deviceEventCoordinator = new DeviceEventCoordinator();
