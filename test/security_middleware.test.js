const test = require('node:test');
const assert = require('node:assert/strict');
const { protectInternalFiles, securityHeaders } = require('../server/middleware/security');

function response() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function invokeProtection(requestPath) {
  const res = response();
  let continued = false;
  protectInternalFiles({ path: requestPath }, res, () => { continued = true; });
  return { res, continued };
}

test('internal environment and repository paths are blocked', () => {
  for (const requestPath of ['/.env', '/.env.production', '/.git/config', '/data/users.json', '/server.js', '/package-lock.json']) {
    const { res, continued } = invokeProtection(requestPath);
    assert.equal(continued, false, requestPath);
    assert.equal(res.statusCode, 403, requestPath);
    assert.equal(res.body.success, false);
  }
});

test('encoded internal paths and Windows separators are blocked', () => {
  for (const requestPath of ['/%2eenv', '/%2egit/config', '/.git%2fconfig', '/data\\users.json']) {
    const { res, continued } = invokeProtection(requestPath);
    assert.equal(continued, false, requestPath);
    assert.equal(res.statusCode, 403, requestPath);
  }
});

test('malformed URL encoding returns a generic client error', () => {
  const { res, continued } = invokeProtection('/%E0%A4%A');
  assert.equal(continued, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { success: false, reason: 'Geçersiz istek URL yolu.' });
});

test('security middleware applies browser hardening headers', () => {
  const res = response();
  let continued = false;
  securityHeaders({}, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.match(res.headers['Strict-Transport-Security'], /max-age=31536000/);
  assert.match(res.headers['Content-Security-Policy'], /frame-ancestors 'self'/);
  assert.match(res.headers['Content-Security-Policy'], /base-uri 'self'/);
  assert.match(res.headers['Content-Security-Policy'], /object-src 'none'/);
  assert.doesNotMatch(res.headers['Content-Security-Policy'], /script-src[^;]*'unsafe-inline'/);
});

test('primary HTML pages contain no inline executable JavaScript', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  for (const page of ['index.html', 'detail.html', 'dashboard.html', 'compare.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
      .filter(match => match[1].trim());
    assert.equal(inlineScripts.length, 0, `${page} must not contain inline scripts`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${page} must not contain inline event handlers`);
    assert.doesNotMatch(html, /javascript\s*:/i, `${page} must not contain javascript URLs`);
  }
});

