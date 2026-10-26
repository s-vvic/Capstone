import { config } from '../config/env.js';
import { InMemoryVpnRepository } from './inMemoryVpnRepository.js';
import { PostgresVpnRepository } from './postgresVpnRepository.js';
import { logger } from '../utils/logger.js';

let repositoryInstance = null;

export function getVpnRepository() {
  if (!repositoryInstance) {
    if (config.dbDriver === 'postgres') {
      logger.info('[RepositoryFactory] PostgreSQL VPN Repository 활성화');
      repositoryInstance = new PostgresVpnRepository();
    } else {
      logger.info('[RepositoryFactory] In-Memory VPN Repository 활성화');
      repositoryInstance = new InMemoryVpnRepository();
    }
  }
  return repositoryInstance;
}

export function setVpnRepository(repo) {
  repositoryInstance = repo;
}
