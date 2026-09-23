import { env } from '../config/env.js';
import { PostgresDeviceRepository } from './deviceRepository.js';
import { PostgresHeartbeatRepository } from './heartbeatRepository.js';
import { InMemoryDeviceRepository, InMemoryHeartbeatRepository } from './inMemoryRepository.js';

let deviceRepository;
let heartbeatRepository;

if (env.DB_DRIVER === 'postgres') {
  deviceRepository = new PostgresDeviceRepository();
  heartbeatRepository = new PostgresHeartbeatRepository();
} else {
  deviceRepository = new InMemoryDeviceRepository();
  heartbeatRepository = new InMemoryHeartbeatRepository();
}

/**
 * 테스트 등에서 강제로 인메모리 저장소로 교체하거나 초기화하기 위한 헬퍼
 */
export function setInMemoryDriver() {
  deviceRepository = new InMemoryDeviceRepository();
  heartbeatRepository = new InMemoryHeartbeatRepository();
  return { deviceRepository, heartbeatRepository };
}

export { deviceRepository, heartbeatRepository };
