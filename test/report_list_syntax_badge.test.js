const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function createEnvironment() {
  const ctx = {
    window: {},
    document: {
      getElementById: () => null,
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {} })
    },
    encodeInlineArg: (s) => encodeURIComponent(String(s || '')),
    encodeURIComponent: (s) => encodeURIComponent(String(s || ''))
  };
  ctx.window = ctx;

  // Load analyzers
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/analytics/syntax_check.js'), 'utf8'), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/core/highlight.js'), 'utf8'), ctx);

  // Load renderers
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/list/renderers/table_renderer.js'), 'utf8'), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/list/renderers/cards_renderer.js'), 'utf8'), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/list/renderers/timeline_renderer.js'), 'utf8'), ctx);

  return ctx;
}

test('getReportSyntaxDiagnostic detects errors in SQL or PascalScript and outputs red badge', () => {
  const ctx = createEnvironment();
  const getDiag = ctx.window.FrpListRenderers.getReportSyntaxDiagnostic;
  assert.ok(typeof getDiag === 'function', 'getReportSyntaxDiagnostic must be defined');

  // Case 1: Clean report (clean SQL, valid Pascal)
  const cleanReport = {
    id: 'rep_clean',
    name: 'TemizRapor.frp',
    meta: { reportName: 'Temiz Rapor' },
    queries: [{ name: 'Query1', sql: 'SELECT ID, ADI FROM CARI WHERE AKTIF = 1;' }],
    dialogPages: [{ controls: [{ name: 'DateEdit1' }, { name: 'DateEdit2' }] }],
    pascalScript: `procedure Test(Sender: TfrxComponent);
var ayNo: Integer; ayAdi: String;
begin
  if (MonthOf(DateEdit1.Date) <> MonthOf(DateEdit2.Date))
    then
  begin
    ShowMessage('Uyarı');
    Exit;
  end;
  case ayNo of
    1: ayAdi := 'OCAK';
  end;
end;`
  };

  const cleanDiag = getDiag(cleanReport);
  assert.equal(cleanDiag.hasError, false, 'Clean report must not have errors');
  assert.equal(cleanDiag.badgeHtml, '', 'Clean report must have empty badgeHtml');

  // Case 2: Report with SQL syntax error (e.g. unclosed parenthesis or missing table)
  const badSqlReport = {
    id: 'rep_bad_sql',
    name: 'HataliSql.frp',
    meta: { reportName: 'Hatalı SQL Raporu' },
    queries: [{ name: 'Query1', sql: 'SELECT ID, ADI FROM (WHERE AKTIF = 1' }]
  };

  const badSqlDiag = getDiag(badSqlReport);
  assert.equal(badSqlDiag.hasError, true, 'Report with bad SQL must flag hasError: true');
  assert.ok(badSqlDiag.badgeHtml.includes('report-syntax-error-badge'), 'Must include red badge class');
  assert.ok(badSqlDiag.badgeHtml.includes('>!</span>'), 'Must contain ! exclamation character');

  // Case 3: Report with Pascal syntax error (e.g. missing then or typo in keyword)
  const badPascalReport = {
    id: 'rep_bad_pas',
    name: 'HataliPascal.frp',
    meta: { reportName: 'Hatalı Pascal Raporu' },
    queries: [{ name: 'Query1', sql: 'SELECT ID FROM CARI' }],
    pascalScript: `prcedure Test;
begn
  x := 5
end;`
  };

  const badPasDiag = getDiag(badPascalReport);
  assert.equal(badPasDiag.hasError, true, 'Report with bad Pascal must flag hasError: true');
  assert.ok(badPasDiag.badgeHtml.includes('report-syntax-error-badge'), 'Must include red badge');
  assert.ok(badPasDiag.badgeHtml.includes('>!</span>'), 'Must contain !');

  // Case 4: Table, Card, and Timeline views render badge
  const container = { innerHTML: '' };

  // Cards
  ctx.window.FrpListRenderers.renderCards([badSqlReport], container);
  assert.ok(container.innerHTML.includes('report-syntax-error-badge'), 'Card view must render red badge for error report');

  // Timeline
  ctx.window.FrpListRenderers.renderTimeline([badSqlReport], container);
  assert.ok(container.innerHTML.includes('report-syntax-error-badge'), 'Timeline view must render red badge for error report');
});
