const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('../lib/passwords');

test('parolayı salt içeren scrypt formatında saklar ve doğrular', async () => {
  const first = await hashPassword('Correct-Horse-123');
  const second = await hashPassword('Correct-Horse-123');

  assert.match(first, /^scrypt\$/);
  assert.notEqual(first, second);
  assert.deepEqual(await verifyPassword('Correct-Horse-123', first), {
    valid: true,
    needsRehash: false,
    scheme: 'scrypt'
  });
  assert.equal((await verifyPassword('wrong-password', first)).valid, false);
});

test('eski SHA-256 kaydını doğrular ve yeniden hash gerektirir', async () => {
  const legacy = crypto.createHash('sha256').update('Legacy-Pass-123').digest('hex');
  const result = await verifyPassword('Legacy-Pass-123', legacy);

  assert.equal(result.valid, true);
  assert.equal(result.needsRehash, true);
  assert.equal(result.scheme, 'sha256');
});

test('düz metin parola kaydını kabul etmez', async () => {
  const result = await verifyPassword('plain-password', 'plain-password');
  assert.equal(result.valid, false);
  assert.equal(result.scheme, 'unsupported');
});
