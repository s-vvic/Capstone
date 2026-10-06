// Dual Driver — 저장소(DB) 구현을 고르는 곳
//   DB_DRIVER=memory → memory/ 폴더 (테스트용, DB 없이 동작)
//   그 외 (기본)     → PostgreSQL 버전
// 서비스는 항상 이 파일에서만 저장소를 가져옴
const useMemory = process.env.DB_DRIVER === 'memory';

export const fileRepository = useMemory
  ? await import('./memory/fileRepository.js')
  : await import('./fileRepository.js');

export const userRepository = useMemory
  ? await import('./memory/userRepository.js')
  : await import('./userRepository.js');

export const deviceRepository = useMemory
  ? await import('./memory/deviceRepository.js')
  : await import('./deviceRepository.js');

export const shareRepository = useMemory
  ? await import('./memory/shareRepository.js')
  : await import('./shareRepository.js');

// 실제 파일 저장소는 드라이버와 상관없이 같은 것 사용 (테스트는 임시 폴더에 저장)
export * as blobStore from './blobStore.js';