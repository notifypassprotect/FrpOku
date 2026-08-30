const crypto = require('crypto');

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function secureEqual(left, right) {
  const leftHash = crypto.createHash('sha256').update(String(left || '')).digest();
  const rightHash = crypto.createHash('sha256').update(String(right || '')).digest();
  return crypto.timingSafeEqual(leftHash, rightHash);
}

function parseBasicAuthorization(headerValue) {
  if (!headerValue || !/^Basic\s+/i.test(headerValue)) return null;
  try {
    const decoded = Buffer.from(String(headerValue).replace(/^Basic\s+/i, ''), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex < 0) return null;
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

function createStagingAccessMiddleware({ env = process.env, healthPath = '/api/health' } = {}) {
  const enabled = env.NODE_ENV === 'staging' || isTruthy(env.STAGING_ACCESS_ENABLED);
  const expectedUsername = env.STAGING_ACCESS_USER || '';
  const expectedPassword = env.STAGING_ACCESS_PASSWORD || '';

  return function stagingAccess(req, res, next) {
    if (!enabled || req.path === healthPath) return next();

    if (!expectedUsername || !expectedPassword) {
      return res.status(503).json({
        success: false,
        reason: 'Staging erişim koruması yapılandırılmadığı için servis güvenli şekilde kapatıldı.'
      });
    }

    const credentials = parseBasicAuthorization(req.headers.authorization);
    const isAuthorized = credentials &&
      secureEqual(credentials.username, expectedUsername) &&
      secureEqual(credentials.password, expectedPassword);

    if (!isAuthorized) {
      res.setHeader('WWW-Authenticate', 'Basic realm="FrpOku Staging", charset="UTF-8"');
      return res.status(401).send('Staging erişimi için kullanıcı adı ve parola gereklidir.');
    }

    next();
  };
}

module.exports = {
  createStagingAccessMiddleware,
  parseBasicAuthorization,
  secureEqual
};
