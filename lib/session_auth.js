const crypto = require('crypto');

function safeEqualBase64Url(left, right) {
  try {
    const leftBuffer = Buffer.from(String(left || ''), 'base64url');
    const rightBuffer = Buffer.from(String(right || ''), 'base64url');
    return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
  } catch {
    return false;
  }
}

function readBearerToken(req) {
  const header = String(req.headers?.authorization || '');
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : '';
}

function createSessionAuth({ secret, userLoader, defaultTtlMs = 7 * 24 * 60 * 60 * 1000 } = {}) {
  if (!secret || typeof secret !== 'string') throw new Error('Session secret gereklidir.');
  if (typeof userLoader !== 'function') throw new Error('Session userLoader gereklidir.');

  function signToken(payload = {}) {
    if (!payload.id) throw new Error('Token için kullanıcı kimliği gereklidir.');
    const now = Date.now();
    const safePayload = {
      id: String(payload.id),
      username: String(payload.username || ''),
      role: payload.role === 'admin' ? 'admin' : 'user',
      department: String(payload.department || ''),
      iat: Number(payload.iat) || now,
      exp: Number(payload.exp) || now + defaultTtlMs
    };
    const data = Buffer.from(JSON.stringify(safePayload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    return `${data}.${signature}`;
  }

  function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [data, signature] = parts;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (!safeEqualBase64Url(signature, expected)) return null;

    try {
      const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
      if (!payload || typeof payload.id !== 'string' || !payload.id) return null;
      if (!Number.isFinite(payload.exp) || Date.now() >= payload.exp) return null;
      if (!Number.isFinite(payload.iat) || payload.iat > Date.now() + 60_000) return null;
      if (!['user', 'admin'].includes(payload.role)) return null;
      return payload;
    } catch {
      return null;
    }
  }

  async function resolveUser(req) {
    const payload = verifyToken(readBearerToken(req));
    if (!payload) return null;

    const user = await userLoader(payload.id);
    if (!user || user.is_active === false) return null;

    const safeUser = { ...user };
    delete safeUser.password_hash;
    return safeUser;
  }

  async function requireAuth(req, res, next) {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, reason: 'Geçerli ve aktif bir kullanıcı oturumu gereklidir.' });
      }
      req.authUser = user;
      next();
    } catch {
      return res.status(503).json({ success: false, reason: 'Oturum doğrulama servisi geçici olarak kullanılamıyor.' });
    }
  }

  async function requireAdmin(req, res, next) {
    try {
      const user = await resolveUser(req);
      if (!user) {
        return res.status(401).json({ success: false, reason: 'Geçerli ve aktif bir kullanıcı oturumu gereklidir.' });
      }
      if (user.role !== 'admin') {
        return res.status(403).json({ success: false, reason: 'Bu işlem için sistem yöneticisi yetkisi gereklidir.' });
      }
      req.authUser = user;
      req.adminUser = user;
      next();
    } catch {
      return res.status(503).json({ success: false, reason: 'Oturum doğrulama servisi geçici olarak kullanılamıyor.' });
    }
  }

  return { signToken, verifyToken, requireAuth, requireAdmin, resolveUser };
}

module.exports = { createSessionAuth, readBearerToken };
