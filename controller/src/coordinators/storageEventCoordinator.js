export class StorageEventCoordinator {
  /**
   * Component 3 이벤트에서 생성된 스냅샷 또는 녹화 클립을
   * Component 5 스토리지 저장소에 파일 메타데이터로 등록 및 연계합니다. (ICD_v2 2.4, SV-F-031)
   */
  async linkEventMediaToStorage(event, { fileRepo, userId }) {
    if (!event || !fileRepo) return null;

    const recordedFiles = [];

    // 1. 스냅샷 파일 메타데이터 연동
    if (event.snapshot_url) {
      const fileName = `${event.device_id}_${event.event_id}_snapshot.jpg`;
      const meta = {
        file_id: `file_snap_${event.event_id}`,
        user_id: userId || 'default-user',
        device_id: event.device_id,
        file_name: fileName,
        file_type: 'image/jpeg',
        file_size_bytes: 150 * 1024, // 추정 150KB
        event_id: event.event_id,
        storage_path: event.snapshot_url,
        created_at: event.occurred_at || new Date().toISOString(),
      };

      if (typeof fileRepo.create === 'function') {
        try {
          const saved = await fileRepo.create(meta);
          recordedFiles.push(saved);
        } catch (e) {
          // non-blocking
        }
      }
    }

    // 2. 녹화 클립(MP4) 메타데이터 연동
    if (event.clip_url) {
      const fileName = `${event.device_id}_${event.event_id}_clip.mp4`;
      const meta = {
        file_id: `file_clip_${event.event_id}`,
        user_id: userId || 'default-user',
        device_id: event.device_id,
        file_name: fileName,
        file_type: 'video/mp4',
        file_size_bytes: 5 * 1024 * 1024, // 추정 5MB
        event_id: event.event_id,
        storage_path: event.clip_url,
        created_at: event.occurred_at || new Date().toISOString(),
      };

      if (typeof fileRepo.create === 'function') {
        try {
          const saved = await fileRepo.create(meta);
          recordedFiles.push(saved);
        } catch (e) {
          // non-blocking
        }
      }
    }

    return recordedFiles;
  }
}

export const storageEventCoordinator = new StorageEventCoordinator();
