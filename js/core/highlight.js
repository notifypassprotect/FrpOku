// SQL & PascalScript Kapsamlı Yanlış Yazılmış (Typo) Anahtar Kelimeler Sözlüğü
const SQL_TYPO_MAP = new Map([
  ['FROS', 'FROM'], ['FRO', 'FROM'], ['FORM', 'FROM'], ['FROMM', 'FROM'], ['FRM', 'FROM'],
  ['SELEC', 'SELECT'], ['SELECTT', 'SELECT'], ['SELCT', 'SELECT'], ['SLECT', 'SELECT'], ['SLCT', 'SELECT'], ['SELECKT', 'SELECT'],
  ['WHER', 'WHERE'], ['WHEREE', 'WHERE'], ['WHERR', 'WHERE'], ['HER', 'WHERE'], ['WHRE', 'WHERE'], ['WHEREF', 'WHERE'],
  ['JOING', 'JOIN'], ['JOINN', 'JOIN'], ['JON', 'JOIN'], ['JION', 'JOIN'], ['JOI', 'JOIN'],
  ['GRUP', 'GROUP'], ['GROU', 'GROUP'], ['GORUP', 'GROUP'], ['GROPU', 'GROUP'], ['GROP', 'GROUP'],
  ['ORDERB', 'ORDER BY'], ['ORDE', 'ORDER'], ['ODER', 'ORDER'], ['ORDRE', 'ORDER'], ['ORDAR', 'ORDER'],
  ['HAVIN', 'HAVING'], ['HAVNG', 'HAVING'], ['HAVN', 'HAVING'], ['HAIVNG', 'HAVING'],
  ['DISTINC', 'DISTINCT'], ['DISTICNT', 'DISTINCT'], ['DISTINCTT', 'DISTINCT'], ['DISTINCKT', 'DISTINCT'],
  ['CAS', 'CASE'], ['WHE', 'WHEN'], ['ELS', 'ELSE'], ['EN', 'END'],
  ['EXIS', 'EXISTS'], ['EXIST', 'EXISTS'], ['EXISST', 'EXISTS'],
  ['UPDAT', 'UPDATE'], ['DELET', 'DELETE'], ['DELETT', 'DELETE'], ['INSERTT', 'INSERT'], ['INSER', 'INSERT'],
  ['BETYEEN', 'BETWEEN'], ['BETWEN', 'BETWEEN'], ['BTWEEN', 'BETWEEN'],
  ['OUTE', 'OUTER'], ['INNE', 'INNER'], ['INNRE', 'INNER'],
  ['VALUS', 'VALUES'], ['VALUE', 'VALUES'], ['VALUSE', 'VALUES'],
  ['COALESE', 'COALESCE'], ['COALESSE', 'COALESCE'], ['COALES', 'COALESCE'],
  ['UNON', 'UNION'], ['UNIONN', 'UNION']
]);

const PAS_TYPO_MAP = new Map([
  ['BEGN', 'BEGIN'], ['BEGINN', 'BEGIN'], ['BGIN', 'BEGIN'], ['BEGİN', 'BEGIN'], ['BEGGING', 'BEGIN'], ['BEGING', 'BEGIN'],
  ['EN', 'END'], ['ENDD', 'END'], ['ENND', 'END'], ['EDN', 'END'],
  ['PROC', 'PROCEDURE'], ['PROCEDUR', 'PROCEDURE'], ['PROSEDUR', 'PROCEDURE'], ['PROSEDÜR', 'PROCEDURE'], ['PROCDURE', 'PROCEDURE'], ['PROCEDUREE', 'PROCEDURE'], ['PROCEDR', 'PROCEDURE'], ['PROCDUR', 'PROCEDURE'],
  ['FUNC', 'FUNCTION'], ['FUNCTON', 'FUNCTION'], ['FUNCTIN', 'FUNCTION'], ['FUNTION', 'FUNCTION'], ['FONKSIYON', 'FUNCTION'], ['FONKSİYON', 'FUNCTION'], ['FUNTİON', 'FUNCTION'], ['FUNCTIONN', 'FUNCTION'],
  ['VARIALBE', 'VAR'], ['VRA', 'VAR'], ['VR', 'VAR'],
  ['INTEGAR', 'INTEGER'], ['INTEGIR', 'INTEGER'], ['INTGER', 'INTEGER'], ['INTEEGER', 'INTEGER'],
  ['STRNG', 'STRING'], ['STRINGG', 'STRING'], ['STRIGN', 'STRING'], ['STRG', 'STRING'],
  ['BOLEAN', 'BOOLEAN'], ['BOOL', 'BOOLEAN'], ['BOOLEANN', 'BOOLEAN'], ['BOL', 'BOOLEAN'],
  ['THN', 'THEN'], ['TEHN', 'THEN'],
  ['ESLE', 'ELSE'], ['ELSEE', 'ELSE'], ['ELZ', 'ELSE'],
  ['IFTHEN', 'IF ... THEN'],
  ['REPET', 'REPEAT'], ['REPEATT', 'REPEAT'],
  ['UNTI', 'UNTIL'], ['UNTLL', 'UNTIL'],
  ['WHIL', 'WHILE'], ['WHLE', 'WHILE'],
  ['MSGDLG', 'MessageDlg'], ['MESSAGEDLGG', 'MessageDlg'], ['MSGDLGG', 'MessageDlg'],
  ['STRTOITN', 'StrToInt'], ['INTTOSTRR', 'IntToStr'], ['STRTOFLOT', 'StrToFloat'],
  ['STRINGREPLCE', 'StringReplace'], ['STRREPLACE', 'StringReplace'],
  ['MODALRSULT', 'ModalResult'], ['MODALRESUT', 'ModalResult'], ['MODALRESLT', 'ModalResult'], ['MODALRESLUT', 'ModalResult'], ['MODLRESULT', 'ModalResult'],
  ['VISBLE', 'Visible'], ['VISIBL', 'Visible'], ['ENBLED', 'Enabled'], ['ENABLE', 'Enabled'],
  ['CHEKED', 'Checked'], ['CHECKT', 'Checked'], ['CAPTN', 'Caption'], ['STOPREPOT', 'StopReport'],
  ['QUOTEDSTRR', 'QuotedStr'], ['QUOTEDST', 'QuotedStr']
]);

