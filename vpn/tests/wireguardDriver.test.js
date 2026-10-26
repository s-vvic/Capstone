import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualWireguardDriver } from '../src/drivers/virtualWireguardDriver.js';
import { VPN_CONFIG, VPN_STATUS } from '../src/constants/vpnConstants.js';

test('WireguardDriver - 가상 WireGuard 드라이버 동작 및 설정 파일 생성 검증', async (t) => {
  const driver = new VirtualWireguardDriver({
    serverPublicKey: 'SERVER_PUB_KEY_12345678901234567890123456789=',
    serverEndpoint: 'vpn.securecam.com:443',
    serverIp: '10.0.0.1',
    keepalive: 25,
  });

  await t.test('피어 등록 및 상태 조회', async () => {
    const pubKey = 'CLIENT_PUB_KEY_1234567890123456789012345678=';
    const peer = await driver.addPeer(pubKey, '10.0.0.15');

    assert.equal(peer.publicKey, pubKey);
    assert.equal(peer.allowedIp, '10.0.0.15/32');
    assert.equal(peer.vpnStatus, VPN_STATUS.CONNECTED);

    const fetched = await driver.getPeer(pubKey);
    assert.ok(fetched);
    assert.equal(fetched.publicKey, pubKey);
  });

  await t.test('클라이언트용 wg0.conf 텍스트 생성 검증 (ICD-06 5.2)', () => {
    const clientPrivKey = 'CLIENT_PRIV_KEY_123456789012345678901234567=';
    const clientIp = '10.0.0.25';

    const configText = driver.generateClientConfig(clientPrivKey, clientIp);

    assert.ok(configText.includes('[Interface]'));
    assert.ok(configText.includes(`PrivateKey = ${clientPrivKey}`));
    assert.ok(configText.includes('Address = 10.0.0.25/24'));
    assert.ok(configText.includes('[Peer]'));
    assert.ok(configText.includes(`PublicKey = ${driver.serverPublicKey}`));
    assert.ok(configText.includes('Endpoint = vpn.securecam.com:443'));
    assert.ok(configText.includes(`AllowedIPs = ${VPN_CONFIG.SUBNET}`));
    assert.ok(configText.includes('PersistentKeepalive = 25'));
  });

  await t.test('서버 설정 파일 syncConfigFile 검증', async () => {
    const peers = [
      { name: 'CAM-01', publicKey: 'PUBKEY_1=', allowedIp: '10.0.0.10' },
      { name: 'CAM-02', publicKey: 'PUBKEY_2=', allowedIp: '10.0.0.11' },
    ];

    const serverConf = await driver.syncConfigFile(peers);
    assert.ok(serverConf.includes('[Interface]'));
    assert.ok(serverConf.includes('Address = 10.0.0.1/24'));
    assert.ok(serverConf.includes('ListenPort = 443'));
    assert.ok(serverConf.includes('# Name: CAM-01'));
    assert.ok(serverConf.includes('PublicKey = PUBKEY_1='));
    assert.ok(serverConf.includes('AllowedIPs = 10.0.0.10/32'));
  });

  await t.test('피어 제거', async () => {
    const pubKey = 'PUBKEY_TO_DELETE============================';
    await driver.addPeer(pubKey, '10.0.0.30');

    const deleted = await driver.removePeer(pubKey);
    assert.equal(deleted, true);

    const check = await driver.getPeer(pubKey);
    assert.equal(check, null);
  });
});
