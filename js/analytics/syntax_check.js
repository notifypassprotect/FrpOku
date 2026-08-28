/**
 * FrpOku - Statik Sözdizimi Denetleyici (PascalScript & SQL)
 */

(function () {
  'use strict';

  function checkPascalSyntax(code) {
    const errors = [], warnings = [];
    if (!code || !code.trim()) return { errors, warnings };

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
        if (!up.endsWith(';') && !up.endsWith('FORWARD;') && !up.endsWith('EXTERNAL;')) {
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
        if (nextNonEmptyTrim && !/^(ELSE|END|UNTIL)\b/i.test(nextNonEmptyTrim)) {
          errors.push({
            text: `Satır ${lnum}: İfade sonunda ';' (noktalı virgül) eksik ➔ '${rawTrim}'`,
            line: lnum,
            suggestion: `Satır sonuna ';' ekleyin (Ör: ${rawTrim};)`
          });
        }
      }

      // '=' yerine ':=' kontrolü (atama yaparken tek eşittir kullanımı)
      if (!up.startsWith('IF') && !up.startsWith('WHILE') && !up.startsWith('CONST') && !up.includes('=')) {
        // ok
      } else if (!/^(IF|WHILE|UNTIL|CASE|CONST)\b/i.test(up) && !up.includes(':=') && /^[a-zA-Z0-9_\.]+\s*=\s*[^=]/i.test(up)) {
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

    return { errors, warnings };
  }

  function checkSqlStaticSyntax(sql) {
    const errors = [], warnings = [], securityRisks = [];
    if (!sql || !sql.trim()) return { errors, warnings, securityRisks };

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
        badge: '🚨 KRİTİK',
        title: 'DROP Komutu Tespit Edildi',
        text: "Sorgu içerisinde tablo veya nesne silmeye yönelik 'DROP' komutu bulundu. Raporlama sorgularında şema silme komutları son derece tehlikelidir!"
      });
    }

    if (/\bTRUNCATE\s+TABLE\b/i.test(upper)) {
      securityRisks.push({
        level: 'CRITICAL',
        badge: '🚨 KRİTİK',
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
    if (hasDelete && !hasWhere) {
      securityRisks.push({
        level: 'CRITICAL',
        badge: '🚨 KRİTİK',
        title: "WHERE Koşulsuz DELETE!",
        text: "DELETE sorgusu herhangi bir WHERE koşulu içermiyor! Tablodaki tüm kayıtların silinmesine neden olabilir."
      });
    }

    if (hasUpdate && !hasWhere) {
      securityRisks.push({
        level: 'HIGH',
        badge: '⚠️ YÜKSEK',
        title: "WHERE Koşulsuz UPDATE!",
        text: "UPDATE sorgusu WHERE koşulu içermiyor! Tablodaki tüm satırların güncellenmesine neden olabilir."
      });
    }

    // 3. Kartezyen Çarpım (Cartesian Product) Uyarısı
    if (hasSelect && upper.includes(' FROM ') && !upper.includes(' JOIN ') && upper.split(' FROM ')[1]?.split(/\b(WHERE|GROUP|ORDER|HAVING)\b/)[0]?.includes(',')) {
      warnings.push("Birden fazla tablo virgülle birleştirilmiş fakat JOIN sözcüğü kullanılmamış. Kartezyen çarpım (Cross Join) ve performans sorunlarına yol açabilir.");
    }

    // 4. Standart Sözdizimi Kontrolleri
    if (hasAggregates && !hasGroupBy && hasSelect) {
      warnings.push("Aggregate fonksiyonu (SUM, COUNT vb.) ile normal kolonlar birlikte kullanılıyor olabilir ancak GROUP BY bulunamadı.");
    }

    if (hasSelect && !/\bFROM\b/i.test(upper)) {
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
      results.errors.push('Dosya boş (0 bayt). Lütfen geçerli bir .frp rapor dosyası seçin.');
      return results;
    }

    if (file.size > 50 * 1024 * 1024) {
      results.warnings.push(`Dosya boyutu (${results.fileSizeMb} MB) oldukça büyük. Ayrıştırma süresi uzayabilir.`);
    }

    const fileName = (file.name || '').toLowerCase();
    if (!fileName.endsWith('.frp') && !fileName.endsWith('.fr3') && !fileName.endsWith('.xml')) {
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