const PAS_KEYWORD_LIST = [
  'PROCEDURE', 'FUNCTION', 'BEGIN', 'END', 'VAR', 'CONST', 'TYPE', 'INTEGER', 'STRING', 'BOOLEAN', 
  'DOUBLE', 'EXTENDED', 'DATETIME', 'TDATETIME', 'TDATE', 'TTIME', 'DATE', 'TIME', 'NOW', 'ARRAY', 'RECORD', 
  'PROGRAM', 'USES', 'IF', 'THEN', 'ELSE', 'WHILE', 'FOR', 'DO', 'REPEAT', 'UNTIL', 'TRY', 'EXCEPT', 
  'FINALLY', 'CASE', 'OF', 'EXIT', 'BREAK', 'CONTINUE', 'MOD', 'DIV', 'NOT', 'AND', 'OR', 'XOR', 'NIL', 
  'TRUE', 'FALSE', 'RESULT', 'SELF', 'INHERITED', 'CHAR', 'BYTE', 'WORD', 'LONGINT', 'INT64', 'CARDINAL',
  'SHORTINT', 'SMALLINT', 'VARIANT', 'OLEVARIANT', 'REAL', 'SINGLE',
  'MESSAGEDLG', 'MESSAGEBOX', 'SHOWMESSAGE', 'INPUTQUERY', 'STRINGREPLACE', 'FORMATDATETIME', 
  'STRTOINT', 'INTTOSTR', 'FLOATTOSTR', 'STRTOFLOAT', 'STRTODATE', 'DATETOSTR', 'STRTODATETIME',
  'LENGTH', 'COPY', 'POS', 'TRIM', 'UPPERCASE', 'LOWERCASE', 'DELETE', 'INSERT', 'ROUND', 'TRUNC',
  'ABS', 'FRAC', 'INT', 'ENCODEDATE', 'DAYOFWEEK', 'FORMATFLOAT', 'QUOTEDSTR',
  'TFRXCOMPONENT', 'TFRXMEMOVIEW', 'REPORT', 'ENGINE', 'DIALOGPAGE', 'PAGE', 'SENDER', 'KEY', 'SHIFT',
  'MRNONE', 'MROK', 'MRCANCEL', 'MRYES', 'MRNO', 'MRABORT', 'MRRETRY', 'MRIGNORE',
  'OPEN', 'CLOSE', 'FETCHALL', 'EXECSQL',
  'MODALRESULT', 'VISIBLE', 'ENABLED', 'CHECKED', 'CAPTION', 'SQLTEXT', 'KEYVALUE', 'TEXT', 
  'STOPREPORT', 'CHECKALL', 'UNCHECKALL', 'ITEMINDEX', 'ROWCOUNT', 'COLCOUNT', 'CLEAR',
  'FIELDVALUES', 'FIELDVALUE', 'PARAMBYNAME', 'VALUE', 'PARAMCOUNT', 'PARAMS', 'DATASET',
  'RECORDCOUNT', 'EOF', 'BOF', 'FIRST', 'NEXT', 'LAST', 'FINDOBJECT', 'SHOWMODAL', 'ADDOBJECT', 
  'ADDITEM', 'LINES', 'ITEMS', 'COUNT', 'FONT', 'COLOR', 'WIDTH', 'HEIGHT', 'TOP', 'LEFT', 'TAG', 'HINT', 'PARENT'
];

