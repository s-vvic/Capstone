import { env } from '../config/env.js';
import {
  InMemoryEventRepository,
  InMemoryNotificationSettingsRepository,
  InMemoryDeviceLookupRepository,
  InMemoryNotificationHistoryRepository,
} from './inMemoryRepository.js';
import { PostgresEventRepository } from './eventRepository.js';
import { PostgresNotificationSettingsRepository } from './notificationSettingsRepository.js';

let inMemoryEventRepo = new InMemoryEventRepository();
let inMemorySettingsRepo = new InMemoryNotificationSettingsRepository();
let inMemoryDeviceLookupRepo = new InMemoryDeviceLookupRepository();
let inMemoryHistoryRepo = new InMemoryNotificationHistoryRepository();

let postgresEventRepo = null;
let postgresSettingsRepo = null;

export function getEventRepository() {
  if (env.DB_DRIVER === 'postgres') {
    if (!postgresEventRepo) postgresEventRepo = new PostgresEventRepository();
    return postgresEventRepo;
  }
  return inMemoryEventRepo;
}

export function getNotificationSettingsRepository() {
  if (env.DB_DRIVER === 'postgres') {
    if (!postgresSettingsRepo) postgresSettingsRepo = new PostgresNotificationSettingsRepository();
    return postgresSettingsRepo;
  }
  return inMemorySettingsRepo;
}

export function getDeviceLookupRepository() {
  return inMemoryDeviceLookupRepo;
}

export function getNotificationHistoryRepository() {
  return inMemoryHistoryRepo;
}

/**
 * 테스트용 상태 초기화 함수
 */
export function setInMemoryDriver() {
  env.DB_DRIVER = 'memory';
  inMemoryEventRepo = new InMemoryEventRepository();
  inMemorySettingsRepo = new InMemoryNotificationSettingsRepository();
  inMemoryDeviceLookupRepo = new InMemoryDeviceLookupRepository();
  inMemoryHistoryRepo = new InMemoryNotificationHistoryRepository();
  return {
    eventRepo: inMemoryEventRepo,
    settingsRepo: inMemorySettingsRepo,
    deviceRepo: inMemoryDeviceLookupRepo,
    historyRepo: inMemoryHistoryRepo,
  };
}
