function registerReportLifecycleRoutes(app, deps) {
  const { apiWriteRateLimiter, canManageReport, getReportRecord, nextReportVersion, readLocalReports, reportId, reportRowToClient, requireAuth, supabase, writeLocalReports } = deps;

  // Bounded batches keep bulk operations below the HTTP write-rate limit.
  // Only status columns change; large report XML is neither read nor returned.
  app.post('/api/reports/bulk-lifecycle', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const { action, items } = req.body || {};
    const { REPORT_ID_REGEX } = require('../../lib/report_access');
    if (!['trash','purge'].includes(action) || !Array.isArray(items) || !items.length || items.length > 50 ||
        items.some(item => !item || typeof item.id !== 'string' || !REPORT_ID_REGEX.test(item.id)) ||
        new Set(items.map(item=>item.id)).size !== items.length) {
      return res.status(400).json({success:false, reason:'Geçerli en fazla 50 rapor seçin.'});
    }
    const results = [];
    try {
      let records;
      if (supabase) {
        const response = await supabase.from('reports').select('id,user_id,version,is_deleted').in('id',items.map(item=>item.id));
        if (response.error) throw response.error;
        records = response.data || [];
      } else records = readLocalReports();
      const byId = new Map(records.map(record=>[reportId(record),record]));
      const groups = new Map();
      const now = new Date().toISOString();
      for (const item of items) {
        const record = byId.get(item.id);
        if (!record) { results.push({id:item.id,success:true}); continue; }
        if (!canManageReport(req.authUser,record)) { results.push({id:item.id,success:false,reason:'Bu raporu silme yetkiniz yok.'}); continue; }
        const version = Math.max(1,Number(record.version ?? record.data?.version)||1);
        if (action==='trash' && Number(item.version)!==version) { results.push({id:item.id,success:false,reason:'Rapor başka bir oturumda güncellendi.'}); continue; }
        const key = record.version == null ? 'null' : String(record.version);
        if (!groups.has(key)) groups.set(key,{version,dbVersion:record.version,ids:[]});
        groups.get(key).ids.push(item.id);
      }
      const removed = new Set();
      for (const group of groups.values()) {
        try {
          let savedIds = group.ids;
          if (supabase) {
            let query = action==='purge' ? supabase.from('reports').delete() : supabase.from('reports').update({is_deleted:true,deleted_at:now,updated_at:now,version:group.version+1});
            query = query.in('id',group.ids);
            query = group.dbVersion == null ? query.is('version',null) : query.eq('version',group.dbVersion);
            if (req.authUser.role!=='admin') query=query.eq('user_id',String(req.authUser.id));
            const response = await query.select('id');
            if (response.error) throw response.error;
            savedIds = (response.data||[]).map(row=>String(row.id));
          }
          const saved = new Set(savedIds);
          for(const id of group.ids) {
            if(!saved.has(id)) { results.push({id,success:false,reason:'Rapor aynı anda değişti; tekrar deneyin.'}); continue; }
            if(action==='purge') removed.add(id);
            else if(!supabase) Object.assign(byId.get(id),{isDeleted:true,is_deleted:true,deletedAt:now,deleted_at:now,version:group.version+1});
            results.push({id,success:true,version:group.version+1});
          }
        } catch { group.ids.forEach(id=>results.push({id,success:false,reason:'Sunucu işlemi tamamlayamadı.'})); }
      }
      if(!supabase && groups.size) writeLocalReports(records.filter(record=>!removed.has(reportId(record))));
      res.json({success:true,results});
    } catch { res.status(503).json({success:false,reason:'Toplu işlem doğrulanamadı. Listeyi yenileyerek kontrol edin.'}); }
  });

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
