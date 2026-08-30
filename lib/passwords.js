const crypto = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(crypto.scrypt);
const PASSWORD_MAX_LENGTH = 256;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

function safeEqual(left, right) {
  const leftBuffer = Buffer.isBuffer(left) ? left : Buffer.from(left);
  const rightBuffer = Buffer.isBuffer(right) ? right : Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function validatePasswordInput(password) {
  return typeof password === 'string' && password.length > 0 && password.length <= PASSWORD_MAX_LENGTH;
}

async function hashPassword(password) {
  if (!validatePasswordInput(password)) {
    throw new Error(`Parola 1-${PASSWORD_MAX_LENGTH} karakter arasında olmalıdır.`);
  }

  const salt = crypto.randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY
  });

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64url'),
    derivedKey.toString('base64url')
  ].join('$');
}

async function verifyScryptPassword(password, storedHash) {
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], 'base64url');
  const expected = Buffer.from(parts[5], 'base64url');

  const parametersAreSafe = Number.isInteger(N) && N >= 16384 && N <= 262144 && (N & (N - 1)) === 0 &&
    Number.isInteger(r) && r >= 1 && r <= 16 &&
    Number.isInteger(p) && p >= 1 && p <= 4 &&
    salt.length >= 16 && salt.length <= 64 &&
    expected.length >= 32 && expected.length <= 128;

  if (!parametersAreSafe) return false;

  const requiredMemory = Math.max(SCRYPT_MAX_MEMORY, 128 * N * r + 1024 * 1024);
  const actual = await scryptAsync(password, salt, expected.length, { N, r, p, maxmem: requiredMemory });
  return safeEqual(actual, expected);
}

async function verifyPassword(password, storedHash) {
  if (!validatePasswordInput(password) || typeof storedHash !== 'string') {
    return { valid: false, needsRehash: false, scheme: 'invalid' };
  }

  if (storedHash.startsWith('scrypt$')) {
    try {
      const valid = await verifyScryptPassword(password, storedHash);
      const currentParameters = storedHash.startsWith(`scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$`);
      return { valid, needsRehash: valid && !currentParameters, scheme: 'scrypt' };
    } catch {
      return { valid: false, needsRehash: false, scheme: 'scrypt' };
    }
  }

  // Eski kayıtları kullanıcıyı kilitlemeden yükseltmek için yalnızca sabit
  // uzunlukta SHA-256 hex formatı kabul edilir. Düz metin parola kabul edilmez.
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const legacyHash = crypto.createHash('sha256').update(password).digest('hex');
    const valid = safeEqual(Buffer.from(legacyHash, 'hex'), Buffer.from(storedHash, 'hex'));
    return { valid, needsRehash: valid, scheme: 'sha256' };
  }

  return { valid: false, needsRehash: false, scheme: 'unsupported' };
}

module.exports = {
  PASSWORD_MAX_LENGTH,
  hashPassword,
  verifyPassword
};