const SQL_KEYWORD_LIST = [
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'INSERT', 'UPDATE', 'DELETE', 'JOIN', 
  'INNER', 'LEFT', 'RIGHT', 'OUTER', 'CROSS', 'DISTINCT', 'BETWEEN', 'UNION', 'COALESCE', 'NVL', 
  'NVL2', 'TRUNC', 'SUBSTR', 'COUNT', 'SUM', 'AVG', 'ROUND', 'CONNECT', 'PRIOR', 'START', 
  'MATCHED', 'MERGE', 'RETURNING', 'EXISTS', 'VALUES', 'TABLE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'CAST', 'CONVERT', 'EXTRACT', 'DECODE', 'LISTAGG', 'XMLAGG', 'ROW_NUMBER', 'RANK', 'DENSE_RANK',
  'OVER', 'PARTITION', 'TO_CHAR', 'TO_DATE', 'TO_NUMBER', 'SYSDATE', 'DUAL', 'ROWNUM', 'SUBSTRING',
  'REPLACE', 'TRIM', 'LTRIM', 'RTRIM', 'INSTR', 'LENGTH', 'GREATEST', 'LEAST', 'NULLIF', 'MIN', 'MAX',
  'WITH', 'AS', 'ON', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'ILIKE', 'INTERSECT', 'MINUS', 'EXCEPT'
];

const SQL_KW = new Set([
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','ON','JOIN','LEFT','RIGHT','INNER','OUTER',
  'FULL','CROSS','UNION','ALL','DISTINCT','AS','WITH','GROUP','BY','ORDER','HAVING','LIMIT','OFFSET',
  'INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','DROP','ALTER','CASE','WHEN',
  'THEN','ELSE','END','IS','NULL','BETWEEN','LIKE','EXISTS','MERGE','MATCHED','USING','CONNECT',
  'START','PRIOR','PIVOT','UNPIVOT','RETURNING','BULK','COLLECT','FOR','DUAL','CAST','EXTRACT'
]);

const SQL_FN = new Set([
  'COUNT','SUM','MIN','MAX','AVG','ROUND','TRUNC','COALESCE','NVL','NVL2','TO_CHAR','TO_DATE','CAST',
  'CONCAT','SUBSTR','LENGTH','UPPER','LOWER','TRIM','RTRIM','LTRIM','REPLACE','DECODE',
  'DATEADD','DATEDIFF','SYSDATE','CURRENT_DATE','ROWNUM','ROW_NUMBER','RANK','DENSE_RANK','LEAD',
  'LAG','OVER','PARTITION','TO_NUMBER','TO_TIMESTAMP','EXTRACT','SUBSTRING',
  'LISTAGG','XMLAGG','XMLELEMENT','REGEXP_LIKE','REGEXP_SUBSTR','REGEXP_REPLACE','REGEXP_INSTR',
  'GREATEST','LEAST','NULLIF','INSTR','MOD','ABS','FLOOR','CEIL','ADD_MONTHS','MONTHS_BETWEEN',
  'LAST_DAY','NEXT_DAY','SYS_GUID'
]);

function levenshteinDist(a, b) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;
  const v0 = new Array(lb + 1);
  const v1 = new Array(lb + 1);
  for (let i = 0; i <= lb; i++) v0[i] = i;
  for (let i = 0; i < la; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < lb; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= lb; j++) v0[j] = v1[j];
  }
  return v0[lb];
}

function findFuzzyTypoMatch(word, lang = 'pascal') {
  const up = word.toUpperCase();
  if (up.length < 3) return null;

  // 1. Zaten geçerli bir anahtar kelime veya standart fonksiyon ise kesinlikle hata değil
  if (lang === 'sql') {
    if (SQL_KW.has(up) || SQL_FN.has(up) || SQL_KEYWORD_LIST.includes(up)) return null;
  } else {
    if (PAS_KW.has(up) || PAS_TYPE.has(up) || PAS_KEYWORD_LIST.includes(up)) return null;
  }

  // 2. Statik typo sözlüğüne bak (Örn: SELEC -> SELECT, CAS -> CASE)
  const staticMap = lang === 'pascal' ? PAS_TYPO_MAP : SQL_TYPO_MAP;
  if (staticMap.has(up)) {
    const sFix = staticMap.get(up);
    if (sFix.toUpperCase() !== up) return sFix;
  }

  // 4 harf ve daha kısa kelimelerde rastgele kolon/tablo isimlerinin yanlış eşleşmesini engelle
  if (up.length <= 4) return null;

  // Sayı, hex, DialogPage1 gibi bileşen kontrolü
  if (/^\d+$/.test(up) || /^0X[0-9A-F]+$/.test(up) || /\d$/.test(up)) return null;

  const targetList = lang === 'pascal' ? PAS_KEYWORD_LIST : SQL_KEYWORD_LIST;
  let bestMatch = null;
  let minDistance = 999;

  for (const kw of targetList) {
    if (kw.length <= 4) continue;
    if (Math.abs(kw.length - up.length) > 2) continue;

    const dist = levenshteinDist(up, kw);
    const maxAllowed = kw.length <= 6 ? 1 : 2;

    if (dist <= maxAllowed && dist < minDistance) {
      minDistance = dist;
      bestMatch = kw;
    }
  }

  return bestMatch;
}

