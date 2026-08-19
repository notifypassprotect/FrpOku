/**
 * FrpOku - Parametre Kullanım Analiz Modülü
 */

(function () {
  'use strict';

  function getParameterUsage(files) {
    const list = files || (window.FrpStore ? window.FrpStore.getAll() : []);
    const usage = {};

    list.forEach(file => {
      (file.queries || []).forEach(q => {
        const extractor = window.extractParamsFromSql || (() => []);
        const params = extractor(q.sql || '');
        params.forEach(param => {
          if (!usage[param]) usage[param] = [];
          usage[param].push({
            fileId: file.id,
            fileName: file.name,
            reportName: (file.meta && file.meta.reportName) || file.name,
            queryName: q.name
          });
        });
      });
    });

    return Object.entries(usage)
      .map(([param, usages]) => ({ param, count: usages.length, usages }))
      .sort((a, b) => b.count - a.count);
  }

  window.FrpParamUsage = {
    getParameterUsage
  };
})();
