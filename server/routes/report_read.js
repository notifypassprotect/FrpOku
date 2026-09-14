function registerReportReadRoutes(app, deps) {
  const { canReadReport, getReportRecord, loadVisibleReports, reportRowToClient, requireAuth, safeLogStr } = deps;

  app.get('/api/store/load', requireAuth, async (req, res) => {
    try {
      res.json(await loadVisibleReports(req.authUser, false, { summaryOnly: true }));
    } catch (error) {
      console.warn('Raporlar yüklenemedi:', safeLogStr(error.message));
      res.status(503).json({ success: false, reason: 'Rapor verileri geçici olarak yüklenemiyor.' });
    }
  });

  app.get('/api/store/trash', requireAuth, async (req, res) => {
    try {
      res.json(await loadVisibleReports(req.authUser, true, { summaryOnly: true }));
    } catch (error) {
      console.warn('Çöp kutusu yüklenemedi:', safeLogStr(error.message));
      res.status(503).json({ success: false, reason: 'Çöp kutusu geçici olarak yüklenemiyor.' });
    }
  });

  app.get('/api/reports/:id', requireAuth, async (req, res) => {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ success: false, reason: 'Rapor kimliği gereklidir.' });
    try {
      const report = await getReportRecord(id);
      if (!report) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
      if (!canReadReport(req.authUser, report)) return res.status(403).json({ success: false, reason: 'Bu rapora erişim yetkiniz yok.' });
      res.json({ success: true, report: reportRowToClient(report) });
    } catch (error) {
      console.warn('Rapor detayı getirilemedi:', safeLogStr(error.message));
      res.status(503).json({ success: false, reason: 'Rapor detayı geçici olarak yüklenemiyor.' });
    }
  });
}

module.exports = { registerReportReadRoutes };
