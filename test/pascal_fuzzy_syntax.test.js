const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

function loadAnalyzers() {
  const ctx = { window: {}, document: { getElementById: () => null } };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/analytics/syntax_check.js'), 'utf8'), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/core/highlight.js'), 'utf8'), ctx);
  return ctx;
}

test('checkPascalSyntax and findSyntaxErrors detect typos when letters are deleted from Open, Color, FetchAll', () => {
  const ctx = loadAnalyzers();

  // 1. Chained Object Methods & Properties (qp.Opn, Memo1.Colr, qp.FetchAl)
  const scriptChained = `procedure Test(Sender: TfrxComponent);
begin
  Query1.Opn;
  Memo1.Colr := clRed;
  Query1.FetchAl;
end;`;

  const res1 = ctx.FrpSyntaxCheck.checkPascalSyntax(scriptChained);
  assert.ok(res1.errors.some(e => e.token === 'Opn' && e.suggestion.includes('Open')), 'Opn typo must suggest Open');
  assert.ok(res1.errors.some(e => e.token === 'Colr' && e.suggestion.includes('Color')), 'Colr typo must suggest Color');
  assert.ok(res1.errors.some(e => e.token === 'FetchAl' && e.suggestion.includes('FetchAll')), 'FetchAl typo must suggest FetchAll');

  const diag1 = ctx.findSyntaxErrors(scriptChained, 'pascal');
  assert.ok(diag1.some(e => e.token === 'Opn' && e.suggestion === 'Open'), 'findSyntaxErrors must detect Opn');
  assert.ok(diag1.some(e => e.token === 'Colr' && e.suggestion === 'Color'), 'findSyntaxErrors must detect Colr');
  assert.ok(diag1.some(e => e.token === 'FetchAl' && e.suggestion === 'FetchAll'), 'findSyntaxErrors must detect FetchAl');

  // 2. Standalone calls / typos (Opn;, Colo, FetchAl;, begn, prcedure)
  const scriptStandalone = `prcedure Deneme;
begn
  Opn;
  FetchAl;
end;`;

  const res2 = ctx.FrpSyntaxCheck.checkPascalSyntax(scriptStandalone);
  assert.ok(res2.errors.some(e => e.token === 'prcedure' && e.suggestion.includes('procedure')), 'prcedure must suggest procedure');
  assert.ok(res2.errors.some(e => e.token === 'begn' && e.suggestion.includes('begin')), 'begn must suggest begin');
  assert.ok(res2.errors.some(e => e.token === 'Opn' && e.suggestion.includes('Open')), 'Standalone Opn must suggest Open');
  assert.ok(res2.errors.some(e => e.token === 'FetchAl' && e.suggestion.includes('FetchAll')), 'Standalone FetchAl must suggest FetchAll');

  // 3. Valid code must produce zero errors
  const validScript = `procedure edtAy10nBeforePrint(Sender: TfrxComponent);
var i: Integer;
begin
  Query1.Close;
  Query1.Open;
  Query1.FetchAll;
  Memo1.Color := clRed;
  edtFazla75.Text := '0';
end;`;

  const res3 = ctx.FrpSyntaxCheck.checkPascalSyntax(validScript);
  assert.equal(res3.errors.length, 0, 'Valid Pascal script must have 0 errors');
  const diag3 = ctx.findSyntaxErrors(validScript, 'pascal');
  assert.equal(diag3.length, 0, 'findSyntaxErrors must have 0 errors on valid code');
});
