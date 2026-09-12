/**
 * FrpOku - Parametre Kullanım Analiz Modülü
 */

(function () {
  'use strict';

  function getParameterUsage(files) {
    const list = files || (window.FrpStore ? window.FrpStore.getAll() : []);
    const usage = {};

    list.forEach(file => {
      const fileParamSet = new Set();

      (file.queries || []).forEach(q => {
        if (!q || !q.sql) return;
        const extractor = window.extractParamsFromSql || (() => []);
        const params = extractor(q.sql || '');
        params.forEach(param => {
          fileParamSet.add(param);
          if (!usage[param]) usage[param] = [];
          usage[param].push({
            fileId: file.id,
            fileName: file.name,
            reportName: (file.meta && file.meta.reportName) || file.name,
            queryName: q.name || 'Sorgu'
          });
        });
      });

      // XML <Params>, <Variables> veya özet kayıtlarından gelen paramNames'i de dahil et:
      const pList = Array.isArray(file.paramNames) ? file.paramNames : (Array.isArray(file.data?.paramNames) ? file.data.paramNames : []);
      pList.forEach(p => {
        let param = String(p || '').toUpperCase().trim();
        if (!param) return;
        if (!param.startsWith(':') && !param.startsWith('@') && !param.startsWith('&')) {
          param = ':' + param;
        }
        if (!fileParamSet.has(param)) {
          fileParamSet.add(param);
          if (!usage[param]) usage[param] = [];
          usage[param].push({
            fileId: file.id,
            fileName: file.name,
            reportName: (file.meta && file.meta.reportName) || file.name,
            queryName: (Array.isArray(file.queryNames) && file.queryNames[0]) || 'Rapor Parametresi'
          });
        }
      });
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

