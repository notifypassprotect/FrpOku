const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionAuth } = require('../lib/session_auth');

function invoke(middleware, token) {
  return new Promise(resolve => {
    const req = { headers: token ? { authorization: `Bearer ${token}` } : {} };
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ next: false, statusCode: this.statusCode, body, req }); }
    };
    middleware(req, res, () => resolve({ next: true, statusCode: 200, req }));
  });
}

test('imzalı token ile aktif kullanıcıyı doğrular', async () => {
  const auth = createSessionAuth({
    secret: 'test-secret-that-is-long-enough',
    userLoader: async id => ({ id, username: 'user', role: 'user', is_active: true, password_hash: 'hidden' })
  });
  const result = await invoke(auth.requireAuth, auth.signToken({ id: 'usr_1', username: 'user', role: 'user' }));

  assert.equal(result.next, true);
  assert.equal(result.req.authUser.id, 'usr_1');
  assert.equal('password_hash' in result.req.authUser, false);
});

test('süresi dolmuş veya imzası bozuk tokenı reddeder', async () => {
  const auth = createSessionAuth({ secret: 'test-secret', userLoader: async () => ({ is_active: true }) });
  const expired = auth.signToken({ id: 'usr_1', iat: Date.now() - 2000, exp: Date.now() - 1000 });
  const [payload, signature] = auth.signToken({ id: 'usr_1' }).split('.');
  const tampered = `${payload}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`;

  assert.equal((await invoke(auth.requireAuth, expired)).statusCode, 401);
  assert.equal((await invoke(auth.requireAuth, tampered)).statusCode, 401);
});

test('admin yetkisini token yerine güncel kullanıcı kaydından kontrol eder', async () => {
  const auth = createSessionAuth({
    secret: 'test-secret',
    userLoader: async id => ({ id, role: 'user', is_active: true })
  });
  const staleAdminToken = auth.signToken({ id: 'usr_1', role: 'admin' });
  const result = await invoke(auth.requireAdmin, staleAdminToken);

  assert.equal(result.statusCode, 403);
});

test('dondurulmuş kullanıcı oturumunu reddeder', async () => {
  const auth = createSessionAuth({
    secret: 'test-secret',
    userLoader: async id => ({ id, role: 'user', is_active: false })
  });
  const result = await invoke(auth.requireAuth, auth.signToken({ id: 'usr_1' }));
  assert.equal(result.statusCode, 401);
});
