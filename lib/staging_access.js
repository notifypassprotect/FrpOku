const crypto = require('crypto');
const STAGING_COOKIE_NAME = '__Host-frpoku_staging';
const STAGING_COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;

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

function parseCookie(headerValue, name) {
  const cookies = String(headerValue || '').split(';');
  for (const cookie of cookies) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex < 0) continue;
    if (cookie.slice(0, separatorIndex).trim() === name) return cookie.slice(separatorIndex + 1).trim();
  }
  return '';
}

function stagingCookieSignature({ username, password, sessionSecret, expiresAt }) {
  const credentialFingerprint = crypto.createHash('sha256').update(`${username}:${password}`).digest('hex');
  return crypto.createHmac('sha256', sessionSecret).update(`${expiresAt}:${credentialFingerprint}`).digest('hex');
}

function createStagingCookie({ username, password, sessionSecret, now = Date.now() }) {
  const expiresAt = now + STAGING_COOKIE_MAX_AGE_SECONDS * 1000;
  const signature = stagingCookieSignature({ username, password, sessionSecret, expiresAt });
  return `${expiresAt}.${signature}`;
}

function verifyStagingCookie(value, { username, password, sessionSecret, now = Date.now() }) {
  const [expiresAtRaw, signature] = String(value || '').split('.');
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || !signature) return false;
  const expected = stagingCookieSignature({ username, password, sessionSecret, expiresAt });
  return secureEqual(signature, expected);
}

function createStagingAccessMiddleware({ env = process.env, healthPath = '/api/health' } = {}) {
  const enabled = env.NODE_ENV === 'staging' || isTruthy(env.STAGING_ACCESS_ENABLED);
  const expectedUsername = env.STAGING_ACCESS_USER || '';
  const expectedPassword = env.STAGING_ACCESS_PASSWORD || '';
  const sessionSecret = env.SESSION_SECRET || '';

  return function stagingAccess(req, res, next) {
    if (!enabled || req.path === healthPath) return next();

    if (!expectedUsername || !expectedPassword || !sessionSecret) {
      return res.status(503).json({
        success: false,
        reason: 'Staging erişim koruması yapılandırılmadığı için servis güvenli şekilde kapatıldı.'
      });
    }

    const stagingCookie = parseCookie(req.headers.cookie, STAGING_COOKIE_NAME);
    if (verifyStagingCookie(stagingCookie, {
      username: expectedUsername,
      password: expectedPassword,
      sessionSecret
    })) return next();

    const credentials = parseBasicAuthorization(req.headers.authorization);
    const isAuthorized = credentials &&
      secureEqual(credentials.username, expectedUsername) &&
      secureEqual(credentials.password, expectedPassword);

    if (!isAuthorized) {
      res.setHeader('WWW-Authenticate', 'Basic realm="FrpOku Staging", charset="UTF-8"');
      return res.status(401).send('Staging erişimi için kullanıcı adı ve parola gereklidir.');
    }

    const cookieValue = createStagingCookie({
      username: expectedUsername,
      password: expectedPassword,
      sessionSecret
    });
    res.setHeader('Set-Cookie', `${STAGING_COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STAGING_COOKIE_MAX_AGE_SECONDS}`);

    next();
  };
}

module.exports = {
  createStagingAccessMiddleware,
  createStagingCookie,
  parseBasicAuthorization,
  secureEqual,
  verifyStagingCookie
};
