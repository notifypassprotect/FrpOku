const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidEmail, isValidText, isValidUsername, normalizePhone } = require('../lib/input_validation');

test('kullanıcı adında yalnızca güvenli karakterleri kabul eder', () => {
  assert.equal(isValidUsername('ilker.diner'), true);
  assert.equal(isValidUsername('ab'), false);
  assert.equal(isValidUsername('user,role.eq.admin'), false);
  assert.equal(isValidUsername('_invalid'), false);
});

test('e-posta uzunluğunu ve temel yapısını doğrular', () => {
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('user..name@example.com'), false);
  assert.equal(isValidEmail('not-an-email'), false);
});

test('metin ve telefonu sınırlar', () => {
  assert.equal(isValidText('Ad Soyad', { min: 2, max: 120 }), true);
  assert.equal(isValidText('x'.repeat(121), { max: 120 }), false);
  assert.equal(normalizePhone('+90 (555) 111 22 33'), '905551112233');
});
