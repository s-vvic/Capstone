import test from 'node:test';
import assert from 'node:assert/strict';
import { VpnPeerService } from '../src/services/vpnPeerService.js';
import { InMemoryVpnRepository } from '../src/repositories/inMemoryVpnRepository.js';
import { VirtualWireguardDriver } from '../src/drivers/virtualWireguardDriver.js';
import { IpPoolManager } from '../src/services/ipPoolManager.js';
import { keyGenerator } from '../src/services/keyGenerator.js';
import { ERROR_CODES } from '../src/constants/errorCodes.js';

test('VpnPeerService - 피어 등록/프로비저닝 및 라이프사이클 관리', async (t) => {
  let repository;
  let driver;
  let ipPool;
  let service;

  t.beforeEach(() => {
    repository = new InMemoryVpnRepository();
    driver = new VirtualWireguardDriver();
    ipPool = new IpPoolManager();
    service = new VpnPeerService({ repository, driver, ipPool });
  });

  await t.test('키 없이 피어 등록 시 WireGuard 키 페어 및 IP 자동 생성/할당', async () => {
    const result = await service.registerPeer({
      peer_id: 'CAM-TEST-001',
      peer_type: 'device',
      name: '현관문 카메라',
      mac_no: 'AA:BB:CC:DD:EE:01',
      user_id: 'user-uuid-1',
    });

    assert.ok(result.peer);
    assert.equal(result.peer.peer_id, 'CAM-TEST-001');
    assert.equal(result.peer.device_id, 'CAM-TEST-001');
    assert.equal(result.peer.vpn_ip, '10.0.0.10');
    assert.ok(result.peer.wg_pubkey);

    assert.ok(result.provision);
    assert.equal(result.provision.vpn_ip, '10.0.0.10');
    assert.ok(result.provision.client_private_key, '자동 생성된 개인키가 반환되어야 함');
    assert.ok(result.provision.client_config_file, 'wg0.conf 텍스트가 반환되어야 함');
    assert.ok(result.provision.client_config_file.includes('[Interface]'));

    // IP 풀에 점유되었는지 확인
    assert.equal(ipPool.isAllocated('10.0.0.10'), true);
  });

  await t.test('클라이언트가 자체 생성한 WireGuard 공개키 전달 시 해당 키 사용', async () => {
    const keyPair = keyGenerator.generateKeyPair();

    const result = await service.registerPeer({
      peer_id: 'PHONE-TEST-001',
      peer_type: 'phone',
      name: '사용자 스마트폰',
      wg_pubkey: keyPair.publicKey,
      user_id: 'user-uuid-1',
    });

    assert.equal(result.peer.wg_pubkey, keyPair.publicKey);
    assert.equal(result.provision.client_private_key, null); // 클라이언트 키이므로 서버는 모름
    assert.equal(result.peer.vpn_ip, '10.0.0.10');
  });

  await t.test('중복 피어 ID 등록 시 409 Conflict', async () => {
    await service.registerPeer({ peer_id: 'DUPLICATE-ID', name: '기기1' });

    await assert.rejects(
      async () => service.registerPeer({ peer_id: 'DUPLICATE-ID', name: '기기2' }),
      (err) => err.code === ERROR_CODES.PEER_ALREADY_EXISTS && err.statusCode === 409
    );
  });

  await t.test('중복 공개키 등록 시 409 Conflict', async () => {
    const keyPair = keyGenerator.generateKeyPair();
    await service.registerPeer({ peer_id: 'P1', wg_pubkey: keyPair.publicKey, name: '기기1' });

    await assert.rejects(
      async () => service.registerPeer({ peer_id: 'P2', wg_pubkey: keyPair.publicKey, name: '기기2' }),
      (err) => err.code === ERROR_CODES.KEY_ALREADY_EXISTS && err.statusCode === 409
    );
  });

  await t.test('피어 등록 해제 시 WireGuard 피어 삭제 및 IP 회수', async () => {
    const registered = await service.registerPeer({ peer_id: 'CAM-DEL', name: '삭제 대상' });
    const ip = registered.peer.vpn_ip;

    assert.equal(ipPool.isAllocated(ip), true);

    const unregResult = await service.unregisterPeer('CAM-DEL');
    assert.equal(unregResult.success, true);
    assert.equal(unregResult.released_ip, ip);

    // IP 풀에서 해제 확인
    assert.equal(ipPool.isAllocated(ip), false);

    // DB에서 제거 확인
    await assert.rejects(
      async () => service.getPeer('CAM-DEL'),
      (err) => err.statusCode === 404
    );
  });
});