const FRX_EVENTS = [
  'OnClick', 'OnDblClick', 'OnChange', 'OnEnter', 'OnExit', 
  'OnKeyDown', 'OnKeyPress', 'OnKeyUp', 
  'OnMouseDown', 'OnMouseMove', 'OnMouseUp', 'OnMouseEnter', 'OnMouseLeave',
  'OnActivate', 'OnDeactivate', 'OnShow', 'OnHide', 'OnCloseQuery', 'OnResize',
  'OnBeforePrint', 'OnAfterPrint', 'OnAfterData', 'OnContentChanged',
  'OnPreviewClick', 'OnPreviewDblClick',
  'OnStartReport', 'OnStopReport', 'OnManualBuild', 'OnMasterDetail', 'OnProgress', 'OnReportPrint'
];

function findFastReportEventTypo(procName) {
  if (!procName || procName.length < 5) return null;

  // Yakala: 'Button1OnClick', 'Button20nClick', 'CheckBox1OnClck', 'Edit1OnKeyPres', 'DialogPage1OnKeyDow', vb.
  // Açgözlü (greedy) eşleşme ile sondaki en son On veya 0n parçasını yakala (Örn: 'Button' içindeki 'on' değil)
  const match = /^(.*?)(?:(0[nN]|[oO][nN])([a-zA-Z0-9_]*))$/.exec(procName);
  const greedyMatch = /^(.*)(0[nN]|[oO][nN])([a-zA-Z0-9_]*)$/.exec(procName);
  const m = greedyMatch || match;
  if (!m) return null;

  const prefix = m[1];
  let rawEvent = 'On' + (m[3] || '');
  const rawUpper = rawEvent.toUpperCase();

  // Zaten tam ve geçerli bir FastReport Event'i ise ve sıfır (0n) ile yazılmamışsa hata yok
  const exact = FRX_EVENTS.find(e => e.toUpperCase() === rawUpper);
  if (exact) {
    if (m[2] === '0n' || m[2] === '0N') {
      return {
        original: procName,
        suggested: prefix + exact,
        eventName: exact,
        reason: `'0' (sıfır) yerine 'O' harfi yazılmalı`
      };
    }
    return null; // Tam geçerli event
  }

  // FastReport Event sözlüğünde Levenshtein mesafesine göre en yakın olayı bul
  let bestEvent = null;
  let minDistance = 999;

  for (const ev of FRX_EVENTS) {
    const evUpper = ev.toUpperCase();
    if (Math.abs(evUpper.length - rawUpper.length) > 2) continue;
    const dist = levenshteinDist(rawUpper, evUpper);
    const maxAllowed = ev.length <= 6 ? 1 : 2;

    if (dist <= maxAllowed && dist < minDistance) {
      minDistance = dist;
      bestEvent = ev;
    }
  }

  if (bestEvent) {
    return {
      original: procName,
      suggested: prefix + bestEvent,
      eventName: bestEvent,
      reason: `FastReport Olayı: '${bestEvent}'`
    };
  }

  return null;
}

window.FRX_EVENTS = FRX_EVENTS;
window.findFastReportEventTypo = findFastReportEventTypo;
window.findFuzzyTypoMatch = findFuzzyTypoMatch;
window.PAS_TYPO_MAP = PAS_TYPO_MAP;
window.SQL_TYPO_MAP = SQL_TYPO_MAP;

/**
 * Highlight SQL code — returns HTML string with syntax error badges
 */
