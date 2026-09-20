const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseFrp } = require('../js/core/parser');

const root = path.join(__dirname, '..');

function loadSqlAnalyzers() {
  const ctx = { window: {}, document: { getElementById: () => null } };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/analytics/syntax_check.js'), 'utf8'), ctx);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/core/highlight.js'), 'utf8'), ctx);
  return ctx;
}

test('valid multiline CASE and derived-table JOIN structures do not produce false SQL errors', () => {
  const ctx = loadSqlAnalyzers();
  const sql = `select
  case
    when ak.ameliyat_baslama_tarihi is not null
     and ak.ameliyat_bitis_tarihi is not null
    then 'BITTI'
    else 'BEKLIYOR'
  end ameliyat_bitti,
  case
    when coalesce(ak.iptal_kk,0) > 0
      or coalesce(ak.erteleme_kk,0) > 0
      or coalesce(ah.iptal_kk,0) > 0
    then 'IPTAL'
    else 'AKTIF'
  end iptal,
  (select to_char(list(t.kodu || '-' || t.adi))
     from hasta_tani ht
     left join tani t on t.kodu=ht.tani_kodu
    where ht.birim_kayit_id=ah.birim_kayit_id) tanilari
from ameliyat_hasta ah
left outer join (
  select py.personel_id,
         min((select py2.brans_id
                from personel_yandal py2
               where py2.personel_id=py.personel_id
                 and rownum=1)) brans_id
    from personel_yandal py
   group by py.personel_id
) py on py.personel_id=ah.personel_id`;

  assert.equal(ctx.FrpSyntaxCheck.checkSqlStaticSyntax(sql).errors.length, 0);
  assert.equal(ctx.findSyntaxErrors(sql, 'sql').length, 0);
});

test('parser preserves transparent brush style and dialog page identity', () => {
  const parsed = parseFrp(`<TfrxReport>
    <TfrxReportPage Name="Page1">
      <TfrxMasterData Name="MasterData1" Height="30">
        <TfrxMemoView Name="Memo1" Width="100" Height="20" Fill.BackColor="0" Fill.Style="bsClear" Text="Başlık" />
      </TfrxMasterData>
    </TfrxReportPage>
    <TfrxDialogPage Name="DialogPage1" Caption="Parametre Formu" Color="-16777189" Width="300" Height="150">
      <TfrxLabelControl Name="Label1" Caption="Başlangıç" />
    </TfrxDialogPage>
  </TfrxReport>`);

  const memo = parsed.pages[0].bands[0].components[0];
  assert.equal(memo.fillBackColor, '0');
  assert.equal(memo.fillStyle, 'bsClear');
  assert.equal(parsed.dialogPages[0].type, 'TfrxDialogPage');
  assert.equal(parsed.dialogPages[0].fillBackColor, '-16777189');
});

test('designer resolves encoded Delphi system colors instead of treating their index as RGB', () => {
  const designerCode = fs.readFileSync(path.join(root, 'js/detail/report_designer.js'), 'utf8');
  const ctx = { window: {}, navigator: { clipboard: { writeText: () => Promise.resolve() } } };
  vm.runInNewContext(designerCode, ctx);
  assert.equal(ctx.window.FastReportDesigner.decodeColor('-16777211'), 'rgb(255, 255, 255)');
  assert.equal(ctx.window.FastReportDesigner.decodeColor('-16777189'), 'rgb(185, 209, 234)');
  assert.equal(ctx.window.FastReportDesigner.decodeColor('27'), 'rgb(185, 209, 234)');
});
