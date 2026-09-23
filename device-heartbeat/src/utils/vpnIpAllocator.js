import { env } from '../config/env.js';

export const vpnIpAllocator = {
  /**
   * 사용 중인 IP 목록을 기반으로 다음 사용 가능한 WireGuard VPN IP 할당 (10.0.0.10 ~ 10.0.0.250, ICD 5.1)
   * @param {string[]} usedIps - 이미 할당된 IP 배열
   * @returns {string} 할당된 IP (예: '10.0.0.11')
   */
  allocateNextIp(usedIps = []) {
    const startOctet = 10;
    const endOctet = 250;

    const usedSet = new Set(usedIps.map((ip) => ip?.trim()).filter(Boolean));

    for (let i = startOctet; i <= endOctet; i++) {
      const candidate = `10.0.0.${i}`;
      if (!usedSet.has(candidate)) {
        return candidate;
      }
    }

    throw new Error('VPN IP 풀의 가용 주소가 모두 소진되었습니다 (10.0.0.10 ~ 10.0.0.250).');
  },
};
