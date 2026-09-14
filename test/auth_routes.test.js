const test = require('node:test');
const assert = require('node:assert/strict');

const { registerAccountLoginRoutes } = require('../server/routes/account_login');
const { registerAccountRecoveryRoutes } = require('../server/routes/account_recovery');
const { registerAdminUserOnboardingRoutes } = require('../server/routes/admin_user_onboarding');

function createApp() {
  const routes = new Map();
  const app = {};
  for (const method of ['get', 'post']) {
    app[method] = (route, ...handlers) => routes.set(`${method.toUpperCase()} ${route}`, handlers.at(-1));
  }
  return { app, route: (method, path) => routes.get(`${method} ${path}`) };
}

function response() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

const middleware = (_req, _res, next) => next?.();

function registerLogin(overrides = {}) {
  const registry = createApp();
  registerAccountLoginRoutes(registry.app, {
    PASSWORD_MAX_LENGTH: 128,
    authRateLimiter: middleware,
    generateCaptcha: () => ({ question: '2 + 3', token: 'captcha-token' }),
    getLocalUsers: () => [],
    hashPassword: async value => `hash:${value}`,
    isValidEmail: value => value.includes('@'),
    loginFailures: new Map(),
    safeLogStr: String,
    saveLocalUsers() {},
    signToken: () => 'signed-token',
    supabase: null,
    verifyCaptcha: () => true,
    verifyPasswordHash: async () => ({ valid: false, needsRehash: false }),
    ...overrides
  });
  return registry;
}

function registerRecovery(overrides = {}) {
  const registry = createApp();
  registerAccountRecoveryRoutes(registry.app, {
    PASSWORD_MAX_LENGTH: 128,
    authRateLimiter: middleware,
    crypto: require('node:crypto'),
    getLocalUsers: () => [],
    hashPassword: async value => `hash:${value}`,
    isValidEmail: value => value.includes('@'),
    isValidUsername: value => value.length >= 3,
    loginFailures: new Map(),
    mailer: { sendSelfServiceResetCode: async () => ({ sent: true }) },
    normalizeEmail: value => String(value).trim().toLowerCase(),
    normalizeUsername: value => String(value).trim().toLowerCase(),
    recordAuditLog: async () => {},
    safeLogStr: String,
    signToken: () => 'signed-token',
    supabase: null,
    updateUserById: async () => null,
    ...overrides
  });
  return registry;
}

test('captcha route returns the generated question and token', () => {
  const registry = registerLogin();
  const res = response();
  registry.route('GET', '/api/auth/captcha')({}, res);
  assert.deepEqual(res.body, {
    success: true,
    question: '2 + 3',
    token: 'captcha-token',
    captchaToken: 'captcha-token'
  });
});

test('login rejects missing credentials before user lookup', async () => {
  const registry = registerLogin();
  const res = response();
  await registry.route('POST', '/api/auth/login')({ body: {}, ip: '127.0.0.1' }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.reason, /kullanıcı bilgilerinizi ve şifrenizi/);
});

test('emergency recovery requires identifier, key and new password', async () => {
  const registry = registerRecovery();
  const res = response();
  await registry.route('POST', '/api/auth/recover-with-key')({ body: {}, ip: '127.0.0.1' }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.reason, /acil erişim anahtarı/);
});

test('forgot-password response does not expose whether an unknown account exists', async () => {
  const registry = registerRecovery();
  const res = response();
  await registry.route('POST', '/api/auth/forgot-password-code')({ body: { identifier: 'unknown-user' } }, res);
  assert.equal(res.statusCode, 400);
  assert.doesNotMatch(JSON.stringify(res.body), /unknown-user/);
});

test('pending user listing removes password hashes in local mode', async () => {
  const registry = createApp();
  registerAdminUserOnboardingRoutes(registry.app, {
    adminRateLimiter: middleware,
    getLocalUsers: () => [{ id: 'user-1', username: 'pending', password_hash: 'secret', is_active: false, created_at: '2026-01-01' }],
    mailer: {},
    recordAuditLog: async () => {},
    requireAdmin: middleware,
    safeLogStr: String,
    supabase: null,
    updateUserById: async () => null
  });
  const res = response();
  await registry.route('GET', '/api/admin/pending-users')({ adminUser: { id: 'admin-1' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal('password_hash' in res.body.users[0], false);
});

test('user approval requires a target user id', async () => {
  const registry = createApp();
  registerAdminUserOnboardingRoutes(registry.app, {
    adminRateLimiter: middleware,
    getLocalUsers: () => [],
    mailer: {},
    recordAuditLog: async () => {},
    requireAdmin: middleware,
    safeLogStr: String,
    supabase: null,
    updateUserById: async () => null
  });
  const res = response();
  await registry.route('POST', '/api/admin/approve-user')({ body: {}, adminUser: { id: 'admin-1' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.reason, /userId/);
});
