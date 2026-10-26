import test from 'node:test';
import assert from 'node:assert/strict';
import { IpPoolManager, ipToInt, intToIp } from '../src/services/ipPoolManager.js';
import { ERROR_CODES } from '../src/constants/errorCodes.js';

test('IpPoolManager - 기본 할당 및 변환 로직 검증', async (t) => {
  await t.test('ipToInt & intToIp 양방향 변환', () => {
    assert.equal(intToIp(ipToInt('10.0.0.1')), '10.0.0.1');
    assert.equal(intToIp(ipToInt('10.0.0.10')), '10.0.0.10');
    assert.equal(intToIp(ipToInt('10.0.0.250')), '10.0.0.250');
  });

  await t.test('10.0.0.10 ~ 10.0.0.250 범위 순차 할당 검증', () => {
    const manager = new IpPoolManager({ startIp: '10.0.0.10', endIp: '10.0.0.250' });

    assert.equal(manager.capacity, 241);

    const ip1 = manager.allocate('CAM-001');
    assert.equal(ip1, '10.0.0.10');

    const ip2 = manager.allocate('CAM-002');
    assert.equal(ip2, '10.0.0.11');

    const ip3 = manager.allocate('PHONE-001');
    assert.equal(ip3, '10.0.0.12');
  });

  await t.test('동일한 기기가 다시 요청 시 기존 할당된 IP 반환', () => {
    const manager = new IpPoolManager();
    const firstIp = manager.allocate('CAM-001');
    const secondIp = manager.allocate('CAM-001');
    assert.equal(firstIp, secondIp);
  });

  await t.test('선호 IP (preferredIp) 지정 할당 및 중복 방지', () => {
    const manager = new IpPoolManager();
    const prefIp = manager.allocate('CAM-PREF', '10.0.0.50');
    assert.equal(prefIp, '10.0.0.50');

    // 이미 할당된 선호 IP 요청 시 다른 미사용 IP 할당
    const nextIp = manager.allocate('CAM-OTHER', '10.0.0.50');
    assert.equal(nextIp, '10.0.0.10');
  });

  await t.test('IP 회수 (release) 후 재할당 확인', () => {
    const manager = new IpPoolManager();
    manager.allocate('CAM-001'); // 10.0.0.10
    manager.allocate('CAM-002'); // 10.0.0.11

    // CAM-001 회수
    const released = manager.release('10.0.0.10');
    assert.equal(released, true);
    assert.equal(manager.isAllocated('10.0.0.10'), false);

    // 다음 신규 기기는 회수된 10.0.0.10을 다시 할당받음
    const reallocatedIp = manager.allocate('CAM-NEW');
    assert.equal(reallocatedIp, '10.0.0.10');
  });

  await t.test('IP 풀 완전 소진 시 IP_POOL_EXHAUSTED 에러 발생', () => {
    // 소규모 풀 (10.0.0.10 ~ 10.0.0.12, 총 3개)
    const smallManager = new IpPoolManager({ startIp: '10.0.0.10', endIp: '10.0.0.12' });
    smallManager.allocate('DEV-1');
    smallManager.allocate('DEV-2');
    smallManager.allocate('DEV-3');

    assert.throws(
      () => smallManager.allocate('DEV-4'),
      (err) => err.code === ERROR_CODES.IP_POOL_EXHAUSTED && err.statusCode === 409
    );
  });

  await t.test('통계 정보 (getStats) 확인', () => {
    const manager = new IpPoolManager();
    manager.allocate('CAM-1');
    manager.allocate('CAM-2');

    const stats = manager.getStats();
    assert.equal(stats.allocated_count, 2);
    assert.equal(stats.capacity, 241);
    assert.equal(stats.available_count, 239);
    assert.equal(typeof stats.usage_percent, 'number');
  });
});
