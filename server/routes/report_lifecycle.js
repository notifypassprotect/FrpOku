function registerReportLifecycleRoutes(app, deps) {
  const { apiWriteRateLimiter, canManageReport, getReportRecord, nextReportVersion, readLocalReports, reportId, reportRowToClient, requireAuth, supabase, writeLocalReports } = deps;

  app.delete('/api/reports', apiWriteRateLimiter, requireAuth, async (req, res) => {
    try {
      if (supabase) {
        const result = await supabase.from('reports').delete().eq('user_id', String(req.authUser.id));
        if (result.error) throw result.error;
      } else {
        writeLocalReports(readLocalReports().filter(report => String(report.userId || report.user_id) !== String(req.authUser.id)));
      }
      res.json({ success: true });
    } catch {
      res.status(503).json({ success: false, reason: 'Kullanıcı raporları silinemedi.' });
    }
  });

  app.delete('/api/reports/trash/all', apiWriteRateLimiter, requireAuth, async (req, res) => {
    try {
      const isAdmin = req.authUser?.role === 'admin';
      if (supabase) {
        let query = supabase.from('reports').delete().eq('is_deleted', true);
        if (!isAdmin) query = query.eq('user_id', String(req.authUser.id));
        const result = await query;
        if (result.error) throw result.error;
      } else {
        writeLocalReports(readLocalReports().filter(report => {
          if (!Boolean(report.isDeleted || report.is_deleted)) return true;
          return !isAdmin && String(report.userId || report.user_id) !== String(req.authUser.id);
        }));
      }
      res.json({ success: true });
    } catch {
      res.status(503).json({ success: false, reason: 'Çöp kutusu boşaltılamadı.' });
    }
  });

  app.delete('/api/reports/:id', apiWriteRateLimiter, requireAuth, async (req, res) => {
    try {
      const report = await getReportRecord(req.params.id);
      if (!report) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
      if (!canManageReport(req.authUser, report)) return res.status(403).json({ success: false, reason: 'Bu raporu silme yetkiniz yok.' });
      if (supabase) {
        const result = await supabase.from('reports').delete().eq('id', String(req.params.id));
        if (result.error) throw result.error;
      } else {
        writeLocalReports(readLocalReports().filter(item => reportId(item) !== String(req.params.id)));
      }
      res.json({ success: true });
    } catch {
      res.status(503).json({ success: false, reason: 'Rapor silinemedi.' });
    }
  });

  app.patch('/api/reports/:id/trash', apiWriteRateLimiter, requireAuth, async (req, res) => {
    try {
      const report = await getReportRecord(req.params.id);
      if (!report) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
      if (!canManageReport(req.authUser, report)) return res.status(403).json({ success: false, reason: 'Bu raporu değiştirme yetkiniz yok.' });
      const isDeleted = req.body?.deleted !== false;
      const deletedAt = isDeleted ? new Date().toISOString() : null;
      const currentVersion = Math.max(1, Number(report.version != null ? report.version : report.data?.version) || 1);
      let nextVersion;
      try {
        nextVersion = nextReportVersion(report, req.body?.version ? Number(req.body.version) : currentVersion);
      } catch (error) {
        return res.status(409).json({ success: false, code: error.code, reason: 'Rapor başka bir oturumda güncellendi.', currentVersion: error.currentVersion });
      }
      let savedReport;
      if (supabase) {
        const current = reportRowToClient(report);
        const data = { ...current, isDeleted, is_deleted: isDeleted, deletedAt, deleted_at: deletedAt, version: nextVersion };
        const result = await supabase.from('reports').update({ is_deleted: isDeleted, deleted_at: deletedAt, version: nextVersion, data, updated_at: new Date().toISOString() }).eq('id', String(req.params.id)).eq('version', currentVersion).select('*').limit(1);
        if (result.error) throw result.error;
        if (!result.data?.length) return res.status(409).json({ success: false, code: 'REPORT_CONFLICT', reason: 'Rapor aynı anda başka bir oturumda güncellendi.' });
        savedReport = reportRowToClient(result.data[0]);
      } else {
        const reports = readLocalReports();
        const index = reports.findIndex(item => reportId(item) === String(req.params.id));
        if (index === -1) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
        reports[index] = { ...reports[index], isDeleted, is_deleted: isDeleted, deletedAt, deleted_at: deletedAt, version: nextVersion };
        writeLocalReports(reports);
        savedReport = reports[index];
      }
      res.json({ success: true, isDeleted, report: savedReport });
    } catch {
      res.status(503).json({ success: false, reason: 'Rapor durumu güncellenemedi.' });
    }
  });
}

module.exports = { registerReportLifecycleRoutes };
