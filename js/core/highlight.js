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
      out += `.<span class="syntax-error" title="Hatalı Kolon / Alias İfadesi: '.${numPart}' (Sayısal kolon alias'ı olmaz)">${esc(numPart)}</span>`;
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
          out += `<span class="syntax-error" title="Eksik Kolon Adı: '${esc(word)}.' sonrasında alan adı veya '*' belirtilmemiş">${esc(word)}.</span>`;
          i = j + 1;
          continue;
        }
      }

      if (SQL_TYPO_MAP.has(up)) {
        const fix = SQL_TYPO_MAP.get(up);
        out += `<span class="syntax-error" title="Yazım Hatası (Typo): '${esc(word)}' -> Doğrusu: '${fix}'">${esc(word)}</span>`;
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
        out += `<span class="syntax-error" title="Yazım Hatası: '${esc(word)}' -> Doğrusu: '${fix}'">${esc(word)}</span>`;
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

  function addDiagnostic(line, col, token, suggestion, message) {
    const safeLine = Math.max(1, Number(line) || 1);
    const safeCol = Math.max(1, Number(col) || 1);
    const safeToken = String(token || '').trim() || 'ifade';
    if (errors.some(item => item.line === safeLine && item.col === safeCol && item.message === message)) return;
    errors.push({ line: safeLine, col: safeCol, token: safeToken, suggestion, message });
  }

  function cleanCodeLine(value, sqlMode) {
    let result = String(value || '').replace(/'(?:''|[^'\r\n])*'/g, match => ' '.repeat(match.length));
    result = result.replace(sqlMode ? /--[^\r\n]*/g : /\/\/[^\r\n]*/g, match => ' '.repeat(match.length));
    return result.replace(/\{[^\r\n]*\}/g, match => ' '.repeat(match.length));
  }

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

  if (lang === 'sql') {
    // (Tanımlanmamış alias kontrolü alt sorgularda ve karmaşık SQL yapılarında sahte hataları önlemek için kaldırıldı)

    // Precalculate line start offsets for fast, accurate O(log N) line/col translation
    const lineStartOffsets = [0];
    for (let i = 0; i < code.length; i++) {
      if (code[i] === '\n') lineStartOffsets.push(i + 1);
    }
    function getPosLineAndCol(index) {
      let low = 0, high = lineStartOffsets.length - 1, lineIdx = 0;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (lineStartOffsets[mid] <= index) {
          lineIdx = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return { line: lineIdx + 1, col: index - lineStartOffsets[lineIdx] + 1 };
    }

    // Mask strings and comments while strictly preserving character offsets and newlines
    let maskedSql = '';
    let inSingleQuote = false;
    let inSlashStar = false;
    let inDashDash = false;
    let quoteStartPos = -1;

    for (let i = 0; i < code.length; i++) {
      const ch = code[i];
      const next = code[i + 1] || '';

      if (inSingleQuote) {
        if (ch === "'") {
          if (next === "'") {
            maskedSql += '  ';
            i++;
          } else {
            inSingleQuote = false;
            maskedSql += ' ';
          }
        } else if (ch === '\n') {
          maskedSql += '\n';
        } else {
          maskedSql += ' ';
        }
        continue;
      }

      if (inSlashStar) {
        if (ch === '*' && next === '/') {
          inSlashStar = false;
          maskedSql += '  ';
          i++;
        } else if (ch === '\n') {
          maskedSql += '\n';
        } else {
          maskedSql += ' ';
        }
        continue;
      }

      if (inDashDash) {
        if (ch === '\n') {
          inDashDash = false;
          maskedSql += '\n';
        } else {
          maskedSql += ' ';
        }
        continue;
      }

      if (ch === '-' && next === '-') {
        inDashDash = true;
        maskedSql += '  ';
        i++;
        continue;
      }

      if (ch === '/' && next === '*') {
        inSlashStar = true;
        maskedSql += '  ';
        i++;
        continue;
      }

      if (ch === "'") {
        inSingleQuote = true;
        quoteStartPos = i;
        maskedSql += ' ';
        continue;
      }

      maskedSql += ch;
    }

    if (inSingleQuote && quoteStartPos >= 0) {
      const qPos = getPosLineAndCol(quoteStartPos);
      addDiagnostic(qPos.line, qPos.col, "'", "Metin değerini ' ile kapatın", "SQL metin değeri tek tırnak (') ile kapatılmamış.");
    }

    // ── 1. CASE ... WHEN ... THEN ... ELSE ... END Bütünlüğü Denetimi ──
    const caseStack = [];
    const caseTokenRx = /\b(CASE|WHEN|THEN|ELSE|END)\b/gi;
    let caseMatch;
    while ((caseMatch = caseTokenRx.exec(maskedSql)) !== null) {
      const token = caseMatch[1].toUpperCase();
      const pos = caseMatch.index;
      const { line, col } = getPosLineAndCol(pos);

      if (token === 'CASE') {
        caseStack.push({ line, col, pos, hasWhen: false, state: 'CASE' });
      } else if (token === 'WHEN') {
        if (caseStack.length === 0) {
          addDiagnostic(line, col, 'WHEN', "CASE ifadesi ile başlayın", "Eşleşmeyen 'WHEN' ifadesi — Başlangıç 'CASE' bulunamadı.");
        } else {
          const top = caseStack[caseStack.length - 1];
          if (top.state === 'WHEN') {
            addDiagnostic(top.lastWhenLine || line, top.lastWhenCol || col, 'WHEN', "'THEN' ekleyin", "CASE ifadesinde 'WHEN' koşulundan sonra 'THEN' eksik.");
          } else if (top.state === 'ELSE') {
            addDiagnostic(line, col, 'WHEN', "'WHEN', 'ELSE'ten önce yazılmalıdır", "CASE ifadesinde 'WHEN', 'ELSE' bloğundan sonra gelemez.");
          }
          top.hasWhen = true;
          top.state = 'WHEN';
          top.lastWhenLine = line;
          top.lastWhenCol = col;
        }
      } else if (token === 'THEN') {
        if (caseStack.length === 0) {
          addDiagnostic(line, col, 'THEN', '', "Eşleşmeyen 'THEN' ifadesi — Başlangıç 'CASE ... WHEN' bulunamadı.");
        } else {
          const top = caseStack[caseStack.length - 1];
          if (top.state !== 'WHEN') {
            addDiagnostic(line, col, 'THEN', "'WHEN <koşul> THEN' kullanın", "'THEN' öncesinde 'WHEN' koşulu bulunamadı.");
          }
          top.state = 'THEN';
        }
      } else if (token === 'ELSE') {
        if (caseStack.length === 0) {
          addDiagnostic(line, col, 'ELSE', '', "Eşleşmeyen 'ELSE' ifadesi — Başlangıç 'CASE' bulunamadı.");
        } else {
          const top = caseStack[caseStack.length - 1];
          if (top.state === 'WHEN') {
            addDiagnostic(top.lastWhenLine || line, top.lastWhenCol || col, 'WHEN', "'THEN' ekleyin", "CASE ifadesinde 'WHEN' koşulundan sonra 'THEN' eksik.");
          }
          top.state = 'ELSE';
        }
      } else if (token === 'END') {
        if (caseStack.length === 0) {
          addDiagnostic(line, col, 'END', "Fazladan 'END' ifadesini kaldırın", "Eşleşmeyen 'END' ifadesi — Başlangıç 'CASE' bulunamadı.");
        } else {
          const top = caseStack.pop();
          if (!top.hasWhen) {
            addDiagnostic(top.line, top.col, 'CASE', "WHEN ... THEN koşulu ekleyin", "CASE bloğunda en az bir 'WHEN ... THEN' ifadesi bulunmalıdır.");
          } else if (top.state === 'WHEN') {
            addDiagnostic(top.lastWhenLine || line, top.lastWhenCol || col, 'WHEN', "'THEN' ekleyin", "CASE bloğunda son 'WHEN' koşulundan sonra 'THEN' ifadesi eksik.");
          }
        }
      }
    }

    while (caseStack.length > 0) {
      const top = caseStack.pop();
      addDiagnostic(
        top.line,
        top.col,
        'CASE',
        "CASE bloğunu 'END' ile kapatın (Örn: CASE ... END)",
        `Satır ${top.line}: Açılan 'CASE' ifadesi 'END' ile kapatılmamış.`
      );
    }

    // ── 2. JOIN Bağlantıları ve CROSS JOIN / NATURAL Muafiyeti Denetimi ──
    const joinRx = /\b((?:CROSS\s+|NATURAL(?:\s+(?:LEFT|RIGHT|FULL)\s+(?:OUTER\s+)?|\s+INNER\s+)?|(?:LEFT|RIGHT|FULL)(?:\s+OUTER)?\s+|INNER\s+)?JOIN)\b/gi;
    let jm;
    while ((jm = joinRx.exec(maskedSql)) !== null) {
      const fullJoinKw = jm[1].trim();
      const upperJoinKw = fullJoinKw.toUpperCase();
      const joinPos = jm.index;
      const { line, col } = getPosLineAndCol(joinPos);

      const isCross = upperJoinKw.startsWith('CROSS');
      const isNatural = upperJoinKw.startsWith('NATURAL');

      const afterJoinStart = joinPos + jm[0].length;
      const afterJoinSub = maskedSql.slice(afterJoinStart);

      // Tablo veya alt sorgu eşleşmesi
      const tableMatch = /^\s*(?:\(([\s\S]*?)\)\s*(?:AS\s+)?([a-zA-Z0-9_#$]+)|([a-zA-Z0-9_$.]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_#$]+))?)/i.exec(afterJoinSub);

      // Bu JOIN ifadesinin bitebileceği sınır noktası (Sonraki JOIN, WHERE, GROUP BY vb.)
      const boundaryRx = /\b(?:(?:CROSS\s+|NATURAL(?:\s+\w+)*\s+|(?:LEFT|RIGHT|FULL)(?:\s+OUTER)?\s+|INNER\s+)?JOIN|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|UNION|MINUS|INTERSECT|CONNECT\s+BY|START\s+WITH)\b|\)/gi;
      boundaryRx.lastIndex = afterJoinStart + 1;
      const boundaryMatch = boundaryRx.exec(maskedSql);
      const boundaryPos = boundaryMatch ? boundaryMatch.index : maskedSql.length;

      if (!tableMatch || !tableMatch[0].trim() || (afterJoinStart + tableMatch.index >= boundaryPos)) {
        addDiagnostic(line, col, 'JOIN', 'JOIN sonrasına tablo adı ekleyin', 'JOIN ifadesinde tablo adı eksik.');
        continue;
      }

      // CROSS JOIN ve NATURAL JOIN koşul (ON veya USING) GEREKTİRMEZ
      if (isCross || isNatural) {
        continue;
      }

      const tableEndPos = afterJoinStart + tableMatch[0].length;
      const conditionSegment = maskedSql.slice(tableEndPos, boundaryPos).trim();

      const hasOn = /\bON\b/i.test(conditionSegment);
      const hasUsing = /\bUSING\b/i.test(conditionSegment);

      if (hasOn) {
        const onPart = conditionSegment.slice(conditionSegment.toUpperCase().indexOf('ON') + 2).trim();
        if (!onPart) {
          addDiagnostic(line, col, 'ON', 'ON sonrasına koşul yazın (Örn: ON a.id = b.id)', "'ON' anahtar sözcüğünden sonra bağlantı koşulu eksik.");
        }
      } else if (hasUsing) {
        const usingPart = conditionSegment.slice(conditionSegment.toUpperCase().indexOf('USING') + 5).trim();
        if (!/^\([^)]+\)/.test(usingPart)) {
          addDiagnostic(line, col, 'USING', 'USING (kolon_adi) biçiminde yazın', "'USING' sonrasında parantez içinde kolon adı eksik.");
        }
      } else {
        if (conditionSegment.length > 0) {
          const previewCond = conditionSegment.replace(/\s+/g, ' ').slice(0, 35);
          addDiagnostic(
            line,
            col,
            'ON',
            `ON ${previewCond}`,
            `JOIN bağlantısında 'ON' anahtar sözcüğü eksik. (Örn: ON ${previewCond})`
          );
        } else {
          addDiagnostic(
            line,
            col,
            'JOIN',
            'JOIN tablosundan sonra ON veya USING koşulu ekleyin',
            'JOIN bağlantısı ON veya USING koşulu olmadan tamamlanmış.'
          );
        }
      }
    }

    // ── 3. Çok Satırlı SQL Bölümleri (SELECT, FROM, WHERE, GROUP/ORDER BY) ──
    const cleanLines = lines.map((l, idx) => ({
      idx,
      lineNo: idx + 1,
      raw: l,
      clean: cleanCodeLine(l, true)
    }));
    const nonEmptyLines = cleanLines.filter(item => item.clean.trim().length > 0);
    const nextNonEmptyMap = new Map();
    nonEmptyLines.forEach((item, pos) => {
      nextNonEmptyMap.set(item.idx, nonEmptyLines[pos + 1] || null);
    });

    const clauseStartRx = /^(?:WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|UNION|MINUS|INTERSECT|CONNECT\s+BY|START\s+WITH|(?:CROSS\s+|NATURAL(?:\s+\w+)*\s+|(?:LEFT|RIGHT|FULL)(?:\s+OUTER)?\s+|INNER\s+)?JOIN|\))\b/i;

    cleanLines.forEach(item => {
      const { lineNo, idx, clean } = item;
      const trim = clean.trim();
      if (!trim) return;
      const nextItem = nextNonEmptyMap.get(idx);
      const nextTrim = nextItem ? nextItem.clean.trim() : '';

      // SELECT boş liste denetimi (Çok satırlı güvenli)
      if (/^\s*SELECT(?:\s+(?:DISTINCT|ALL))?\s*$/i.test(trim)) {
        if (!nextTrim || /^(?:FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING|UNION|MINUS|INTERSECT|\))\b/i.test(nextTrim)) {
          addDiagnostic(lineNo, clean.toUpperCase().indexOf('SELECT') + 1, 'SELECT', 'SELECT sonrasına kolon veya ifade yazın', 'SELECT listesi boş bırakılamaz.');
        }
      } else if (/\bSELECT\s+(?:DISTINCT\s+|ALL\s+)?(?:FROM\b|\))/i.test(trim)) {
        addDiagnostic(lineNo, clean.toUpperCase().indexOf('SELECT') + 1, 'SELECT', 'SELECT sonrasına kolon veya ifade yazın', 'SELECT listesi boş bırakılamaz.');
      }

      // FROM / INTO / UPDATE tablo eksikliği denetimi (Çok satırlı güvenli)
      const missingSourceMatch = /^(?:FROM|INTO|UPDATE)\s*$/i.exec(trim);
      if (missingSourceMatch) {
        if (!nextTrim || clauseStartRx.test(nextTrim)) {
          const kw = missingSourceMatch[0].trim().toUpperCase();
          addDiagnostic(lineNo, clean.toUpperCase().indexOf(kw) + 1, kw, `${kw} sonrasına tablo adı yazın`, `'${kw}' ifadesinde tablo adı eksik.`);
        }
      } else {
        const inlineMissingSource = /\b(FROM|INTO|UPDATE)\s*(?:WHERE|SET|GROUP\s+BY|ORDER\s+BY|HAVING|\)|$)/i.exec(trim);
        if (inlineMissingSource && !/\b(?:FROM|INTO|UPDATE)\s+[a-zA-Z0-9_$.]+/i.test(trim)) {
          const kw = inlineMissingSource[1].toUpperCase();
          addDiagnostic(lineNo, clean.toUpperCase().indexOf(kw) + 1, kw, `${kw} sonrasına tablo adı yazın`, `'${kw}' ifadesinde tablo adı eksik.`);
        }
      }

      const rawWithoutComments = (item.raw || '').replace(/--[^\r\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{[^\r\n]*\}/g, '').trim();

      // WHERE / HAVING boş koşul denetimi (Çok satırlı güvenli)
      const emptyClause = /\b(WHERE|HAVING)\s*$/i.exec(rawWithoutComments);
      if (emptyClause) {
        if (!nextTrim || clauseStartRx.test(nextTrim)) {
          addDiagnostic(lineNo, clean.toUpperCase().lastIndexOf(emptyClause[1].toUpperCase()) + 1, emptyClause[1].toUpperCase(), 'Koşul ifadesini tamamlayın', `'${emptyClause[1].toUpperCase()}' anahtar sözcüğünden sonra koşul eksik.`);
        }
      }

      // Satır sonu yarım kalan AND / OR
      const danglingLogical = /\b(AND|OR)\s*$/i.exec(rawWithoutComments);
      if (danglingLogical) {
        if (!nextTrim || /^(?:GROUP\s+BY|ORDER\s+BY|HAVING|UNION|MINUS|INTERSECT|\))\b/i.test(nextTrim)) {
          addDiagnostic(lineNo, clean.toUpperCase().lastIndexOf(danglingLogical[1].toUpperCase()) + 1, danglingLogical[1].toUpperCase(), 'Koşul ifadesini tamamlayın', `'${danglingLogical[1].toUpperCase()}' anahtar sözcüğünden sonra koşul eksik.`);
        }
      }

      // Karşılaştırma operatörü sağ tarafı eksik
      const danglingComparison = /(=|<>|!=|<=|>=|<|>|\bLIKE\b|\bIN\b)\s*$/i.exec(rawWithoutComments);
      if (danglingComparison) {
        if (!nextTrim || clauseStartRx.test(nextTrim) || /^(?:AND|OR)\b/i.test(nextTrim)) {
          addDiagnostic(lineNo, Math.max(1, rawWithoutComments.lastIndexOf(danglingComparison[1]) + 1), danglingComparison[1], 'Operatörün sağına değer, parametre veya kolon yazın', `Karşılaştırma operatörü '${danglingComparison[1]}' sonrasında değer eksik.`);
        }
      }

      // Bölüm öncesi fazladan virgül
      const trailingComma = /,\s*$/i.exec(trim);
      if (trailingComma && nextTrim && clauseStartRx.test(nextTrim)) {
        addDiagnostic(lineNo, clean.lastIndexOf(',') + 1, ',', 'Son virgülü kaldırın', 'SQL bölümü değişmeden önce virgülden sonra kolon ya da tablo eksik.');
      }

      // GROUP BY / ORDER BY eksik 'BY'
      const missingBy = /\b(GROUP|ORDER)\s+(?!BY\b)([a-zA-Z_][\w$#.]*)/i.exec(trim);
      if (missingBy) {
        addDiagnostic(lineNo, clean.toUpperCase().indexOf(missingBy[1].toUpperCase()) + 1, missingBy[1].toUpperCase(), `${missingBy[1].toUpperCase()} BY kullanın`, `'${missingBy[1].toUpperCase()}' sonrasında 'BY' anahtar sözcüğü eksik.`);
      }

      // BETWEEN ... AND eksikliği
      if (/\bBETWEEN\b/i.test(trim)) {
        const afterBetween = trim.slice(trim.toUpperCase().lastIndexOf('BETWEEN') + 7);
        if (afterBetween && !/\bAND\b/i.test(afterBetween) && (!nextTrim || clauseStartRx.test(nextTrim))) {
          addDiagnostic(lineNo, clean.toUpperCase().lastIndexOf('BETWEEN') + 1, 'BETWEEN', 'BETWEEN alt_değer AND üst_değer biçimini kullanın', 'BETWEEN ifadesinin AND ve üst sınır bölümü eksik.');
        }
      }
    });

    // ── 4. SELECT Kolon Listesinde Eksik Virgül (,) Tespiti ──
    const selectMatch = /\bSELECT\b/i.exec(maskedSql);
    if (selectMatch) {
      const selectIdx = selectMatch.index;
      let fromIdx = -1;
      let pDepth = 0;
      for (let i = selectIdx + 6; i < maskedSql.length; i++) {
        if (maskedSql[i] === '(') pDepth++;
        else if (maskedSql[i] === ')') pDepth = Math.max(0, pDepth - 1);
        else if (pDepth === 0 && /\bFROM\b/i.test(maskedSql.slice(i, i + 5))) {
          fromIdx = i;
          break;
        }
      }

      if (fromIdx > selectIdx) {
        const startLineObj = getPosLineAndCol(selectIdx);
        const endLineObj = getPosLineAndCol(fromIdx);

        for (let l = startLineObj.line; l <= endLineObj.line; l++) {
          const curLineText = cleanLines[l - 1]?.clean || '';
          const curTrim = curLineText.trim();
          if (!curTrim) continue;

          let body = curTrim;
          if (l === startLineObj.line) {
            body = body.replace(/^\s*SELECT(?:\s+(?:DISTINCT|ALL))?\b/i, '').trim();
          }
          if (!body) continue;

          const nextItem = nextNonEmptyMap.get(l - 1);
          if (nextItem && nextItem.lineNo <= endLineObj.line) {
            const nextTrimClean = nextItem.clean.trim();
            const endsWithComma = /,\s*$/.test(curTrim);
            const endsWithOp = /(=|<>|!=|<=|>=|<|>|\+|-|\*|\/|\|\||\bAS|\bAND|\bOR|\bCASE|\bWHEN|\bTHEN|\bELSE)\s*$/i.test(curTrim);
            const startsWithComma = /^\s*,/.test(nextTrimClean);
            const startsWithFrom = /^\s*FROM\b/i.test(nextTrimClean);

            if (!endsWithComma && !endsWithOp && !startsWithComma && !startsWithFrom) {
              const nextStartsWithOp = /^(=|<>|!=|<=|>=|<|>|\+|-|\*|\/|\|\|)/.test(nextTrimClean);
              const nextStartsNewExpr = !nextStartsWithOp && (
                /^(?:[a-zA-Z_]\w*\s*\(|CASE\b|\(|\d+|'|[a-zA-Z_]\w*\.[a-zA-Z0-9_#$*]+)/i.test(nextTrimClean) ||
                /^[a-zA-Z_][\w$#]*/i.test(nextTrimClean)
              );
              const curHasExpr = body.length > 0;

              if (nextStartsNewExpr && curHasExpr) {
                addDiagnostic(
                  l,
                  curLineText.length,
                  ',',
                  `Satır sonuna virgül (,) ekleyin (Örn: '${curTrim},')`,
                  'Kolon veya ifadeler arasında virgül (,) eksik.'
                );
              }
            }
          }
        }
      }
    }
  } else if (lang === 'pascal') {
    lines.forEach((rawLine, index) => {
      const clean = cleanCodeLine(rawLine, false);
      const trim = clean.trim();
      if (!trim) return;
      const lineNo = index + 1;
      const emptyAssignment = /:=\s*;?\s*$/i.exec(trim);
      if (emptyAssignment) addDiagnostic(lineNo, clean.lastIndexOf(':=') + 1, ':=', 'Atamanın sağına değer veya ifade yazın', "Pascal atama operatörü ':=' sonrasında değer eksik.");
      if (/^\s*IF\b/i.test(trim) && !/\bTHEN\b/i.test(trim)) addDiagnostic(lineNo, clean.toUpperCase().indexOf('IF') + 1, 'if', 'Koşulu THEN ile tamamlayın', "IF koşulunda 'then' eksik.");
      if (/^\s*(?:WHILE|FOR)\b/i.test(trim) && !/\bDO\b/i.test(trim)) addDiagnostic(lineNo, 1, trim.split(/\s+/)[0], 'Döngü koşulunu DO ile tamamlayın', "Pascal döngüsünde 'do' eksik.");
      if (/^\s*(?:ELSE|THEN)\s*;\s*$/i.test(trim)) addDiagnostic(lineNo, 1, trim.replace(';', ''), 'Anahtar sözcükten sonra çalıştırılacak ifadeyi yazın', 'Kontrol bloğu boş bırakılmış.');
      if (/STRINGREPLACE\s*\([^\n]*\[\s*RFREPLACEALL\s*\]/i.test(trim)) addDiagnostic(lineNo, clean.toUpperCase().indexOf('STRINGREPLACE') + 1, 'StringReplace', 'StringReplace(source, old, new) biçimini kullanın', 'Bu FastReport ortamında [rfReplaceAll] parametresi desteklenmiyor.');

      const quoteLine = rawLine.replace(/\/\/.*$/, '').replace(/\{[^}]*\}/g, '');
      let quoteOpen = false;
      for (let i = 0; i < quoteLine.length; i++) {
        if (quoteLine[i] !== "'") continue;
        if (quoteOpen && quoteLine[i + 1] === "'") { i += 1; continue; }
        quoteOpen = !quoteOpen;
      }
      if (quoteOpen) addDiagnostic(lineNo, Math.max(1, rawLine.lastIndexOf("'") + 1), "'", "Metni ' ile kapatın", 'Pascal metin değeri satır sonunda kapatılmamış.');
    });
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
          addDiagnostic(lineNum, c + 1, ')', 'Fazladan kapama parantezi', `Satır ${lineNum}: Eşleşmeyen kapama parantezi ')' bulundu.`);
        }
      }
    }
  });

  if (openStack.length > 0) {
    const lastOpen = openStack[openStack.length - 1];
    addDiagnostic(lastOpen.line, lastOpen.col, '(', "Açılan '(' parantezini kapatın", `Satır ${lastOpen.line}: Açılan parantez '(' kapatılmamış.`);
  }

  // 5. PascalScript için Noktalı Virgül (;) ve Blok Bütünlüğü Doğrulaması
  if (lang === 'pascal' && window.FrpSyntaxCheck && typeof window.FrpSyntaxCheck.checkPascalSyntax === 'function') {
    const pasRes = window.FrpSyntaxCheck.checkPascalSyntax(code);
    if (pasRes && Array.isArray(pasRes.errors)) {
      pasRes.errors.forEach(pe => {
        const lineN = pe.line || 1;
        if (!errors.some(e => e.line === lineN && (e.message === pe.text || e.token === ';' || (pe.token && e.token === pe.token)))) {
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

