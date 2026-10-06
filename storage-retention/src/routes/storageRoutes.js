// /v1/storage 아래 경로 정의
import { Router } from 'express';
import * as storageController from '../controllers/storageController.js';

// authenticate(로그인 확인 미들웨어)는 밖에서 넣어 줌 → 나중에 Component 1 것으로 바꾸기 쉬움
export function createStorageRouter({ authenticate }) {
  const router = Router();

  router.get('/usage', authenticate, storageController.getUsage);                      // SV-F-030
  router.get('/files', authenticate, storageController.listFiles);                     // SV-F-031 목록
  router.delete('/files', authenticate, storageController.deleteFiles);                // SV-F-031 삭제
  router.patch('/files/:fileId', authenticate, storageController.renameFile);          // SV-F-031 이름 변경
  router.post('/files/:fileId/share', authenticate, storageController.createShare);    // SV-F-031 공유
  router.delete('/files/:fileId/share', authenticate, storageController.revokeShare);  // SV-F-031 공유 해제

  // 아래 두 개는 JWT 없음: 다운로드는 서명(exp, sig), 공유는 공유 토큰으로 확인
  router.get('/files/:fileId/download', storageController.downloadFile);               // SV-F-031 다운로드
  router.get('/shared/:shareToken', storageController.openSharedFile);                 // 공유 링크 열기

  return router;
}