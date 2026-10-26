import { VPN_CONFIG } from '../constants/vpnConstants.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../constants/errorCodes.js';
import { logger } from '../utils/logger.js';

/**
 * IP 문자열을 정수(32bit)로 변환
 */
export function ipToInt(ip) {
  return ip.split('.').reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

/**
 * 정수(32bit)를 IP 문자열로 변환
 */
export function intToIp(int) {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join('.');
}

/**
 * WireGuard VPN 사설 IP 풀 관리자 (IPAM)
 * ICD-06 5.1: 10.0.0.10 ~ 10.0.0.250 범위 자동 할당 및 관리
 */
export class IpPoolManager {
  constructor(options = {}) {
    this.startIp = options.startIp || VPN_CONFIG.POOL_START_IP;
    this.endIp = options.endIp || VPN_CONFIG.POOL_END_IP;

    this.startNum = ipToInt(this.startIp);
    this.endNum = ipToInt(this.endIp);

    if (this.startNum > this.endNum) {
      throw new Error(`Invalid IP pool range: ${this.startIp} > ${this.endIp}`);
    }

    this.capacity = this.endNum - this.startNum + 1;

    // ip -> peerId 매핑
    this.allocatedIps = new Map();
    // peerId -> ip 매핑
    this.peerToIp = new Map();

    logger.info(`[IpPoolManager] IP 풀 초기화 완료: ${this.startIp} ~ ${this.endIp} (총 ${this.capacity}개)`);
  }

  /**
   * 신규 IP 할당
   * @param {string} peerId - 기기 또는 폰 ID
   * @param {string} [preferredIp] - 선호 IP (가능하면 우선 할당)
   * @returns {string} 할당된 IP 문자열
   */
  allocate(peerId, preferredIp = null) {
    if (!peerId) {
      throw AppError.badRequest('peerId가 누락되었습니다.');
    }

    // 이미 할당된 기기인 경우 기존 IP 반환
    if (this.peerToIp.has(peerId)) {
      return this.peerToIp.get(peerId);
    }

    // 1. 선호 IP가 주어졌고, 풀 범위 내이며 비어 있는 경우
    if (preferredIp) {
      const prefNum = ipToInt(preferredIp);
      if (prefNum >= this.startNum && prefNum <= this.endNum && !this.allocatedIps.has(preferredIp)) {
        this.allocatedIps.set(preferredIp, peerId);
        this.peerToIp.set(peerId, preferredIp);
        logger.info(`[IpPoolManager] 선호 IP 할당 완료: ${preferredIp} -> ${peerId}`);
        return preferredIp;
      }
    }

    // 2. 순차 검색하여 미사용 최소 IP 탐색
    for (let currentNum = this.startNum; currentNum <= this.endNum; currentNum++) {
      const candidateIp = intToIp(currentNum);
      if (!this.allocatedIps.has(candidateIp)) {
        this.allocatedIps.set(candidateIp, peerId);
        this.peerToIp.set(peerId, candidateIp);
        logger.info(`[IpPoolManager] 자동 IP 할당 완료: ${candidateIp} -> ${peerId}`);
        return candidateIp;
      }
    }

    // 풀 소진 시 에러
    throw AppError.conflict(
      `가상 VPN IP 풀이 모두 소진되었습니다 (최대 ${this.capacity}개).`,
      ERROR_CODES.IP_POOL_EXHAUSTED
    );
  }

  /**
   * IP 회수
   * @param {string} identifier - IP 문자열 또는 peerId
   */
  release(identifier) {
    if (!identifier) return false;

    let ip = null;
    let peerId = null;

    if (this.allocatedIps.has(identifier)) {
      ip = identifier;
      peerId = this.allocatedIps.get(ip);
    } else if (this.peerToIp.has(identifier)) {
      peerId = identifier;
      ip = this.peerToIp.get(peerId);
    }

    if (ip && peerId) {
      this.allocatedIps.delete(ip);
      this.peerToIp.delete(peerId);
      logger.info(`[IpPoolManager] IP 회수 완료: ${ip} (peer: ${peerId})`);
      return true;
    }

    return false;
  }

  /**
   * IP 점유 여부 확인
   */
  isAllocated(ip) {
    return this.allocatedIps.has(ip);
  }

  /**
   * 특정 피어에 할당된 IP 조회
   */
  getIpForPeer(peerId) {
    return this.peerToIp.get(peerId) || null;
  }

  /**
   * 특정 IP를 사용하는 피어 ID 조회
   */
  getPeerForIp(ip) {
    return this.allocatedIps.get(ip) || null;
  }

  /**
   * IP 풀 상태 및 통계 반환
   */
  getStats() {
    const allocatedCount = this.allocatedIps.size;
    const availableCount = this.capacity - allocatedCount;
    return {
      start_ip: this.startIp,
      end_ip: this.endIp,
      capacity: this.capacity,
      allocated_count: allocatedCount,
      available_count: availableCount,
      usage_percent: parseFloat(((allocatedCount / this.capacity) * 100).toFixed(2)),
    };
  }

  /**
   * 전체 풀 초기화 (테스트용)
   */
  clear() {
    this.allocatedIps.clear();
    this.peerToIp.clear();
  }
}

export const defaultIpPoolManager = new IpPoolManager();
