function registerReportWriteRoute(app, deps) {
  const { apiWriteRateLimiter, buildOwnedReportRow, canManageReport, getReportRecord, nextReportVersion, readLocalReports, reportId, reportRowToClient, requireAuth, safeLogStr, supabase, toSupabaseReportRow, writeLocalReports } = deps;

  app.put('/api/reports/:id', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const id = String(req.params.id || '');
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || String(req.body.id || '') !== id) {
      return res.status(400).json({ success: false, reason: 'Rapor kimliği istek adresiyle eşleşmelidir.' });
    }
  
    try {
      const existing = await getReportRecord(id);
      if (existing && !canManageReport(req.authUser, existing)) {
        return res.status(403).json({ success: false, reason: 'Başka bir kullanıcıya ait rapor güncellenemez.' });
      }
  
      const currentVersion = existing ? Math.max(1, Number(existing.version != null ? existing.version : existing.data?.version) || 1) : 0;
      let nextVersion;
      try {
        nextVersion = nextReportVersion(existing, req.body.version);
      } catch (versionError) {
        return res.status(409).json({
          success: false,
          code: versionError.code,
          reason: 'Rapor başka bir oturumda güncellendi. Yenileyip değişikliklerinizi tekrar uygulayın.',
          currentVersion: versionError.currentVersion
        });
      }
      const row = buildOwnedReportRow(req.body, req.authUser, { existing });
      row.version = nextVersion;
      row.data = { ...row.data, version: nextVersion };
  
      let saved;
      if (supabase) {
        const dbRow = toSupabaseReportRow(row);
        if (!existing) {
          const result = await supabase.from('reports').insert(dbRow).select('*').limit(1);
          if (result.error) {
            if (result.error.code === '23505') {
              return res.status(409).json({ success: false, code: 'REPORT_CONFLICT', reason: 'Rapor aynı anda başka bir oturumda oluşturuldu.' });
            }
            throw result.error;
          }
          saved = result.data?.[0];
        } else {
          let updateQuery = supabase.from('reports').update(dbRow).eq('id', id);
          updateQuery = updateQuery.eq('version', currentVersion);
          const result = await updateQuery.select('*').limit(1);
          if (result.error) throw result.error;
          if (!result.data?.length) {
            return res.status(409).json({ success: false, code: 'REPORT_CONFLICT', reason: 'Rapor aynı anda başka bir oturumda güncellendi.' });
          }
          saved = result.data[0];
        }
      } else {
        const reports = readLocalReports();
        const index = reports.findIndex(report => reportId(report) === id);
        const clientReport = reportRowToClient(row);
        if (index === -1) reports.push(clientReport);
        else reports[index] = clientReport;
        writeLocalReports(reports);
        saved = row;
      }
  
      res.json({ success: true, report: reportRowToClient(saved) });
    } catch (error) {
      console.warn('Rapor kaydedilemedi:', safeLogStr(error.message));
      res.status(503).json({ success: false, reason: 'Rapor geçici olarak kaydedilemedi.' });
    }
  });
}

module.exports = { registerReportWriteRoute };
