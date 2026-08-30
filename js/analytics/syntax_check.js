/**
 * FrpOku - Statik Sözdizimi Denetleyici (PascalScript & SQL)
 */

(function () {
 'use strict';

 function checkPascalSyntax(code, reportContext = null) {
 const errors = [], warnings = [];
 if (!code ||!code.trim()) return { errors, warnings };

 const rawLines = code.split('\n');

 let stripped = '';
 let inSingleQuote = false;
 let inBraceComment = false;
 let inParenStarComment = false;
 let inMacro = false;

 for (let i = 0; i < code.length; i++) {
 const ch = code[i];
 const next = code[i + 1] || '';

 if (ch === '\n') {
 stripped += '\n';
 inSingleQuote = false;
 inMacro = false;
 continue;
 }

 if (inSingleQuote) {
 if (ch === "'") {
 if (next === "'") {
 stripped += ' ';
 i++;
 } else {
 inSingleQuote = false;
 stripped += ' ';
 }
 } else {
 stripped += ' ';
 }
 continue;
 }

 if (inBraceComment) {
 if (ch === '}') inBraceComment = false;
 stripped += ' ';
 continue;
 }

 if (inParenStarComment) {
 if (ch === '*' && next === ')') {
 inParenStarComment = false;
 stripped += ' ';
 i++;
 } else {
 stripped += ' ';
 }
 continue;
 }

 if (inMacro) {
 if (ch === '>') inMacro = false;
 stripped += ' ';
 continue;
 }

 if (ch === '/' && next === '/') {
 let j = i;
 while (j < code.length && code[j]!== '\n') {
 stripped += ' ';
 j++;
 }
 i = j - 1;
 continue;
 }

 if (ch === '{') {
 inBraceComment = true;
 stripped += ' ';
 continue;
 }

 if (ch === '(' && next === '*') {
 inParenStarComment = true;
 stripped += ' ';
 i++;
 continue;
 }

 if (ch === "'") {
 inSingleQuote = true;
 stripped += ' ';
 continue;
 }

 if (ch === '<' && /[a-zA-Z_#]/.test(next)) {
 inMacro = true;
 stripped += ' ';
 continue;
 }

 stripped += ch;
 }

 const strippedLines = stripped.split('\n');

 // Parantez kontrolleri
 const openParens = [];
 const openBrackets = [];

 strippedLines.forEach((sLine, lIdx) => {
 const lnum = lIdx + 1;
 for (let c = 0; c < sLine.length; c++) {
 const ch = sLine[c];
 if (ch === '(') openParens.push({ line: lnum, col: c + 1 });
 else if (ch === ')') {
 if (openParens.length > 0) openParens.pop();
 else errors.push({ text: `Satır ${lnum}: Fazladan kapatma parantezi ')' bulundu`, line: lnum });
 } else if (ch === '[') openBrackets.push({ line: lnum, col: c + 1 });
 else if (ch === ']') {
 if (openBrackets.length > 0) openBrackets.pop();
 else errors.push({ text: `Satır ${lnum}: Fazladan kapatma köşeli parantezi ']' bulundu`, line: lnum });
 }
 }
 });

 if (openParens.length > 0) {
 const p = openParens[openParens.length - 1];
 errors.push({ text: `Satır ${p.line}: Açılan '(' parantezi kapatılmamış`, line: p.line });
 }
 if (openBrackets.length > 0) {
 const b = openBrackets[openBrackets.length - 1];
 errors.push({ text: `Satır ${b.line}: Açılan '[' köşeli parantezi kapatılmamış`, line: b.line });
 }

 // Begin / End Eşleşmesi ve Satır Sonu Noktalı Virgül (;) Kontrolü
 let beginCount = 0, endCount = 0;
 const beginStack = [];

 const NON_SEMICOLON_LINE_STARTERS = /^(BEGIN|THEN|ELSE|DO|TRY|EXCEPT|FINALLY|REPEAT|VAR|CONST|TYPE|USES|INTERFACE|IMPLEMENTATION)\b/i;
 const NON_SEMICOLON_LINE_ENDERS = /(:=|;|,|\(|\+|-\*|\/|\bAND\b|\bOR\b|\bTHEN\b|\bELSE\b|\bDO\b|\bBEGIN\b|\bTRY\b|\bEXCEPT\b|\bFINALLY\b|\bREPEAT\b|\bVAR\b|\bCONST\b|\bTYPE\b)$/i;

 strippedLines.forEach((sLine, lIdx) => {
 const lnum = lIdx + 1;
 const rawTrim = rawLines[lIdx].trim();
 const sTrim = sLine.trim();
 if (!sTrim) return;

 const up = sTrim.toUpperCase();

 const bMatches = [...up.matchAll(/\bBEGIN\b/g)];
 bMatches.forEach(bm => {
 beginCount++;
 beginStack.push({ line: lnum, type: 'begin', col: bm.index + 1 });
 });

 const cMatches = [...up.matchAll(/\bCASE\b\s+[^;]+\s+\bOF\b|\bCASE\b\s+[^;]+$/g)];
 cMatches.forEach(cm => {
 beginCount++;
 beginStack.push({ line: lnum, type: 'case', col: cm.index + 1 });
 });

 const eMatches = [...up.matchAll(/\bEND\b/g)];
 eMatches.forEach(() => {
 endCount++;
 if (beginStack.length > 0) beginStack.pop();
 else errors.push({ text: `Satır ${lnum}: Eşleşmeyen 'end' ifadesi`, line: lnum, suggestion: "Fazladan 'end' ifadesini kaldırın." });
 });

 // Procedure / Function bildirim sonu kontrolü
 if (/^(PROCEDURE|FUNCTION)\b/i.test(up)) {
 if (!up.endsWith(';') &&!up.endsWith('FORWARD;') &&!up.endsWith('EXTERNAL;')) {
 errors.push({ text: `Satır ${lnum}: '${rawTrim.slice(0, 45)}' bildiriminin sonunda ';' eksik`, line: lnum, suggestion: "Satır sonuna ';' ekleyin." });
 }
 }

 // Satır Sonu ';' (Noktalı Virgül) Eksikliği Tespiti
 // Eğer satır bir atama (:=), method çağrısı (qp.open) veya ifade içeriyor ve ';' ile bitmiyorsa
 // ve bir sonraki dolu satır 'else', 'end', 'until' değilse bu bir sözdizimi hatasıdır.
 const isStatementCandidate = (
!NON_SEMICOLON_LINE_STARTERS.test(up) &&
!NON_SEMICOLON_LINE_ENDERS.test(up) &&
!up.endsWith('.') &&
!up.startsWith('//') &&
!up.startsWith('{') &&
!up.startsWith('(*')
 );

 if (isStatementCandidate) {
 // Sonraki ilk dolu satırı bul
 let nextNonEmptyTrim = '';
 for (let nextIdx = lIdx + 1; nextIdx < strippedLines.length; nextIdx++) {
 const nt = strippedLines[nextIdx].trim();
 if (nt) {
 nextNonEmptyTrim = nt.toUpperCase();
 break;
 }
 }

 // Eğer sonraki satır 'ELSE' veya 'END' veya 'UNTIL' değilse ';' zorunludur
 if (nextNonEmptyTrim &&!/^(ELSE|END|UNTIL)\b/i.test(nextNonEmptyTrim)) {
 errors.push({
 text: `Satır ${lnum}: İfade sonunda ';' (noktalı virgül) eksik ➔ '${rawTrim}'`,
 line: lnum,
 suggestion: `Satır sonuna ';' ekleyin (Ör: ${rawTrim};)`
 });
 }
 }

 // '=' yerine ':=' kontrolü (atama yaparken tek eşittir kullanımı)
 if (!up.startsWith('IF') &&!up.startsWith('WHILE') &&!up.startsWith('CONST') &&!up.includes('=')) {
 // ok
 } else if (!/^(IF|WHILE|UNTIL|CASE|CONST)\b/i.test(up) &&!up.includes(':=') && /^[a-zA-Z0-9_\.]+\s*=\s*[^=]/i.test(up)) {
 warnings.push({
 text: `Satır ${lnum}: Atama işlemi için '=' yerine ':=' kullanılmalıdır.`,
 line: lnum,
 suggestion: "Atama operatörünü ':=' olarak düzeltin."
 });
 }
 });

 if (beginStack.length > 0) {
 const unclosed = beginStack[beginStack.length - 1];
 errors.push({ text: `Satır ${unclosed.line}: Açılan '${unclosed.type || 'begin'}' bloğu kapatılmamış`, line: unclosed.line, suggestion: "Bloğu uygun bir 'end;' ile kapatın." });
 }

 // ── RAPOR NESNE İSMİ UYUMSUZLUKLARI (Object / Component Inspector Çapraz Denetimi) ──
 const reportComponentNames = extractReportComponentNames(reportContext);
 if (reportComponentNames.size > 0) {
 // Script içindeki yerel 'var' tanımlamalarını ayıkla
 const declaredVars = new Set();
 const varSectionRx = /\bVAR\b([\s\S]+?)(?=\bBEGIN\b|\bPROCEDURE\b|\bFUNCTION\b|\bCONST\b|\bTYPE\b|$)/gi;
 let vm;
 while ((vm = varSectionRx.exec(code))!== null) {
 const decls = vm[1].split(';');
 decls.forEach(d => {
 const colonIdx = d.indexOf(':');
 if (colonIdx!== -1) {
 const varList = d.slice(0, colonIdx).split(',');
 varList.forEach(v => {
 const cleanV = v.trim().toUpperCase();
 if (cleanV) declaredVars.add(cleanV);
 });
 }
 });
 }

 // Standart Delphi / FastReport anahtar kelimeleri ve yerleşik nesneleri (Spesifik görsel sayfa isimleri hariç)
 const PASCAL_BUILTINS = new Set([
 'REPORT', 'ENGINE', 'SENDER', 'SELF', 'CANVAS', 'APPLICATION', 'SCREEN',
 'TRUNC', 'ROUND', 'INTTOSTR', 'STRTOINT', 'FLOATTOSTR', 'STRTOFLOAT', 'FORMATDATETIME',
 'NOW', 'DATE', 'TIME', 'INCMONTH', 'TRIM', 'COPY', 'POS', 'LENGTH', 'UPPERCASE', 'LOWERCASE',
 'SHOWMESSAGE', 'MESSAGEDLG', 'GET', 'SET', 'VARARRAYCREATE', 'VARARRAYOF', 'NULL', 'UNASSIGNED',
 'TRUE', 'FALSE', 'RESULT', 'ITEMS', 'LINES', 'TEXT', 'CAPTION', 'VALUE', 'CLOSE', 'OPEN',
 'TFRXMEMOVIEW', 'TFRXPICTUREVIEW', 'TFRXCHECKLISTBOXCONTROL', 'TFRXDBCHECKLISTBOXCONTROL',
 'TSTRINGLIST', 'TLIST', 'TOBJECT', 'COMPONENT', 'OWNER', 'MATH', 'SYSUTILS', 'CLASSES', 'FORMS'
 ]);

 const FR_BUILTIN_MAP = {
 REPORT: {
 label: 'Report',
 props: {
 PRINTOPTIONS: {
 label: 'PrintOptions',
 props: ['PRINTER', 'COPIES', 'DUPLEX', 'SHOWDIALOG', 'PRINTMODE', 'REVERSE', 'PAGENUMBERS', 'COLLATE']
 },
 REPORTOPTIONS: {
 label: 'ReportOptions',
 props: ['NAME', 'AUTHOR', 'DESCRIPTION', 'VERSIONBUILD', 'VERSIONMAJOR', 'VERSIONMINOR', 'GUID']
 },
 VARIABLES: { label: 'Variables', props: [] },
 PARAMS: { label: 'Params', props: [] },
 FILENAME: { label: 'FileName', props: [] },
 SCRIPTTEXT: { label: 'ScriptText', props: [] },
 PREPAREREPORT: { label: 'PrepareReport', props: [] },
 SHOWREPORT: { label: 'ShowReport', props: [] },
 DESIGNREPORT: { label: 'DesignReport', props: [] }
 }
 },
 ENGINE: {
 label: 'Engine',
 props: {
 STOPREPORT: { label: 'StopReport', props: [] },
 NEWPAGE: { label: 'NewPage', props: [] },
 NEWCOLUMN: { label: 'NewColumn', props: [] },
 SHOWBAND: { label: 'ShowBand', props: [] },
 CURX: { label: 'CurX', props: [] },
 CURY: { label: 'CurY', props: [] },
 PAGEWIDTH: { label: 'PageWidth', props: [] },
 PAGEHEIGHT: { label: 'PageHeight', props: [] }
 }
 }
 };

 function getLevenshteinDist(s1, s2) {
 const m = s1.length, n = s2.length;
 const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
 for (let i = 0; i <= m; i++) dp[i][0] = i;
 for (let j = 0; j <= n; j++) dp[0][j] = j;
 for (let i = 1; i <= m; i++) {
 for (let j = 1; j <= n; j++) {
 if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
 else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
 }
 }
 return dp[m][n];
 }

 const seenUnknowns = new Set();
 strippedLines.forEach((sLine, lIdx) => {
 const lnum = lIdx + 1;
 // Zincirleme Obje/Property kalıpları: ObjeAdi.Prop1 veya ObjeAdi.Prop1.Prop2
 const fullChainRx = /\b([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+)\b/g;
 let cm;
 while ((cm = fullChainRx.exec(sLine))!== null) {
 const rawChain = cm[1];
 const parts = rawChain.split('.');
 const rootObj = parts[0];
 const upperRoot = rootObj.toUpperCase();

 // 1. Report / Engine gibi yerleşik nesnelerin alt özellik denetimi
 if (FR_BUILTIN_MAP[upperRoot]) {
 const schema = FR_BUILTIN_MAP[upperRoot];
 if (parts.length >= 2) {
 const p1 = parts[1];
 const upperP1 = p1.toUpperCase();
 if (!schema.props[upperP1] &&!seenUnknowns.has(`${upperRoot}.${upperP1}`)) {
 seenUnknowns.add(`${upperRoot}.${upperP1}`);
 let closestP1 = '';
 let minDist = 999;
 for (const validProp of Object.keys(schema.props)) {
 const d = getLevenshteinDist(upperP1, validProp);
 if (d < minDist && d <= 3) {
 minDist = d;
 closestP1 = schema.props[validProp].label;
 }
 }
 errors.push({
 text: `Satır ${lnum}: Geçersiz '${schema.label}' Özelliği '${p1}'${closestP1? ` ➔ (Doğrusu: '${closestP1}')`: ''}`,
 line: lnum,
 token: p1,
 suggestion: closestP1? `'${p1}' yerine '${closestP1}' kullanın.`: `'${p1}' özelliğinin geçerli olduğundan emin olun.`
 });
 } else if (schema.props[upperP1] && parts.length >= 3) {
 // 3. Seviye alt özellik (Örn: Report.PrintOptions.Printer)
 const subSchema = schema.props[upperP1];
 const p2 = parts[2];
 const upperP2 = p2.toUpperCase();
 if (Array.isArray(subSchema.props) && subSchema.props.length > 0 &&!subSchema.props.includes(upperP2) &&!seenUnknowns.has(`${upperP1}.${upperP2}`)) {
 seenUnknowns.add(`${upperP1}.${upperP2}`);
 let closestP2 = '';
 let minDist = 999;
 for (const validSub of subSchema.props) {
 const d = getLevenshteinDist(upperP2, validSub);
 if (d < minDist && d <= 3) {
 minDist = d;
 closestP2 = validSub;
 }
 }
 errors.push({
 text: `Satır ${lnum}: Geçersiz '${subSchema.label}' Özelliği '${p2}'${closestP2? ` ➔ (Doğrusu: '${closestP2}')`: ''}`,
 line: lnum,
 token: p2,
 suggestion: closestP2? `'${p2}' yerine '${closestP2}' kullanın.`: `'${p2}' özelliğinin geçerli olduğundan emin olun.`
 });
 }
 }
 }
 continue;
 }

 if (PASCAL_BUILTINS.has(upperRoot) || declaredVars.has(upperRoot)) continue;

 // 2. Rapor tasarımındaki bileşenler arasında var mı?
 if (!reportComponentNames.has(upperRoot) &&!seenUnknowns.has(upperRoot)) {
 seenUnknowns.add(upperRoot);

 // Report / Engine için yazım hatası mı?
 let closest = '';
 if (getLevenshteinDist(upperRoot, 'REPORT') <= 2 || upperRoot === 'REPOR') {
 closest = 'Report';
 } else if (getLevenshteinDist(upperRoot, 'ENGINE') <= 2) {
 closest = 'Engine';
 } else {
 let minDistance = 999;
 for (const realComp of reportComponentNames) {
 if (realComp.startsWith(upperRoot) || upperRoot.startsWith(realComp)) {
 closest = realComp;
 break;
 }
 const dist = getLevenshteinDist(upperRoot, realComp);
 if (dist < minDistance && dist <= 3) {
 minDistance = dist;
 closest = realComp;
 }
 }
 }

 errors.push({
 text: `Satır ${lnum}: Tanımsız Rapor Nesnesi '${rootObj}' ➔ Rapor tasarımında '${rootObj}' adında bir nesne bulunamadı${closest? ` (Önerilen: '${closest}')`: ''}`,
 line: lnum,
 token: rootObj,
 suggestion: closest 
? `'${rootObj}' yerine '${closest}' kullanın.` 
: `'${rootObj}' nesnesinin rapor tasarımında var olduğundan emin olun.`
 });
 }
 }
 });
 }

 // ── PASCAL SCRIPT SONLANDIRMA (end. Nokta Kontrolü) ──
 const nonCommentLines = rawLines.map(l => l.replace(/\/\/.*$/, '').replace(/\{[^}]*\}/g, '').trim()).filter(Boolean);
 if (nonCommentLines.length > 0) {
 const lastLine = nonCommentLines[nonCommentLines.length - 1];
 const lastClean = lastLine.replace(/\s+/g, '').toUpperCase();
 if (lastClean === 'END' || lastClean === 'END;') {
 errors.push({
 text: `Satır ${rawLines.length}: PascalScript ana kod bloğu 'end.' (nokta) ile sonlandırılmalıdır. (Mevcut: '${lastLine}')`,
 line: rawLines.length,
 token: 'end.',
 suggestion: "Programın en sonundaki 'end' ifadesini 'end.' olarak tamamlayın."
 });
 }
 }

 return { errors, warnings };
 }

 function extractReportComponentNames(context) {
 const names = new Set();
 if (!context) {
 if (typeof window!== 'undefined' && window.currentFile) {
 context = window.currentFile;
 }
 }
 if (!context) return names;

 if (Array.isArray(context)) {
 context.forEach(n => { if (n && typeof n === 'string') names.add(n.toUpperCase()); });
 return names;
 }

 if (context.rawXml) {
 const nameMatches = context.rawXml.match(/\bName="([a-zA-Z0-9_]+)"/g) || [];
 nameMatches.forEach(m => {
 const val = m.replace(/^Name="|"$|"/g, '').trim().toUpperCase();
 if (val) names.add(val);
 });
 }

 if (Array.isArray(context.pages)) {
 context.pages.forEach(p => {
 if (p.name) names.add(p.name.toUpperCase());
 (p.bands || []).forEach(b => {
 if (b.name) names.add(b.name.toUpperCase());
 (b.objects || []).forEach(o => { if (o.name) names.add(o.name.toUpperCase()); });
 });
 });
 }

 if (Array.isArray(context.dialogPages)) {
 context.dialogPages.forEach(d => {
 if (d.name) names.add(d.name.toUpperCase());
 (d.controls || []).forEach(c => {
 if (c.name) names.add(c.name.toUpperCase());
 (c.children || []).forEach(ch => { if (ch.name) names.add(ch.name.toUpperCase()); });
 });
 });
 }

 if (Array.isArray(context.queries)) {
 context.queries.forEach(q => { if (q.name) names.add(q.name.toUpperCase()); });
 }

 if (Array.isArray(context.datasets)) {
 context.datasets.forEach(ds => { if (ds.name) names.add(ds.name.toUpperCase()); });
 }

 return names;
 }

 function checkSqlStaticSyntax(sql) {
 const errors = [], warnings = [], securityRisks = [];
 if (!sql ||!sql.trim()) return { errors, warnings, securityRisks };

 const upper = sql.toUpperCase()
.replace(/--[^\n]*/g, '')
.replace(/\/\*[\s\S]*?\*\//g, '')
.replace(/'(?:''|[^'\r\n])*'/g, "''");

 const hasAggregates = /\b(AVG|SUM|COUNT|MIN|MAX)\s*\(/i.test(upper);
 const hasGroupBy = /\bGROUP\s+BY\b/i.test(upper);
 const hasSelect = /\bSELECT\b/i.test(upper);
 const hasWhere = /\bWHERE\b/i.test(upper);
 const hasDelete = /\bDELETE\s+FROM\b/i.test(upper) || /\bDELETE\b\s+[a-zA-Z0-9_#]+/i.test(upper);
 const hasUpdate = /\bUPDATE\b\s+[a-zA-Z0-9_#]+\s+SET\b/i.test(upper);

 // ── GÜVENLİK VE RİSK DENETİMİ (Security Auditing) ──────────────
 // 1. DROP / TRUNCATE / ALTER / DDL Denetimi
 if (/\bDROP\s+(TABLE|DATABASE|VIEW|PROCEDURE|INDEX|SCHEMA)\b/i.test(upper)) {
 securityRisks.push({
 level: 'CRITICAL',
 badge: ' KRİTİK',
 title: 'DROP Komutu Tespit Edildi',
 text: "Sorgu içerisinde tablo veya nesne silmeye yönelik 'DROP' komutu bulundu. Raporlama sorgularında şema silme komutları son derece tehlikelidir!"
 });
 }

 if (/\bTRUNCATE\s+TABLE\b/i.test(upper)) {
 securityRisks.push({
 level: 'CRITICAL',
 badge: ' KRİTİK',
 title: 'TRUNCATE Komutu Tespit Edildi',
 text: "Tabloyu tamamen boşaltan 'TRUNCATE' komutu tespit edildi. Rapor sorguları salt-okunur (read-only) olmalıdır!"
 });
 }

 if (/\bALTER\s+TABLE\b/i.test(upper)) {
 securityRisks.push({
 level: 'HIGH',
 badge: '⚠️ YÜKSEK',
 title: 'ALTER TABLE Komutu Tespit Edildi',
 text: "Veritabanı tablosunun yapısını değiştiren 'ALTER TABLE' komutu bulundu."
 });
 }

 if (/\b(GRANT|REVOKE)\b/i.test(upper)) {
 securityRisks.push({
 level: 'HIGH',
 badge: '⚠️ YÜKSEK',
 title: 'Yetki Değiştirme Komutu Tespit Edildi',
 text: "Kullanıcı yetkisi tanımlayan/kaldıran GRANT/REVOKE komutu tespit edildi."
 });
 }

 // 2. WHERE'siz DELETE veya UPDATE (Veri Kaybı Riski)
 if (hasDelete &&!hasWhere) {
 securityRisks.push({
 level: 'CRITICAL',
 badge: ' KRİTİK',
 title: "WHERE Koşulsuz DELETE!",
 text: "DELETE sorgusu herhangi bir WHERE koşulu içermiyor! Tablodaki tüm kayıtların silinmesine neden olabilir."
 });
 }

 if (hasUpdate &&!hasWhere) {
 securityRisks.push({
 level: 'HIGH',
 badge: '⚠️ YÜKSEK',
 title: "WHERE Koşulsuz UPDATE!",
 text: "UPDATE sorgusu WHERE koşulu içermiyor! Tablodaki tüm satırların güncellenmesine neden olabilir."
 });
 }

 // 3. Kartezyen Çarpım (Cartesian Product) Uyarısı
 if (hasSelect && upper.includes(' FROM ') &&!upper.includes(' JOIN ') && upper.split(' FROM ')[1]?.split(/\b(WHERE|GROUP|ORDER|HAVING)\b/)[0]?.includes(',')) {
 warnings.push("Birden fazla tablo virgülle birleştirilmiş fakat JOIN sözcüğü kullanılmamış. Kartezyen çarpım (Cross Join) ve performans sorunlarına yol açabilir.");
 }

 // 4. Standart Sözdizimi Kontrolleri
 if (hasAggregates &&!hasGroupBy && hasSelect) {
 warnings.push("Aggregate fonksiyonu (SUM, COUNT vb.) ile normal kolonlar birlikte kullanılıyor olabilir ancak GROUP BY bulunamadı.");
 }

 if (hasSelect &&!/\bFROM\b/i.test(upper)) {
 errors.push("SELECT ifadesi bulundu fakat FROM anahtar sözcüğü eksik.");
 }

 // 5. Parantez Bütünlüğü Kontrolü
 let openCount = 0;
 for (let i = 0; i < upper.length; i++) {
 if (upper[i] === '(') openCount++;
 else if (upper[i] === ')') {
 openCount--;
 if (openCount < 0) {
 errors.push("SQL sorgusunda fazladan kapatma parantezi ')' bulundu.");
 break;
 }
 }
 }
 if (openCount > 0) {
 errors.push(`SQL sorgusunda ${openCount} adet açılan parantez '(' kapatılmamış.`);
 }

 return { errors, warnings, securityRisks };
 }

 /**
 * FRP Dosya Bütünlüğü ve Güvenlik Denetimi
 */
 function validateFrpFileContent(file, rawBytesOrText) {
 const results = {
 isValid: true,
 errors: [],
 warnings: [],
 fileSizeMb: (file.size / (1024 * 1024)).toFixed(2)
 };

 if (!file) {
 results.isValid = false;
 results.errors.push('Dosya nesnesi bulunamadı.');
 return results;
 }

 if (file.size === 0) {
 results.isValid = false;
 results.errors.push('Dosya boş (0 bayt). Lütfen geçerli bir.frp rapor dosyası seçin.');
 return results;
 }

 if (file.size > 50 * 1024 * 1024) {
 results.warnings.push(`Dosya boyutu (${results.fileSizeMb} MB) oldukça büyük. Ayrıştırma süresi uzayabilir.`);
 }

 const fileName = (file.name || '').toLowerCase();
 if (!fileName.endsWith('.frp') &&!fileName.endsWith('.fr3') &&!fileName.endsWith('.xml')) {
 results.warnings.push(`Dosya uzantısı '.frp' yerine '${file.name.split('.').pop()}' görünüyor. FastReport standardı olmayabilir.`);
 }

 return results;
 }

 window.FrpSyntaxCheck = {
 checkPascalSyntax,
 checkSqlStaticSyntax,
 validateFrpFileContent
 };
})();
