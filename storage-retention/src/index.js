// 다른 컴포넌트(통합 서버, 3.2.3 이벤트 모듈)가 가져다 쓰는 것들
export { createStorageRouter } from './routes/storageRoutes.js';          // app.use('/v1/storage', ...)
export { storeFile } from './services/fileService.js';                    // 스냅샷·클립 저장 (SV-F-032)
export { startRetentionScheduler } from './services/retentionScheduler.js'; // 자동 삭제 예약 (SV-F-033)