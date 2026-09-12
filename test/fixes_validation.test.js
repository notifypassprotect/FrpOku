const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildOwnedReportRow,
  reportRowToClient,
  reportRowToSummaryClient
} = require('../lib/report_access.js');

test('buildOwnedReportRow unpinning ve unfavorite değerlerini doğru korur', () => {
  const existingRow = {
    id: 'rep-1',
    user_id: 'user-1',
    name: 'Mevcut Rapor',
    is_pinned: true,
    is_favorite: true,
    data: {
      isPinned: true,
      isFavorite: true,
      rawXml: '<xml>1</xml>'
    }
  };

  // Kullanıcı sabitlemeyi kaldırıyor (isPinned: false)
  const unpinUpdate = {
    id: 'rep-1',
    name: 'Mevcut Rapor',
    isPinned: false,
    isFavorite: false
  };

  const user = { id: 'user-1', username: 'ilker' };
  const updatedRow = buildOwnedReportRow(unpinUpdate, user, {
    existing: existingRow
  });

  assert.equal(updatedRow.is_pinned, false, 'is_pinned false olmalı');
  assert.equal(updatedRow.is_favorite, false, 'is_favorite false olmalı');
  assert.equal(updatedRow.data.isPinned, false, 'data.isPinned false olmalı');
  assert.equal(updatedRow.data.isFavorite, false, 'data.isFavorite false olmalı');
});

test('reportRowToSummaryClient tableNames, paramNames ve queryNames alanlarını korur', () => {
  const serverRow = {
    id: 'rep-2',
    user_id: 'user-1',
    name: 'Fatura Raporu',
    user_note: 'Önemli muhasebe raporu',
    tableNames: ['tbl_fatura', 'tbl_cari'],
    paramNames: ['p_tarih1', 'p_tarih2'],
    queryNames: ['qryFaturaDetay'],
    datasets: ['dsFatura'],
    data: {
      tableNames: ['tbl_fatura', 'tbl_cari'],
      paramNames: ['p_tarih1', 'p_tarih2'],
      rawXml: '<xml>büyük xml</xml>'
    }
  };

  const clientSummary = reportRowToSummaryClient(serverRow);
  assert.deepEqual(clientSummary.tableNames, ['tbl_fatura', 'tbl_cari']);
  assert.deepEqual(clientSummary.paramNames, ['p_tarih1', 'p_tarih2']);
  assert.deepEqual(clientSummary.queryNames, ['qryFaturaDetay']);
  assert.deepEqual(clientSummary.datasets, ['dsFatura']);
  assert.equal(clientSummary.userNote, 'Önemli muhasebe raporu');
  assert.equal(clientSummary.rawXml, null, 'Özet raporda rawXml null olmalı');
});

test('reportRowToSummaryClient PostgREST data->... formatındaki sütunları da ayrıştırır', () => {
  const postgrestRow = {
    id: 'rep-3',
    user_id: 'user-1',
    name: 'Teknik Servis',
    'data->tableNames': ['teknik_servis', 'cihazlar'],
    'data->paramNames': ['servis_id'],
    'data->queryNames': ['qryServis'],
    'data->datasets': ['dsServis'],
    data: {}
  };

  const clientSummary = reportRowToSummaryClient(postgrestRow);
  assert.deepEqual(clientSummary.tableNames, ['teknik_servis', 'cihazlar']);
  assert.deepEqual(clientSummary.paramNames, ['servis_id']);
  assert.deepEqual(clientSummary.queryNames, ['qryServis']);
  assert.deepEqual(clientSummary.datasets, ['dsServis']);
});

test('store_main.js _reportHash fonksiyonu userNote değişikliklerini algılar', () => {
  const storeMainPath = path.join(__dirname, '..', 'js', 'store', 'store_main.js');
  const code = fs.readFileSync(storeMainPath, 'utf8');

  // _reportHash fonksiyonunun tanımını kontrol et
  assert.match(code, /_reportHash\(report\)/);
  assert.match(code, /userNote/);
  assert.match(code, /user_note/);
});

test('Karmaşıklık analizi index.html, detail.html ve shortcuts_tab.js dosyalarından kaldırıldı', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const detailHtml = fs.readFileSync(path.join(__dirname, '..', 'detail.html'), 'utf8');
  const shortcuts = fs.readFileSync(path.join(__dirname, '..', 'js', 'settings', 'tabs', 'shortcuts_tab.js'), 'utf8');

  assert.equal(indexHtml.includes('btnComplexityCenter'), false, 'index.html btnComplexityCenter içermemeli');
  assert.equal(indexHtml.includes('btnMobComplexity'), false, 'index.html btnMobComplexity içermemeli');
  assert.equal(indexHtml.includes('js/analytics/complexity.js'), false, 'index.html complexity.js script tagi içermemeli');

  assert.equal(detailHtml.includes('js/analytics/complexity.js'), false, 'detail.html complexity.js script tagi içermemeli');
  assert.equal(shortcuts.includes('SQL Karmaşıklık'), false, 'shortcuts_tab.js F7 karmaşıklık kısayolu içermemeli');
});

test('Ortak havuz kullanıcı filtresi index.html ve list.js içinde mevcuttur', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const listJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'list', 'list.js'), 'utf8');

  assert.match(indexHtml, /id="userSelect"/, 'index.html userSelect elemanı içermeli');
  assert.match(listJs, /selectedUser/, 'list.js selectedUser değişkeni içermeli');
  assert.match(listJs, /updateUserList/, 'list.js updateUserList fonksiyonu içermeli');
});

