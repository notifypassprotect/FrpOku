/**
 * FrpOku - Tablo Kullanım ve Mükerrer Sorgu Analiz Modülü
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

  function getTableUsage(files) {
    const list = files || (window.FrpStore ? window.FrpStore.getAll() : []);
    const tableMap = new Map();
    const tableRx = /\b(?:FROM|JOIN)\s+([a-zA-Z0-9_$.]+)/gi;

    list.forEach(file => {
      (file.queries || []).forEach(q => {
        let match;
        const sql = (q.sql || '')
          .replace(/--[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/'(?:''|[^'\r\n])*'/g, "''")
          .replace(/\b(EXTRACT|SUBSTR|SUBSTRING|TRIM)\s*\([^)]*?\)/gi, '');

        tableRx.lastIndex = 0;
        while ((match = tableRx.exec(sql)) !== null) {
          let rawTable = match[1].replace(/[()]/g, '').trim().toUpperCase();
          rawTable = rawTable.split('.')[0]; 
          if (rawTable && !rawTable.startsWith('(') && !SQL_RESERVED.has(rawTable) && rawTable.length > 2 && !/^\d+$/.test(rawTable)) {
            if (!tableMap.has(rawTable)) tableMap.set(rawTable, new Set());
            tableMap.get(rawTable).add(file);
          }
        }
      });
    });

    const result = [];
    tableMap.forEach((fileSet, tableName) => {
      result.push({
        tableName,
        count: fileSet.size,
        files: Array.from(fileSet)
      });
    });
    return result.sort((a, b) => b.count - a.count);
  }

  function findDuplicateQueries(files) {
    const list = files || (window.FrpStore ? window.FrpStore.getAll() : []);
    const allQueries = [];

    list.forEach(f => {
      (f.queries || []).forEach(q => {
        const cleanSql = (q.sql || '').replace(/\s+/g, ' ').trim().toUpperCase();
        allQueries.push({
          fileId: f.id,
          fileName: (f.meta && f.meta.reportName) || f.name,
          queryName: q.name,
          cleanSql,
          rawSql: q.sql
        });
      });
    });

    const duplicates = [];
    for (let i = 0; i < allQueries.length; i++) {
      for (let j = i + 1; j < allQueries.length; j++) {
        const q1 = allQueries[i];
        const q2 = allQueries[j];
        if (q1.fileId !== q2.fileId && q1.cleanSql === q2.cleanSql && q1.cleanSql.length > 20) {
          duplicates.push({ query1: q1, query2: q2 });
        }
      }
    }
    return duplicates;
  }

  window.FrpTableUsage = {
    getTableUsage,
    findDuplicateQueries
  };
})();
