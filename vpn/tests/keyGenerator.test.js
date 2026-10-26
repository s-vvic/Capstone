import test from 'node:test';
import assert from 'node:assert/strict';
import { keyGenerator } from '../src/services/keyGenerator.js';
import { isValidWireGuardKey } from '../src/middleware/validator.js';

test('keyGenerator - WireGuard 키 생성 및 형식 검증', async (t) => {
  await t.test('Curve25519 x25519 키 페어 생성 검증 (44자리 Base64)', () => {
    const keyPair = keyGenerator.generateKeyPair();

    assert.ok(keyPair.privateKey, '개인키가 존재해야 함');
    assert.ok(keyPair.publicKey, '공개키가 존재해야 함');
    assert.equal(keyPair.privateKey.length, 44, '개인키 길이는 44자리 Base64');
    assert.equal(keyPair.publicKey.length, 44, '공개키 길이는 44자리 Base64');
    assert.ok(keyPair.privateKey.endsWith('='), '개인키는 =로 끝나야 함');
    assert.ok(keyPair.publicKey.endsWith('='), '공개키는 =로 끝나야 함');

    assert.equal(keyGenerator.isValidKey(keyPair.publicKey), true);
    assert.equal(isValidWireGuardKey(keyPair.publicKey), true);
  });

  await t.test('PresharedKey 생성 검증 (32바이트 44자리 Base64)', () => {
    const psk = keyGenerator.generatePresharedKey();
    assert.equal(psk.length, 44);
    assert.equal(keyGenerator.isValidKey(psk), true);
  });

  await t.test('비정상 키 포맷 거부 검증', () => {
    assert.equal(keyGenerator.isValidKey(''), false);
    assert.equal(keyGenerator.isValidKey(null), false);
    assert.equal(keyGenerator.isValidKey('short-key'), false);
    assert.equal(keyGenerator.isValidKey('InvalidChars!@#$%^&*()_+~`|}{[]:;?><,./'), false);
    assert.equal(isValidWireGuardKey('12345'), false);
  });
});
