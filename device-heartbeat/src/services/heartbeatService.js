import { deviceRepository, heartbeatRepository } from '../repositories/index.js';
import { vpnIpAllocator } from '../utils/vpnIpAllocator.js';
import { tokenGenerator } from '../utils/tokenGenerator.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export class HeartbeatService {
  /**
   * 보드 최초 부팅 시 프로비저닝 요청 처리 (ICD_v2 3.1.1, SV-F-010, SV-F-015, WC-F-030)
   * SV-F-015: 보드 MAC 주소 기반 식별 번호 부여
   * 보드에 VPN IP, 서버 공개키, heartbeat 인증 토큰 발급
   */
  async provisionByMac({ mac_no, MAC_no, serial_no, wg_pubkey, firmware_version, model }) {
    const rawMac = mac_no || MAC_no;
    if (!rawMac && !serial_no) {
      throw AppError.badRequest('mac_no 또는 serial_no는 필수 항목입니다.');
    }
    if (!wg_pubkey) {
      throw AppError.badRequest('wg_pubkey는 필수 항목입니다.');
    }

    const cleanMac = rawMac ? String(rawMac).trim() : null;
    const cleanSerial = serial_no ? String(serial_no).trim() : null;

    let device = null;
    if (cleanMac) {
      device = await deviceRepository.findByMac(cleanMac);
    }
    if (!device && cleanSerial) {
      device = await deviceRepository.findBySerial(cleanSerial);
    }

    if (device) {
      // 기존 등록 보드인 경우 키 갱신 및 토큰 재발급
      const provisionToken = device.provision_token || tokenGenerator.generateProvisionToken();
      let vpnIp = device.vpn_ip;
      if (!vpnIp) {
        const usedIps = await deviceRepository.getAllAssignedVpnIps();
        vpnIp = vpnIpAllocator.allocateNextIp(usedIps);
      }

      device = await deviceRepository.update(device.device_id, {
        mac_no: cleanMac || device.mac_no,
        serial_no: cleanSerial || device.serial_no,
        wg_pubkey: wg_pubkey.trim(),
        vpn_ip: vpnIp,
        firmware_version: firmware_version?.trim() || device.firmware_version,
        model: model?.trim() || device.model,
        provision_token: provisionToken,
        rtsp_url: `rtsp://${vpnIp}:${env.RTSP_PORT}/${device.device_id}/live/0`,
        rtsp_url_sub: `rtsp://${vpnIp}:${env.RTSP_PORT}/${device.device_id}/live/1`,
      });

      logger.info(`[Provisioning] 기존 보드 재프로비저닝 완료: ${device.device_id} -> VPN IP: ${vpnIp}`);
    } else {
      // 신규 보드 프로비저닝 (미등록 상태로 서버에 선등록)
      // SV-F-015: 보드 MAC 주소 기반 식별 번호 부여
      const deviceId = cleanMac
        ? tokenGenerator.generateDeviceIdFromMac(cleanMac)
        : tokenGenerator.generateDeviceId((await deviceRepository.count()) + 1);

      const usedIps = await deviceRepository.getAllAssignedVpnIps();
      const vpnIp = vpnIpAllocator.allocateNextIp(usedIps);
      const provisionToken = tokenGenerator.generateProvisionToken();
      const regCode = tokenGenerator.generateRegisterCode();

      device = await deviceRepository.create({
        deviceId,
        macNo: cleanMac || (cleanSerial ? `MAC-${cleanSerial}` : null),
        serialNo: cleanSerial || (cleanMac ? `SN-${cleanMac.replace(/[^a-zA-Z0-9]/g, '')}` : null),
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

      logger.info(`[Provisioning] 신규 보드 프로비저닝 완료 (SV-F-015): ${deviceId} (MAC: ${cleanMac}) -> VPN IP: ${vpnIp}`);
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
   * 하위 호환성을 위한 provisionBySerial (내부적으로 provisionByMac 호출)
   */
  async provisionBySerial(params) {
    return this.provisionByMac(params);
  }

  /**
   * 보드 Heartbeat 수신 및 실시간 상태 갱신 (ICD_v2 3.2, SV-F-013, WC-F-031, NF-P-003)
   * 30초 주기로 보드가 호출하며, 204 No Content 또는 403 Forbidden 응답
   */
  async processHeartbeat({
    mac_no,
    MAC_no,
    serial_no,
    provision_token,
    status = 'online',
    rtsp_ok,
    wg_ok,
    storage_used_bytes,
    firmware_version,
    latency_ms,
  }) {
    const rawMac = mac_no || MAC_no;
    if (!rawMac && !serial_no) {
      throw AppError.badRequest('MAC_no(또는 serial_no)와 provision_token은 필수 항목입니다.');
    }
    if (!provision_token) {
      throw AppError.badRequest('provision_token은 필수 항목입니다.');
    }

    let device = null;
    if (rawMac) {
      device = await deviceRepository.findByMac(String(rawMac).trim());
    }
    if (!device && serial_no) {
      device = await deviceRepository.findBySerial(String(serial_no).trim());
    }

    if (!device) {
      logger.warn(`[Heartbeat] 미등록 보드 Heartbeat 수신 실패: MAC=${rawMac}, Serial=${serial_no}`);
      throw AppError.forbidden('등록되지 않은 보드입니다. 재프로비저닝이 필요합니다.');
    }

    // provision_token 일치 여부 검증 (ICD 3.2.1: 토큰 불일치 시 403 Forbidden)
    if (device.provision_token && device.provision_token !== provision_token) {
      logger.warn(`[Heartbeat] 토큰 불일치 거부: ${device.device_id} (MAC: ${rawMac})`);
      throw AppError.forbidden('토큰 불일치 - 재프로비저닝 필요');
    }

    const numLatency = latency_ms !== undefined && latency_ms !== null ? parseInt(latency_ms, 10) : 0;
    const numStorage = storage_used_bytes !== undefined && storage_used_bytes !== null ? parseInt(storage_used_bytes, 10) : null;

    // 실시간 상태 업데이트
    await deviceRepository.updateHeartbeat(device.device_id, {
      status: 'online',
      wgOk: wg_ok !== false,
      rtspOk: rtsp_ok !== false,
      storageUsedBytes: numStorage,
      latencyMs: numLatency,
      firmwareVersion: firmware_version,
    });

    // 감사/통계용 로그 기록
    await heartbeatRepository.recordHeartbeat({
      deviceId: device.device_id,
      macNo: rawMac || device.mac_no,
      serialNo: serial_no || device.serial_no,
      status: 'online',
      rtspOk: rtsp_ok !== false,
      wgOk: wg_ok !== false,
      storageUsedBytes: numStorage,
      latencyMs: numLatency,
      firmwareVersion: firmware_version,
    });

    logger.info(`[Heartbeat] 정상 수신: ${device.device_id} (wg: ${wg_ok}, rtsp: ${rtsp_ok}, latency: ${numLatency}ms)`);
  }
}

export const heartbeatService = new HeartbeatService();
