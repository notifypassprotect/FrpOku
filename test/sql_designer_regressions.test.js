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

test('Oracle IN lists, string literals and multiline FROM are not marked as empty', () => {
  const ctx = loadSqlAnalyzers();
  const sql = `select coalesce(count(distinct case when pk.aciklama in ('II','OI','EI','BI') then d.id end),0) idari_izin,
    sum(case when coalesce(to_char(d.tarihi,'D'),'0') in ('6','7') then t.calisma_saati else 0 end) hafta_sonu
    from
    (select d.id from personel_isci_nobet_detay d) t
    where t.id not in ('0')`;
  assert.deepEqual(Array.from(ctx.findSyntaxErrors(sql, 'sql')), []);
  assert.deepEqual(Array.from(ctx.findSyntaxErrors(`select distinct p.id,p.adi_soyadi\nfrom personel p\nwhere p.cikis_tarihi is null\nand coalesce(p.diploma_tescil_no,'0') not in ('0')`, 'sql')), []);
});

test('FastReport assignments with quoted values and custom functions stay valid', () => {
  const ctx = loadSqlAnalyzers();
  const script = `procedure edtAy10nBeforePrint(Sender: TfrxComponent);
var i: Integer;
begin
  i := VarToInt(ReturnQuery('select count(*) from dual'));
  edtFazla75.Text := '0';
end;`;
  assert.deepEqual(Array.from(ctx.findSyntaxErrors(script, 'pascal')), []);
});

test('detail editor font sizing and SQL format action work in edit mode', () => {
  const detail = fs.readFileSync(path.join(root, 'js/detail/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
  assert.match(detail, /data-detail-action="format-sql"[^>]*data-mode="expanded"[^>]*>Formatla<\/button>/);
  assert.match(css, /\.code-editor-wrap \.edit-mode-textarea[\s\S]*?font-size: var\(--code-size\)!important/);
  assert.match(css, /\.code-editor-backdrop \{[\s\S]*?font-size: var\(--code-size\)!important/);
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

test('multiline select * from followed by subquery or derived table does not report missing table error', () => {
  const ctx = loadSqlAnalyzers();
  const sql = `select * from
(select cc.*,case when (cc.ham_puan-cc.puan_toplam)>0 then (select distinct to_char(list(distinct gp.UYGULANAN_KURAL)) from GIP_KURAL_CARI gp where gp.DONEM_ID=:donem and gp.DOKTOR_ID=cc.id and gp.TETKIK_KODU=cc.kodu) end from dual)`;

  const res = ctx.FrpSyntaxCheck.checkSqlStaticSyntax(sql);
  const fromErrors = res.errors.filter(e => e.includes('FROM/INTO/UPDATE sonrasında tablo adı eksik'));
  assert.equal(fromErrors.length, 0, 'Must not report missing table for select * from followed by subquery');

  const diagErrors = Array.from(ctx.findSyntaxErrors(sql, 'sql')).filter(d => (d.message || '').includes('tablo adı eksik'));
  assert.equal(diagErrors.length, 0, 'Highlight diagnostics must not report missing table');
});

test('table function with parameter list does not produce Cartesian product warning', () => {
  const ctx = loadSqlAnalyzers();
  const sql = `select * from table(p_istatistik2.isci_nobet_gunleri(:t1, :t2))`;
  const res = ctx.FrpSyntaxCheck.checkSqlStaticSyntax(sql);
  const cartesianWarnings = res.warnings.filter(w => w.includes('Kartezyen'));
  assert.equal(cartesianWarnings.length, 0, 'TABLE(pkg.func(:t1, :t2)) must not be flagged as Cartesian product');

  const cartesianSql = `select * from emp e, dept d where e.dept_id = d.id`;
  const resCartesian = ctx.FrpSyntaxCheck.checkSqlStaticSyntax(cartesianSql);
  assert.equal(resCartesian.warnings.some(w => w.includes('Kartezyen')), true, 'Comma-separated tables must still be flagged');
});

