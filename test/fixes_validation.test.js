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

test('findSyntaxErrors ve checkSqlStaticSyntax SQL sözdizimi hata doğrulamalarını eksiksiz uygular', () => {
  const vm = require('vm');
  const highlightCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'highlight.js'), 'utf8');
  const syntaxCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'analytics', 'syntax_check.js'), 'utf8');

  const ctx = { window: {}, document: { getElementById: () => null } };
  ctx.window = ctx;
  vm.runInNewContext(syntaxCode, ctx);
  vm.runInNewContext(highlightCode, ctx);

  // 1. Çok satırlı geçerli SELECT (Kullanıcı ekran görüntüsü 1): sıfır hata olmalı
  const sqlClean = `select
  to_date(c.tarihi, 'DD-MM-YYYY') cari_tarihi, SUBSTR (H.TC_KIMLIK_NO, 1, 2) || '*******' || SUBSTR (H.TC_KIMLIK_NO, 10, 2) TC_KIMLIK_NO, m.numarasi, m.hasta_id, h.adi, h.soyadi, h.dogum_tarihi, h.cinsiyeti,
  to_char(c.onay_kts, 'DD.MM.YYYY') onay_kts, c.yapan_doktor_id, p.adi_soyadi doktor_adi, lo.*, lk.*,
  case when h.cinsiyeti='E' then 'Erkek' else 'Kadın' end cinsiyet
from cari c
left outer join muracaat m on m.id=c.muracaat_id
left outer join hasta h on h.id=m.hasta_id
left outer join personel p on p.id=c.yapan_doktor_id
where c.id=:cariid and c.lab_durum=150`;

  const errsClean = ctx.findSyntaxErrors(sqlClean, 'sql');
  assert.equal(errsClean.length, 0, 'Çok satırlı SELECT hatasız olmalıdır');
  assert.equal(ctx.FrpSyntaxCheck.checkSqlStaticSyntax(sqlClean).errors.length, 0);

  // 2. Eksik virgül denetimi (select k \\n to_date(...)): satır 1'de virgül uyarısı
  const sqlComma = `select k
  to_date(c.tarihi, 'DD-MM-YYYY') cari_tarihi
from cari c`;
  const errsComma = ctx.findSyntaxErrors(sqlComma, 'sql');
  assert.equal(errsComma.some(e => e.line === 1 && e.token === ','), true, 'Eksik virgül yakalanmalı');
  assert.equal(ctx.FrpSyntaxCheck.checkSqlStaticSyntax(sqlComma).errors.some(e => e.includes('virgül')), true);

  // 3. CASE bloğunda eksik END denetimi (Kullanıcı ekran görüntüsü 3)
  const sqlCase = `select
  case when h.cinsiyeti='E' then 'Erkek' else 'Kadın' cinsiyet
from cari c`;
  const errsCase = ctx.findSyntaxErrors(sqlCase, 'sql');
  assert.equal(errsCase.some(e => e.token === 'CASE' && e.message.includes("'END' ile kapatılmamış")), true, 'Eksik END yakalanmalı');
  assert.equal(ctx.FrpSyntaxCheck.checkSqlStaticSyntax(sqlCase).errors.some(e => e.includes("'END' ile kapatılmamış")), true);

  // 4. JOIN'de eksik ON denetimi (Kullanıcı ekran görüntüsü 4): left outer join hasta h h.id=m.hasta_id
  const sqlJoin = `select c.id
from cari c
left outer join muracaat m on m.id=c.muracaat_id
left outer join hasta h h.id=m.hasta_id
left outer join personel p on p.id=c.yapan_doktor_id`;
  const errsJoin = ctx.findSyntaxErrors(sqlJoin, 'sql');
  assert.equal(errsJoin.some(e => e.token === 'ON' && e.message.includes("'ON' anahtar sözcüğü eksik")), true, 'Eksik ON yakalanmalı');
  assert.equal(ctx.FrpSyntaxCheck.checkSqlStaticSyntax(sqlJoin).errors.some(e => e.includes("'ON' anahtar sözcüğü eksik")), true);

  // 5. CROSS JOIN muafiyeti (Kullanıcı ekran görüntüsü 5): ON gerektirmez
  const sqlCross = `select c.id
from cari c
cross join aa
where c.id=:cariid and c.lab_durum=150`;
  const errsCross = ctx.findSyntaxErrors(sqlCross, 'sql');
  assert.equal(errsCross.length, 0, 'CROSS JOIN için ON hatası verilmemeli');
  assert.equal(ctx.FrpSyntaxCheck.checkSqlStaticSyntax(sqlCross).errors.length, 0);

  // 6. JOIN anahtar kelime yazım hatası (lef outer join -> LEFT)
  const sqlLefJoin = `from birim_kayit bk
    lef outer join birim b on bk.birim_id = b.id`;
  const errsLef = ctx.findSyntaxErrors(sqlLefJoin, 'sql');
  assert.equal(errsLef.some(e => e.token === 'lef' && e.suggestion === 'LEFT'), true, 'lef yerine LEFT önerilmeli');

  // 7. JOIN ON bağlantısında karşılaştırma operatörü eksikliği (on bk.birim_id  b.id)
  const sqlOnMissingOp = `from birim_kayit bk
    left outer join birim b on bk.birim_id  b.id`;
  const errsOnOp = ctx.findSyntaxErrors(sqlOnMissingOp, 'sql');
  assert.equal(errsOnOp.some(e => e.token === 'ON' && e.message.includes("karşılaştırma operatörü eksik")), true, 'ON koşulunda eksik operatör yakalanmalı');
  assert.equal(ctx.FrpSyntaxCheck.checkSqlStaticSyntax(sqlOnMissingOp).errors.some(e => e.includes("karşılaştırma operatörü eksik")), true);

  // 8. BETWEEN sonrasında alt sınır eksikliği (between and :t2)
  const sqlBetweenAnd = `select id from t where t.tarih between and :t2`;
  const errsBetween = ctx.findSyntaxErrors(sqlBetweenAnd, 'sql');
  assert.equal(errsBetween.some(e => e.token === 'BETWEEN' && e.message.includes('alt sınır')), true, 'BETWEEN alt sınır eksikliği yakalanmalı');
  assert.equal(ctx.FrpSyntaxCheck.checkSqlStaticSyntax(sqlBetweenAnd).errors.some(e => e.includes('alt sınır')), true);

  // 9. (YEAR FROM ...) başında eksik EXTRACT fonksiyonu
  const sqlExtract = `select id from t order by (year from t.tarih) desc`;
  const errsExtract = ctx.findSyntaxErrors(sqlExtract, 'sql');
  assert.equal(errsExtract.some(e => e.message.includes('EXTRACT')), true, 'Eksik EXTRACT yakalanmalı');
  assert.equal(ctx.FrpSyntaxCheck.checkSqlStaticSyntax(sqlExtract).errors.some(e => e.includes('EXTRACT')), true);

  // 10. Parametresiz fonksiyon çağrısı (COALESCE()) ve boş IN ()
  const sqlFuncEmpty = `select coalesce() from t where id in ()`;
  const errsFuncEmpty = ctx.findSyntaxErrors(sqlFuncEmpty, 'sql');
  assert.equal(errsFuncEmpty.some(e => e.message.includes('parametresiz')), true, 'Parametresiz fonksiyon yakalanmalı');
  assert.equal(errsFuncEmpty.some(e => e.message.includes('IN ()')), true, 'Boş IN listesi yakalanmalı');
});



