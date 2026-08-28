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
    's'
  );
  const m = chunk.match(rx);
  const value = m ? (m[1] ?? m[2]) : null;
  return value ? decodeHtmlEntities(value) : null;
}

function findTagAttributes(xmlText, tagName) {
  const safeTag = typeof escapeRegex === 'function' ? escapeRegex(tagName) : tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`<${safeTag}\\b`, 'g');
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
  const rx = /:([a-zA-Z_]\w*)/g;
  let m;
  while ((m = rx.exec(cleanSql)) !== null) {
    // PostgreSQL ::type cast kontrolü
    if (m.index > 0 && cleanSql[m.index - 1] === ':') continue;

    const pName = m[1];
    if (!DATE_FORMAT_TOKENS.has(pName.toUpperCase())) {
      params.add(':' + pName);
    }
  }
  return [...params].sort();
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
  const queryTags = [
    ...findTagAttributes(xmlText, 'TfrxFOQuery'),
    ...findTagAttributes(xmlText, 'TfrxQuery')
  ];
  for (const tag of queryTags) {
    const attrs = tag.replace(/^<Tfrx(?:FOQuery|Query)\b\s*/, '').replace(/\s*\/?>$/, '');
    const name = getAttr(attrs, 'Name') || getAttr(attrs, 'UserName');
    const sql  = getAttr(attrs, 'SQL.Text');
    if (name && sql && sql.trim()) {
      if (!result.queries.find(q => q.name === name)) {
        result.queries.push({
          name: name.trim(),
          sql: sql.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
        });
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
  result.datasets = [...dsSet].filter(d => d && d.length < 40).sort();

  // ── RAPOR ELEMAN AĞACI & GÖRSEL TASARIM MODELİ ───────────
  result.pages = [];
  result.dialogPages = [];

  function numVal(v, fallback = 0) {
    if (v === null || v === undefined) return fallback;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? fallback : n;
  }

  function parseComponentNode(type, attrsChunk) {
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
    const frameTyp = numVal(getAttr(attrsChunk, 'Frame.Typ'), 0);
    const frameColor = getAttr(attrsChunk, 'Frame.Color') || '-16777208';
    const frameWidth = numVal(getAttr(attrsChunk, 'Frame.Width'), 1);
    
    // Align & Rotation
    const align = getAttr(attrsChunk, 'Align') || 'baNone';
    const hAlign = getAttr(attrsChunk, 'HAlign') || 'haLeft';
    const vAlign = getAttr(attrsChunk, 'VAlign') || 'vaTop';
    const rotation = numVal(getAttr(attrsChunk, 'Rotation'), 0);
    
    // Data bindings & Formats
    const dataSet = getAttr(attrsChunk, 'DataSetName') || getAttr(attrsChunk, 'DataSet') || '';
    const dataField = getAttr(attrsChunk, 'DataField') || '';
    const displayFormat = getAttr(attrsChunk, 'DisplayFormat.FormatStr') || getAttr(attrsChunk, 'DisplayFormat') || '';
    
    // Events
    const onBeforePrint = getAttr(attrsChunk, 'OnBeforePrint') || '';
    const onClick = getAttr(attrsChunk, 'OnClick') || '';
    const onAfterPrint = getAttr(attrsChunk, 'OnAfterPrint') || '';
    const onPreviewClick = getAttr(attrsChunk, 'OnPreviewClick') || '';
    
    // Additional Delphi Properties
    const allowExpressions = getAttr(attrsChunk, 'AllowExpressions') !== 'False';
    const autoWidth = getAttr(attrsChunk, 'AutoWidth') === 'True';
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
      frameTyp,
      frameColor,
      frameWidth,
      align,
      hAlign,
      vAlign,
      rotation,
      dataSet: dataSet || chartDataSet,
      dataField,
      displayFormat,
      onBeforePrint,
      onClick,
      onAfterPrint,
      onPreviewClick,
      allowExpressions,
      autoWidth,
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
      rawAttrs: attrsChunk
    };
  }

  // 1. TfrxReportPage & TfrxDMPPage (Rapor & Nokta Vuruşlu/Barkod Sayfaları & Bantlar)
  const pageRx = /<(TfrxReportPage|TfrxDMPPage)\b([\s\S]*?)>([\s\S]*?)<\/\1>/gi;
  let pMatch;
  while ((pMatch = pageRx.exec(xmlText)) !== null) {
    const pType = pMatch[1];
    const pAttrs = pMatch[2];
    const pContent = pMatch[3];

    const pageObj = {
      type: pType,
      name: getAttr(pAttrs, 'Name') || 'Page1',
      orientation: getAttr(pAttrs, 'Orientation') || 'poPortrait',
      paperWidth: numVal(getAttr(pAttrs, 'PaperWidth'), 210),
      paperHeight: numVal(getAttr(pAttrs, 'PaperHeight'), 297),
      leftMargin: numVal(getAttr(pAttrs, 'LeftMargin'), 10),
      topMargin: numVal(getAttr(pAttrs, 'TopMargin'), 10),
      rightMargin: numVal(getAttr(pAttrs, 'RightMargin'), 10),
      bottomMargin: numVal(getAttr(pAttrs, 'BottomMargin'), 10),
      columnWidth: numVal(getAttr(pAttrs, 'ColumnWidth'), 0),
      bands: []
    };

    // Bantlar
    const bandTagRx = /<(Tfrx(?:MasterData|DetailData|SubdetailData|Header|Footer|PageHeader|PageFooter|GroupHeader|GroupFooter|ColumnHeader|ColumnFooter|ReportTitle|ReportSummary|DataBand|Overlay|DMPHeader|DMPFooter|DMPGroupHeader|DMPGroupFooter|DMPMasterData|DMPDetailData|DMPSubdetailData))\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
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
        vertical: getAttr(bAttrs, 'Vertical') === 'True',
        left: numVal(getAttr(bAttrs, 'Left'), 0),
        rawAttrs: bAttrs,
        components: []
      };

      const compRx = /<(Tfrx[A-Za-z0-9_]+View|TfrxChartView|TfrxShapeView|TfrxDMPMemoView|TfrxBarCodeView|TfrxPictureView|TfrxLineView|TfrxMemoView|TfrxSubreport)\b([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;
      let cMatch;
      while ((cMatch = compRx.exec(bContent)) !== null) {
        const cType = cMatch[1];
        const cAttrs = cMatch[2];
        const compObj = parseComponentNode(cType, cAttrs);
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
      const compObj = parseComponentNode(cType, cAttrs);
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
      name: getAttr(dAttrs, 'Name') || 'DialogPage1',
      caption: getAttr(dAttrs, 'Caption') || 'Parametre Formu',
      left: numVal(getAttr(dAttrs, 'Left'), 100),
      top: numVal(getAttr(dAttrs, 'Top'), 100),
      width: numVal(getAttr(dAttrs, 'Width'), 360),
      height: numVal(getAttr(dAttrs, 'Height'), 450),
      position: getAttr(dAttrs, 'Position') || 'poScreenCenter',
      color: getAttr(dAttrs, 'Color') || 'clBtnFace',
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

  result.rawXml = xmlText;
  return result;
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
    return xml;
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

  return xml;
}

window.parseFrp                 = parseFrp;
window.decodeHtmlEntities       = decodeHtmlEntities;
window.extractParamsFromSql     = extractParamsFromSql;
window.encodeFrpAttr            = encodeFrpAttr;
window.buildUpdatedFrpXml       = buildUpdatedFrpXml;

