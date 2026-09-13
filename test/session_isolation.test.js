const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('eski oturuma ait gecikmiş 401 yeni kullanıcıyı oturumdan çıkarmaz', async () => {
  const source = fs.readFileSync(path.join(root, 'js/core/supabase.js'), 'utf8');
  let authorization = 'Bearer eski-token';
  let resolveFetch;
  const events = [];
  const context = {
    window: {
      location: { protocol: 'https:' },
      FRP_RUNTIME_CONFIG: {},
      FrpAuth: { getAuthHeaders: () => ({ 'Content-Type': 'application/json', Authorization: authorization }) },
      dispatchEvent: event => events.push(event)
    },
    fetch: () => new Promise(resolve => { resolveFetch = resolve; }),
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    AbortController,
    setTimeout,
    clearTimeout,
    console
  };
  vm.runInNewContext(source, context);

  const request = context.window.FrpCloud.loadActiveReports();
  authorization = 'Bearer yeni-token';
  resolveFetch(response(401, { reason: 'Eski oturum' }));
  await request;

  assert.equal(events.filter(event => event.type === 'frp:auth-expired').length, 0);
});

test('geçerli oturumun 401 yanıtı auth-expired olayını tetikler', async () => {
  const source = fs.readFileSync(path.join(root, 'js/core/supabase.js'), 'utf8');
  const events = [];
  const context = {
    window: {
      location: { protocol: 'https:' },
      FRP_RUNTIME_CONFIG: {},
      FrpAuth: { getAuthHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer aynı-token' }) },
      dispatchEvent: event => events.push(event)
    },
    fetch: async () => response(401, { reason: 'Oturum süresi doldu' }),
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    AbortController,
    setTimeout,
    clearTimeout,
    console
  };
  vm.runInNewContext(source, context);

  await context.window.FrpCloud.loadActiveReports();
  assert.equal(events.filter(event => event.type === 'frp:auth-expired').length, 1);
});

test('oturum cache temizliği tamamlanmayı bekler ve bulut yenilemeleri kullanıcı değişimini gözetir', () => {
  const store = fs.readFileSync(path.join(root, 'js/store/store_main.js'), 'utf8');
  const auth = fs.readFileSync(path.join(root, 'js/core/auth.js'), 'utf8');
  const portal = fs.readFileSync(path.join(root, 'js/core/auth/auth_portal.js'), 'utf8');

  assert.match(store, /async function clearSessionCache\(\)/);
  assert.match(store, /await Promise\.all\(\[syncToIndexedDB\(\[\]\), syncTrashToIndexedDB\(\[\]\)\]\)/);
  assert.match(store, /refreshSequence !== _refreshSequence \|\| sessionIdentity !== _sessionIdentity\(\)/);
  assert.match(store, /bootstrapSessionIdentity !== 'anonymous'/);
  assert.match(auth, /if \(logoutInProgress\) return/);
  assert.match(auth, /sessionStorage\.removeItem\('frpoku_auth_token'\)/);
  assert.match(auth, /window\.addEventListener\('storage'/);
  assert.equal((portal.match(/await window\.FrpStore\.clearSessionCache\(\)/g) || []).length, 3);
});
