import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deviceEventCoordinator } from '../src/coordinators/deviceEventCoordinator.js';
import { userAccountCoordinator } from '../src/coordinators/userAccountCoordinator.js';
import { storageEventCoordinator } from '../src/coordinators/storageEventCoordinator.js';

describe('컴포넌트 간 오케스트레이션 및 연동 테스트 (Inter-component Coordination)', () => {
  it('C2 보드 오프라인 감지 시 C3 연결 끊김 이벤트가 정상 생성되어야 한다 (deviceEventCoordinator)', async () => {
    let capturedReport = null;
    const mockEventService = {
      async reportEvent(payload) {
        capturedReport = payload;
        return { event_id: 'ev-auto-01', ...payload };
      },
    };

    const mockDevice = {
      device_id: 'CAM-0001',
      name: '현관 카메라',
      mac_no: 'AA:BB:CC:DD:EE:99',
      provision_token: 'prov_test_123',
    };

    const created = await deviceEventCoordinator.handleDeviceStatusChange({
      device: mockDevice,
      oldStatus: 'online',
      newStatus: 'offline',
      eventService: mockEventService,
    });

    assert.ok(created);
    assert.equal(capturedReport.event_type, 'connection');
    assert.ok(capturedReport.detail.includes('offline'));
    assert.equal(capturedReport.mac_no, 'AA:BB:CC:DD:EE:99');
  });

  it('C1 사용자 회원 탈퇴 시 연관된 C2 기기 및 C5 파일 정리가 조정되어야 한다 (userAccountCoordinator)', async () => {
    const unlinkedIds = [];
    const mockDeviceRepo = {
      async findByUserId(uid) {
        return [{ device_id: 'CAM-0001' }, { device_id: 'CAM-0002' }];
      },
      async update(deviceId, fields) {
        unlinkedIds.push(deviceId);
        return { device_id: deviceId, ...fields };
      },
    };

    const mockFileRepo = {
      async deleteByUserId(uid) {
        return 5;
      },
    };

    const result = await userAccountCoordinator.handleAccountDeletion('user-uuid-1234', {
      deviceRepo: mockDeviceRepo,
      settingsRepo: null,
      fileRepo: mockFileRepo,
    });

    assert.equal(result.unlinkedDevices, 2);
    assert.equal(result.deletedFiles, 5);
    assert.deepEqual(unlinkedIds, ['CAM-0001', 'CAM-0002']);
  });

  it('C1 구독 플랜에 따른 C5 스토리지 용량 한도 및 보존 기간이 규격에 맞게 매핑되어야 한다', () => {
    assert.equal(userAccountCoordinator.getStorageQuotaForPlan('basic'), 5 * 1024 * 1024 * 1024);
    assert.equal(userAccountCoordinator.getStorageQuotaForPlan('standard'), 30 * 1024 * 1024 * 1024);
    assert.equal(userAccountCoordinator.getStorageQuotaForPlan('premium'), 100 * 1024 * 1024 * 1024);

    assert.equal(userAccountCoordinator.getRetentionDaysForPlan('basic'), 7);
    assert.equal(userAccountCoordinator.getRetentionDaysForPlan('standard'), 30);
    assert.equal(userAccountCoordinator.getRetentionDaysForPlan('premium'), 90);
  });

  it('C3 이벤트 미디어 발생 시 C5 스토리지 파일 메타데이터로 연계 등록되어야 한다 (storageEventCoordinator)', async () => {
    const createdFiles = [];
    const mockFileRepo = {
      async create(data) {
        createdFiles.push(data);
        return data;
      },
    };

    const mockEvent = {
      event_id: 'ev-test-999',
      device_id: 'CAM-0001',
      snapshot_url: 'https://api.securecam.com/v1/snapshots/ev-test-999.jpg',
      clip_url: 'https://api.securecam.com/v1/clips/ev-test-999.mp4',
      occurred_at: new Date().toISOString(),
    };

    const result = await storageEventCoordinator.linkEventMediaToStorage(mockEvent, {
      fileRepo: mockFileRepo,
      userId: 'test-user-id',
    });

    assert.equal(result.length, 2);
    assert.equal(createdFiles[0].file_type, 'image/jpeg');
    assert.equal(createdFiles[1].file_type, 'video/mp4');
  });
});
