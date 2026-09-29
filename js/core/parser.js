// ============================================================
//  parser.js — FastReport .frp XML Parser (Gelişmiş v3.1)
//  Script, SQL, Metadata, GUID ve Rapor Eleman Ağacını ayıklar.
// ============================================================

const CP1254_ENTITY_MAP = {
  222: 'Ş', 254: 'ş',
  208: 'Ğ', 240: 'ğ',
  221: 'İ', 253: 'ı',
  199: 'Ç', 231: 'ç',
  214: 'Ö', 246: 'ö',
  220: 'Ü', 252: 'ü',
  0xDE: 'Ş', 0xFE: 'ş',
  0xD0: 'Ğ', 0xF0: 'ğ',
  0xDD: 'İ', 0xFD: 'ı',
  0xC7: 'Ç', 0xE7: 'ç',
  0xD6: 'Ö', 0xF6: 'ö',
  0xDC: 'Ü', 0xFC: 'ü'
};

function decodeHtmlEntities(str) {
  if (!str) return '';
  let res = str
    .replace(/&#13;&#10;/g, '\n')
    .replace(/&#13;/g, '\n')
    .replace(/&#10;/g, '\n')
    .replace(/&#9;/g,  '\t')
    .replace(/&#60;/g, '<')
    .replace(/&#62;/g, '>')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g,  '<')
    .replace(/&gt;/g,  '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const num = parseInt(h, 16);
      return CP1254_ENTITY_MAP[num] || (num > 0 ? String.fromCodePoint(num) : '');
    })
    .replace(/&#(\d+);/g, (_, n) => {
      const num = Number(n);
      return CP1254_ENTITY_MAP[num] || (num > 0 ? String.fromCodePoint(num) : '');
    });

  if (typeof fixTurkishMojibake === 'function') {
    res = fixTurkishMojibake(res);
  }
  return res;
}

function getAttr(chunk, name) {
  const escaped = typeof escapeRegex === 'function' ? escapeRegex(name) : name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(
    '(?:^|\\s)' + escaped + "\\s*=\\s*(?:\"((?:[^\"\\\\]|\\\\.)*?)\"|'((?:[^'\\\\]|\\\\.)*?)')",
    'is'
  );
  const m = chunk.match(rx);
  const value = m ? (m[1] ?? m[2]) : null;
  return value ? decodeHtmlEntities(value) : null;
}

function findTagAttributes(xmlText, tagName) {
  let rx;
  if (tagName instanceof RegExp) {
    rx = new RegExp(tagName.source, 'g');
  } else {
    const safeTag = typeof escapeRegex === 'function' ? escapeRegex(tagName) : tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rx = new RegExp(`<${safeTag}\\b`, 'g');
  }
  const chunks = [];
  let match;

  while ((match = rx.exec(xmlText)) !== null) {
    let pos = match.index + match[0].length;
    let inQuote = false;
    let quoteChar = '';

    while (pos < xmlText.length) {
      const ch = xmlText[pos];

      if (!inQuote) {
        if (ch === '"' || ch === "'") {
          inQuote = true;
          quoteChar = ch;
        } else if (ch === '>') {
          chunks.push(xmlText.slice(match.index, pos + 1));
          break;
        }
      } else {
        if (ch === quoteChar) {
          inQuote = false;
          quoteChar = '';
        } else if (ch === '\\') {
          pos += 1;
        }
      }

      pos += 1;
    }
  }

  return chunks;
}

// Oracle / SQL TO_CHAR biçimlendirme ve zaman format kelimeleri (parametre değildir!)
const DATE_FORMAT_TOKENS = new Set([
  'YYYY', 'YY', 'RRRR', 'RR', 'MM', 'DD', 'HH', 'HH12', 'HH24', 'MI', 'SS', 'MS',
  'AM', 'PM', 'D', 'DY', 'DAY', 'MONTH', 'RM', 'FF', 'FF1', 'FF2', 'FF3', 'FF4', 'FF5', 'FF6', 'FF7', 'FF8', 'FF9'
]);

function extractParamsFromSql(sql) {
  if (!sql) return [];
  // 1. Önce yorum satırlarını sil
  const noComments = (sql || '')
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  // 2. String değerlerini sil (satır taşmasını engelle)
  const cleanSql = noComments.replace(/'(?:''|[^'\r\n])*'/g, "''");

  const params = new Set();

  // SQL Parametreleri: :PARAM, &PARAM, @PARAM
  const rx = /[:&@]([a-zA-Z_]\w*)/g;
  let m;
  while ((m = rx.exec(cleanSql)) !== null) {
    // PostgreSQL ::type cast kontrolü
    if (m.index > 0 && cleanSql[m.index - 1] === ':') continue;

    const pName = m[1];
    if (!DATE_FORMAT_TOKENS.has(pName.toUpperCase())) {
      params.add(':' + pName);
    }
  }

  // Delphi FastReport Parametre / Değişken İfadeleri: <ParamName> (örn. <BinaIdList>, <BasTar>, <BitTar>)
  const frRx = /<([a-zA-Z_]\w*)>/g;
  let frm;
  while ((frm = frRx.exec(cleanSql)) !== null) {
    const pName = frm[1];
    if (!DATE_FORMAT_TOKENS.has(pName.toUpperCase()) && !/^(FONT|COLOR|PAGE|DATE|TIME)$/i.test(pName)) {
      params.add(':' + pName);
    }
  }

  return [...params].sort();
}

function extractSqlFromElementBody(body) {
  if (!body) return '';
  const sqlNode = body.match(/<(?:SQL\.Text|SQL)\b[^>]*>([\s\S]*?)<\/(?:SQL\.Text|SQL)\s*>/i);
  if (!sqlNode) return '';

  let content = sqlNode[1];
  const itemValues = [];
  const itemRx = /<item\b([^>]*)>([\s\S]*?)<\/item\s*>|<item\b([^>]*)\/>/gi;
  let itemMatch;
  while ((itemMatch = itemRx.exec(content)) !== null) {
    const attrs = itemMatch[1] || itemMatch[3] || '';
    const attrValue = getAttr(attrs, 'Text') || getAttr(attrs, 'Value');
    const textValue = (itemMatch[2] || '').replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '');
    const value = attrValue || textValue;
    if (value.trim()) itemValues.push(decodeHtmlEntities(value.trim()));
  }
  if (itemValues.length > 0) return itemValues.join('\n');

  content = content
    .replace(/^\s*<!\[CDATA\[/, '')
    .replace(/\]\]>\s*$/, '')
    .replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function readFrpVariables(xmlText) {
  const P = typeof DOMParser !== 'undefined' ? DOMParser : (typeof global !== 'undefined' ? global.DOMParser : null);
  if (!P) return {categories:[],editable:false,reason:'XML okuyucu bulunamadı.'};
  if (!xmlText) return {categories:[],editable:true};
  const doc = new P().parseFromString(xmlText,'application/xml');
  if (doc.querySelector('parsererror')) return {categories:[],editable:false,reason:'FRP XML okunamadı.'};
  const blocks = Array.from(doc.documentElement.children).filter(n=>n.nodeName==='Variables');
  if (blocks.length>1) return {categories:[],editable:false,reason:'Birden çok Variables bloğu var; özgün yapı korunuyor.'};
  if (!blocks.length) {
    const legacy=doc.documentElement.hasAttribute('Variables') || doc.documentElement.hasAttribute('Variables.Text') || doc.getElementsByTagName('TfrxVariable').length;
    return {categories:[],editable:!legacy,reason:legacy?'Bu değişken biçimi henüz düzenlenemiyor; özgün içerik korunuyor.':''};
  }
  const categories=[], names=new Set(), categoryNames=new Set(); let category=null,reason='';
  Array.from(blocks[0].children).forEach((node,index)=>{
    if(node.nodeName!=='item'||!node.hasAttribute('Name'))return;
    const raw=node.getAttribute('Name'),name=raw.trim();
    if(!name){reason='Adsız değişken veya kategori var; özgün yapı korunuyor.';return;}
    if(/^\s/.test(raw)){
      if(categoryNames.has(name.toLowerCase()))reason='Mükerrer kategori adı var; özgün yapı korunuyor.';
      categoryNames.add(name.toLowerCase()); category={name,_sourceIndex:index,variables:[]};categories.push(category);
    }else{
      if(!node.hasAttribute('Value')&&node.children.length)reason='Bu değişkenin değer biçimi henüz desteklenmiyor.';
      if(names.has(name.toLowerCase()))reason='Mükerrer değişken adı var; özgün yapı korunuyor.';
      names.add(name.toLowerCase());
      if(!category){category={name:'Genel',variables:[]};categories.push(category);categoryNames.add('genel');}
      category.variables.push({name,expression:node.getAttribute('Value')??'',_sourceIndex:index});
    }
  });
  return {categories,editable:!reason,reason};
}

function syncFrpVariables(doc,categories) {
  const S=typeof XMLSerializer!=='undefined'?XMLSerializer:global.XMLSerializer;
  const info=readFrpVariables(new S().serializeToString(doc));
  if(!info.editable)throw new Error(info.reason);
  const root=doc.documentElement;
  let block=Array.from(root.children).find(n=>n.nodeName==='Variables');
  if(!block&&!categories.length)return;
  if(!block){block=doc.createElement('Variables');root.appendChild(block);}
  const original=Array.from(block.children),used=new Set();
  const append=(model,name,isCategory)=>{
    let node=Number.isInteger(model._sourceIndex)?original[model._sourceIndex]:null;
    if(!node||node.nodeName!=='item'||!node.hasAttribute('Name')||used.has(node))node=doc.createElement('item');
    used.add(node);node.setAttribute('Name',name);
    if(!isCategory)node.setAttribute('Value',String(model.expression??''));
    block.appendChild(node);
  };
  categories.forEach(category=>{
    append(category,' '+category.name.trim(),true);
    (category.variables||[]).forEach(variable=>append(variable,variable.name.trim(),false));
  });
  original.forEach(node=>{if(node.nodeName==='item'&&node.hasAttribute('Name')&&!used.has(node))block.removeChild(node);});
}

function parseFrp(xmlText) {
  const result = {
    meta: {},
    pascalScript: null,
    queries: [],
    datasets: [],
    tree: []
  };

  // ── META ────────────────────────────────────────────────
  const rootTags = findTagAttributes(xmlText, 'TfrxReport');
  if (rootTags.length > 0) {
    const chunk = rootTags[0].replace(/^<TfrxReport\b\s*/, '').replace(/\s*\/?>$/, '');
    result.meta.reportName   = getAttr(chunk, 'ReportOptions.Name');
    result.meta.author       = getAttr(chunk, 'ReportOptions.Author');
    result.meta.description  = getAttr(chunk, 'ReportOptions.Description.Text');
    result.meta.version      = getAttr(chunk, 'Version');
    result.meta.scriptLang   = getAttr(chunk, 'ScriptLanguage');
    result.meta.versionBuild = getAttr(chunk, 'ReportOptions.VersionBuild');
    result.meta.guid         = getAttr(chunk, 'ReportOptions.GUID') || getAttr(chunk, 'GUID');
    result.reportSettings = {};
    if (getAttr(chunk, 'EngineOptions.DoublePass') !== '') result.reportSettings.doublePass = getAttr(chunk, 'EngineOptions.DoublePass');
    if (getAttr(chunk, 'EngineOptions.PrintIfEmpty') !== '') result.reportSettings.printIfEmpty = getAttr(chunk, 'EngineOptions.PrintIfEmpty');
    if (getAttr(chunk, 'PrintOptions.Copies') !== '') result.reportSettings.copies = getAttr(chunk, 'PrintOptions.Copies');
    if (getAttr(chunk, 'PrintOptions.Printer') !== '') result.reportSettings.printer = getAttr(chunk, 'PrintOptions.Printer');
    if (getAttr(chunk, 'ReportOptions.Password') !== '') result.reportSettings.password = getAttr(chunk, 'ReportOptions.Password');
    if (getAttr(chunk, 'ReportOptions.Name') !== '') result.reportSettings.name = getAttr(chunk, 'ReportOptions.Name');
    if (getAttr(chunk, 'ReportOptions.Author') !== '') result.reportSettings.author = getAttr(chunk, 'ReportOptions.Author');
    if (getAttr(chunk, 'ReportOptions.Description.Text') !== '') result.reportSettings.description = getAttr(chunk, 'ReportOptions.Description.Text');
    result.reportSettings.parentReport = getAttr(chunk, 'ParentReport');

  }

  // GUID Ayıklama (Gelişmiş Bütünsel Arama + Base64 & HTML Entity Dekode)
  let searchXml = xmlText;

  // PntData attribute'larındaki Base64 kodlanmış XML verisini çöz
  const pntRx = /PntData="([A-Za-z0-9+/=]{20,})"/gi;
  let pm;
  while ((pm = pntRx.exec(xmlText)) !== null) {
    try {
      const decodedPnt = atob(pm[1]);
      searchXml += '\n' + decodedPnt;
    } catch (e) {}
  }

  const decodedSearch = decodeHtmlEntities(searchXml);

  // 1. Explicit Guid variable/attribute check
  let extractedGuid = null;
  const directMatch = searchXml.match(/Name=["']Guid["'][^>]*?Value=["'](?:&quot;|&#39;|'|")*([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})/i);
  
  if (directMatch) {
    extractedGuid = directMatch[1];
  } else {
    const varGuidMatch = decodedSearch.match(/Name=["']Guid["'][^>]*?Value=["'](?:&quot;|&#39;|'|")*([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})/i)
                      || decodedSearch.match(/\bGuid=["'](?:&quot;|&#39;|'|")*([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})/i);
    if (varGuidMatch) {
      extractedGuid = varGuidMatch[1];
    } else {
      const rawGuidMatch = decodedSearch.match(/\b([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})\b/);
      if (rawGuidMatch) {
        extractedGuid = rawGuidMatch[1];
      }
    }
  }

  if (extractedGuid) {
    result.meta.guid = extractedGuid.toUpperCase();
  }

  // ── PASCAL SCRIPT ────────────────────────────────────────
  const scriptText = getAttr(xmlText, 'ScriptText.Text');
  if (scriptText && scriptText.trim()) {
    result.pascalScript = scriptText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }

  // ── SQL QUERIES ─────────────────────────────────────────
  const queryTagNames = [
    'TfrxADOQuery', 'TfrxIBXQuery', 'TfrxFDQuery', 'TfrxUniQuery',
    'TfrxOracleQuery', 'TfrxBDEQuery', 'TfrxDBXQuery', 'TfrxFOQuery',
    'TfrxQuery', 'TfrxCustomQuery', 'TfrxSQLQuery', 'TfrxADOTable'
  ];

  const seenQueryNames = new Set();
  const queryTags = [];
  queryTagNames.forEach(tn => {
    queryTags.push(...findTagAttributes(xmlText, tn));
  });

  // Ayrıca SQL.Text="..." veya SQL="..." içeren ancak farklı isimlendirilmiş veri etiketlerini de tara:
  const genericQueryChunks = findTagAttributes(xmlText, /<Tfrx[A-Za-z0-9_]+/);
  genericQueryChunks.forEach(chunk => {
    if ((chunk.includes('SQL.Text=') || chunk.includes('SQL=')) && !queryTags.includes(chunk)) {
      queryTags.push(chunk);
    }
  });

  for (const tag of queryTags) {
    const attrs = tag.replace(/^<Tfrx[A-Za-z0-9_]+\b\s*/, '').replace(/\s*\/?>$/, '');
    const name = getAttr(attrs, 'Name') || getAttr(attrs, 'UserName');
    const sql  = getAttr(attrs, 'SQL.Text') || getAttr(attrs, 'SQL');
    if (name) {
      const cleanName = name.trim();
      if (!seenQueryNames.has(cleanName)) {
        seenQueryNames.add(cleanName);
        result.queries.push({
          name: cleanName,
          sql: (sql || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
        });
      }
    }
  }

  // Bazı FRP sürümleri SQL'i attribute yerine <SQL.Text>, <SQL> veya <item> düğümlerinde saklar.
  const nestedQueryRx = /<(Tfrx[A-Za-z0-9_]*(?:Query|Table))\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
  let nestedQuery;
  while ((nestedQuery = nestedQueryRx.exec(xmlText)) !== null) {
    const attrs = nestedQuery[2] || '';
    const cleanName = (getAttr(attrs, 'Name') || getAttr(attrs, 'UserName') || '').trim();
    if (!cleanName) continue;
    const nestedSql = extractSqlFromElementBody(nestedQuery[3]);
    const existing = result.queries.find(q => q.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      if (!existing.sql && nestedSql) existing.sql = nestedSql;
    } else {
      seenQueryNames.add(cleanName);
      result.queries.push({ name: cleanName, sql: nestedSql });
    }
  }

  // PascalScript içerisindeki dinamik sorgu atamalarını da tara (örn. qn.SQL.Text := ..., qbine.SQL[5] := ...)
  if (result.pascalScript) {
    const scriptSqlRx = /\b([a-zA-Z_]\w*)\.SQL(?:\.Text|\[\d+\])?\s*[:+]=\s*(?:'([^'\r\n]+)'|StringReplace\([^,]+,\s*'[^']*',\s*'([^']*)'\))/gi;
    let sMatch;
    while ((sMatch = scriptSqlRx.exec(result.pascalScript)) !== null) {
      const qName = sMatch[1].trim();
      const rawFragment = sMatch[2] || sMatch[3] || '';
      if (!seenQueryNames.has(qName)) {
        seenQueryNames.add(qName);
        result.queries.push({
          name: qName,
          sql: rawFragment
        });
      } else {
        const existing = result.queries.find(q => q.name === qName);
        if (existing && !existing.sql && rawFragment) {
          existing.sql = rawFragment;
        }
      }
    }
  }

  // ── DATASETS ────────────────────────────────────────────
  const dsSet = new Set();
  const dsRx = /DataSetName="([^"]{1,50})"/g;
  let dm;
  while ((dm = dsRx.exec(xmlText)) !== null) {
    if (dm[1]) dsSet.add(dm[1]);
  }
  const dsRx2 = /\bDataSet="([^"]{1,50})"/g;
  while ((dm = dsRx2.exec(xmlText)) !== null) {
    if (dm[1]) dsSet.add(dm[1]);
  }
  result.queries.forEach(q => { if (q.name) dsSet.add(q.name); });
  result.datasets = [...dsSet].filter(d => d && d.length < 50).sort();

  // ── PARAMETRELER & DEĞİŞKENLER (XML <Params> & <Variables> & SQL Parametreleri) ──
  const allParams = new Set();
  // 1. Sorgulardan parametreleri topla:
  result.queries.forEach(q => {
    if (q.sql) {
      const extracted = extractParamsFromSql(q.sql);
      extracted.forEach(p => allParams.add(':' + p.replace(/^:/, '').toUpperCase()));
    }
  });

  // 2. XML <Params> ve <Variables> bloklarından topla:
  const paramBlockRx = /<(?:Params|Variables)\b[\s\S]*?<\/(?:Params|Variables)>/gi;
  let pbMatch;
  while ((pbMatch = paramBlockRx.exec(xmlText)) !== null) {
    const block = pbMatch[0];
    const itemRx = /<item\b([^>]*?)(?:\/>|>.*?<\/item>)/gi;
    let itm;
    while ((itm = itemRx.exec(block)) !== null) {
      const pName = getAttr(itm[1], 'Name');
      if (pName && !DATE_FORMAT_TOKENS.has(pName.toUpperCase()) && !/^(FONT|COLOR|PAGE|DATE|TIME)$/i.test(pName)) {
        allParams.add(':' + pName.toUpperCase());
      }
    }
  }


  // FastReport'ın nesne tabanlı parametre biçimleri blok dışında da bulunabilir.
  const paramTagNames = ['TfrxParamItem', 'TfrxParameter', 'TfrxVariable'];
  paramTagNames.forEach(tagName => {
    findTagAttributes(xmlText, tagName).forEach(tag => {
      const attrs = tag.replace(new RegExp(`^<${tagName}\\b\\s*`, 'i'), '').replace(/\s*\/?>$/, '');
      const pName = getAttr(attrs, 'Name') || getAttr(attrs, 'UserName');
      if (pName && !DATE_FORMAT_TOKENS.has(pName.toUpperCase()) && !/^(FONT|COLOR|PAGE|DATE|TIME)$/i.test(pName)) {
        allParams.add(':' + pName.toUpperCase());
      }
    });
  });
  result.paramNames = [...allParams].sort();
  result.variableCategories = readFrpVariables(xmlText).categories;

  // ── VERİTABANI TABLOLARI ─────────────────────────────────
  const SQL_RESERVED = new Set([
    'SELECT', 'WHERE', 'AND', 'OR', 'NOT', 'ON', 'DUAL', 'AS', 'SET', 'INTO', 'VALUES',
    'FROM', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'GROUP', 'ORDER',
    'HAVING', 'BY', 'UNION', 'ALL', 'WITH', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'DATE', 'TIME', 'TIMESTAMP',
    'TRUNC', 'SYSDATE', 'ROWNUM', 'LEVEL', 'TABLE', 'LATERAL', 'ROW', 'ROWS'
  ]);
  const tableSet = new Set();
  result.queries.forEach(q => {
    const sql = String(q.sql || '')
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/'(?:''|[^'\r\n])*'/g, "''")
      .replace(/\b(EXTRACT|SUBSTR|SUBSTRING|TRIM)\s*\([^)]*?\)/gi, '');
    const cteNames = new Set();
    const cteRx = /(?:\bWITH|,)\s*([a-zA-Z_$][\w$]*)\s+AS\s*\(/gi;
    let cteMatch;
    while ((cteMatch = cteRx.exec(sql)) !== null) cteNames.add(cteMatch[1].toUpperCase());

    const rx = /\b(?:FROM|JOIN)\s+((?:["`\[]?[a-zA-Z0-9_$]+["`\]]?)(?:\s*\.\s*["`\[]?[a-zA-Z0-9_$]+["`\]]?)*)/gi;
    let tm;
    while ((tm = rx.exec(sql)) !== null) {
      const rawTable = tm[1].replace(/["`\[\]\s]/g, '').trim().toUpperCase();
      const unqualifiedName = rawTable.split('.').pop();
      if (rawTable && !SQL_RESERVED.has(rawTable) && !SQL_RESERVED.has(unqualifiedName) && !cteNames.has(rawTable) && rawTable.length > 2 && !/^\d+$/.test(rawTable)) {
        tableSet.add(rawTable);
      }
    }
  });
  result.tableNames = [...tableSet].sort();

  // ── RAPOR ELEMAN AĞACI & GÖRSEL TASARIM MODELİ ───────────
  result.pages = [];
  result.dialogPages = [];

  function numVal(v, fallback = 0) {
    if (v === null || v === undefined) return fallback;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? fallback : n;
  }

  function parseComponentNode(type, attrsChunk, innerContent = '') {
    const name = getAttr(attrsChunk, 'Name') || type;
    const left = numVal(getAttr(attrsChunk, 'Left'), 0);
    const top = numVal(getAttr(attrsChunk, 'Top'), 0);
    const width = numVal(getAttr(attrsChunk, 'Width'), 100);
    const height = numVal(getAttr(attrsChunk, 'Height'), 20);
    const text = getAttr(attrsChunk, 'Text') || getAttr(attrsChunk, 'Memo.Text') || getAttr(attrsChunk, 'Caption') || '';
    
    // Font
    const fontName = getAttr(attrsChunk, 'Font.Name') || 'Arial';
    const fontHeight = numVal(getAttr(attrsChunk, 'Font.Height'), -11);
    const fontSize = Math.abs(fontHeight) || 10;
    const fontColor = getAttr(attrsChunk, 'Font.Color') || '-16777208';
    const fontStyle = getAttr(attrsChunk, 'Font.Style') || '0';
    
    // Frame & Fill
    const fillBackColor = getAttr(attrsChunk, 'Fill.BackColor') || getAttr(attrsChunk, 'Color') || 'clNone';
    const fillForeColor = getAttr(attrsChunk, 'Fill.ForeColor') || 'clNone';
    const fillStyle = getAttr(attrsChunk, 'Fill.Style') || getAttr(attrsChunk, 'BrushStyle') || '';
    const fillType = getAttr(attrsChunk, 'FillType') || 'ftBrush';
    const frameTyp = numVal(getAttr(attrsChunk, 'Frame.Typ'), 0);
    const frameColor = getAttr(attrsChunk, 'Frame.Color') || '-16777208';
    const frameWidth = numVal(getAttr(attrsChunk, 'Frame.Width'), 1);
    const frameStyle = getAttr(attrsChunk, 'Frame.Style') || 'fsSolid';
    
    // Align & Rotation
    const align = getAttr(attrsChunk, 'Align') || 'baNone';
    const hAlign = getAttr(attrsChunk, 'HAlign') || 'haLeft';
    const vAlign = getAttr(attrsChunk, 'VAlign') || 'vaTop';
    const rotation = numVal(getAttr(attrsChunk, 'Rotation'), 0);
    
    // Data bindings & Formats
    const dataSet = getAttr(attrsChunk, 'DataSetName') || getAttr(attrsChunk, 'DataSet') || '';
    const dataField = getAttr(attrsChunk, 'DataField') || '';
    const displayFormat = getAttr(attrsChunk, 'DisplayFormat.FormatStr') || getAttr(attrsChunk, 'DisplayFormat') || '';
    const hyperlink = getAttr(attrsChunk, 'Hyperlink.Value') || getAttr(attrsChunk, 'Hyperlink') || '';
    
    // Events
    const onBeforePrint = getAttr(attrsChunk, 'OnBeforePrint') || '';
    const onClick = getAttr(attrsChunk, 'OnClick') || '';
    const onAfterPrint = getAttr(attrsChunk, 'OnAfterPrint') || '';
    const onPreviewClick = getAttr(attrsChunk, 'OnPreviewClick') || '';
    const onChange = getAttr(attrsChunk, 'OnChange') || '';
    const onMasterDetail = getAttr(attrsChunk, 'OnMasterDetail') || '';
    const onEnter = getAttr(attrsChunk, 'OnEnter') || '';
    const onExit = getAttr(attrsChunk, 'OnExit') || '';
    const onKeyDown = getAttr(attrsChunk, 'OnKeyDown') || '';
    const onAfterData = getAttr(attrsChunk, 'OnAfterData') || '';
    const onAfterCalcHeight = getAttr(attrsChunk, 'OnAfterCalcHeight') || '';
    
    // Additional Delphi Properties
    const allowExpressions = getAttr(attrsChunk, 'AllowExpressions') !== 'False';
    const autoWidth = getAttr(attrsChunk, 'AutoWidth') === 'True';
    const autoSize = getAttr(attrsChunk, 'AutoSize') === 'True';
    const allowHTMLTags = getAttr(attrsChunk, 'AllowHTMLTags') === 'True';
    const wordWrap = getAttr(attrsChunk, 'WordWrap') !== 'False';
    const printable = getAttr(attrsChunk, 'Printable') !== 'False';
    const suppressRepeatedValues = getAttr(attrsChunk, 'SuppressRepeatedValues') === 'True';
    const hideZeros = getAttr(attrsChunk, 'HideZeros') === 'True';
    const clipped = getAttr(attrsChunk, 'Clipped') !== 'False';
    const lineSpacing = numVal(getAttr(attrsChunk, 'LineSpacing'), 0);
    const paragraphGap = numVal(getAttr(attrsChunk, 'ParagraphGap'), 0);
    const charSpacing = numVal(getAttr(attrsChunk, 'CharSpacing'), 0);
    const gapX = numVal(getAttr(attrsChunk, 'GapX'), 0);
    const gapY = numVal(getAttr(attrsChunk, 'GapY'), 0);
    const expressionDelimiters = getAttr(attrsChunk, 'ExpressionDelimiters') || '[,]';
    const shiftMode = getAttr(attrsChunk, 'ShiftMode') || 'smAlways';
    const stretchMode = getAttr(attrsChunk, 'StretchMode') || 'smDontStretch';
    const visible = getAttr(attrsChunk, 'Visible') !== 'False';
    const enabled = getAttr(attrsChunk, 'Enabled') !== 'False';
    
    // Barcode properties
    const barType = getAttr(attrsChunk, 'BarType') || '';
    const showText = getAttr(attrsChunk, 'ShowText') !== 'False';
    const calcCheckSum = getAttr(attrsChunk, 'CalcCheckSum') === 'True';
    const zoom = numVal(getAttr(attrsChunk, 'Zoom'), 1);

    // Chart / Grafik properties
    let seriesType = 'FastLineSeries';
    let chartDataSet = dataSet;
    let xField = '';
    let yField = '';
    const propData = getAttr(attrsChunk, 'PropData');
    if (propData) {
      let decoded = '';
      for (let i = 0; i < propData.length; i += 2) {
        const code = parseInt(propData.substr(i, 2), 16);
        if (code >= 32 && code <= 126) decoded += String.fromCharCode(code);
        else decoded += ' ';
      }
      const sMatch = decoded.match(/T(\w+Series)/i);
      if (sMatch) seriesType = sMatch[1];
      const dsMatch = decoded.match(/DataSet="([^"]+)"/i) || decoded.match(/DataSetName="([^"]+)"/i);
      if (dsMatch) chartDataSet = dsMatch[1];
      const xm = decoded.match(/(?:Source1|XSource)="([^"]+)"/i);
      if (xm) xField = xm[1].replace(/^[a-zA-Z0-9_]+\.|\"/g, '').replace(/&#34;/g, '');
      const ym = decoded.match(/(?:Source2|YSource)="([^"]+)"/i);
      if (ym) yField = ym[1].replace(/^[a-zA-Z0-9_]+\.|\"/g, '').replace(/&#34;/g, '');
    }

    // Shape properties
    const shape = getAttr(attrsChunk, 'Shape') || 'skRectangle';

    // Picture / Resim properties
    let pictureData = getAttr(attrsChunk, 'Picture.Data') || getAttr(attrsChunk, 'Picture') || getAttr(attrsChunk, 'Picture.PropData') || '';
    if (!pictureData && innerContent) {
      const picMatch = innerContent.match(/<Picture\b[^>]*>([\s\S]*?)<\/Picture>/i);
      if (picMatch) pictureData = picMatch[1].trim();
    }
    const fileLink = getAttr(attrsChunk, 'FileLink') || '';
    const keepAspectRatio = getAttr(attrsChunk, 'KeepAspectRatio') !== 'False';
    const center = getAttr(attrsChunk, 'Center') === 'True';
    const isStretched = getAttr(attrsChunk, 'Stretched') === 'True';
    
    return {
      type,
      name,
      left,
      top,
      width,
      height,
      text,
      fontName,
      fontHeight,
      fontSize,
      fontColor,
      fontStyle,
      fillBackColor,
      fillForeColor,
      fillStyle,
      fillType,
      frameTyp,
      frameColor,
      frameWidth,
      frameStyle,
      align,
      hAlign,
      vAlign,
      rotation,
      dataSet: dataSet || chartDataSet,
      dataField,
      displayFormat,
      hyperlink,
      onBeforePrint,
      onClick,
      onAfterPrint,
      onPreviewClick,
      onChange,
      onMasterDetail,
      onEnter,
      onExit,
      onKeyDown,
      onAfterData,
      onAfterCalcHeight,
      allowExpressions,
      autoWidth,
      autoSize,
      allowHTMLTags,
      wordWrap,
      printable,
      suppressRepeatedValues,
      hideZeros,
      clipped,
      lineSpacing,
      paragraphGap,
      charSpacing,
      gapX,
      gapY,
      expressionDelimiters,
      shiftMode,
      stretchMode,
      visible,
      enabled,
      barType,
      showText,
      calcCheckSum,
      zoom,
      seriesType,
      xField,
      yField,
      shape,
      picture: pictureData,
      fileLink,
      keepAspectRatio,
      center,
      stretched: isStretched,
      subreportPage: type === 'TfrxSubreport' ? getAttr(attrsChunk, 'Page') || '' : undefined,
      printOnParent: type === 'TfrxSubreport' ? getAttr(attrsChunk, 'PrintOnParent') === 'True' : undefined,
      restrictions: getAttr(attrsChunk, 'Restrictions') || undefined,
      rawAttrs: attrsChunk
    };
  }

  // 1. Rapor sayfaları (FastReport sürümleri farklı sayfa sınıf adları kullanabilir)
  const pageRx = /<(TfrxReportPage|TfrxDMPPage|TfrxPage|ReportPage)\b([\s\S]*?)>([\s\S]*?)<\/\1>/gi;
  let pMatch;
  while ((pMatch = pageRx.exec(xmlText)) !== null) {
    const pType = pMatch[1];
    const pAttrs = pMatch[2];
    const pContent = pMatch[3];

    const pageObj = {
      type: pType,
      name: getAttr(pAttrs, 'Name') || 'Page1',
      restrictions: getAttr(pAttrs, 'Restrictions') || undefined,
      orientation: getAttr(pAttrs, 'Orientation') || 'poPortrait',
      paperWidth: numVal(getAttr(pAttrs, 'PaperWidth'), 210),
      paperHeight: numVal(getAttr(pAttrs, 'PaperHeight'), 297),
      leftMargin: numVal(getAttr(pAttrs, 'LeftMargin'), 10),
      topMargin: numVal(getAttr(pAttrs, 'TopMargin'), 10),
      rightMargin: numVal(getAttr(pAttrs, 'RightMargin'), 10),
      bottomMargin: numVal(getAttr(pAttrs, 'BottomMargin'), 10),
      columnWidth: numVal(getAttr(pAttrs, 'ColumnWidth'), 0),
      paperSize: numVal(getAttr(pAttrs, 'PaperSize'), 256),
      columns: numVal(getAttr(pAttrs, 'Columns'), 0),
      columnPositions: getAttr(pAttrs, 'ColumnPositions.Text'),
      mirrorMargins: getAttr(pAttrs, 'MirrorMargins') === 'True',
      endlessWidth: getAttr(pAttrs, 'EndlessWidth') === 'True',
      endlessHeight: getAttr(pAttrs, 'EndlessHeight') === 'True',
      printOnPreviousPage: getAttr(pAttrs, 'PrintOnPreviousPage') === 'True',
      titleBeforeHeader: getAttr(pAttrs, 'TitleBeforeHeader') !== 'False',
      visible: getAttr(pAttrs, 'Visible') !== 'False',
      onClick: getAttr(pAttrs, 'OnClick') || '',
      onBeforePrint: getAttr(pAttrs, 'OnBeforePrint') || '',
      onAfterPrint: getAttr(pAttrs, 'OnAfterPrint') || '',
      bands: []
    };

    // Bantlar
    const bandTagRx = /<(Tfrx(?:MasterData|DetailData|SubdetailData|Header|Footer|PageHeader|PageFooter|GroupHeader|GroupFooter|ColumnHeader|ColumnFooter|ReportTitle|ReportSummary|DataBand|Child|Overlay|DMPHeader|DMPFooter|DMPGroupHeader|DMPGroupFooter|DMPMasterData|DMPDetailData|DMPSubdetailData))\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
    let bMatch;
    while ((bMatch = bandTagRx.exec(pContent)) !== null) {
      const bType = bMatch[1];
      const bAttrs = bMatch[2];
      const bContent = bMatch[3] || '';

      const bandObj = {
        type: bType,
        name: getAttr(bAttrs, 'Name') || bType,
        top: numVal(getAttr(bAttrs, 'Top'), 0),
        height: numVal(getAttr(bAttrs, 'Height'), 30),
        width: numVal(getAttr(bAttrs, 'Width'), 1000),
        dataSet: getAttr(bAttrs, 'DataSetName') || getAttr(bAttrs, 'DataSet') || '',
        condition: getAttr(bAttrs, 'Condition') || '',
        stretched: getAttr(bAttrs, 'Stretched') === 'True',
        allowSplit: getAttr(bAttrs, 'AllowSplit') === 'True',
        keepTogether: getAttr(bAttrs, 'KeepTogether') === 'True',
        keepChild: getAttr(bAttrs, 'KeepChild') === 'True',
        keepHeader: getAttr(bAttrs, 'KeepHeader') === 'True',
        keepFooter: getAttr(bAttrs, 'KeepFooter') === 'True',
        startNewPage: getAttr(bAttrs, 'StartNewPage') === 'True',
        printIfDetailEmpty: getAttr(bAttrs, 'PrintIfDetailEmpty') === 'True',
        rowCount: numVal(getAttr(bAttrs, 'RowCount'), 0),
        vertical: getAttr(bAttrs, 'Vertical') === 'True',
        left: numVal(getAttr(bAttrs, 'Left'), 0),
        onClick: getAttr(bAttrs, 'OnClick') || '',
        onBeforePrint: getAttr(bAttrs, 'OnBeforePrint') || '',
        onAfterPrint: getAttr(bAttrs, 'OnAfterPrint') || '',
        onPreviewClick: getAttr(bAttrs, 'OnPreviewClick') || '',
        onMasterDetail: getAttr(bAttrs, 'OnMasterDetail') || '',
        visible: getAttr(bAttrs, 'Visible') !== 'False',
        restrictions: getAttr(bAttrs, 'Restrictions') || undefined,
        rawAttrs: bAttrs,
        components: []
      };

      const compRx = /<(Tfrx[A-Za-z0-9_]+View|TfrxChartView|TfrxShapeView|TfrxDMPMemoView|TfrxBarCodeView|TfrxPictureView|TfrxLineView|TfrxMemoView|TfrxSubreport)\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
      let cMatch;
      while ((cMatch = compRx.exec(bContent)) !== null) {
        const cType = cMatch[1];
        const cAttrs = cMatch[2];
        const compObj = parseComponentNode(cType, cAttrs, cMatch[3]);
        bandObj.components.push(compObj);
      }

      pageObj.bands.push(bandObj);
    }

    // Doğrudan Sayfa Üzerine Eklenmiş Bileşenler (Page-Level Direct Components - örn. DONOR_REAKSIYON, pgApache)
    const directPContent = pContent.replace(bandTagRx, '');
    const directCompRx = /<(Tfrx[A-Za-z0-9_]+View|TfrxChartView|TfrxShapeView|TfrxDMPMemoView|TfrxBarCodeView|TfrxPictureView|TfrxLineView|TfrxMemoView|TfrxSubreport)\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
    let dcMatch;
    const directComponents = [];
    while ((dcMatch = directCompRx.exec(directPContent)) !== null) {
      const cType = dcMatch[1];
      const cAttrs = dcMatch[2];
      const compObj = parseComponentNode(cType, cAttrs, dcMatch[3]);
      directComponents.push(compObj);
    }

    if (directComponents.length > 0) {
      // Doğrudan bileşenlerin en üst koordinatını bul
      let minCompTop = Infinity;
      let maxCompBottom = 30;
      directComponents.forEach(c => {
        if (c.top < minCompTop) minCompTop = c.top;
        const bottom = (c.top || 0) + (c.height || 0);
        if (bottom > maxCompBottom) maxCompBottom = bottom;
      });
      if (minCompTop === Infinity) minCompTop = 0;

      // Eğer sayfada önceden bantlar varsa (örn. ReportTitle), direct component'lerin offsetini normalize et
      const topOffset = pageObj.bands.length > 0 ? minCompTop : 0;
      if (topOffset > 0) {
        directComponents.forEach(c => {
          c.top = Math.max(0, c.top - topOffset);
        });
      }

      pageObj.bands.push({
        type: 'TfrxPageContent',
        name: pageObj.bands.length > 0 ? 'SayfaDetayı' : 'SayfaGövdesi',
        top: topOffset,
        height: Math.max(30, maxCompBottom - topOffset),
        width: pageObj.paperWidth ? Math.ceil(pageObj.paperWidth * 3.78) : 1000,
        dataSet: '',
        condition: '',
        stretched: false,
        vertical: false,
        left: 0,
        rawAttrs: '',
        components: directComponents
      });
    }

    // Bantları sırala: Bileşeni olan bantları Top koordinatına göre sırala
    pageObj.bands.sort((a, b) => {
      if (a.components.length > 0 && b.components.length > 0) {
        return a.top - b.top;
      }
      if (a.components.length > 0 && b.components.length === 0) return -1;
      if (a.components.length === 0 && b.components.length > 0) return 1;
      return a.top - b.top;
    });

    result.pages.push(pageObj);
  }

  // Sayfa sarmalayıcısı olmayan eski/özel FRP çıktılarında görsel nesneleri kaybetme.
  if (result.pages.length === 0) {
    const fallbackComponents = [];
    const fallbackCompRx = /<(Tfrx[A-Za-z0-9_]+View|TfrxChartView|TfrxShapeView|TfrxDMPMemoView|TfrxBarCodeView|TfrxPictureView|TfrxLineView|TfrxMemoView|TfrxSubreport)\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
    let fallbackMatch;
    while ((fallbackMatch = fallbackCompRx.exec(xmlText)) !== null) {
      fallbackComponents.push(parseComponentNode(fallbackMatch[1], fallbackMatch[2], fallbackMatch[3]));
    }

    if (fallbackComponents.length > 0) {
      const maxBottom = fallbackComponents.reduce((max, component) => {
        return Math.max(max, (component.top || 0) + (component.height || 0));
      }, 30);
      result.pages.push({
        type: 'TfrxReportPage',
        name: 'Page1',
        orientation: 'poPortrait',
        paperWidth: 210,
        paperHeight: 297,
        leftMargin: 10,
        topMargin: 10,
        rightMargin: 10,
        bottomMargin: 10,
        columnWidth: 0,
        bands: [{
          type: 'TfrxPageContent',
          name: 'KurtarılanSayfaİçeriği',
          top: 0,
          height: Math.max(30, maxBottom),
          width: 794,
          dataSet: '',
          condition: '',
          stretched: false,
          vertical: false,
          left: 0,
          rawAttrs: '',
          components: fallbackComponents
        }]
      });
    }
  }

  // 2. TfrxDialogPage (Kullanıcı Parametre / Filtreleme Formları)
  function parseControlNode(ctrlType, ctrlAttrs, innerContent = '') {
    const ctrlObj = {
      type: ctrlType,
      name: getAttr(ctrlAttrs, 'Name') || ctrlType,
      left: numVal(getAttr(ctrlAttrs, 'Left'), 0),
      top: numVal(getAttr(ctrlAttrs, 'Top'), 0),
      width: numVal(getAttr(ctrlAttrs, 'Width'), 100),
      height: numVal(getAttr(ctrlAttrs, 'Height'), 25),
      caption: getAttr(ctrlAttrs, 'Caption') || getAttr(ctrlAttrs, 'Text') || '',
      text: getAttr(ctrlAttrs, 'Text') || '',
      fontName: getAttr(ctrlAttrs, 'Font.Name') || 'Segoe UI',
      fontSize: Math.abs(numVal(getAttr(ctrlAttrs, 'Font.Height'), -11)),
      fontStyle: getAttr(ctrlAttrs, 'Font.Style') || '0',
      fontColor: getAttr(ctrlAttrs, 'Font.Color') || '-16777208',
      color: getAttr(ctrlAttrs, 'Color') || 'clBtnFace',
      checked: getAttr(ctrlAttrs, 'Checked') === 'True',
      enabled: getAttr(ctrlAttrs, 'Enabled') !== 'False',
      visible: getAttr(ctrlAttrs, 'Visible') !== 'False',
      modalResult: getAttr(ctrlAttrs, 'ModalResult') || '',
      listField: getAttr(ctrlAttrs, 'ListField') || '',
      keyField: getAttr(ctrlAttrs, 'KeyField') || '',
      listSource: getAttr(ctrlAttrs, 'ListSource') || '',
      items: getAttr(ctrlAttrs, 'Items.Text') || '',
      date: getAttr(ctrlAttrs, 'Date') || '',
      time: getAttr(ctrlAttrs, 'Time') || '',
      onClick: getAttr(ctrlAttrs, 'OnClick') || '',
      onBeforePrint: getAttr(ctrlAttrs, 'OnBeforePrint') || '',
      onChange: getAttr(ctrlAttrs, 'OnChange') || '',
      onEnter: getAttr(ctrlAttrs, 'OnEnter') || '',
      onExit: getAttr(ctrlAttrs, 'OnExit') || '',
      onKeyDown: getAttr(ctrlAttrs, 'OnKeyDown') || '',
      restrictions: getAttr(ctrlAttrs, 'Restrictions') || undefined,
      rawAttrs: ctrlAttrs,
      children: []
    };

    if (innerContent && innerContent.trim()) {
      const childCtrlRx = /<(Tfrx[A-Za-z0-9_]+(?:Control|Sheet|PageControl|TabSheet))\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
      let cMatch;
      while ((cMatch = childCtrlRx.exec(innerContent)) !== null) {
        ctrlObj.children.push(parseControlNode(cMatch[1], cMatch[2], cMatch[3] || ''));
      }
    }

    return ctrlObj;
  }

  const dialogRx = /<TfrxDialogPage\b([\s\S]*?)>([\s\S]*?)<\/TfrxDialogPage>/gi;
  let dMatch;
  while ((dMatch = dialogRx.exec(xmlText)) !== null) {
    const dAttrs = dMatch[1];
    const dContent = dMatch[2];

    const dialogObj = {
      type: 'TfrxDialogPage',
      name: getAttr(dAttrs, 'Name') || 'DialogPage1',
      caption: getAttr(dAttrs, 'Caption') || 'Parametre Formu',
      left: numVal(getAttr(dAttrs, 'Left'), 100),
      top: numVal(getAttr(dAttrs, 'Top'), 100),
      width: numVal(getAttr(dAttrs, 'Width'), 360),
      height: numVal(getAttr(dAttrs, 'Height'), 450),
      position: getAttr(dAttrs, 'Position') || 'poScreenCenter',
      color: getAttr(dAttrs, 'Color') || 'clBtnFace',
      fillBackColor: getAttr(dAttrs, 'Color') || 'clBtnFace',
      controls: []
    };

    const ctrlRx = /<(Tfrx[A-Za-z0-9_]+(?:Control|Sheet|PageControl|TabSheet))\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
    let ctrlMatch;
    while ((ctrlMatch = ctrlRx.exec(dContent)) !== null) {
      const ctrlType = ctrlMatch[1];
      const ctrlAttrs = ctrlMatch[2];
      const innerContent = ctrlMatch[3] || '';
      dialogObj.controls.push(parseControlNode(ctrlType, ctrlAttrs, innerContent));
    }

    result.dialogPages.push(dialogObj);
  }

  // Geriye dönük uyumluluk için tree listesi oluştur
  if (result.pages.length > 0) {
    result.pages.forEach(p => {
      p.bands.forEach(b => {
        const memos = b.components
          .filter(c => c.type === 'TfrxMemoView')
          .map(m => ({ name: m.name, text: m.text }));
        if (memos.length > 0) {
          result.tree.push({ bandName: b.name, type: b.type, memos });
        }
      });
    });
  }

  if (typeof DOMParser !== 'undefined') {
    const appearanceDoc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (!appearanceDoc.querySelector('parsererror')) {
      const nodes = Array.from(appearanceDoc.getElementsByTagName('*'));
      result.pages.forEach(page => (page.bands || []).forEach(band => (band.components || []).forEach(component => {
        const node = nodes.find(n => n.nodeName === component.type && n.getAttribute('Name') === component.name);
        if (node) {
          Object.assign(component, readFrpAppearance(node));
          if (typeof window !== 'undefined' && window.FrpComplexCodec && component.type==='TfrxChartView') component._complex=window.FrpComplexCodec.readChart(node);
          if (typeof window !== 'undefined' && window.FrpComplexCodec && /^(TfrxCrossView|TfrxDBCrossView)$/.test(component.type)) component._complex=window.FrpComplexCodec.readCross(node);
        }
      })));
    }
  }
  result.rawXml = xmlText;
  return result;
}

// Advanced VCL properties keep their XML names and preserve unknown attributes.
const FRP_APPEARANCE_FIELDS = {
 'Font.Name':'fontName','Font.Height':'fontHeight','Font.Color':'fontColor','Font.Style':'fontStyle',
 'FillType':'fillType','Fill.BackColor':'fillBackColor','Fill.ForeColor':'fillForeColor','Fill.Style':'fillStyle',
 'Frame.Typ':'frameTyp','Frame.Color':'frameColor','Frame.Width':'frameWidth','Frame.Style':'frameStyle',
 'DisplayFormat.FormatStr':'displayFormat','Hyperlink.Value':'hyperlink'
};
function readFrpAppearance(node) {
 const attrs={};
 Array.from(node.attributes||[]).forEach(a=>{if(/^(Font\.|Frame\.|Fill\.|FillType$|DisplayFormat\.|Hyperlink\.)/.test(a.name))attrs[a.name]=a.value;});
 const blocks=Array.from(node.children||[]).filter(n=>n.nodeName==='Highlights');
 const rules=[];
 let reason='';
 if(node.hasAttribute('Highlights')||blocks.length>1)reason='Bu Highlight saklama biçimi henüz düzenlenemiyor; özgün içerik korunuyor.';
 if(blocks.length){
   if(Array.from(blocks[0].children).some(n=>n.nodeName!=='item'))reason='Tanınmayan Highlight öğeleri korunuyor; bu yapı salt okunur.';
   Array.from(blocks[0].children).filter(n=>n.nodeName==='item').forEach(n=>rules.push({attrs:Object.fromEntries(Array.from(n.attributes).map(a=>[a.name,a.value])),xml:new XMLSerializer().serializeToString(n)}));
 } else {
   const legacy={};
   Array.from(node.attributes||[]).forEach(a=>{if(a.name.startsWith('Highlight.'))legacy[a.name.slice(10)]=a.value;});
   if(Object.keys(legacy).length)rules.push({attrs:legacy});
 }
 const formatCollection=node.hasAttribute('Formats')||Array.from(node.children||[]).some(n=>n.nodeName==='Formats');
 return {_appearance:attrs,_appearanceReadOnly:formatCollection?{DisplayFormat:'Bu nesnede birden çok ifade için Formats koleksiyonu var. Özgün biçimler korunuyor; tek biçim editörü bu yapıyı değiştiremez.'}:{},_highlights:{rules,collection:blocks.length>0,reason}};
}
function writeFrpAppearance(node,model) {
 Object.entries(model._appearanceEdits||{}).forEach(([key,value])=>{
   if(/^(Font\.|Frame\.|Fill\.|FillType$|DisplayFormat\.|Hyperlink\.)/.test(key)){
     if (value === '' && /^Frame\.(Left|Right|Top|Bottom)Line\./.test(key)) node.removeAttribute(key);
     else node.setAttribute(key,String(value));
   }
 });
 if(!model._highlightsEdited)return;
 if(model._highlights?.reason)throw new Error(model._highlights.reason);
 const rules=model._highlights?.rules||[], doc=node.ownerDocument;
 Array.from(node.attributes).filter(a=>a.name.startsWith('Highlight.')).forEach(a=>node.removeAttribute(a.name));
 const blocks=Array.from(node.children).filter(n=>n.nodeName==='Highlights');
 if(rules.length===1&&!model._highlights.collection&&!rules[0].xml){
   blocks.forEach(n=>n.remove());
   Object.entries(rules[0].attrs).forEach(([k,v])=>{if(v!==''||!/^Frame\.(Left|Right|Top|Bottom)Line\./.test(k))node.setAttribute('Highlight.'+k,String(v));});
 } else {
   let block=blocks[0];
   if(!block&&rules.length){block=doc.createElement('Highlights');node.appendChild(block);}
   if(!block)return;
   Array.from(block.children).filter(n=>n.nodeName==='item').forEach(n=>n.remove());
   rules.forEach(rule=>{
     let item=doc.createElement('item');
     if(rule.xml){
       const original=new DOMParser().parseFromString(rule.xml,'application/xml');
       if(original.querySelector('parsererror'))throw new Error('Highlight XML okunamadı.');
       item=doc.importNode(original.documentElement,true);
     }
     Object.entries(rule.attrs).forEach(([k,v])=>{if(v===''&&/^Frame\.(Left|Right|Top|Bottom)Line\./.test(k))item.removeAttribute(k);else item.setAttribute(k,String(v));});
     block.appendChild(item);
   });
   if(!rules.length&&!block.attributes.length&&!block.children.length)block.remove();
 }
}


function encodeFrpAttr(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&#60;')
    .replace(/>/g, '&#62;')
    .replace(/"/g, '&#34;')
    .replace(/'/g, '&#39;')
    .replace(/\r\n/g, '&#13;&#10;')
    .replace(/\n/g, '&#13;&#10;')
    .replace(/\r/g, '&#13;&#10;');
}


function renameFrpScriptIdentifiers(script, names) {
  // Preserve Pascal strings and comments; replace whole code identifiers only.
  return String(script || '').replace(/'(?:''|[^'])*'|\{[\s\S]*?\}|\(\*[\s\S]*?\*\)|\/\/[^\r\n]*|[A-Za-z_][A-Za-z0-9_]*/g,
    token => /^[A-Za-z_]/.test(token) ? (names.get(token.toLowerCase()) || token) : token);
}

function buildUpdatedFrpXml(file, newVersionNumStr) {
  let xml = file.rawXml || '';
  if (!xml) {
    const scriptText = file.pascalScript ? ` ScriptText.Text="${encodeFrpAttr(file.pascalScript)}"` : '';
    const verBuild = newVersionNumStr ? ` ReportOptions.VersionBuild="${encodeFrpAttr(newVersionNumStr)}"` : '';
    xml = `<?xml version="1.0" encoding="utf-8" standalone="no"?>\n` +
      `<TfrxReport Tag="1" Version="${file.meta?.version || '2022.2'}"${verBuild} ScriptLanguage="${file.meta?.scriptLang || 'PascalScript'}"${scriptText}>\n` +
      `  <TfrxDataPage Name="Data" Height="1000" Left="0" Top="0" Width="1000">\n` +
      (file.queries || []).map(q => `    <TfrxFOQuery Name="${encodeFrpAttr(q.name)}" UserName="${encodeFrpAttr(q.name)}" SQL.Text="${encodeFrpAttr(q.sql)}"/>`).join('\n') + '\n' +
      `  </TfrxDataPage>\n` +
      `</TfrxReport>`;
    // Continue through the same model synchronization used for existing reports.
  }

  (file.queries || []).forEach(q => {
    const encodedSql = encodeFrpAttr(q.sql);
    const escapedName = typeof escapeRegex === 'function' ? escapeRegex(q.name) : q.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tagRx = new RegExp(`(<Tfrx(?:FOQuery|Query)\\b[^>]*?\\b(?:Name|UserName)=["']${escapedName}["'][^>]*?>)`, 'gi');
    xml = xml.replace(tagRx, match => {
      if (/\bSQL\.Text=["']/i.test(match)) {
        return match.replace(/(\bSQL\.Text=)"[^"]*?"/gi, (m, g1) => `${g1}"${encodedSql}"`)
                    .replace(/(\bSQL\.Text=)'[^']*?'/gi, (m, g1) => `${g1}"${encodedSql}"`);
      }
      return match;
    });
  });

  if (file.pascalScript !== undefined && file.pascalScript !== null) {
    const encodedScript = encodeFrpAttr(file.pascalScript);
    if (/<TfrxReport\b[^>]*?\bScriptText\.Text=/.test(xml)) {
      xml = xml.replace(/(<TfrxReport\b[^>]*?\bScriptText\.Text=)"([^"]*?)"/gi, (m, g1) => `${g1}"${encodedScript}"`)
               .replace(/(<TfrxReport\b[^>]*?\bScriptText\.Text=)'([^']*?)'/gi, (m, g1) => `${g1}"${encodedScript}"`);
    } else {
      xml = xml.replace(/(<TfrxReport\b[^>]*?)(\/?>)/i, (m, g1, g2) => {
        return `${g1} ScriptText.Text="${encodedScript}"${g2}`;
      });
    }
  }

  if (newVersionNumStr) {
    if (/\bReportOptions\.VersionBuild="[^"]*"/.test(xml)) {
      xml = xml.replace(/(\bReportOptions\.VersionBuild=)"[^"]*"/gi, (m, g1) => `${g1}"${newVersionNumStr}"`);
    }
  }

  // Yeni sorgular ile görsel tasarım modelini gerçek FRP XML DOM'una uygula.
  // Bu katman yalnızca mevcut alanları güncellemez; editörde eklenen query,
  // band ve component düğümlerini de doğru parent altına oluşturur.
  try {
    const ParserClass = typeof DOMParser !== 'undefined' ? DOMParser : (typeof global !== 'undefined' ? global.DOMParser : null);
    const SerializerClass = typeof XMLSerializer !== 'undefined' ? XMLSerializer : (typeof global !== 'undefined' ? global.XMLSerializer : null);
    if (!ParserClass || !SerializerClass) return xml;
    const doc = new ParserClass().parseFromString(xml, 'application/xml');
    if (!doc.querySelector('parsererror') && doc.documentElement) {
      const root = doc.documentElement;
      const cleanupTasks = [];
      const renamedObjects = new Map();
      const elements = () => Array.from(doc.getElementsByTagName('*'));
      const managedComponentType = type => /^Tfrx(?:[A-Za-z0-9_]+View|Subreport)$/i.test(String(type || ''));
      const managedBandType = type => /^Tfrx(?:MasterData|DetailData|SubdetailData|Header|Footer|PageHeader|PageFooter|GroupHeader|GroupFooter|ColumnHeader|ColumnFooter|ReportTitle|ReportSummary|DataBand|Child|Overlay|DMPHeader|DMPFooter|DMPGroupHeader|DMPGroupFooter|DMPMasterData|DMPDetailData|DMPSubdetailData)$/i.test(String(type || ''));
      const managedStructuralType = type => /^(?:TfrxReport|TfrxDataPage|TfrxReportPage|TfrxDMPPage|TfrxPage|ReportPage|TfrxDialogPage|TfrxFOQuery|TfrxQuery)$/i.test(String(type || ''))
        || /^Tfrx[A-Za-z0-9_]+(?:Control|Sheet|PageControl|TabSheet)$/i.test(String(type || ''));
      const protectedNamedNodes = elements().filter(node => {
        if (file.variablesEdited === true && node.nodeName === 'item' && node.parentNode?.nodeName === 'Variables') return false;
        const name = node.getAttribute('Name') || node.getAttribute('UserName');
        return name && !managedComponentType(node.nodeName) && !managedBandType(node.nodeName) && !managedStructuralType(node.nodeName);
      }).map(node => ({ type: node.nodeName, name: node.getAttribute('Name') || node.getAttribute('UserName') }));
      const byName = (name, type, parent) => {
        const wantedName = String(name);
        const wantedType = String(type || '');
        const candidates = parent ? Array.from(parent.children || []) : elements();
        return candidates.find(node => node.getAttribute('Name') === wantedName && (!wantedType || node.nodeName === wantedType))
          || (!parent ? null : elements().find(node => node.getAttribute('Name') === wantedName && (!wantedType || node.nodeName === wantedType)))
          || null;
      };
      const setAttrs = (node, attrs) => Object.entries(attrs).forEach(([key, value]) => {
        if (value !== undefined && value !== null) node.setAttribute(key, typeof value === 'boolean' ? (value ? 'True' : 'False') : String(value));
      });
      const originalNodes = new Map(elements().filter(node => node.hasAttribute('Name')).map(node => [node.nodeName + '\\0' + node.getAttribute('Name'), node]));
      const ensureNode = (model, parent) => {
        if (!model?.name || !model?.type) return null;
        let node = model._sourceName && model._sourceName !== model.name ?
          originalNodes.get(model.type + '\\0' + model._sourceName) : byName(model.name, model.type, parent);
        if (node && model._sourceName && model._sourceName !== model.name) {
          if (node) {
            renamedObjects.set(model._sourceName.toLowerCase(), model.name);
            node.setAttribute('Name', model.name);
          }
        }
        if (!node && parent) {
          node = doc.createElement(model.type);
          node.setAttribute('Name', model.name);
          parent.appendChild(node);
        } else if (node && parent && node.parentNode !== parent) {
          // Tasarımcıda başka banda/sayfaya taşınan nesnenin XML ebeveynini de güncelle.
          parent.appendChild(node);
        }
        if (node) setAttrs(node, { Restrictions: model.restrictions, Visible: model.visible });
        return node;
      };

      if (file.reportSettings) setAttrs(root, {
        'EngineOptions.DoublePass': file.reportSettings.doublePass,
        'EngineOptions.PrintIfEmpty': file.reportSettings.printIfEmpty,
        'PrintOptions.Copies': file.reportSettings.copies,
        'PrintOptions.Printer': file.reportSettings.printer,
        'ReportOptions.Password': file.reportSettings.password,
        'ReportOptions.Name': file.reportSettings.name,
        'ReportOptions.Author': file.reportSettings.author,
        'ReportOptions.Description.Text': file.reportSettings.description
      });

      let dataPage = elements().find(node => node.nodeName === 'TfrxDataPage') || null;
      if (!dataPage && (file.queries || []).length > 0) {
        dataPage = doc.createElement('TfrxDataPage');
        setAttrs(dataPage, { Name: 'Data', Height: 1000, Left: 0, Top: 0, Width: 1000 });
        root.insertBefore(dataPage, root.firstChild);
      }
      (file.queries || []).forEach(query => {
        let queryNode = elements().find(node => /^(TfrxFOQuery|TfrxQuery)$/i.test(node.nodeName) &&
          (node.getAttribute('Name') === query.name || node.getAttribute('UserName') === query.name));
        if (!queryNode && dataPage) {
          queryNode = doc.createElement('TfrxFOQuery');
          dataPage.appendChild(queryNode);
        }
        if (queryNode) setAttrs(queryNode, { Name: query.name, UserName: query.name, 'SQL.Text': query.sql || '' });
      });

      (file.pages || []).forEach(page => {
        const pageNode = ensureNode(page, root);
        if (!pageNode) return;
        root.appendChild(pageNode);
        setAttrs(pageNode, {
          Orientation: page.orientation, PaperWidth: page.paperWidth, PaperHeight: page.paperHeight,
          LeftMargin: page.leftMargin, TopMargin: page.topMargin, RightMargin: page.rightMargin,
          BottomMargin: page.bottomMargin, ColumnWidth: page.columnWidth, Visible: page.visible,
          PaperSize: page.paperSize, Columns: page.columns, 'ColumnPositions.Text': page.columnPositions,
          MirrorMargins: page.mirrorMargins, EndlessWidth: page.endlessWidth, EndlessHeight: page.endlessHeight,
          PrintOnPreviousPage: page.printOnPreviousPage, TitleBeforeHeader: page.titleBeforeHeader,
          OnClick: page.onClick, OnBeforePrint: page.onBeforePrint, OnAfterPrint: page.onAfterPrint
        });
        (page.bands || []).forEach(band => {
          const synthetic = band.type === 'TfrxPageContent';
          const bandNode = synthetic ? pageNode : ensureNode(band, pageNode);
          if (!bandNode) return;
          // Modeldeki bant sıralamasını XML düğüm sırasına yansıt.
          if (!synthetic && bandNode.parentNode === pageNode) pageNode.appendChild(bandNode);
          if (!synthetic) setAttrs(bandNode, {
            Left: band.left, Top: band.top, Width: band.width, Height: band.height,
            DataSetName: band.dataSet, Condition: band.condition, Stretched: band.stretched,
            AllowSplit: band.allowSplit, KeepTogether: band.keepTogether, KeepChild: band.keepChild,
            KeepHeader: band.keepHeader, KeepFooter: band.keepFooter, StartNewPage: band.startNewPage,
            PrintIfDetailEmpty: band.printIfDetailEmpty, RowCount: band.rowCount, Vertical: band.vertical,
            OnClick: band.onClick, OnBeforePrint: band.onBeforePrint, OnAfterPrint: band.onAfterPrint,
            OnPreviewClick: band.onPreviewClick, OnMasterDetail: band.onMasterDetail
          });
          (band.components || []).forEach(component => {
            const componentNode = ensureNode(component, bandNode);
            if (!componentNode) return;
            bandNode.appendChild(componentNode);
            const textAttr = component.rawAttrs && /\bMemo\.Text\s*=/.test(component.rawAttrs) ? 'Memo.Text' : 'Text';
            writeFrpAppearance(componentNode, component);
            if (component._complexEdited) {
              if (!component._complex || component._complex.reason || !window.FrpComplexCodec) throw new Error('Nesnenin ikili kayıt biçimi düzenlenemiyor.');
              const chart=component.type==='TfrxChartView';
              const propData=chart?window.FrpComplexCodec.writeChart(component._complex):window.FrpComplexCodec.writeCross(component._complex);
              if (!chart) {
                if(component._complex.attrs.DataSet===undefined)componentNode.removeAttribute('DataSet');
                const keys=['RowLevels','ColumnLevels','CellLevels','RowFields.Text','ColumnFields.Text','CellFields.Text','ShowRowTotal','ShowColumnTotal','RepeatHeaders','ShowRowHeader','ShowColumnHeader','ShowTitle','ShowCorner','AutoSize','KeepTogether','KeepRowsTogether','JoinEqualCells','SuppressNullRecords'];
                keys.forEach(k=>{if(component._complex.attrs[k]!==undefined)componentNode.setAttribute(k,String(component._complex.attrs[k]));});
              }
              componentNode.setAttribute('PropData',propData);
            }
            setAttrs(componentNode, {
              Left: component.left, Top: synthetic ? Number(component.top || 0) + Number(band.top || 0) : component.top, Width: component.width, Height: component.height,
              [textAttr]: component.text, 'Font.Name': component.fontName,
              Page: component.type === 'TfrxSubreport' ? (component.subreportPage ?? component.pageName ?? component.page) : undefined,
              PrintOnParent: component.type === 'TfrxSubreport' ? component.printOnParent : undefined,
              'Font.Height': component.fontSize ? -Math.abs(component.fontSize) : component.fontHeight,
              'Font.Color': component.fontColor, 'Font.Style': component.fontStyle,
              'Fill.BackColor': component.fillBackColor, 'Fill.ForeColor': component.fillForeColor,
              'Fill.Style': component.fillStyle, FillType: component.fillType,
              'Frame.Typ': component.frameTyp, 'Frame.Color': component.frameColor,
              'Frame.Width': component.frameWidth, 'Frame.Style': component.frameStyle,
              Align: component.align, HAlign: component.hAlign, VAlign: component.vAlign, Rotation: component.rotation,
              DataSetName: component.dataSet, DataField: component.dataField, 'DisplayFormat.FormatStr': component.displayFormat,
              'Hyperlink.Value': component.hyperlink,
              WordWrap: component.wordWrap, AutoWidth: component.autoWidth, AutoSize: component.autoSize,
              AllowExpressions: component.allowExpressions, AllowHTMLTags: component.allowHTMLTags,
              StretchMode: component.stretchMode, ShiftMode: component.shiftMode,
              Printable: component.printable, SuppressRepeatedValues: component.suppressRepeatedValues,
              HideZeros: component.hideZeros, Clipped: component.clipped,
              LineSpacing: component.lineSpacing, ParagraphGap: component.paragraphGap,
              CharSpacing: component.charSpacing, GapX: component.gapX, GapY: component.gapY,
              ExpressionDelimiters: component.expressionDelimiters,
              FileLink: component.fileLink, KeepAspectRatio: component.keepAspectRatio,
              Center: component.center, Stretched: component.stretched,
              BarType: component.barType, ShowText: component.showText,
              CalcCheckSum: component.calcCheckSum, Zoom: component.zoom, Shape: component.shape,
              Visible: component.visible, Enabled: component.enabled, OnBeforePrint: component.onBeforePrint,
              OnAfterPrint: component.onAfterPrint, OnClick: component.onClick, OnPreviewClick: component.onPreviewClick,
              OnChange: component.onChange, OnMasterDetail: component.onMasterDetail,
              OnEnter: component.onEnter, OnExit: component.onExit, OnKeyDown: component.onKeyDown,
              OnAfterData: component.onAfterData, OnAfterCalcHeight: component.onAfterCalcHeight
            });
            if(component._complexEdited){
              // VCL reads attributes in order: dimensions must precede the embedded templates.
              const propData=componentNode.getAttribute('PropData');
              componentNode.removeAttribute('PropData');componentNode.setAttribute('PropData',propData);
            }
          });

          // Tasarımda silinen bileşenleri XML band düğümünden kaldır
          const activeCompNames = new Set((band.components || []).map(c => c.name).filter(Boolean));
          cleanupTasks.push(() => Array.from(bandNode.childNodes || []).forEach(child => {
            if (child.nodeType === 1) {
              const cName = child.getAttribute('Name');
              // Yalnızca tasarımcının okuyup yönettiği nesneler silinebilir. Table,
              // Map eklentileri veya özel FastReport bileşenleri modelde görünmese
              // bile ham FRP içinde aynen korunur.
              if (cName && managedComponentType(child.nodeName) && !activeCompNames.has(cName)) {
                bandNode.removeChild(child);
              }
            }
          }));
        });

        // Tasarımda silinen bandları XML sayfa düğümünden kaldır
        const activeBandNames = new Set((page.bands || []).filter(b => b.type !== 'TfrxPageContent').map(b => b.name).filter(Boolean));
        cleanupTasks.push(() => Array.from(pageNode.childNodes || []).forEach(child => {
          if (child.nodeType === 1) {
            const bName = child.getAttribute('Name');
            if (bName && managedBandType(child.nodeName) && !activeBandNames.has(bName)) {
              pageNode.removeChild(child);
            }
          }
        }));
      });

      if (dataPage) {
        const activeQueryNames = new Set((file.queries || []).map(q => q.name).filter(Boolean));
        Array.from(dataPage.childNodes || []).forEach(child => {
          if (child.nodeType === 1 && /^(TfrxFOQuery|TfrxQuery)$/i.test(child.nodeName)) {
            const qName = child.getAttribute('Name') || child.getAttribute('UserName');
            if (qName && !activeQueryNames.has(qName)) {
              dataPage.removeChild(child);
            }
          }
        });
      }

      const syncControls = (controls, parent) => (controls || []).forEach(control => {
        const node = ensureNode(control, parent);
        if (!node) return;
        parent.appendChild(node);
        setAttrs(node, {
          Left: control.left, Top: control.top, Width: control.width, Height: control.height,
          Caption: control.caption, Text: control.text, 'Font.Name': control.fontName,
          'Font.Height': control.fontSize ? -Math.abs(control.fontSize) : undefined,
          'Font.Style': control.fontStyle, 'Font.Color': control.fontColor, Color: control.color,
          Checked: control.checked, Enabled: control.enabled, Visible: control.visible,
          ModalResult: control.modalResult, ListField: control.listField, KeyField: control.keyField,
          ListSource: control.listSource, 'Items.Text': control.items, OnClick: control.onClick,
          OnChange: control.onChange, OnEnter: control.onEnter, OnExit: control.onExit, OnKeyDown: control.onKeyDown
        });
        syncControls(control.children, node);
      });
      (file.dialogPages || []).forEach(dialog => {
        const dialogNode = ensureNode({ ...dialog, type: 'TfrxDialogPage' }, root);
        if (!dialogNode) return;
        root.appendChild(dialogNode);
        setAttrs(dialogNode, {
          Caption: dialog.caption, Left: dialog.left, Top: dialog.top, Width: dialog.width,
          Height: dialog.height, Position: dialog.position, Color: dialog.color
        });
        syncControls(dialog.controls, dialogNode);
      });

      cleanupTasks.forEach(cleanup => cleanup());
      if (file.variablesEdited === true && Array.isArray(file.variableCategories)) syncFrpVariables(doc,file.variableCategories);
      const referenceAttrs = new Set(['page', 'flowto', 'child', 'parent', 'subreportpage']);
      elements().forEach(node => {
        Array.from(node.attributes || []).forEach(attr => {
          const replacement = renamedObjects.get(attr.value.toLowerCase());
          if (replacement && referenceAttrs.has(attr.name.toLowerCase())) node.setAttribute(attr.name, replacement);
        });
      });
      if (renamedObjects.size && root.hasAttribute('ScriptText.Text'))
        root.setAttribute('ScriptText.Text', renameFrpScriptIdentifiers(root.getAttribute('ScriptText.Text'), renamedObjects));
      if (newVersionNumStr) root.setAttribute('ReportOptions.VersionBuild', String(newVersionNumStr));
      const serialized = new SerializerClass().serializeToString(doc);
      const verifyDoc = new ParserClass().parseFromString(serialized, 'application/xml');
      const verifyElements = verifyDoc.querySelector('parsererror') ? [] : Array.from(verifyDoc.getElementsByTagName('*'));
      const missingProtected = protectedNamedNodes.filter(item => !verifyElements.some(node => node.nodeName === item.type && (node.getAttribute('Name') === item.name || node.getAttribute('UserName') === item.name)));
      if (missingProtected.length > 0) {
        if ((file.pages||[]).some(p=>(p.bands||[]).some(b=>(b.components||[]).some(c=>c._complexEdited||c._highlightsEdited||c._subreportEdited||Object.keys(c._appearanceEdits||{}).length)))) throw new Error('FRP güvenlik koruması: özel XML içeriği etkileniyor; kayıt uygulanmadı.');
        if (file.variablesEdited === true) throw new Error('Değişken kaydı bilinmeyen XML içeriğini etkiliyor; özgün FRP korundu.');
        console.warn('FRP güvenlik koruması: desteklenmeyen düğüm kaybı engellendi.', missingProtected);
        if (typeof window !== 'undefined') window.FrpNotify?.warning?.('FRP içindeki özel bileşenler korundu; güvenli olmayan tasarım değişikliği uygulanmadı.');
      } else {
        xml = serialized;
        if (file.variablesEdited === true) { file.variableCategories=readFrpVariables(serialized).categories; file.variablesEdited=false; }
        if (renamedObjects.size && root.hasAttribute('ScriptText.Text')) file.pascalScript = root.getAttribute('ScriptText.Text');
      }
    }
  } catch (error) {
    if ((file.pages || []).some(p => (p.bands || []).some(b => (b.components || []).some(c => c._complexEdited || c._subreportEdited || c._highlightsEdited || Object.keys(c._appearanceEdits || {}).length)))) throw error;
    if (file.variablesEdited === true) throw error;
    console.warn('FRP XML model senkronizasyonu başarısız:', error.message);
  }

  return xml;
}

if (typeof window !== 'undefined') {
  window.renameFrpScriptIdentifiers = renameFrpScriptIdentifiers;
  window.readFrpVariables = readFrpVariables;
  window.FrpAppearance = {read:readFrpAppearance, fields:FRP_APPEARANCE_FIELDS};
  window.parseFrp                 = parseFrp;
  window.decodeHtmlEntities       = decodeHtmlEntities;
  window.extractParamsFromSql     = extractParamsFromSql;
  window.encodeFrpAttr            = encodeFrpAttr;
  window.buildUpdatedFrpXml       = buildUpdatedFrpXml;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseFrp,
    decodeHtmlEntities,
    extractParamsFromSql,
    encodeFrpAttr,
    buildUpdatedFrpXml
  };
}

