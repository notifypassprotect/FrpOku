const crypto = require('crypto');

function createAuthSecurity(secret) {
  function generateCaptcha() {
    const a = Math.floor(Math.random() * 8) + 1;
    const b = Math.floor(Math.random() * 8) + 1;
    const answer = String(a + b);
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const signature = crypto.createHmac('sha256', secret).update(`${answer}:${expiresAt}`).digest('hex');
    return { question: `${a} + ${b} = ?`, token: `${answer}:${expiresAt}:${signature}` };
  }

  function verifyCaptcha(token, answer) {
    if (!token || !answer) return false;
    const parts = String(token).split(':');
    if (parts.length !== 3) return false;
    const [expectedAnswer, expiresAtText, signature] = parts;
    const expiresAt = Number(expiresAtText);
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;
    const expectedSignature = crypto.createHmac('sha256', secret).update(`${expectedAnswer}:${expiresAtText}`).digest('hex');
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return false;
    return String(answer).trim() === expectedAnswer;
  }

  function generateEmergencyRecoveryKey() {
    const first = crypto.randomBytes(2).toString('hex').toUpperCase();
    const second = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `FRP-RECOVER-${first}-${second}`;
  }

  return { generateCaptcha, generateEmergencyRecoveryKey, verifyCaptcha };
}

module.exports = { createAuthSecurity };
