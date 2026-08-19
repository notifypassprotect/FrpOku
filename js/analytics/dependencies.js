/**
 * FrpOku - Tablo ve Veri Seti Bağımlılık Haritası Modülü
 */

(function () {
  'use strict';

  const SQL_RESERVED = new Set([
    'SELECT', 'WHERE', 'AND', 'OR', 'NOT', 'ON', 'DUAL', 'AS', 'SET', 'INTO', 'VALUES',
    'FROM', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'GROUP', 'ORDER',
    'HAVING', 'BY', 'UNION', 'ALL', 'WITH', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND', 'DATE', 'TIME', 'TIMESTAMP',
    'TRUNC', 'SYSDATE', 'ROWNUM', 'LEVEL', 'TABLE', 'LATERAL', 'ROW', 'ROWS'
  ]);

  function getDependencyMap(files) {
    const list = files || (window.FrpStore ? window.FrpStore.getAll() : []);
    const depMap = {};

    list.forEach(file => {
      (file.queries || []).forEach(q => {
        const sql = (q.sql || '')
          .replace(/--[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/'(?:''|[^'\r\n])*'/g, "''")
          .replace(/\b(EXTRACT|SUBSTR|SUBSTRING|TRIM|TO_CHAR|TO_DATE|TO_NUMBER|DECODE|NVL|NVL2|COALESCE)\s*\([^)]*?\)/gi, '');

        const rx = /\bFROM\s+([a-zA-Z0-9_.]+)|\bJOIN\s+([a-zA-Z0-9_.]+)/gi;
        let m;
        while ((m = rx.exec(sql)) !== null) {
          const tbl = (m[1] || m[2]).split('.').pop().toUpperCase();
          if (!tbl || SQL_RESERVED.has(tbl) || tbl.length <= 2 || /^\d+$/.test(tbl)) continue;
          if (!depMap[tbl]) depMap[tbl] = [];
          depMap[tbl].push({
            fileId: file.id,
            fileName: file.name,
            reportName: (file.meta && file.meta.reportName) || file.name,
            queryName: q.name
          });
        }
      });
    });

    return Object.entries(depMap)
      .map(([table, deps]) => {
        const uniqueDeps = unique(deps, d => d.fileId + d.queryName);
        const reportCount = new Set(deps.map(d => d.fileId)).size;
        return {
          table,
          count: uniqueDeps.length,
          reportCount,
          deps: uniqueDeps
        };
      })
      .sort((a, b) => b.reportCount !== a.reportCount ? b.reportCount - a.reportCount : b.count - a.count);
  }

  function unique(arr, keyFn) {
    const seen = new Set();
    return arr.filter(item => {
      const k = keyFn(item);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  window.FrpDependencies = {
    getDependencyMap
  };
})();
