import { deviceRepository, heartbeatRepository } from '../repositories/index.js';
import { vpnIpAllocator } from '../utils/vpnIpAllocator.js';
import { tokenGenerator } from '../utils/tokenGenerator.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export class HeartbeatService {
  /**
   * 보드 최초 부팅 시 프로비저닝 요청 처리 (ICD 3.1, SV-F-010, WC-F-030)
   * 보드에 VPN IP, 서버 공개키, heartbeat 인증 토큰 발급
   */
  async provisionBySerial({ serial_no, wg_pubkey, firmware_version, model }) {
    if (!serial_no || !wg_pubkey) {
      throw AppError.badRequest('serial_no와 wg_pubkey는 필수 항목입니다.');
    }

    const cleanSerial = serial_no.trim();
    let device = await deviceRepository.findBySerial(cleanSerial);

    if (device) {
      // 기존 등록 보드인 경우 키 갱신 및 토큰 재발급
      const provisionToken = device.provision_token || tokenGenerator.generateProvisionToken();
      let vpnIp = device.vpn_ip;
      if (!vpnIp) {
        const usedIps = await deviceRepository.getAllAssignedVpnIps();
        vpnIp = vpnIpAllocator.allocateNextIp(usedIps);
      }

      device = await deviceRepository.update(device.device_id, {
        wg_pubkey: wg_pubkey.trim(),
        vpn_ip: vpnIp,
        firmware_version: firmware_version?.trim() || device.firmware_version,
        model: model?.trim() || device.model,
        provision_token: provisionToken,
        rtsp_url: `rtsp://${vpnIp}:${env.RTSP_PORT}/${device.device_id}/live/0`,
        rtsp_url_sub: `rtsp://${vpnIp}:${env.RTSP_PORT}/${device.device_id}/live/1`,
      });

      logger.info(`[Provisioning] 기존 보드 재프로비저닝 완료: ${device.device_id} (${cleanSerial}) -> VPN IP: ${vpnIp}`);
    } else {
      // 신규 보드 프로비저닝 (미등록 상태로 서버에 선등록)
      const count = await deviceRepository.count();
      const deviceId = tokenGenerator.generateDeviceId(count + 1);
      const usedIps = await deviceRepository.getAllAssignedVpnIps();
      const vpnIp = vpnIpAllocator.allocateNextIp(usedIps);
      const provisionToken = tokenGenerator.generateProvisionToken();
      const regCode = tokenGenerator.generateRegisterCode();

      device = await deviceRepository.create({
        deviceId,
        serialNo: cleanSerial,
        registerCode: regCode,
        name: `보드 ${deviceId}`,
        location: '미지정',
        model: model?.trim() || 'RV-1106',
        firmwareVersion: firmware_version?.trim() || 'v1.0.0',
        wgPubkey: wg_pubkey.trim(),
        vpnIp,
        provisionToken,
        rtspUrl: `rtsp://${vpnIp}:${env.RTSP_PORT}/${deviceId}/live/0`,
        rtspUrlSub: `rtsp://${vpnIp}:${env.RTSP_PORT}/${deviceId}/live/1`,
      });

      logger.info(`[Provisioning] 신규 보드 프로비저닝 완료: ${deviceId} (${cleanSerial}) -> VPN IP: ${vpnIp}`);
    }

    // ICD 3.1.1 응답 규격
    return {
      device_id: device.device_id,
      vpn_ip: device.vpn_ip,
      server_pubkey: env.WG_SERVER_PUBKEY,
      server_endpoint: env.WG_SERVER_ENDPOINT,
      provision_token: device.provision_token,
      rtsp_proxy_ip: env.MEDIAMTX_RTSP_PROXY_IP,
    };
  }

  /**
   * 보드 Heartbeat 수신 및 실시간 상태 갱신 (ICD 3.2, SV-F-013, WC-F-031, NF-P-003)
   * 30초 주기로 보드가 호출하며, 204 No Content 또는 403 Forbidden 응답
   */
  async processHeartbeat({
    serial_no,
    provision_token,
    status = 'online',
    rtsp_ok,
    wg_ok,
    storage_used_bytes,
    firmware_version,
    latency_ms,
  }) {
    if (!serial_no || !provision_token) {
      throw AppError.badRequest('serial_no와 provision_token은 필수 항목입니다.');
    }

    const device = await deviceRepository.findBySerial(serial_no.trim());
    if (!device) {
      logger.warn(`[Heartbeat] 미등록 시리얼 번호 Heartbeat 수신 실패: ${serial_no}`);
      throw AppError.forbidden('등록되지 않은 보드 시리얼 번호입니다. 재프로비저닝이 필요합니다.');
    }

    // 토큰 일치 여부 확인 (ICD 3.2.1: 403 Forbidden - 토큰 불일치)
    if (device.provision_token !== provision_token.trim()) {
      logger.warn(`[Heartbeat] 토큰 불일치 거부: ${device.device_id} (${serial_no})`);
      throw AppError.forbidden('토큰 불일치 - 재프로비저닝 필요');
    }

    const numLatency = latency_ms !== undefined ? parseInt(latency_ms, 10) : null;
    const numStorage = storage_used_bytes !== undefined ? parseInt(storage_used_bytes, 10) : null;

    const updatedDevice = await deviceRepository.updateHeartbeat(device.device_id, {
      status,
      rtspOk: Boolean(rtsp_ok),
      wgOk: Boolean(wg_ok),
      storageUsedBytes: numStorage,
      firmwareVersion: firmware_version ? String(firmware_version).trim() : undefined,
      latencyMs: numLatency,
    });

    // 감사 이력 저장 (비동기)
    heartbeatRepository.recordHeartbeat({
      deviceId: device.device_id,
      serialNo: device.serial_no,
      status,
      rtspOk: Boolean(rtsp_ok),
      wgOk: Boolean(wg_ok),
      storageUsedBytes: numStorage,
      latencyMs: numLatency,
      firmwareVersion: firmware_version || device.firmware_version,
    }).catch(() => {});

    return updatedDevice;
  }
}

export const heartbeatService = new HeartbeatService();
