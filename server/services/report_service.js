const fs = require('fs');
const path = require('path');

function createReportService({ canReadReport, reportId, reportRowToClient, reportRowToSummaryClient, storePath, supabase }) {
  const tempPath = storePath + '.tmp';
  const summarySelectColumns = 'id, name, file_size, category, tags, is_favorite, is_pinned, sql_count, memo_count, dataset_count, page_count, has_script, created_at, updated_at, user_note, note_html, note_attachments, is_deleted, deleted_at, user_id, is_public, owner_name, owner_username, owner_department, shared_at, version, meta:data->meta, tableNames:data->tableNames, queryNames:data->queryNames, paramNames:data->paramNames, datasets:data->datasets';

  function readLocalReports() {
    if (!fs.existsSync(storePath)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeLocalReports(reports) {
    const dataDir = path.dirname(storePath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(reports, null, 2), 'utf8');
    fs.renameSync(tempPath, storePath);
  }

  async function getReportRecord(id) {
    const strId = String(id || '');
    let decodedId = strId;
    try { decodedId = decodeURIComponent(strId); } catch {}
    if (supabase) {
      const result = await supabase.from('reports').select('*').eq('id', strId).limit(1);
      if (result.error) throw result.error;
      if (result.data?.[0]) return result.data[0];
      if (decodedId !== strId) {
        const decodedResult = await supabase.from('reports').select('*').eq('id', decodedId).limit(1);
        if (!decodedResult.error && decodedResult.data?.[0]) return decodedResult.data[0];
      }
      return null;
    }
    return readLocalReports().find(report => {
      const idValue = reportId(report);
      return idValue === strId || idValue === decodedId;
    }) || null;
  }

  async function loadVisibleReports(user, isDeleted, { summaryOnly = true } = {}) {
    if (supabase) {
      const rows = [];
      let from = 0;
      const step = 1000;
      while (true) {
        let query = supabase.from('reports').select(summaryOnly ? summarySelectColumns : '*').eq('is_deleted', isDeleted);
        if (user.role !== 'admin') query = isDeleted ? query.eq('user_id', user.id) : query.or(`user_id.eq.${user.id},is_public.eq.true`);
        const result = await query.order('updated_at', { ascending: false }).range(from, from + step - 1);
        if (result.error) throw result.error;
        if (!result.data?.length) break;
        rows.push(...result.data);
        if (result.data.length < step) break;
        from += step;
      }
      return summaryOnly ? rows.map(reportRowToSummaryClient) : rows.map(reportRowToClient);
    }
    const reports = readLocalReports()
      .filter(report => Boolean(report.isDeleted || report.is_deleted) === isDeleted && canReadReport(user, report))
      .sort((left, right) => new Date(right.loadedAt || right.updated_at || 0) - new Date(left.loadedAt || left.updated_at || 0));
    return summaryOnly ? reports.map(reportRowToSummaryClient) : reports.map(reportRowToClient);
  }

  return { getReportRecord, loadVisibleReports, readLocalReports, writeLocalReports };
}

module.exports = { createReportService };
