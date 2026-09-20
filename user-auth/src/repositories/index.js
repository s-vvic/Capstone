import { env } from '../config/env.js';
import { PostgresUserRepository } from './userRepository.js';
import { PostgresSessionRepository } from './sessionRepository.js';
import { PostgresLoginAttemptRepository } from './loginAttemptRepository.js';
import { PostgresPasswordResetRepository } from './passwordResetRepository.js';

import {
  InMemoryUserRepository,
  InMemorySessionRepository,
  InMemoryLoginAttemptRepository,
  InMemoryPasswordResetRepository,
} from './inMemoryRepository.js';

let userRepository;
let sessionRepository;
let loginAttemptRepository;
let passwordResetRepository;

if (env.DB_DRIVER === 'postgres') {
  userRepository = new PostgresUserRepository();
  sessionRepository = new PostgresSessionRepository();
  loginAttemptRepository = new PostgresLoginAttemptRepository();
  passwordResetRepository = new PostgresPasswordResetRepository();
} else {
  userRepository = new InMemoryUserRepository();
  sessionRepository = new InMemorySessionRepository();
  loginAttemptRepository = new InMemoryLoginAttemptRepository();
  passwordResetRepository = new InMemoryPasswordResetRepository();
}

/**
 * 테스트 등에서 강제로 인메모리 저장소로 교체하거나 초기화하기 위한 헬퍼
 */
export function setInMemoryDriver() {
  userRepository = new InMemoryUserRepository();
  sessionRepository = new InMemorySessionRepository();
  loginAttemptRepository = new InMemoryLoginAttemptRepository();
  passwordResetRepository = new InMemoryPasswordResetRepository();
  return { userRepository, sessionRepository, loginAttemptRepository, passwordResetRepository };
}

export { userRepository, sessionRepository, loginAttemptRepository, passwordResetRepository };
