/**
 * FrpOku - Parametre Kullanım Analiz Modülü
 */

(function () {
  'use strict';

  function getParameterUsage(files) {
    const list = files || (window.FrpStore ? window.FrpStore.getAll() : []);
    const usage = {};

    list.forEach(file => {
      let foundQueries = false;
      (file.queries || []).forEach(q => {
        if (!q || !q.sql) return;
        foundQueries = true;
        const extractor = window.extractParamsFromSql || (() => []);
        const params = extractor(q.sql || '');
        params.forEach(param => {
          if (!usage[param]) usage[param] = [];
          usage[param].push({
            fileId: file.id,
            fileName: file.name,
            reportName: (file.meta && file.meta.reportName) || file.name,
            queryName: q.name || 'Sorgu'
          });
        });
      });

      // Hafifletilmiş özet modunda SQL sorguları bellekte yoksa paramNames kullan:
      if (!foundQueries && Array.isArray(file.paramNames) && file.paramNames.length > 0) {
        file.paramNames.forEach(p => {
          const param = String(p || '').toUpperCase().trim();
          if (!param) return;
          if (!usage[param]) usage[param] = [];
          usage[param].push({
            fileId: file.id,
            fileName: file.name,
            reportName: (file.meta && file.meta.reportName) || file.name,
            queryName: (Array.isArray(file.queryNames) && file.queryNames[0]) || 'Sorgu'
          });
        });
      }
    });

    return Object.entries(usage)
      .map(([param, usages]) => {
        const uniqueFileIds = new Set(usages.map(u => u.fileId));
        return {
          param,
          count: usages.length,
          reportCount: uniqueFileIds.size,
          reports: usages,
          usages
        };
      })
      .sort((a, b) => b.count !== a.count ? b.count - a.count : b.reportCount - a.reportCount);
  }

  window.FrpParamUsage = {
    getParameterUsage
  };
})();

