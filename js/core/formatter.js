// ============================================================
//  formatter.js — SQL Güzelleştirici & Yorum Bloğu Üretici
//  Offline, bağımlılıksız. FrpOku v4.
// ============================================================
(function () {
  'use strict';

  // Ana cümleler — yeni satıra alınır (uzun → kısa sırayla)
  const MAIN_CLAUSES = [
    'INSERT INTO', 'DELETE FROM', 'CREATE TABLE', 'DROP TABLE', 'ALTER TABLE',
    'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN',
    'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'CROSS JOIN',
    'UNION ALL', 'UNION', 'INTERSECT', 'MINUS', 'EXCEPT',
    'GROUP BY', 'ORDER BY', 'PARTITION BY', 'CONNECT BY', 'START WITH',
    'FETCH NEXT', 'ROWS ONLY',
    'SELECT', 'FROM', 'JOIN', 'WHERE', 'HAVING',
    'UPDATE', 'SET', 'VALUES',
    'LIMIT', 'OFFSET'
  ];

  const ALL_KWS = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'ON', 'JOIN',
    'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'UNION', 'ALL',
    'DISTINCT', 'AS', 'WITH', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT',
    'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
    'CREATE', 'TABLE', 'DROP', 'ALTER', 'CASE', 'WHEN', 'THEN', 'ELSE',
    'END', 'IS', 'NULL', 'BETWEEN', 'LIKE', 'EXISTS', 'OVER', 'PARTITION',
    'MINUS', 'INTERSECT', 'FETCH', 'NEXT', 'ROWS', 'ONLY', 'CONNECT',
    'START', 'PRIOR', 'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
    'COUNT', 'SUM', 'MAX', 'MIN', 'AVG', 'COALESCE', 'NVL', 'NULLIF', 'NVL2', 'LNNVL', 'DECODE',
    'TO_CHAR', 'TO_DATE', 'TO_NUMBER', 'TRUNC', 'ROUND', 'SYSDATE',
    'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'LEAD', 'LAG', 'GREATEST', 'LEAST',
    'REGEXP_LIKE', 'REGEXP_SUBSTR', 'REGEXP_REPLACE', 'REGEXP_INSTR', 'SYS_GUID', 'SYS_CONTEXT'
  ];

  /**
   * Verilen SQL metnini güzelleştirir.
   * @param {string} raw - Ham SQL
   * @param {object|string} options - { mode: 'expanded' | 'compact', uppercase: boolean } veya doğrudan mod adı
   */
  function formatSQL(raw, options = {}) {
    if (!raw || !raw.trim()) return raw;

    const mode = typeof options === 'string' ? options : (options.mode || 'expanded');
    const uppercase = typeof options === 'object' ? !!options.uppercase : false;

    const comments = [];
    const literals = [];

    let s = raw;

    // 1. Yorum satırlarını (-- ...) ve blok yorumları (/* ... */) koru
    s = s.replace(/--[^\n]*/g, match => {
      comments.push(match);
      return `\n__LINE_COMMENT_${comments.length - 1}__\n`;
    });

    s = s.replace(/\/\*[\s\S]*?\*\//g, match => {
      comments.push(match);
      return `\n__BLOCK_COMMENT_${comments.length - 1}__\n`;
    });

    // 2. String literal'leri ('...') koru
    s = s.replace(/'([^']|'')*'/g, match => {
      literals.push(match);
      return `'__LIT_${literals.length - 1}__'`;
    });

    // 3. Normalizasyon: Satır sonlarını ve boşlukları tek standarda getir
    s = s.replace(/\r\n/g, '\n').replace(/\t/g, '  ');
    s = s.replace(/\s+/g, ' ').trim();

    // 4. Ana SQL Cümlelerini yeni satıra al
    MAIN_CLAUSES.forEach(clause => {
      const safeClause = typeof escapeRegex === 'function' ? escapeRegex(clause) : clause.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escaped = safeClause.replace(/ /g, '\\s+');
      const rx = new RegExp('(?<=[\\s,)]|^)(' + escaped + ')(?=[\\s(,]|$)', 'gi');
      s = s.replace(rx, '\n' + clause.toUpperCase() + ' ');
    });

    if (mode === 'expanded') {
      // ── GENİŞLETİLMİŞ FORMAT (Her Sütun ve Koşul Ayrı Satırda) ──
      const lines = s.split('\n');
      const resultLines = [];

      lines.forEach(line => {
        let l = line.trim();
        if (!l) return;

        const up = l.toUpperCase();
        if (up.startsWith('SELECT')) {
          const isDistinct = up.startsWith('SELECT DISTINCT');
          const prefix = isDistinct ? 'SELECT DISTINCT' : 'SELECT';
          const selectBody = l.slice(prefix.length).trim();
          resultLines.push(prefix);

          // SELECT kolonlarını virgülle ayır (fonksiyon/parantez içi virgüller hariç)
          let curCol = '';
          let pDepth = 0;
          for (let i = 0; i < selectBody.length; i++) {
            const ch = selectBody[i];
            if (ch === '(') pDepth++;
            else if (ch === ')') pDepth = Math.max(0, pDepth - 1);

            if (ch === ',' && pDepth === 0) {
              if (curCol.trim()) resultLines.push('  ' + curCol.trim() + ',');
              curCol = '';
              continue;
            }
            curCol += ch;
          }
          if (curCol.trim()) {
            resultLines.push('  ' + curCol.trim());
          }
          return;
        }

        if (up.startsWith('WHERE') || up.startsWith('HAVING')) {
          let whereBody = l;
          whereBody = whereBody.replace(/\bAND\b(?!\s*\()/gi, '\n  AND');
          whereBody = whereBody.replace(/\bOR\b(?!\s*\()/gi, '\n  OR');
          resultLines.push(whereBody);
          return;
        }

        // CASE / WHEN / THEN / ELSE / END girintileme
        l = l.replace(/\bCASE\b/gi, '\n  CASE');
        l = l.replace(/\bWHEN\b/gi, '\n    WHEN');
        l = l.replace(/\bTHEN\b/gi, ' THEN');
        l = l.replace(/\bELSE\b(?!\s*IF)/gi, '\n    ELSE');
        l = l.replace(/\bEND\b(?!\s*(CASE|IF))/gi, '\n  END');

        resultLines.push(l);
      });

      s = resultLines.join('\n');
    } else if (mode === 'compact') {
      // ── KOMPAKT FORMAT (Daha Az Satır - Kolonlar & Şartlar Yan Yana) ──
      s = s.replace(/\nSELECT\s+/gi, '\nSELECT ');
      s = s.replace(/,\s+/g, ', ');
      s = s.replace(/\nWHERE\s+/gi, '\nWHERE ');
      s = s.replace(/\bAND\b(?!\s*\()/gi, ' AND');
      s = s.replace(/\bOR\b(?!\s*\()/gi, ' OR');
    }

    // 5. Literal'leri ve Yorumları geri yükle
    literals.forEach((lit, i) => {
      s = s.replace(`'__LIT_${i}__'`, lit);
    });

    comments.forEach((c, i) => {
      s = s.replace(`\n__LINE_COMMENT_${i}__\n`, '\n' + c + '\n');
      s = s.replace(`__LINE_COMMENT_${i}__`, c);
      s = s.replace(`__BLOCK_COMMENT_${i}__`, c);
    });

    if (uppercase && typeof window.convertSqlKeywords === 'function') {
      s = window.convertSqlKeywords(s, 'upper');
    }

    return s.split('\n').filter(l => l.trim().length > 0 || l.includes('--')).join('\n').trim();
  }

  /**
   * SQL'e FrpOku standarı başlık yorumu ekler.
   * @param {string} sql
   * @param {{reportName, queryName, params}} opts
   */
  function addSqlHeaderComment(sql, { reportName, queryName, params } = {}) {
    const paramStr = (params && params.length)
      ? params.join(', ')
      : '(parametre yok)';

    const sep = '-- ' + '='.repeat(62);
    const header = [
      sep,
      `-- Rapor       : ${reportName || '—'}`,
      `-- Sorgu       : ${queryName  || '—'}`,
      `-- Parametreler: ${paramStr}`,
      `-- Üretildi    : ${new Date().toLocaleString('tr-TR')}`,
      `-- FrpOku      : FastReport Analiz Aracı`,
      sep,
      ''
    ].join('\n');

    return header + sql;
  }

  /**
   * SQL → Markdown dokümantasyon üretir
   * @param {object} file - Store'dan gelen rapor nesnesi
   */
  function generateMarkdownDoc(file) {
    const meta    = file.meta    || {};
    const queries = Array.isArray(file.queries)      ? file.queries      : [];
    const tags    = Array.isArray(file.tags)         ? file.tags         : [];

    const lines = [];

    lines.push(`# 📋 ${meta.reportName || file.name}`);
    lines.push('');
    lines.push(`> **Dosya:** \`${file.name}\`  `);
    lines.push(`> **GUID:** \`${meta.guid || '—'}\`  `);
    lines.push(`> **Versiyon:** ${meta.version || '1.0'}  `);
    if (tags.length) lines.push(`> **Etiketler:** ${tags.map(t => `\`${t}\``).join(', ')}  `);
    if (file.userNote && file.userNote.trim()) {
      lines.push('');
      lines.push(`> **Not:** ${file.userNote.trim()}`);
    }
    lines.push('');

    if (meta.description) {
      lines.push('## Açıklama');
      lines.push('');
      lines.push(meta.description);
      lines.push('');
    }

    // SQL Sağlık Skoru
    const h = file.health || {};
    if (h.score) {
      lines.push('## SQL Sağlık Skoru');
      lines.push('');
      lines.push(`**${h.score}** — ${h.rating || ''}`);
      if (h.warnings && h.warnings.length) {
        lines.push('');
        lines.push('### Uyarılar');
        h.warnings.forEach(w => lines.push(`- ⚠️ ${w}`));
      }
      lines.push('');
    }

    // SQL Sorguları
    if (queries.length) {
      lines.push('## SQL Sorguları');
      lines.push('');
      queries.forEach((q, i) => {
        lines.push(`### ${i + 1}. ${q.name}`);
        lines.push('');
        // Parametreler
        const params = [];
        const rx = /:([a-zA-Z_]\w*)/g;
        let m;
        while ((m = rx.exec(q.sql)) !== null) params.push(':' + m[1]);
        if (params.length) {
          lines.push(`**Parametreler:** ${[...new Set(params)].join(', ')}`);
          lines.push('');
        }
        lines.push('```sql');
        lines.push(q.sql.trim());
        lines.push('```');
        lines.push('');
      });
    }

    // PascalScript
    if (file.pascalScript) {
      lines.push('## PascalScript');
      lines.push('');
      lines.push(`*${file.pascalScript.split('\n').length} satır kod*`);
      lines.push('');
      lines.push('<details>');
      lines.push('<summary>Kodu Göster</summary>');
      lines.push('');
      lines.push('```pascal');
      lines.push(file.pascalScript.trim());
      lines.push('```');
      lines.push('');
      lines.push('</details>');
      lines.push('');
    }

    lines.push('---');
    lines.push(`*Bu döküman FrpOku tarafından ${new Date().toLocaleString('tr-TR')} tarihinde otomatik oluşturulmuştur.*`);

    return lines.join('\n');
  }

  window.formatSQL             = formatSQL;
  window.addSqlHeaderComment   = addSqlHeaderComment;
  window.generateMarkdownDoc   = generateMarkdownDoc;
})();
