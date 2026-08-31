const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('../lib/rate_limiter');

function invoke(middleware, ip) {
  return new Promise(resolve => {
    const req = { ip, headers: {} };
    const headers = {};
    const res = {
      statusCode: 200,
      setHeader(name, value) { headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ next: false, statusCode: this.statusCode, body, headers }); }
    };
    middleware(req, res, () => resolve({ next: true, statusCode: 200, headers }));
  });
}

test('aynı IP için sınırı uygular ve Retry-After döndürür', async () => {
  let time = 1000;
  const limiter = createRateLimiter({ max: 2, windowMs: 60_000, now: () => time });

  assert.equal((await invoke(limiter, '10.0.0.1')).next, true);
  assert.equal((await invoke(limiter, '10.0.0.1')).next, true);
  const blocked = await invoke(limiter, '10.0.0.1');
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers['Retry-After'], '60');

  time += 60_001;
  assert.equal((await invoke(limiter, '10.0.0.1')).next, true);
});

test('farklı IP adreslerini ayrı sayaçlarda tutar', async () => {
  const limiter = createRateLimiter({ max: 1 });
  assert.equal((await invoke(limiter, '10.0.0.1')).next, true);
  assert.equal((await invoke(limiter, '10.0.0.2')).next, true);
});
