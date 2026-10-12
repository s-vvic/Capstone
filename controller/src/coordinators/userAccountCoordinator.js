export class UserAccountCoordinator {
  /**
   * Component 1 회원 탈퇴 시 (ICD_v2 2.1.7, SV-F-001)
   * 관련된 C2 보드 연결 해제, C3 알림 설정 및 C5 파일 정리를 오케스트레이션합니다.
   */
  async handleAccountDeletion(userId, { deviceRepo, settingsRepo, fileRepo }) {
    const results = {
      userId,
      unlinkedDevices: 0,
      clearedSettings: false,
      deletedFiles: 0,
    };

    // 1. C2 기기 소유권 해제
    if (deviceRepo && typeof deviceRepo.findByUserId === 'function') {
      try {
        const devices = await deviceRepo.findByUserId(userId);
        for (const dev of devices) {
          if (typeof deviceRepo.update === 'function') {
            await deviceRepo.update(dev.device_id, {
              user_id: null,
              is_active: false,
            });
            results.unlinkedDevices++;
          }
        }
      } catch (e) {
        // non-blocking
      }
    }

    // 2. C3 사용자 알림 설정 정리
    if (settingsRepo && typeof settingsRepo.clearUser === 'function') {
      try {
        await settingsRepo.clearUser(userId);
        results.clearedSettings = true;
      } catch (e) {
        // non-blocking
      }
    }

    // 3. C5 사용자 스토리지 파일 정리
    if (fileRepo && typeof fileRepo.deleteByUserId === 'function') {
      try {
        const deleted = await fileRepo.deleteByUserId(userId);
        results.deletedFiles = deleted || 0;
      } catch (e) {
        // non-blocking
      }
    }

    return results;
  }

  /**
   * 사용자 플랜(Basic/Standard/Premium)에 따른 스토리지 할당량(bytes) 반환 (SV-F-030)
   */
  getStorageQuotaForPlan(plan = 'basic') {
    const lower = String(plan).toLowerCase();
    switch (lower) {
      case 'premium':
        return 100 * 1024 * 1024 * 1024; // 100GB
      case 'standard':
        return 30 * 1024 * 1024 * 1024;  // 30GB
      case 'basic':
      default:
        return 5 * 1024 * 1024 * 1024;   // 5GB
    }
  }

  /**
   * 사용자 플랜에 따른 파일 보존 기간(일) 반환 (SV-F-033)
   */
  getRetentionDaysForPlan(plan = 'basic') {
    const lower = String(plan).toLowerCase();
    switch (lower) {
      case 'premium':
        return 90;
      case 'standard':
        return 30;
      case 'basic':
      default:
        return 7;
    }
  }
}

export const userAccountCoordinator = new UserAccountCoordinator();
