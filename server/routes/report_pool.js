function registerReportPoolRoutes(app, deps) {
  const { apiWriteRateLimiter, canManageReport, getReportRecord, readLocalReports, reportId, reportRowToClient, requireAuth, supabase, writeLocalReports } = deps;

  app.post('/api/reports/toggle-pool', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const id = String(req.body?.reportId || '');
    if (!id) return res.status(400).json({ success: false, reason: 'Rapor ID gerekli.' });
    try {
      const report = await getReportRecord(id);
      if (!report) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
      if (!canManageReport(req.authUser, report)) return res.status(403).json({ success: false, reason: 'Bu raporu havuzda değiştirme yetkiniz yok.' });
      const isPublic = Boolean(req.body.makePublic);
      const sharedAt = isPublic ? new Date().toISOString() : null;
      if (supabase) {
        const current = reportRowToClient(report);
        const data = { ...current, isPublic, is_public: isPublic, inPool: isPublic, in_pool: isPublic, sharedAt, shared_at: sharedAt };
        const result = await supabase.from('reports').update({ is_public: isPublic, shared_at: sharedAt, data, updated_at: new Date().toISOString() }).eq('id', id);
        if (result.error) throw result.error;
      } else {
        const reports = readLocalReports();
        const index = reports.findIndex(item => reportId(item) === id);
        if (index === -1) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
        reports[index] = { ...reports[index], isPublic, is_public: isPublic, inPool: isPublic, in_pool: isPublic, sharedAt, shared_at: sharedAt };
        writeLocalReports(reports);
      }
      res.json({ success: true, isPublic });
    } catch {
      res.status(503).json({ success: false, reason: 'Ortak havuz durumu güncellenemedi.' });
    }
  });

  app.post('/api/reports/bulk-toggle-pool', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const ids = Array.isArray(req.body?.reportIds) ? [...new Set(req.body.reportIds.map(String))] : [];
    if (ids.length === 0 || ids.length > 100) return res.status(400).json({ success: false, reason: '1-100 arasında rapor ID değeri gereklidir.' });
    try {
      const reports = [];
      for (const id of ids) {
        const report = await getReportRecord(id);
        if (!report) return res.status(404).json({ success: false, reason: 'Raporlardan biri bulunamadı.' });
        if (!canManageReport(req.authUser, report)) return res.status(403).json({ success: false, reason: 'Raporlardan biri için yönetim yetkiniz yok.' });
        reports.push(report);
      }
      const isPublic = Boolean(req.body.makePublic);
      const sharedAt = isPublic ? new Date().toISOString() : null;
      if (supabase) {
        for (const report of reports) {
          const current = reportRowToClient(report);
          const data = { ...current, isPublic, is_public: isPublic, inPool: isPublic, in_pool: isPublic, sharedAt, shared_at: sharedAt };
          const result = await supabase.from('reports').update({ is_public: isPublic, shared_at: sharedAt, data, updated_at: new Date().toISOString() }).eq('id', String(report.id));
          if (result.error) throw result.error;
        }
      } else {
        const localReports = readLocalReports();
        const idSet = new Set(ids);
        localReports.forEach((report, index) => {
          if (idSet.has(reportId(report))) localReports[index] = { ...report, isPublic, is_public: isPublic, inPool: isPublic, in_pool: isPublic, sharedAt, shared_at: sharedAt };
        });
        writeLocalReports(localReports);
      }
      res.json({ success: true, count: ids.length, isPublic });
    } catch {
      res.status(503).json({ success: false, reason: 'Ortak havuz durumu güncellenemedi.' });
    }
  });
}

module.exports = { registerReportPoolRoutes };
