// devices 조회 — In-Memory 버전 (../deviceRepository.js 와 같은 함수·같은 결과)
import { store } from './store.js';

export async function findActiveById(deviceId) {
  const device = store.devices.get(deviceId);
  if (!device || device.is_active === false) return null;
  return { device_id: device.device_id, user_id: device.user_id, name: device.name };
}