function highlightSQL(raw) {
  if (!raw) return '';
  let out = '';
  let i = 0;
  const len = raw.length;

  while (i < len) {
    // -- single line comment
    if (raw[i] === '-' && raw[i+1] === '-') {
      let j = i;
      while (j < len && raw[j] !== '\n') j++;
      out += `<span class="sql-comment">${esc(raw.slice(i, j))}</span>`;
      i = j; continue;
    }
    // /* block comment */
    if (raw[i] === '/' && raw[i+1] === '*') {
      let j = i + 2;
      while (j < len && !(raw[j] === '*' && raw[j+1] === '/')) j++;
      j += 2;
      out += `<span class="sql-comment">${esc(raw.slice(i, j))}</span>`;
      i = j; continue;
    }
    // 'string'
    if (raw[i] === "'") {
      let j = i + 1;
      while (j < len) {
        if (raw[j] === "'" && raw[j+1] === "'") { j += 2; continue; }
        if (raw[j] === "'") { j++; break; }
        j++;
      }
      out += `<span class="sql-string">${esc(raw.slice(i, j))}</span>`;
      i = j; continue;
    }
    // :param
    if (raw[i] === ':' && i+1 < len && /\w/.test(raw[i+1])) {
      let j = i + 1;
      while (j < len && /\w/.test(raw[j])) j++;
      out += `<span class="sql-param">${esc(raw.slice(i, j))}</span>`;
      i = j; continue;
    }

    // dot-number invalid member reference check (e.g. lo.1 or alias.0)
    if (raw[i] === '.' && i+1 < len && /\d/.test(raw[i+1]) && i > 0 && /[a-zA-Z_]/.test(raw[i-1])) {
      let j = i + 1;
      while (j < len && /\d/.test(raw[j])) j++;
      const numPart = raw.slice(i+1, j);
      out += `.<span class="syntax-error" title="⚠️ Hatalı Kolon / Alias İfadesi: '.${numPart}' (Sayısal kolon alias'ı olmaz)">${esc(numPart)}</span>`;
      i = j; continue;
    }

    // number
    if (/\d/.test(raw[i]) && (i === 0 || !/\w/.test(raw[i-1]))) {
      let j = i;
      while (j < len && /[\d.]/.test(raw[j])) j++;
      out += `<span class="sql-number">${esc(raw.slice(i, j))}</span>`;
      i = j; continue;
    }
    // word or identifier
    if (/[a-zA-Z_]/.test(raw[i])) {
      let j = i;
      while (j < len && /\w/.test(raw[j])) j++;
      const word = raw.slice(i, j);
      const up = word.toUpperCase();

      // Check if this word is followed by a dot '.' with no valid field/character after it (e.g. "aa." before space/newline/comma/keyword)
      if (j < len && raw[j] === '.') {
        const afterDot = raw.slice(j + 1);
        const isHanging = /^(?:\s*[\r\n,);]|\s+(?:FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|SELECT|GROUP|ORDER|HAVING|UNION|AND|OR|ON)\b|$)/i.test(afterDot);
        if (isHanging) {
          out += `<span class="syntax-error" title="⚠️ Eksik Kolon Adı: '${esc(word)}.' sonrasında alan adı veya '*' belirtilmemiş">${esc(word)}.</span>`;
          i = j + 1;
          continue;
        }
      }

      if (SQL_TYPO_MAP.has(up)) {
        const fix = SQL_TYPO_MAP.get(up);
        out += `<span class="syntax-error" title="⚠️ Yazım Hatası (Typo): '${esc(word)}' -> Doğrusu: '${fix}'">${esc(word)}</span>`;
      } else if (SQL_KW.has(up)) {
        out += `<span class="sql-keyword">${esc(word)}</span>`;
      } else if (SQL_FN.has(up)) {
        out += `<span class="sql-fn">${esc(word)}</span>`;
      } else {
        out += esc(word);
      }
      i = j; continue;
    }
    // operators
    if (/[=<>!(),.;*+\-\/]/.test(raw[i])) {
      out += `<span class="sql-operator">${esc(raw[i])}</span>`;
      i++; continue;
    }
    out += esc(raw[i]);
    i++;
  }
  return out;
}

// ============================================================
//  Pascal Highlighter
// ============================================================
const PAS_KW = new Set([
  'BEGIN','END','IF','THEN','ELSE','FOR','TO','DO','WHILE','REPEAT','UNTIL',
  'VAR','CONST','TYPE','PROCEDURE','FUNCTION','PROGRAM','USES','UNIT','INTERFACE',
  'IMPLEMENTATION','INITIALIZATION','FINALIZATION','TRY','EXCEPT','FINALLY',
  'RAISE','WITH','AND','OR','NOT','IN','IS','AS','NIL','TRUE','FALSE','INHERITED',
  'OVERRIDE','VIRTUAL','ABSTRACT','PROPERTY','READ','WRITE','CLASS','OBJECT',
  'ARRAY','OF','RECORD','CASE','RESULT','EXIT','BREAK','CONTINUE','DOWNTO',
  'MOD','DIV','SHL','SHR','XOR','SET','GOTO','LABEL'
]);

const PAS_TYPE = new Set([
  'INTEGER','STRING','BOOLEAN','REAL','DOUBLE','SINGLE','CHAR','BYTE','WORD',
  'LONGINT','INT64','CARDINAL','SHORTINT','SMALLINT','TDATETIME','TDATE',
  'TFRXCOMPONENT','TSTRING','TSTRINGLIST','TLIST','TARRAY','VARIANT','OLEVARIANT'
]);

/**
 * Highlight PascalScript code — returns HTML string
 */