test('tüm toast katmanları tam ekran modalların üzerinde gösterilir', () => {
  const detailHtml = fs.readFileSync(path.join(__dirname, '..', 'detail.html'), 'utf8');
  const listCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'list.css'), 'utf8');
  const presenceCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'online_presence.css'), 'utf8');
  const styleCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

  assert.match(detailHtml, /#toastDetail[\s\S]*?z-index:\s*999999\s*!important/);
  assert.match(listCss, /\.toast-stack[\s\S]*?z-index:\s*999999\s*!important/);
  assert.match(presenceCss, /\.frp-inapp-toast-container[\s\S]*?z-index:\s*999999\s*!important/);
  assert.match(styleCss, /\.frp-toast-container[\s\S]*?z-index:\s*999999/);
});

test('report_designer.js dosyasında sözdizimi hatası yoktur ve FastReportDesigner tanımlanır', () => {
  const designerPath = path.join(__dirname, '..', 'js', 'detail', 'report_designer.js');
  const code = fs.readFileSync(designerPath, 'utf8');

  assert.doesNotThrow(() => {
    new Function(code);
  }, 'report_designer.js temiz derlenmeli');
  assert.match(code, /window\.FastReportDesigner\s*=/);
});

test('store_main.js ve themes.js ayarları kullanıcı bazlı izole anahtarlarla saklar', () => {
  const storePath = path.join(__dirname, '..', 'js', 'store', 'store_main.js');
  const themePath = path.join(__dirname, '..', 'js', 'core', 'themes.js');
  const storeCode = fs.readFileSync(storePath, 'utf8');
  const themeCode = fs.readFileSync(themePath, 'utf8');

  assert.match(storeCode, /function _scopedStorageKey\(/);
  assert.match(storeCode, /_scopedStorageKey\(PREFS_KEY\)/);
  assert.match(themeCode, /function _scopedUserKey\(/);
  assert.match(themeCode, /_scopedUserKey\(THEME_CODE_KEY\)/);
});

test('online_presence.js son mesajlaşılan kullanıcıları en üstte sıralar ve ses oynatıcı seeking desteği barındırır', () => {
  const presenceJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'online_presence.js'), 'utf8');

  assert.match(presenceJs, /localLastInteractions/);
  assert.match(presenceJs, /lastInteraction/);
  assert.match(presenceJs, /bindAudioPlayer/);
  assert.match(presenceJs, /isFinite\(audioEl\.duration\)/);
  assert.match(presenceJs, /frp-audio-track/);
});

test('online_presence.css okunmamış mesaj içeren kullanıcı satırını canlı mavi ile vurgular', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'online_presence.css'), 'utf8');

  assert.match(css, /\.frp-presence-item\.unread/);
  assert.match(css, /linear-gradient\(90deg,\s*rgba\(37,\s*99,\s*235/);
  assert.match(css, /border-left:\s*4px\s+solid/);
});

test('detail/app.js zengin not şablonları, sayaç ve Word modu tetikleyicisi barındırır', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'detail', 'app.js'), 'utf8');

  assert.match(appJs, /selNoteTemplate/);
  assert.match(appJs, /noteCharStats/);
  assert.match(appJs, /btnOpenRichNoteModalDetail/);
  assert.match(appJs, /btnInsertDateStamp/);
});

test('assets/favicon.svg geçerli XML standartlarına ve yeni FrpOku vektörel tasarımına sahiptir', () => {
  const svg = fs.readFileSync(path.join(__dirname, '..', 'assets', 'favicon.svg'), 'utf8');

  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /viewBox="0 0 128 128"/);
  assert.match(svg, /frpPrismGrad/);
  assert.match(svg, /frpFoldGrad/);
});

test('server.js captcha endpointi hem token hem de captchaToken döner', () => {
  const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

  assert.match(serverJs, /token:\s*c\.token,\s*captchaToken:\s*c\.token/);
});

test('auth_portal.js yeni FrpOku logosunu, acil kurtarma gizliliğini ve captcha çözümünü barındırır', () => {
  const portalJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'auth', 'auth_portal.js'), 'utf8');

  assert.match(portalJs, /function getFrpLogoSvg\(/);
  assert.match(portalJs, /id="linkEmergencyRecover"[^>]*display:\s*none/);
  assert.match(portalJs, /data\?\.captchaToken\s*\|\|\s*data\?\.token/);
});

test('dashboard.html ve compare.html atıl complexity.js içermez ve dashboard favicon barındırır', () => {
  const dashHtml = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
  const compHtml = fs.readFileSync(path.join(__dirname, '..', 'compare.html'), 'utf8');

  assert.equal(dashHtml.includes('complexity.js'), false, 'dashboard.html complexity.js içermemeli');
  assert.equal(compHtml.includes('complexity.js'), false, 'compare.html complexity.js içermemeli');
  assert.match(dashHtml, /assets\/favicon\.svg/, 'dashboard.html favicon içermeli');
});

test('yetim dosyalar ve aaa.txt kök dizinden temizlenmiştir', () => {
  const rootDir = path.join(__dirname, '..');
  assert.equal(fs.existsSync(path.join(rootDir, 'aaa.txt')), false, 'aaa.txt kökte olmamalı');
  assert.equal(fs.existsSync(path.join(rootDir, 'js', 'detail', 'detail_helpers.js')), false, 'detail_helpers.js silinmiş olmalı');
  assert.equal(fs.existsSync(path.join(rootDir, 'js', 'detail', 'detail_panels.js')), false, 'detail_panels.js silinmiş olmalı');
  assert.equal(fs.existsSync(path.join(rootDir, 'js', 'analytics', 'complexity.js')), false, 'complexity.js silinmiş olmalı');
  assert.equal(fs.existsSync(path.join(rootDir, 'docs', 'security-audit-notes.md')), true, 'docs/security-audit-notes.md mevcut olmalı');
});


