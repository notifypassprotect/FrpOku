const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createSessionAuth } = require('../lib/session_auth.js');

test('session_auth dondurulmuş kullanıcıyı (is_frozen=true) oturumdan düşürür', async () => {
  const sessionAuth = createSessionAuth({
    secret: 'test-secret-at-least-32-chars-long!!',
    userLoader: async (id) => {
      if (id === 'frozen-user-1') {
        return { id: 'frozen-user-1', username: 'dondurulmus', is_frozen: true };
      }
      return { id: 'active-user-1', username: 'aktif', is_frozen: false };
    }
  });

  const activeToken = sessionAuth.signToken({ id: 'active-user-1', username: 'aktif' });
  const frozenToken = sessionAuth.signToken({ id: 'frozen-user-1', username: 'dondurulmus' });

  const activeResolved = await sessionAuth.resolveUser({
    headers: { authorization: `Bearer ${activeToken}` }
  });
  assert.ok(activeResolved, 'Aktif kullanıcı çözümlenebilmeli');
  assert.equal(activeResolved.username, 'aktif');

  const frozenResolved = await sessionAuth.resolveUser({
    headers: { authorization: `Bearer ${frozenToken}` }
  });
  assert.equal(frozenResolved, null, 'Dondurulmuş kullanıcı oturumu null dönmeli');
});

test('themes.js 3 yeni ultra-premium temayı içerir', () => {
  const themesContent = fs.readFileSync(path.join(__dirname, '../js/core/themes.js'), 'utf8');
  assert.match(themesContent, /midnight-amethyst/);
  assert.match(themesContent, /nordic-frost/);
  assert.match(themesContent, /aurora-emerald/);
});

test('circuit_fx.js mevcut ve pencere nesnesinde FrpCircuit tanımlar', () => {
  const fxContent = fs.readFileSync(path.join(__dirname, '../js/core/circuit_fx.js'), 'utf8');
  assert.match(fxContent, /window\.FrpCircuit/);
  assert.match(fxContent, /circuitAppBoot/);
  assert.match(fxContent, /showLogoutSplash/);
});

test('list_modals.js ve list.js sağ tık menüsünde not ekleme/düzenleme işlevini barındırır', () => {
  const modalsContent = fs.readFileSync(path.join(__dirname, '../js/list/list_modals.js'), 'utf8');
  const listContent = fs.readFileSync(path.join(__dirname, '../js/list/list.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

  assert.match(modalsContent, /openReportNoteModal/);
  assert.match(listContent, /openReportNoteModal/);
  assert.match(indexHtml, /data-action="note"/);
});

test('store_main.js notları ve pin durumunu kullanıcıya özel saklar, sunucu sürümünü istemcide erken artırmaz', () => {
  const storeContent = fs.readFileSync(path.join(__dirname, '../js/store/store_main.js'), 'utf8');
  assert.match(storeContent, /_saveUserNote/);
  assert.match(storeContent, /_getUserNotesMap/);
  assert.match(storeContent, /_saveUserPinOverride/);
  assert.match(storeContent, /_scopedStorageKey/);

  const noteBody = storeContent.slice(storeContent.indexOf('function updateNote('), storeContent.indexOf('function updateMeta('));
  const pinBody = storeContent.slice(storeContent.indexOf('function togglePin('), storeContent.indexOf('function addTag('));
  assert.doesNotMatch(noteBody, /files\[idx\]\.version\s*=/);
  assert.doesNotMatch(pinBody, /files\[idx\]\.version\s*=/);
});

test('çıkış ekranı tamamlanınca kaldırılır ve giriş portalı daha sonra açılır', () => {
  const fxContent = fs.readFileSync(path.join(__dirname, '../js/core/circuit_fx.js'), 'utf8');
  const logoutBody = fxContent.slice(fxContent.indexOf('function showLogoutSplash('), fxContent.indexOf('window.FrpCircuit'));
  assert.match(logoutBody, /logoutOverlay\.classList\.add\('loaded'\)/);
  assert.match(logoutBody, /logoutOverlay\.remove\(\)/);
  assert.ok(logoutBody.indexOf('logoutOverlay.remove()') < logoutBody.indexOf("typeof onComplete === 'function'"));
});

test('şifre değişiminde yeni token istemci oturumuna yazılır ve şema geçişi bulunur', () => {
  const authContent = fs.readFileSync(path.join(__dirname, '../js/core/auth.js'), 'utf8');
  const serverContent = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/004_add_password_changed_at.sql'), 'utf8');
  assert.match(authContent, /data\.success && data\.token/);
  assert.match(serverContent, /\['is_frozen', 'password_changed_at'\]/);
  assert.match(migration, /add column if not exists password_changed_at timestamptz/i);
});