function highlightPascal(raw) {
  if (!raw) return '';
  let out = '';
  let i = 0;
  const len = raw.length;

  while (i < len) {
    // { block comment }
    if (raw[i] === '{') {
      let j = i + 1;
      while (j < len && raw[j] !== '}') j++;
      j++;
      out += `<span class="pas-comment">${esc(raw.slice(i, j))}</span>`;
      i = j; continue;
    }
    // // line comment
    if (raw[i] === '/' && raw[i+1] === '/') {
      let j = i;
      while (j < len && raw[j] !== '\n') j++;
      out += `<span class="pas-comment">${esc(raw.slice(i, j))}</span>`;
      i = j; continue;
    }
    // (* comment *)
    if (raw[i] === '(' && raw[i+1] === '*') {
      let j = i + 2;
      while (j < len && !(raw[j] === '*' && raw[j+1] === ')')) j++;
      j += 2;
      out += `<span class="pas-comment">${esc(raw.slice(i, j))}</span>`;
      i = j; continue;
    }
    // 'string'
    if (raw[i] === "'") {
      let j = i + 1;
      while (j < len) {
        if (raw[j] === "'" && raw[j+1] === "'") { j += 2; continue; }
        if (raw[j] === "'") { j++; break; }
        j++;
      }
      out += `<span class="pas-string">${esc(raw.slice(i, j))}</span>`;
      i = j; continue;
    }
    // number
    if (/\d/.test(raw[i]) && (i === 0 || !/\w/.test(raw[i-1]))) {
      let j = i;
      while (j < len && /[\d.]/.test(raw[j])) j++;
      out += `<span class="pas-number">${esc(raw.slice(i, j))}</span>`;
      i = j; continue;
    }
    // word
    if (/[a-zA-Z_]/.test(raw[i])) {
      let j = i;
      while (j < len && /\w/.test(raw[j])) j++;
      const word = raw.slice(i, j);
      const up = word.toUpperCase();
      if (PAS_TYPO_MAP.has(up)) {
        const fix = PAS_TYPO_MAP.get(up);
        out += `<span class="syntax-error" title="⚠️ Yazım Hatası: '${esc(word)}' -> Doğrusu: '${fix}'">${esc(word)}</span>`;
      } else if (PAS_KW.has(up)) {
        out += `<span class="pas-keyword">${esc(word)}</span>`;
      } else if (PAS_TYPE.has(up)) {
        out += `<span class="pas-type">${esc(word)}</span>`;
      } else {
        out += esc(word);
      }
      i = j; continue;
    }
    // :=
    if (raw[i] === ':' && raw[i+1] === '=') {
      out += `<span class="pas-special">:=</span>`;
      i += 2; continue;
    }
    if (':;.'.includes(raw[i])) {
      out += `<span class="pas-special">${esc(raw[i])}</span>`;
      i++; continue;
    }
    out += esc(raw[i]);
    i++;
  }
  return out;
}

/**
 * Advanced Syntax Errors Finder / Linter — returns array of error objects
 */
