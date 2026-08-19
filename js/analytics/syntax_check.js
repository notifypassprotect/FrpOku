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

    // Begin / End Eşleşmesi
    let beginCount = 0, endCount = 0;
    const beginStack = [];

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
        else errors.push({ text: `Satır ${lnum}: Eşleşmeyen 'end' ifadesi`, line: lnum });
      });

      if (/^(PROCEDURE|FUNCTION)\b/i.test(up)) {
        if (!up.endsWith(';') && !up.endsWith('FORWARD;') && !up.endsWith('EXTERNAL;')) {
          errors.push({ text: `Satır ${lnum}: '${rawTrim.slice(0, 45)}' bildiriminin sonunda ';' eksik`, line: lnum });
        }
      }
    });

    if (beginStack.length > 0) {
      const unclosed = beginStack[beginStack.length - 1];
      errors.push({ text: `Satır ${unclosed.line}: Açılan '${unclosed.type || 'begin'}' bloğu kapatılmamış`, line: unclosed.line });
    }

    return { errors, warnings };
  }

  function checkSqlStaticSyntax(sql) {
    const errors = [], warnings = [];
    if (!sql || !sql.trim()) return { errors, warnings };

    const upper = sql.toUpperCase()
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/'(?:''|[^'\r\n])*'/g, "''");

    const hasAggregates = /\b(AVG|SUM|COUNT|MIN|MAX)\s*\(/i.test(upper);
    const hasGroupBy = /\bGROUP\s+BY\b/i.test(upper);
    const hasSelect = /\bSELECT\b/i.test(upper);

    if (hasAggregates && !hasGroupBy && hasSelect) {
      warnings.push("Aggregate fonksiyonu (SUM, COUNT vb.) ile normal kolonlar birlikte kullanılıyor olabilir ancak GROUP BY bulunamadı.");
    }

    if (hasSelect && !/\bFROM\b/i.test(upper)) {
      errors.push("SELECT ifadesi bulundu fakat FROM anahtar sözcüğü eksik.");
    }

    return { errors, warnings };
  }

  window.FrpSyntaxCheck = {
    checkPascalSyntax,
    checkSqlStaticSyntax
  };
})();
