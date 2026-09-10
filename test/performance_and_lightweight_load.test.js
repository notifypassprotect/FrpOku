const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { reportRowToClient, reportRowToSummaryClient } = require('../lib/report_access');

test('reportRowToSummaryClient devasa XML ve sayfa verilerini ayıklar ancak tüm liste alanlarını eksiksiz korur', () => {
  const fullRow = {
    id: 'rep-test-perf-1',
    name: 'Performans Test Raporu.frp',
    user_id: 'usr_perf_1',
    file_size: 250000,
    category: 'Maliye',
    tags: ['Test', 'Bütçe'],
    is_favorite: true,
    is_pinned: false,
    is_deleted: false,
    sql_count: 5,
    memo_count: 12,
    dataset_count: 3,
    page_count: 2,
    has_script: true,
    created_at: '2026-09-10T12:00:00.000Z',
    updated_at: '2026-09-10T12:00:00.000Z',
    user_note: 'Hızlı test notu',
    meta: {
      reportName: 'Performans Test Raporu',
      guid: 'GUID-123-456'
    },
    isPublic: true,
    is_public: true,
    inPool: true,
    in_pool: true,
    ownerName: 'Ali Veli',
    ownerUsername: 'aliveli',
    ownerDepartment: 'Mali Hizmetler',
    sharedAt: '2026-09-10T12:00:00.000Z',
    version: 3,
    data: {
      rawXml: '<TfrxReport>'.repeat(5000) + '</TfrxReport>',
      tree: Array.from({ length: 500 }, (_, i) => ({ id: `node_${i}`, name: `Control_${i}`, type: 'TfrxMemoView' })),
      pages: Array.from({ length: 10 }, (_, i) => ({ pageNo: i, bands: [] })),
      dialogPages: [{ name: 'Dialog1' }],
      queries: [{ name: 'Q1', sql: 'SELECT 1' }]
    }
  };

  const clientFull = reportRowToClient(fullRow);
  const clientSummary = reportRowToSummaryClient(fullRow);

  // Boyut farkı kontrolü
  const fullSize = JSON.stringify(clientFull).length;
  const summarySize = JSON.stringify(clientSummary).length;
  assert.ok(summarySize < fullSize * 0.05, `Özet boyut (${summarySize} B) tam boyuttan (${fullSize} B) en az %95 daha küçük olmalı.`);

  // Temel alanların eksiksizliği
  assert.equal(clientSummary.id, 'rep-test-perf-1');
  assert.equal(clientSummary.name, 'Performans Test Raporu.frp');
  assert.equal(clientSummary.userId, 'usr_perf_1');
  assert.equal(clientSummary.sizeBytes, 250000);
  assert.equal(clientSummary.category, 'Maliye');
  assert.deepEqual(clientSummary.tags, ['Test', 'Bütçe']);
  assert.equal(clientSummary.isFavorite, true);
  assert.equal(clientSummary.isPinned, false);
  assert.equal(clientSummary.isDeleted, false);
  assert.equal(clientSummary.isPublic, true);
  assert.equal(clientSummary.inPool, true);
  assert.equal(clientSummary.ownerName, 'Ali Veli');
  assert.equal(clientSummary.ownerUsername, 'aliveli');
  assert.equal(clientSummary.ownerDepartment, 'Mali Hizmetler');
  assert.equal(clientSummary.version, 3);
  assert.equal(clientSummary.meta.guid, 'GUID-123-456');
  assert.equal(clientSummary.stats.sqlCount, 5);
  assert.equal(clientSummary.stats.memoCount, 12);
  assert.equal(clientSummary.stats.pageCount, 2);

  // Ağır alanların listede bulunmadığı doğrulanır
  assert.equal(clientSummary.rawXml, null);
  assert.deepEqual(clientSummary.tree, []);
  assert.deepEqual(clientSummary.pages, []);
});

test('server.js dosyasında tekil rapor getirme rotası GET /api/reports/:id ve yetki denetimi mevcuttur', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(serverCode, /app\.get\(['"]\/api\/reports\/:id['"]/);
  assert.match(serverCode, /canReadReport\(req\.authUser/);
  assert.match(serverCode, /loadVisibleReports\(req\.authUser,\s*false,\s*\{\s*summaryOnly:\s*true\s*\}\)/);
  assert.match(serverCode, /SUMMARY_SELECT_COLUMNS/);
});

test('store_main.js dosyasında ensureFullReport ve optimize edilmiş _reportHash mevcuttur', () => {
  const storeCode = fs.readFileSync(path.join(__dirname, '../js/store/store_main.js'), 'utf8');
  assert.match(storeCode, /async function ensureFullReport\(/);
  assert.match(storeCode, /ensureFullReport,\s*add,/);
  assert.match(storeCode, /function _reportHash\(report\)\s*\{\s*if \(!report\) return '';\s*return `\$\{report\.id\}/);
});

test('detail ve indirme dosyalarında ensureFullReport entegrasyonu vardır', () => {
  const detailCode = fs.readFileSync(path.join(__dirname, '../js/detail/app.js'), 'utf8');
  assert.match(detailCode, /ensureFullReport/);

  const listActionsCode = fs.readFileSync(path.join(__dirname, '../js/list/list_actions.js'), 'utf8');
  assert.match(listActionsCode, /ensureFullReport/);
});
