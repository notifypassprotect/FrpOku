const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('store_tags.js SYPG raporları için SYPG etiketi üretir', () => {
  const code = fs.readFileSync(path.join(root, 'js/store/store_tags.js'), 'utf8');
  assert.match(code, /tags\.add\('SYPG'\)/);
  assert.doesNotMatch(code, /tags\.add\('Gören'\)/);

  // Tarama fonksiyonunu izole çalıştırıp doğrula
  const fnMatch = code.match(/function generateAutoTags\(parsedData, fileName\) \{[\s\S]*?\n  \}/);
  assert.ok(fnMatch, 'generateAutoTags bulunamadı');
  const tagRulesMatch = code.match(/const TAG_RULES = \[[\s\S]*?\];/);
  assert.ok(tagRulesMatch, 'TAG_RULES bulunamadı');
  const isBarcodeFnMatch = code.match(/function isBarcodeReport\(parsedData, fileName\) \{[\s\S]*?\n  \}/);
  const isBarcodeCode = isBarcodeFnMatch ? isBarcodeFnMatch[0] : 'function isBarcodeReport() { return false; }';

  const evalScope = new Function(`
    ${tagRulesMatch[0]}
    ${isBarcodeCode}
    ${fnMatch[0]}
    return {
      sypgTags: generateAutoTags({ meta: { reportName: 'SYPG Aylık Analiz Raporu' }, queries: [] }, 'sypg_test.frp'),
      sqlOnlyTags: generateAutoTags({ meta: { reportName: 'Laboratuvar Tetkik Listesi' }, queries: [{ sql: 'SELECT TETKIK_BARKOD, BARKOD_NO FROM TETKIKLER' }] }, 'lab_tetkik.frp'),
      barcodeFileTags: generateAutoTags({ meta: { reportName: 'Hasta Etiketi' }, queries: [] }, 'Mbarkod-001.fr3'),
      zebraPageTags: generateAutoTags({ meta: { reportName: 'Etiket Raporu' }, pages: [{ name: 'Zebra' }] }, 'etiket.frp'),
      printerLangTags: generateAutoTags({ meta: { reportName: 'Barkod Çıktı' }, rawXml: 'A20,22,423,231,1,1' }, 'cikti.frp')
    };
  `);
  const results = evalScope();
  assert.ok(results.sypgTags.includes('SYPG'), 'SYPG etiketi üretilmedi');
  assert.ok(!results.sypgTags.includes('Gören'), 'Gören etiketi üretilmemeli');
  assert.ok(!results.sqlOnlyTags.includes('Barkod'), 'SQL içinde BARKOD kolonu geçmesi rapora Barkod etiketi vermemeli');
  assert.ok(results.barcodeFileTags.includes('Barkod'), 'Dosya adında barkod geçen rapora Barkod etiketi verilmeli');
  assert.ok(results.zebraPageTags.includes('Barkod'), 'Sayfa adı Zebra olan rapora Barkod etiketi verilmeli');
  assert.ok(results.printerLangTags.includes('Barkod'), 'Barkod yazıcı komutu (A20,22...) içeren rapora Barkod etiketi verilmeli');
});

test('supabase.js çöp ve silme operasyonlarında hataları yutmaz ve yukarı iletir', () => {
  const code = fs.readFileSync(path.join(root, 'js/core/supabase.js'), 'utf8');

  // moveToTrash içinde sunucu isteği doğrudan döner veya fırlatır
  const moveToTrashCode = code.slice(code.indexOf('async moveToTrash('), code.indexOf('async moveManyToTrash('));
  assert.doesNotMatch(moveToTrashCode, /catch\s*\([^\)]*\)\s*\{\s*return false;\s*\}/);

  // restoreFromTrash içinde sunucu isteği doğrudan döner veya fırlatır
  const restoreCode = code.slice(code.indexOf('async restoreFromTrash('), code.indexOf('async restoreManyFromTrash('));
  assert.doesNotMatch(restoreCode, /catch\s*\([^\)]*\)\s*\{\s*return false;\s*\}/);

  // purgeReport içinde hata yutma yoktur
  const purgeCode = code.slice(code.indexOf('async purgeReport('), code.indexOf('async deleteReport('));
  assert.doesNotMatch(purgeCode, /catch\s*\{\s*return false;\s*\}/);

  // emptyTrash içinde hata yutma yoktur
  const emptyTrashCode = code.slice(code.indexOf('async emptyTrash('), code.indexOf('// ── 8. KATEGORİLER'));
  assert.doesNotMatch(emptyTrashCode, /catch\s*\{\s*return false;\s*\}/);
});

test('server.js çöp kutusu boşaltmada admin kullanıcısına tüm silinmiş kayıtları temizleme yetkisi verir', () => {
  const code = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const trashAllRoute = code.slice(code.indexOf("app.delete('/api/reports/trash/all'"), code.indexOf("app.delete('/api/reports/:id'"));
  assert.match(trashAllRoute, /isAdmin/);
  assert.match(trashAllRoute, /req\.authUser\?\.role === 'admin'/);
});

test('server.js çöp ve ortak havuz rotalarında -1 indeks sınır kontrolü yapar', () => {
  const code = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const trashRoute = code.slice(code.indexOf("app.patch('/api/reports/:id/trash'"), code.indexOf("app.post('/api/reports/toggle-pool'"));
  assert.match(trashRoute, /if \(index === -1\) return res\.status\(404\)/);

  const togglePoolRoute = code.slice(code.indexOf("app.post('/api/reports/toggle-pool'"), code.indexOf("app.post('/api/reports/bulk-toggle-pool'"));
  assert.match(togglePoolRoute, /if \(index === -1\) return res\.status\(404\)/);
});

test('store_main.js bulut işlemleri başarısız olduğunda rollback tetikler', () => {
  const code = fs.readFileSync(path.join(root, 'js/store/store_main.js'), 'utf8');

  // moveToTrash guard kontrolü
  const moveToTrashBody = code.slice(code.indexOf('async function moveToTrash('), code.indexOf('async function moveManyToTrash('));
  assert.match(moveToTrashBody, /if \(!saved\) throw new Error/);

  // restoreFromTrash guard kontrolü
  const restoreBody = code.slice(code.indexOf('async function restoreFromTrash('), code.indexOf('async function restoreManyFromTrash('));
  assert.match(restoreBody, /if \(!saved\) throw new Error/);

  // purgeFromTrash guard kontrolü
  const purgeBody = code.slice(code.indexOf('async function purgeFromTrash('), code.indexOf('async function purgeManyFromTrash('));
  assert.match(purgeBody, /if \(!ok\) throw new Error/);

  // emptyTrash guard kontrolü
  const emptyTrashBody = code.slice(code.indexOf('async function emptyTrash('), code.indexOf('// ── 6. Not, Meta'));
  assert.match(emptyTrashBody, /if \(!ok\) throw new Error/);

  // deleteOne ve deleteMany asenkron rollback korumasına sahiptir
  assert.match(code, /async function deleteOne\(/);
  assert.match(code, /async function deleteMany\(/);
});
