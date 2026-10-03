const { createHash } = require('node:crypto');
const { REPORT_ID_REGEX } = require('../../lib/report_access');

function registerBulkReportWrite(app, deps) {
  const { apiWriteRateLimiter, requireAuth, supabase, getReportRecord, canManageReport,
    buildOwnedReportRow, toSupabaseReportRow, nextReportVersion, readLocalReports,
    writeLocalReports, reportId, reportRowToClient } = deps;
  app.post('/api/reports/bulk-save', apiWriteRateLimiter, requireAuth, async (req, res) => {
    const reports = req.body?.reports;
    if (!Array.isArray(reports) || !reports.length || reports.length > 40 ||
        reports.some(r => !r || typeof r !== 'object' || Array.isArray(r) || !REPORT_ID_REGEX.test(String(r.id || ''))) ||
        new Set(reports.map(r => String(r.id))).size !== reports.length) {
      return res.status(400).json({ success:false, reason:'Bir pakette en fazla 40 farklı rapor gönderilebilir.' });
    }
    const results = [];
    // A receipt is stored in the same row/write as the report itself. Retrying a
    // committed request whose HTTP response was lost cannot create another copy.
    const digest = report => {
      const clean = {...report}; delete clean._uploadReceipt; delete clean._syncPending;
      return createHash('sha256').update(JSON.stringify(clean)).digest('hex');
    };
    const hashes = new Map(reports.map(r => [String(r.id), digest(r)]));
    const receiptMatches = (record, report) => {
      const receipt = record?.receipt || record?.data?._uploadReceipt || record?._uploadReceipt;
      return Boolean(receipt) && (receipt.hash === hashes.get(String(report.id)) || (report._syncToken && receipt.token === report._syncToken)) && Number(receipt.version) === Number(record.version);
    };
    const makeRow = (report, existing) => {
      const row = buildOwnedReportRow(report, req.authUser, {existing});
      row.version = nextReportVersion(existing, report.version);
      row.data = {...row.data, version:row.version, _syncPending:false,
        _uploadReceipt:{hash:hashes.get(String(report.id)),token:report._syncToken || null,version:row.version}};
      return row;
    };
    const success = (id, version) => results.push({id:String(id),success:true,version:Number(version)});
    const failure = (id, status, reason) => results.push({id:String(id),success:false,status,reason});
    const saveOne = async report => {
      const id = String(report.id);
      try {
        const existing = await getReportRecord(id);
        if (existing && !canManageReport(req.authUser, existing)) return failure(id,403,'Bu raporu değiştirme yetkiniz yok.');
        if (existing && receiptMatches(existing,report)) return success(id,existing.version);
        let row;
        try { row = makeRow(report,existing); }
        catch(error) { return failure(id,error.code === 'REPORT_CONFLICT' ? 409 : 400,error.message); }
        if (supabase) {
          const dbRow = toSupabaseReportRow(row);
          let query = existing ? supabase.from('reports').update(dbRow).eq('id',id) : supabase.from('reports').insert(dbRow);
          if (existing) query = existing.version == null ? query.is('version',null) : query.eq('version',existing.version);
          if (existing && req.authUser.role !== 'admin') query = query.eq('user_id',String(req.authUser.id));
          const saved = await query.select('id,version');
          if (saved.error || !saved.data?.length) {
            // Another request may have committed this exact upload concurrently.
            const fresh = await getReportRecord(id);
            if (fresh && canManageReport(req.authUser,fresh) && receiptMatches(fresh,report)) return success(id,fresh.version);
            return failure(id,saved.error?.code === '23505' || !saved.error ? 409 : 503,'Kayıt onaylanamadı; rapor yerel kuyrukta korundu.');
          }
          success(id,saved.data[0].version);
        } else {
          const rows = readLocalReports();
          const index = rows.findIndex(r => reportId(r) === id);
          const saved = reportRowToClient(row);
          if (index < 0) rows.push(saved); else rows[index] = saved;
          writeLocalReports(rows); success(id,row.version);
        }
      } catch { failure(id,503,'Sunucu kaydı tamamlayamadı. Yeniden denenecek.'); }
    };
    try {
      let remaining = reports;
      if (supabase) {
        const response = await supabase.from('reports').select('id,user_id,version,receipt:data->_uploadReceipt').in('id',reports.map(r=>String(r.id)));
        if (response.error) throw response.error;
        const known = new Map((response.data || []).map(r=>[String(r.id),r]));
        const newRows = [], retry = [];
        for (const report of reports) {
          const existing = known.get(String(report.id));
          if (existing) {
            if (!canManageReport(req.authUser,existing)) failure(report.id,403,'Bu raporu değiştirme yetkiniz yok.');
            else if (receiptMatches(existing,report)) success(report.id,existing.version);
            else retry.push(report);
          } else {
            try { newRows.push({report,row:toSupabaseReportRow(makeRow(report,null))}); }
            catch(error) { failure(report.id,400,error.message); }
          }
        }
        if (newRows.length) {
          const inserted = await supabase.from('reports').insert(newRows.map(r=>r.row)).select('id,version');
          if (inserted.error) retry.push(...newRows.map(r=>r.report));
          else {
            const saved = new Map((inserted.data || []).map(r=>[String(r.id),r]));
            for (const entry of newRows) {
              const row = saved.get(String(entry.report.id));
              if (row) success(row.id,row.version); else retry.push(entry.report);
            }
          }
        }
        remaining = retry;
      }
      let cursor = 0;
      await Promise.all(Array.from({length:supabase ? Math.min(4,remaining.length) : 1}, async () => {
        while (cursor < remaining.length) await saveOne(remaining[cursor++]);
      }));
      res.json({success:true,results});
    } catch { res.status(503).json({success:false,reason:'Paket onaylanamadı. Aynı raporlar güvenle yeniden gönderilebilir.'}); }
  });
}
module.exports = { registerBulkReportWrite };
