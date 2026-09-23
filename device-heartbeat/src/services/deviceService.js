import { deviceRepository } from '../repositories/index.js';
import { vpnIpAllocator } from '../utils/vpnIpAllocator.js';
import { tokenGenerator } from '../utils/tokenGenerator.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export class DeviceService {
  /**
   * 보드 등록 (SV-F-010, ICD 2.2.2)
   * 지원 방식: QR 코드(qr), 시리얼 번호(serial), 등록 코드(code)
   */
  async registerDevice(userId, {
    register_type,
    serial_no,
    register_code,
    name,
    location,
    group_id,
  }) {
    if (!register_type || !['qr', 'serial', 'code'].includes(register_type)) {
      throw AppError.badRequest("register_type은 'qr', 'serial', 'code' 중 하나여야 합니다.");
    }

    let device = null;

    if (register_type === 'qr' || register_type === 'serial') {
      if (!serial_no || typeof serial_no !== 'string' || serial_no.trim().length === 0) {
        throw AppError.badRequest('시리얼 번호(serial_no)가 필요합니다.');
      }
      const cleanSerial = serial_no.trim();
      device = await deviceRepository.findBySerial(cleanSerial);

      if (device) {
        if (device.user_id && device.user_id !== userId) {
          throw AppError.conflict('이미 다른 계정에 등록된 보드입니다.', '기존 계정에서 보드 등록을 해제한 후 다시 시도하세요.');
        }
        // 기존 사전 프로비저닝된 보드에 사용자 매핑 및 설정 업데이트
        const updated = await deviceRepository.update(device.device_id, {
          user_id: userId,
          name: name?.trim() || device.name || `보드 ${device.device_id}`,
          location: location?.trim() || device.location || '미지정',
          group_id: group_id?.trim() || device.group_id,
          registered_at: new Date().toISOString(),
          is_active: true,
        });
        logger.info(`[Device] 보드 등록 완료 (${register_type}): ${device.device_id} (사용자: ${userId})`);
        return updated;
      }

      // 서버에 보드 레코드가 아직 없는 경우 새로 생성
      const count = await deviceRepository.count();
      const deviceId = tokenGenerator.generateDeviceId(count + 1);
      const usedIps = await deviceRepository.getAllAssignedVpnIps();
      const vpnIp = vpnIpAllocator.allocateNextIp(usedIps);
      const provisionToken = tokenGenerator.generateProvisionToken();
      const regCode = tokenGenerator.generateRegisterCode();

      const newDevice = await deviceRepository.create({
        deviceId,
        userId,
        serialNo: cleanSerial,
        registerCode: regCode,
        name: name?.trim() || `보드 ${deviceId}`,
        location: location?.trim() || '미지정',
        groupId: group_id?.trim() || null,
        vpnIp,
        provisionToken,
        rtspUrl: `rtsp://${vpnIp}:${env.RTSP_PORT}/${deviceId}/live/0`,
        rtspUrlSub: `rtsp://${vpnIp}:${env.RTSP_PORT}/${deviceId}/live/1`,
        registeredAt: new Date().toISOString(),
      });

      logger.info(`[Device] 신규 보드 등록 완료 (${register_type}): ${deviceId} (사용자: ${userId})`);
      return newDevice;
    }

    if (register_type === 'code') {
      if (!register_code || typeof register_code !== 'string' || register_code.trim().length === 0) {
        throw AppError.badRequest('등록 코드(register_code)가 필요합니다.');
      }
      device = await deviceRepository.findByRegisterCode(register_code.trim());
      if (!device) {
        throw AppError.notFound('유효하지 않거나 존재하지 않는 등록 코드입니다.');
      }
      if (device.user_id && device.user_id !== userId) {
        throw AppError.conflict('이미 등록된 보드입니다.');
      }

      const updated = await deviceRepository.update(device.device_id, {
        user_id: userId,
        name: name?.trim() || device.name,
        location: location?.trim() || device.location,
        group_id: group_id?.trim() || device.group_id,
        registered_at: new Date().toISOString(),
        is_active: true,
      });

      logger.info(`[Device] 코드 기반 보드 등록 완료: ${device.device_id} (사용자: ${userId})`);
      return updated;
    }
  }

  /**
   * 사용자 소유의 등록 보드 목록 조회 (SV-F-011, ICD 2.2.1)
   */
  async listDevices(userId) {
    const devices = await deviceRepository.findByUserId(userId);
    return devices.map((d) => ({
      device_id: d.device_id,
      name: d.name,
      location: d.location,
      serial_no: d.serial_no,
      model: d.model,
      firmware_version: d.firmware_version,
      status: d.status,
      vpn_status: d.vpn_status,
      vpn_ip: d.vpn_ip,
      last_seen: d.last_seen,
      latest_event_time: d.latest_event_time,
      thumbnail_url: d.thumbnail_url || '',
    }));
  }

  /**
   * 특정 보드의 현재 상세 상태 및 VPN 정보 조회 (SV-F-011, ICD 2.2.3)
   */
  async getDeviceStatus(deviceId, userId) {
    const device = await deviceRepository.findById(deviceId);
    if (!device) {
      throw AppError.notFound(`보드 ID '${deviceId}'를 찾을 수 없습니다.`);
    }
    if (userId && device.user_id && device.user_id !== userId) {
      throw AppError.forbidden('해당 보드의 상태를 조회할 권한이 없습니다.');
    }

    return {
      status: device.status,
      vpn_status: device.vpn_status,
      vpn_ip: device.vpn_ip,
      last_handshake: device.last_handshake,
      uptime_seconds: device.uptime_seconds,
      storage_total_gb: device.storage_total_gb,
      storage_used_gb: device.storage_used_gb,
      rtsp_url: device.rtsp_url,
      rtsp_url_sub: device.rtsp_url_sub,
    };
  }

  /**
   * 보드 정보 수정 (이름, 위치, 설명, 그룹) (SV-F-012, ICD 2.2.4)
   */
  async updateDevice(deviceId, userId, { name, location, description, group_id }) {
    const device = await deviceRepository.findById(deviceId);
    if (!device) {
      throw AppError.notFound(`보드 ID '${deviceId}'를 찾을 수 없습니다.`);
    }
    if (userId && device.user_id && device.user_id !== userId) {
      throw AppError.forbidden('해당 보드의 정보를 수정할 권한이 없습니다.');
    }

    const updateFields = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.length > 50) {
        throw AppError.badRequest('보드 이름은 1자 이상 50자 이하이어야 합니다.');
      }
      updateFields.name = name.trim();
    }
    if (location !== undefined) {
      updateFields.location = String(location).trim();
    }
    if (description !== undefined) {
      if (description.length > 200) {
        throw AppError.badRequest('설명은 최대 200자까지 가능합니다.');
      }
      updateFields.description = String(description).trim();
    }
    if (group_id !== undefined) {
      updateFields.group_id = group_id ? String(group_id).trim() : null;
    }

    const updated = await deviceRepository.update(deviceId, updateFields);
    logger.info(`[Device] 보드 정보 수정 완료: ${deviceId}`);
    return updated;
  }
}

export const deviceService = new DeviceService();