function findSyntaxErrors(code, lang = 'sql') {
  if (!code || !code.trim()) return [];
  const errors = [];
  const lines = code.split('\n');

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;

    // Yorum ve string içeriğini temizle (kod dışı metinlerin taranmaması için)
    const cleanLineText = lineText
      .replace(/'(?:''|[^'\r\n])*'/g, "''")
      .replace(/\/\/[^\r\n]*/g, '')
      .replace(/--[^\r\n]*/g, '')
      .replace(/\{[^\r\n]*\}/g, '');

    // 1. Zeki Kelime Bazlı Yazım Hatası & Typo Taraması (Statik + Levenshtein Fuzzy)
    const wordRx = /\b[a-zA-Z_]\w*\b/g;
    let wm;
    while ((wm = wordRx.exec(cleanLineText)) !== null) {
      const w = wm[0];
      const match = findFuzzyTypoMatch(w, lang);
      if (match) {
        if (!errors.some(e => e.line === lineNum && e.token.toUpperCase() === w.toUpperCase())) {
          errors.push({
            line: lineNum,
            col: wm.index + 1,
            token: w,
            suggestion: match,
            message: `${lang === 'pascal' ? 'PascalScript' : 'SQL'} Yazım Hatası: '${w}' yerine '${match}' yazılmalı.`
          });
        }
      }
    }

    if (lang === 'sql') {
      // 2a. Hanging / Incomplete dot reference (e.g. "aa." before space+keyword, newline, comma, closing paren, or end of line)
      const hangingDotRx = /\b([a-zA-Z_]\w*)\.\s*(?=[,\r\n);]|\s+(?:FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|SELECT|GROUP|ORDER|HAVING|UNION|AND|OR|ON)\b|$)/gi;
      let hm;
      while ((hm = hangingDotRx.exec(cleanLineText)) !== null) {
        errors.push({
          line: lineNum,
          col: hm.index + 1,
          token: `${hm[1]}.`,
          suggestion: `${hm[1]}.kolon_adi veya ${hm[1]}.*`,
          message: `Eksik Kolon / Alan Adı: '${hm[1]}.' ifadesinden sonra bir kolon adı veya '*' belirtilmemiş.`
        });
      }

      // 2b. Member/column reference with invalid digit like lo.1
      const dotNumRx = /\b([a-zA-Z_]\w*)\.(\d+)\b/g;
      let dm;
      while ((dm = dotNumRx.exec(cleanLineText)) !== null) {
        errors.push({
          line: lineNum,
          col: dm.index + 1,
          token: dm[0],
          suggestion: `${dm[1]}.kolon_adi`,
          message: `Hatalı Kolon İfadesi: '${dm[0]}' — nokta sonrasında sayısal kolon adı geçerli değildir.`
        });
      }

      // 3. JOIN without ON check
      if (/\bJOIN\b/i.test(cleanLineText) && !/\bON\b|\bUSING\b/i.test(cleanLineText) && !/CROSS\s+JOIN/i.test(cleanLineText)) {
        const restOfCode = lines.slice(lineIdx).join('\n')
          .replace(/'(?:''|[^'\r\n])*'/g, "''")
          .replace(/--[^\r\n]*/g, '')
          .replace(/\/\/[^\r\n]*/g, '');
        const joinMatch = /\bJOIN\b\s+([a-zA-Z0-9_$.]+)/i.exec(restOfCode);
        if (joinMatch) {
          const afterJoin = restOfCode.slice(joinMatch.index + joinMatch[0].length, joinMatch.index + joinMatch[0].length + 120);
          if (!/\bON\b|\bUSING\b/i.test(afterJoin)) {
            errors.push({
              line: lineNum,
              col: lineText.indexOf(joinMatch[0]) + 1,
              token: joinMatch[0],
              suggestion: 'ON tablo1.id = tablo2.id',
              message: `Eksik JOIN Bağlantısı: '${joinMatch[0]}' sonrasında 'ON' veya 'USING' koşulu bulunamadı.`
            });
          }
        }
      }
    }

    if (lang === 'pascal') {
      const procMatch = /^\s*procedure\s+([a-zA-Z0-9_]+)/i.exec(cleanLineText);
      if (procMatch) {
        const procName = procMatch[1];
        const evTypo = findFastReportEventTypo(procName);
        if (evTypo) {
          if (!errors.some(e => e.line === lineNum && e.token === procName)) {
            errors.push({
              line: lineNum,
              col: cleanLineText.indexOf(procName) + 1,
              token: procName,
              suggestion: evTypo.suggested,
              message: `FastReport Event Hatası: '${procName}' yerine '${evTypo.suggested}' yazılmalı (${evTypo.reason || evTypo.eventName}).`
            });
          }
        }
      }
    }
  });

  // 4. SQL Kapsamlı Tanımlanmamış / Orphan Tablo ve Alias Taraması
  if (lang === 'sql') {
    const cleanWholeSql = code
      .replace(/'(?:''|[^'\r\n])*'/g, "''")
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--[^\r\n]*/g, '')
      .replace(/<[^>]+>/g, '');

    const definedAliases = new Set();
    const sqlReservedKeywords = new Set([
      'ON','WHERE','LEFT','RIGHT','INNER','OUTER','FULL','CROSS','JOIN','GROUP','ORDER','HAVING',
      'LIMIT','OFFSET','UNION','USING','WITH','SET','VALUES','AND','OR','SELECT','INTO','FROM','AS',
      'CASE','WHEN','THEN','ELSE','END','DISTINCT','BETWEEN','LIKE','EXISTS','IN','IS','NOT','NULL'
    ]);

    // 1. CTEs: WITH cte AS (...), cte2 AS (...)
    const cteRx = /\b(?:WITH|,)\s*([a-zA-Z0-9_#$]+)\s+AS\s*\(/gi;
    let cm;
    while ((cm = cteRx.exec(cleanWholeSql)) !== null) {
      const cteName = cm[1].toUpperCase();
      if (!sqlReservedKeywords.has(cteName)) definedAliases.add(cteName);
    }

    // 2. FROM / JOIN tables and aliases (including inside subqueries)
    const tableRx = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-zA-Z0-9_#$.]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_#$]+))?/gi;
    let tm;
    while ((tm = tableRx.exec(cleanWholeSql)) !== null) {
      const fullTable = tm[1];
      if (!fullTable.startsWith('(')) {
        const parts = fullTable.split('.');
        const tName = parts[parts.length - 1].toUpperCase();
        if (!sqlReservedKeywords.has(tName)) definedAliases.add(tName);
      }

      if (tm[2]) {
        const aName = tm[2].toUpperCase();
        if (!sqlReservedKeywords.has(aName)) definedAliases.add(aName);
      }
    }

    // 3. Subquery aliases: ) [AS] alias (ör. )aa, ) aa, ) AS aa)
    const subqueryAliasRx = /\)\s*(?:AS\s+)?([a-zA-Z0-9_#$]+)/gi;
    let sm;
    while ((sm = subqueryAliasRx.exec(cleanWholeSql)) !== null) {
      const sa = sm[1].toUpperCase();
      if (!sqlReservedKeywords.has(sa)) definedAliases.add(sa);
    }

    // Bilinen sistem tabloları, paketler ve pseudo kolonlar
    const systemNamespaces = [
      'DUAL', 'SYS', 'SYSTEM', 'DBO', 'INSERTED', 'DELETED', 'NEW', 'OLD', 'ROWNUM', 'USER',
      'ALL_TABLES', 'USER_TABLES', 'DBA_TABLES', 'V$SESSION', 'V$SQL', 'DBMS_LOB', 'DBMS_OUTPUT',
      'UTL_RAW', 'UTL_HTTP', 'SYS_CONTEXT', 'JSON_VALUE', 'XMLTABLE', 'EXTRACTVALUE'
    ];
    systemNamespaces.forEach(s => definedAliases.add(s));

    // Eğer sorguda en az 1 tablo/FROM/JOIN tespit edildiyse, bilinmeyen prefix.kolon kullanımlarını yakala
    if (definedAliases.size > 0) {
      lines.forEach((lineText, idx) => {
        const lineNum = idx + 1;
        const cleanLine = lineText
          .replace(/'(?:''|[^'\r\n])*'/g, "''")
          .replace(/\/\/[^\r\n]*/g, '')
          .replace(/--[^\r\n]*/g, '')
          .replace(/\{[^\r\n]*\}/g, '');

        // alias.column veya alias.* kalıplarını yakala
        const aliasColRx = /\b([a-zA-Z_]\w*)\.([a-zA-Z0-9_#$*]+|\*)\b/g;
        let am;
        while ((am = aliasColRx.exec(cleanLine)) !== null) {
          const prefix = am[1];
          const col = am[2];
          const prefixUp = prefix.toUpperCase();

          // Sayısal veya floating point kontrolü (örn. 3.14 veya 1.0)
          if (/^\d+$/.test(prefix) || /^\d+$/.test(col)) continue;
          if (definedAliases.has(prefixUp)) continue;
          if (SQL_FN.has(prefixUp) || SQL_KW.has(prefixUp)) continue;

          // Paket / Şema fonksiyon çağrıları: prefix.function(...) (örn. p_util.datediff)
          const safePref = typeof escapeRegex === 'function' ? escapeRegex(prefix) : prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const safeCol = typeof escapeRegex === 'function' ? escapeRegex(col) : col.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp('\\b' + safePref + '\\.' + safeCol + '\\s*\\(', 'i').test(cleanLine)) continue;

          // Bu satırda zaten aynı hata var mı?
          if (!errors.some(e => e.line === lineNum && e.token === am[0])) {
            errors.push({
              line: lineNum,
              col: am.index + 1,
              token: am[0],
              suggestion: `FROM veya JOIN içine '${prefix}' tablosunu ekleyin`,
              message: `Tanımlanmamış Tablo/Alias: '${prefix}' aliası sorgudaki FROM veya JOIN tabloları arasında bulunamadı ('${am[0]}').`
            });
          }
        }
      });
    }
  }

  // Document-wide Parenthesis & Bracket Balance Check (Comments, Strings, and FastReport Macros stripped safely)
  let stripped = '';
  let inSingleQuote = false;
  let inBraceComment = false;
  let inParenStarComment = false;
  let inSlashStarComment = false;
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
          stripped += '  ';
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
        stripped += '  ';
        i++;
      } else {
        stripped += ' ';
      }
      continue;
    }

    if (inSlashStarComment) {
      if (ch === '*' && next === '/') {
        inSlashStarComment = false;
        stripped += '  ';
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
      while (j < code.length && code[j] !== '\n') {
        stripped += ' ';
        j++;
      }
      i = j - 1;
      continue;
    }

    if (ch === '-' && next === '-') {
      let j = i;
      while (j < code.length && code[j] !== '\n') {
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
      stripped += '  ';
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      inSlashStarComment = true;
      stripped += '  ';
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

  const parenLines = stripped.split('\n');
  const openStack = [];

  parenLines.forEach((lineText, idx) => {
    const lineNum = idx + 1;
    for (let c = 0; c < lineText.length; c++) {
      if (lineText[c] === '(') {
        openStack.push({ line: lineNum, col: c + 1 });
      } else if (lineText[c] === ')') {
        if (openStack.length > 0) {
          openStack.pop();
        } else {
          errors.push({
            line: lineNum,
            col: c + 1,
            token: ')',
            suggestion: 'Fazladan kapama parantezi',
            message: `Satır ${lineNum}: Eşleşmeyen kapama parantezi ')' bulundu.`
          });
        }
      }
    }
  });

  if (openStack.length > 0) {
    const lastOpen = openStack[openStack.length - 1];
    errors.push({
      line: lastOpen.line,
      col: lastOpen.col,
      token: '(',
      suggestion: 'Açılan \'(\' parantezini kapatın',
      message: `Satır ${lastOpen.line}: Açılan parantez '(' kapatılmamış.`
    });
  }

  // 5. PascalScript için Noktalı Virgül (;) ve Blok Bütünlüğü Doğrulaması
  if (lang === 'pascal' && window.FrpSyntaxCheck && typeof window.FrpSyntaxCheck.checkPascalSyntax === 'function') {
    const pasRes = window.FrpSyntaxCheck.checkPascalSyntax(code);
    if (pasRes && Array.isArray(pasRes.errors)) {
      pasRes.errors.forEach(pe => {
        const lineN = pe.line || 1;
        if (!errors.some(e => e.line === lineN && (e.message === pe.text || e.token === ';'))) {
          errors.push({
            line: lineN,
            col: 1,
            token: ';',
            suggestion: pe.suggestion || "Satır sonuna ';' ekleyin",
            message: pe.text
          });
        }
      });
    }
  }

  return errors;
}

window.highlightSQL = highlightSQL;
window.highlightPascal = highlightPascal;
window.findSyntaxErrors = findSyntaxErrors;
window.findFuzzyTypoMatch = findFuzzyTypoMatch;




