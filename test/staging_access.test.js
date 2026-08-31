const test = require('node:test');
const assert = require('node:assert/strict');
const { createStagingAccessMiddleware } = require('../lib/staging_access');

function invoke(middleware, { path = '/', authorization, cookie } = {}) {
  return new Promise(resolve => {
    const headers = {};
    const req = { path, headers: { authorization, cookie } };
    const res = {
      statusCode: 200,
      headers,
      setHeader(name, value) { headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ next: false, statusCode: this.statusCode, body, headers }); },
      send(body) { resolve({ next: false, statusCode: this.statusCode, body, headers }); }
    };
    middleware(req, res, () => resolve({ next: true, statusCode: 200, headers }));
  });
}

test('health endpoint staging korumasını atlar', async () => {
  const middleware = createStagingAccessMiddleware({ env: { NODE_ENV: 'staging' } });
  const result = await invoke(middleware, { path: '/api/health' });
  assert.equal(result.next, true);
});

test('eksik staging secretları servisi fail-closed kapatır', async () => {
  const middleware = createStagingAccessMiddleware({ env: { NODE_ENV: 'staging' } });
  const result = await invoke(middleware);
  assert.equal(result.statusCode, 503);
});

test('doğru Basic Auth bilgisini kabul eder', async () => {
  const middleware = createStagingAccessMiddleware({
    env: {
      NODE_ENV: 'staging',
      STAGING_ACCESS_USER: 'tester',
      STAGING_ACCESS_PASSWORD: 'strong-password',
      SESSION_SECRET: 'test-session-secret-that-is-long-enough'
    }
  });
  const authorization = `Basic ${Buffer.from('tester:strong-password').toString('base64')}`;
  const result = await invoke(middleware, { authorization });
  assert.equal(result.next, true);
  assert.match(result.headers['Set-Cookie'], /^__Host-frpoku_staging=/);
});

test('staging çerezi Bearer oturum başlığıyla birlikte erişimi sürdürür', async () => {
  const env = {
    NODE_ENV: 'staging',
    STAGING_ACCESS_USER: 'tester',
    STAGING_ACCESS_PASSWORD: 'strong-password',
    SESSION_SECRET: 'test-session-secret-that-is-long-enough'
  };
  const middleware = createStagingAccessMiddleware({ env });
  const authorization = `Basic ${Buffer.from('tester:strong-password').toString('base64')}`;
  const first = await invoke(middleware, { authorization });
  const cookie = first.headers['Set-Cookie'].split(';', 1)[0];
  const result = await invoke(middleware, { authorization: 'Bearer application-session-token', cookie });
  assert.equal(result.next, true);
});
