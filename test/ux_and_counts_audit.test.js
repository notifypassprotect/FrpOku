const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('profile_tab.js retrieves files via FrpStore.getAll() and calculates owned & pool reports', () => {
  const code = fs.readFileSync(path.join(__dirname, '../js/settings/tabs/profile_tab.js'), 'utf8');
  assert.match(code, /FrpStore\?\.getAll/, 'profile_tab must use FrpStore.getAll()');
  assert.doesNotMatch(code, /FrpStore\?\.getFiles/, 'profile_tab must not reference nonexistent getFiles');
  assert.match(code, /poolReportCount/, 'must calculate pool reports');
  assert.match(code, /myReportCount/, 'must calculate myReportCount');
});

test('supabase.js parseReportFromRow preserves row.sql_count and populates stats.sqlCount', () => {
  const code = fs.readFileSync(path.join(__dirname, '../js/core/supabase.js'), 'utf8');
  assert.match(code, /row\.sql_count/, 'parseReportFromRow must check row.sql_count');
  assert.match(code, /r\.sql_count = sqlCountVal/, 'parseReportFromRow must assign sql_count');
  assert.match(code, /r\.stats\.sqlCount = sqlCountVal/, 'parseReportFromRow must assign stats.sqlCount');
});

test('storage_tab.js calculates totalQueries taking sql_count and queries into account', () => {
  const code = fs.readFileSync(path.join(__dirname, '../js/settings/tabs/storage_tab.js'), 'utf8');
  assert.match(code, /totalQueries/, 'storage_tab must compute totalQueries');
  assert.match(code, /\$\{totalQueries\}/, 'storage_tab must display totalQueries in the SQL count card');
});

test('list.js applySearch preserves currentPage when resetPage is false', () => {
  const code = fs.readFileSync(path.join(__dirname, '../js/list/list.js'), 'utf8');
  assert.match(code, /function applySearch\(opts = \{\}\)/, 'applySearch must accept options');
  assert.match(code, /if \(isExplicitReset\) \{\s*currentPage = 1;\s*\}/, 'applySearch must only reset currentPage on explicit reset');
  assert.match(code, /applySearch\(\{ resetPage: false \}\)/, 'refreshAll must pass resetPage: false');
});

test('timeline_renderer.js displays full group count and getReportColorTooltip provides hover guidance', () => {
  const timelineCode = fs.readFileSync(path.join(__dirname, '../js/list/renderers/timeline_renderer.js'), 'utf8');
  assert.match(timelineCode, /\$\{totalInGroup\.toLocaleString\('tr-TR'\)\} rapor/, 'timeline must show full month total');
  assert.match(timelineCode, /getReportColorTooltip/, 'timeline must use getReportColorTooltip for hover guidance');

  const tableCode = fs.readFileSync(path.join(__dirname, '../js/list/renderers/table_renderer.js'), 'utf8');
  assert.match(tableCode, /function getReportColorTooltip/, 'table_renderer must define getReportColorTooltip');
  assert.match(tableCode, /\[Kırmızı - Risk\]/, 'tooltip must describe red risk');
  assert.match(tableCode, /\[Yeşil - Havuzda\]/, 'tooltip must describe green pool');
  assert.match(tableCode, /\[Mavi - SQL\]/, 'tooltip must describe blue SQL count');
});

test('retro mode is removed from main index list and configured exclusively in settings appearance tab', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.doesNotMatch(html, /id="btnColorGuide"/, 'btnColorGuide button must be removed');
  assert.doesNotMatch(html, /id="btnRetroModeToggle"/, 'topbar must not contain btnRetroModeToggle');
  assert.doesNotMatch(html, /id="btnMobRetroToggle"/, 'mobile drawer must not contain btnMobRetroToggle');

  const appearanceCode = fs.readFileSync(path.join(__dirname, '../js/settings/tabs/appearance_tab.js'), 'utf8');
  assert.match(appearanceCode, /value="retro-win95"/, 'settings appearance tab must support retro-win95 mode');
});
