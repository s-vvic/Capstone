// users 조회 — In-Memory 버전 (../userRepository.js 와 같은 함수·같은 결과)
import { store } from './store.js';

export async function findPlanByUserId(userId) {
  return store.users.get(userId)?.plan ?? null;
}