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
