// In-Memory 드라이버의 저장 공간 (테스트용 — DB 없이 동작, 프로그램이 끝나면 사라짐)
export const store = {
  users: new Map(),   // user_id → { user_id, plan }
  devices: new Map(), // device_id → { device_id, user_id, name, is_active }
  files: new Map(),   // file_id → files 테이블 한 행과 같은 모양
  shares: new Map(),  // share_id → file_shares 테이블 한 행과 같은 모양
};

export function resetStore() {
  for (const table of Object.values(store)) table.clear();
}

// sql/dev_dependencies.sql 과 같은 테스트 사용자 3명 + 보드 3대
export function seedDevData() {
  const rows = [
    ['11111111-1111-1111-1111-111111111111', 'basic', 'CAM-0001', '현관'],
    ['22222222-2222-2222-2222-222222222222', 'standard', 'CAM-0002', '거실'],
    ['33333333-3333-3333-3333-333333333333', 'premium', 'CAM-0003', '창고'],
  ];
  for (const [userId, plan, deviceId, name] of rows) {
    store.users.set(userId, { user_id: userId, plan });
    store.devices.set(deviceId, { device_id: deviceId, user_id: userId, name, is_active: true });
  }
}

// 파일 삭제 + 그 파일의 공유도 같이 삭제 (PostgreSQL의 ON DELETE CASCADE 흉내)
export function removeFile(fileId) {
  store.files.delete(fileId);
  for (const [shareId, share] of store.shares) {
    if (share.file_id === fileId) store.shares.delete(shareId);
  }
}