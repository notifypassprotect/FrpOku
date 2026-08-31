/**
 * FrpOku — Supabase Bulut Veritabanı Entegrasyon Katmanı (Nihai & Eksiksiz Sürüm)
 * Raporlar, Çöp Kutusu (Soft Delete), Kategoriler, Snippets ve Kullanıcı Ayarları
 */

(function () {
  'use strict';

  const USE_SERVER_BRIDGE = window.location.protocol !== 'file:';

  const runtimeConfig = window.FRP_RUNTIME_CONFIG || {};
  const SUPABASE_CONFIG = {
    url: runtimeConfig.supabaseUrl || '',
    key: runtimeConfig.supabaseAnonKey || ''
  };

  let client = null;

  function getClient() {
    if (client) return client;
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.key) return null;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        client = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
        window._frpSupabase = client;
        window.supabaseClient = client;
      } catch (e) {
        console.warn('Supabase başlatılamadı:', e);
      }
    }
    return client;
  }
  getClient();

  function serverAuthHeaders(extra = {}) {
    if (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') {
      return window.FrpAuth.getAuthHeaders(extra);
    }
    return { 'Content-Type': 'application/json', ...extra };
  }

  async function serverRequest(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: serverAuthHeaders(options.headers || {})
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(data?.reason || `Sunucu isteği başarısız (${response.status}).`);
      error.status = response.status;
      error.code = data?.code || (response.status === 409 ? 'REPORT_CONFLICT' : 'SERVER_REQUEST_FAILED');
      throw error;
    }
    return data;
  }

  let lastLoadStatus = { ok: false, kind: 'not_started', status: 0 };

  function classifyLoadError(error) {
    const status = Number(error?.status || 0);
    return {
      ok: false,
      kind: status === 401 || status === 403 ? 'auth' : 'network',
      status,
      message: String(error?.message || 'Bulut bağlantısı kurulamadı.')
    };
  }

  async function requireSuccess(query) {
    const result = await query;
    if (result?.error) throw result.error;
    return result?.data;
  }

  // Rapor nesnesini DB şemasına dönüştür
  function formatReportRow(report, isDeleted = false) {
    if (!report) return null;
    const id = String(report.id || report.fileId || Date.now());
    const name = String(report.name || report.fileName || 'İsimsiz Rapor');
    const fileSize = Number(report.sizeBytes || report.size || report.file_size || 0);
    const category = String(report.category || '');
    const tags = Array.isArray(report.tags) ? report.tags : [];
    const userNote = String(report.userNote || report.user_note || '');
    const isFavorite = !!(report.isFavorite || report.favorite || report.is_favorite);
    const isPinned = !!(report.isPinned || report.pinned || report.is_pinned);
    const isPublic = !!(report.isPublic || report.is_public || report.inPool || report.in_pool);
    const ownerName = String(report.ownerName || report.owner_name || report.uploadedBy || '');
    const ownerUsername = String(report.ownerUsername || report.owner_username || '');
    const ownerDepartment = String(report.ownerDepartment || report.owner_department || '');
    const sharedAt = isPublic ? (report.sharedAt || report.shared_at || new Date().toISOString()) : null;

    const sqlCount = Array.isArray(report.queries) ? report.queries.length : Number(report.stats?.sqlCount || report.sql_count || 0);
    const memoCount = Array.isArray(report.memos) ? report.memos.length : Number(report.stats?.memoCount || report.memo_count || 0);
    const datasetCount = Array.isArray(report.datasets) ? report.datasets.length : Number(report.dataset_count || 0);
    const pageCount = Array.isArray(report.pages) ? report.pages.length : Number(report.stats?.pageCount || report.page_count || 1);
    const hasScript = !!(report.pascalScript && report.pascalScript.trim().length > 0);
    const userId = String(report.userId || report.user_id || (window.FrpAuth && window.FrpAuth.getUser() ? window.FrpAuth.getUser().id : 'public'));

    const safeData = {
      ...report,
      userId,
      isPublic,
      is_public: isPublic,
      ownerName,
      owner_name: ownerName,
      ownerUsername,
      owner_username: ownerUsername,
      ownerDepartment,
      owner_department: ownerDepartment,
      sharedAt,
      shared_at: sharedAt
    };

    return {
      id,
      name,
      user_id: userId,
      file_size: fileSize,
      category,
      tags,
      user_note: userNote,
      is_favorite: isFavorite,
      is_pinned: isPinned,
      is_deleted: isDeleted,
      deleted_at: isDeleted ? (report.deletedAt || new Date().toISOString()) : null,
      sql_count: sqlCount,
      memo_count: memoCount,
      dataset_count: datasetCount,
      page_count: pageCount,
      has_script: hasScript,
      data: safeData,
      updated_at: new Date().toISOString()
    };
  }

  function parseReportFromRow(row) {
    if (!row) return null;
    let r = {};
    if (row.data) {
      if (typeof row.data === 'string') {
        try { r = JSON.parse(row.data); } catch { r = {}; }
      } else if (typeof row.data === 'object') {
        r = { ...row.data };
      }
    }
    r.id = String(row.id);
    r.name = row.name || r.name || 'İsimsiz Rapor';
    r.userId = row.user_id || r.userId || 'public';
    r.sizeBytes = Number(row.file_size || r.sizeBytes || 0);
    r.category = row.category || r.category || '';
    r.tags = Array.isArray(row.tags) ? row.tags : (Array.isArray(r.tags) ? r.tags : []);
    r.userNote = row.user_note || r.userNote || '';
    r.isFavorite = !!(row.is_favorite || r.isFavorite);
    r.isPinned = !!(row.is_pinned || r.isPinned);
    r.isPublic = !!(row.is_public || r.isPublic || r.is_public);
    r.ownerName = row.owner_name || r.ownerName || r.owner_name || '';
    r.ownerUsername = row.owner_username || r.ownerUsername || r.owner_username || '';
    r.ownerDepartment = row.owner_department || r.ownerDepartment || r.owner_department || '';
    r.sharedAt = row.shared_at || r.sharedAt || r.shared_at || null;
    r.deletedAt = row.deleted_at || r.deletedAt || null;
    r.version = Math.max(0, Number(row.version || r.version) || 1);
    r.meta = r.meta || { reportName: r.name };
    r.queries = Array.isArray(r.queries) ? r.queries : [];
    r.datasets = Array.isArray(r.datasets) ? r.datasets : [];
    r.tree = Array.isArray(r.tree) ? r.tree : [];
    r.loadedAt = r.loadedAt || row.updated_at || new Date().toISOString();
    return r;
  }

  const FrpCloud = {
    getClient,
    getLastLoadStatus: () => ({ ...lastLoadStatus }),

    // ── 1. AKTİF RAPORLAR (is_deleted = false) ─────────────────────
    async loadActiveReports() {
      if (USE_SERVER_BRIDGE) {
        try {
          const data = await serverRequest('/api/store/load');
          if (!Array.isArray(data)) throw new Error('Sunucu geçersiz rapor yanıtı döndürdü.');
          lastLoadStatus = { ok: true, kind: 'success', status: 200, count: data.length };
          return data;
        } catch (error) {
          lastLoadStatus = classifyLoadError(error);
          console.warn('Sunucu raporları çekilemedi:', error.message);
          return null;
        }
      }
      const sb = getClient();
      if (!sb) return null;
      try {
        let allRows = [];
        let from = 0;
        const step = 1000;

        while (true) {
          const { data, error } = await sb
            .from('reports')
            .select('*')
            .eq('is_deleted', false)
            .order('updated_at', { ascending: false })
            .range(from, from + step - 1);

          if (error) {
            console.warn('Supabase aktif raporlar çekilemedi:', error.message);
            break;
          }
          if (!data || data.length === 0) break;

          allRows.push(...data);
          if (data.length < step) break;
          from += step;
        }

        const reports = allRows.map(parseReportFromRow);
        lastLoadStatus = { ok: true, kind: 'success', status: 200, count: reports.length };
        return reports;
      } catch (e) {
        lastLoadStatus = classifyLoadError(e);
        console.warn('Supabase load error:', e);
        return null;
      }
    },

    // ── 2. ÇÖP KUTUSUNDAKİ RAPORLAR (is_deleted = true) ─────────────
    async loadTrashReports() {
      if (USE_SERVER_BRIDGE) {
        try {
          const data = await serverRequest('/api/store/trash');
          return Array.isArray(data) ? data : null;
        } catch (error) {
          return null;
        }
      }
      const sb = getClient();
      if (!sb) return null;
      try {
        const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
        let allRows = [];
        let from = 0;
        const step = 1000;

        while (true) {
          let query = sb
            .from('reports')
            .select('*')
            .eq('is_deleted', true);

          if (curUser) {
            query = query.eq('user_id', curUser.id);
          }

          const { data, error } = await query
            .order('deleted_at', { ascending: false })
            .range(from, from + step - 1);

          if (error) break;
          if (!data || data.length === 0) break;

          allRows.push(...data);
          if (data.length < step) break;
          from += step;
        }

        return allRows.map(parseReportFromRow);
      } catch (e) {
        return null;
      }
    },

    // ── 3. RAPOR KAYDET / GÜNCELLE ──────────────────────────────────
    async saveReport(report) {
      if (USE_SERVER_BRIDGE) {
        try {
          const data = await serverRequest(`/api/reports/${encodeURIComponent(report.id)}`, {
            method: 'PUT',
            body: JSON.stringify(report)
          });
          return data?.report || false;
        } catch (error) {
          if (error?.status === 409) throw error;
          console.warn('Rapor kaydedilemedi:', error.message);
          return false;
        }
      }
      const sb = getClient();
      if (!sb || !report) return false;
      try {
        const row = formatReportRow(report, false);
        const { data, error } = await sb.from('reports').upsert(row, { onConflict: 'id' }).select('*').limit(1);
        if (error) throw error;
        return data?.[0] ? parseReportFromRow(data[0]) : false;
      } catch {
        return false;
      }
    },

    // ── 5. ÇÖP KUTUSUNA TAŞI (Soft Delete) ─────────────────────────
    async moveToTrash(id, reportObj) {
      if (USE_SERVER_BRIDGE) {
        try {
          const data = await serverRequest(`/api/reports/${encodeURIComponent(id)}/trash`, {
            method: 'PATCH',
            body: JSON.stringify({ deleted: true, version: reportObj?.version })
          });
          return data?.report || false;
        } catch (error) {
          if (error?.status === 409) throw error;
          return false;
        }
      }
      const sb = getClient();
      if (!sb || !id) return false;
      try {
        const now = new Date().toISOString();
        if (reportObj) {
          const row = formatReportRow(reportObj, true);
          row.deleted_at = now;
          await requireSuccess(sb.from('reports').upsert(row, { onConflict: 'id' }));
        } else {
          await requireSuccess(sb.from('reports').update({ is_deleted: true, deleted_at: now }).eq('id', String(id)));
        }
        return true;
      } catch {
        return false;
      }
    },

    async moveManyToTrash(ids) {
      if (USE_SERVER_BRIDGE) {
        if (!Array.isArray(ids) || ids.length === 0) return false;
        const results = await Promise.all(ids.map(id => this.moveToTrash(id)));
        return results.every(Boolean);
      }
      const sb = getClient();
      if (!sb || !Array.isArray(ids) || ids.length === 0) return false;
      try {
        const now = new Date().toISOString();
        const strIds = ids.map(String);
        await requireSuccess(sb.from('reports').update({ is_deleted: true, deleted_at: now }).in('id', strIds));
        return true;
      } catch {
        return false;
      }
    },

    // ── 6. ÇÖP KUTUSUNDAN GERİ YÜKLE (Restore) ─────────────────────
    async restoreFromTrash(id, reportObj) {
      if (USE_SERVER_BRIDGE) {
        try {
          const data = await serverRequest(`/api/reports/${encodeURIComponent(id)}/trash`, {
            method: 'PATCH',
            body: JSON.stringify({ deleted: false, version: reportObj?.version })
          });
          return data?.report || false;
        } catch (error) {
          if (error?.status === 409) throw error;
          return false;
        }
      }
      const sb = getClient();
      if (!sb || !id) return false;
      try {
        await requireSuccess(sb.from('reports').update({ is_deleted: false, deleted_at: null }).eq('id', String(id)));
        return true;
      } catch {
        return false;
      }
    },

    async restoreManyFromTrash(ids) {
      if (USE_SERVER_BRIDGE) {
        if (!Array.isArray(ids) || ids.length === 0) return false;
        const results = await Promise.all(ids.map(id => this.restoreFromTrash(id)));
        return results.every(Boolean);
      }
      const sb = getClient();
      if (!sb || !Array.isArray(ids) || ids.length === 0) return false;
      try {
        const strIds = ids.map(String);
        await requireSuccess(sb.from('reports').update({ is_deleted: false, deleted_at: null }).in('id', strIds));
        return true;
      } catch {
        return false;
      }
    },

    // ── 7. ORTAK HAVUZ PAYLAŞIM YÖNETİMİ ─────────────────────────
    async togglePoolStatus(reportId, makePublic, ownerInfo) {
      const sb = getClient();
      if (!reportId) return false;
      try {
        if (USE_SERVER_BRIDGE) {
          const data = await serverRequest('/api/reports/toggle-pool', {
            method: 'POST',
            body: JSON.stringify({ reportId, makePublic, ownerInfo })
          });
          return Boolean(data?.success);
        }

        if (sb) {
          // Row'un data JSON alanını çekip güncelle
          const { data: row, error: rowError } = await sb.from('reports').select('data').eq('id', String(reportId)).single();
          if (rowError) throw rowError;
          if (row && row.data) {
            const updatedData = { ...row.data, isPublic: !!makePublic, is_public: !!makePublic };
            if (ownerInfo) {
              updatedData.ownerName = ownerInfo.fullName || ownerInfo.name || updatedData.ownerName || '';
              updatedData.ownerUsername = ownerInfo.username || updatedData.ownerUsername || '';
              updatedData.ownerDepartment = ownerInfo.department || updatedData.ownerDepartment || '';
            }
            if (makePublic) updatedData.sharedAt = new Date().toISOString();
            await requireSuccess(sb.from('reports').update({
              data: updatedData,
              updated_at: new Date().toISOString()
            }).eq('id', String(reportId)));
          }
        }
        return true;
      } catch (e) {
        console.warn('Havuz toggle hatası:', e);
        return false;
      }
    },

    async bulkTogglePoolStatus(reportIds, makePublic, ownerInfo) {
      const sb = getClient();
      if (!Array.isArray(reportIds) || reportIds.length === 0) return false;
      try {
        if (USE_SERVER_BRIDGE) {
          const data = await serverRequest('/api/reports/bulk-toggle-pool', {
            method: 'POST',
            body: JSON.stringify({ reportIds, makePublic, ownerInfo })
          });
          return Boolean(data?.success);
        }

        if (sb) {
          const strIds = reportIds.map(String);
          const { data: rows, error: rowsError } = await sb.from('reports').select('id, data').in('id', strIds);
          if (rowsError) throw rowsError;
          if (Array.isArray(rows)) {
            const nowIso = new Date().toISOString();
            for (const r of rows) {
              const updatedData = { ...(r.data || {}), isPublic: !!makePublic, is_public: !!makePublic };
              if (ownerInfo) {
                updatedData.ownerName = ownerInfo.fullName || ownerInfo.name || updatedData.ownerName || '';
                updatedData.ownerUsername = ownerInfo.username || updatedData.ownerUsername || '';
                updatedData.ownerDepartment = ownerInfo.department || updatedData.ownerDepartment || '';
              }
              if (makePublic) updatedData.sharedAt = nowIso;
              await requireSuccess(sb.from('reports').update({ data: updatedData, updated_at: nowIso }).eq('id', r.id));
            }
          }
        }
        return true;
      } catch (e) {
        console.warn('Toplu havuz toggle hatası:', e);
        return false;
      }
    },

    // ── 8. KALICI SİL (Purge from Database) ─────────────────────────
    async purgeReport(id) {
      if (USE_SERVER_BRIDGE) {
        try {
          const data = await serverRequest(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' });
          return Boolean(data?.success);
        } catch {
          return false;
        }
      }
      const sb = getClient();
      if (!sb || !id) return false;
      try {
        await requireSuccess(sb.from('reports').delete().eq('id', String(id)));
        return true;
      } catch {
        return false;
      }
    },

    async deleteReport(id) {
      return this.purgeReport(id);
    },

    async purgeManyReports(ids) {
      if (USE_SERVER_BRIDGE) {
        if (!Array.isArray(ids) || ids.length === 0) return false;
        const results = await Promise.all(ids.map(id => this.purgeReport(id)));
        return results.every(Boolean);
      }
      const sb = getClient();
      if (!sb || !Array.isArray(ids) || ids.length === 0) return false;
      try {
        const strIds = ids.map(String);
        await requireSuccess(sb.from('reports').delete().in('id', strIds));
        return true;
      } catch {
        return false;
      }
    },

    async deleteReports(ids) {
      return this.purgeManyReports(ids);
    },

    async deleteAllReports() {
      if (USE_SERVER_BRIDGE) {
        try {
          const data = await serverRequest('/api/reports', { method: 'DELETE' });
          return Boolean(data?.success);
        } catch {
          return false;
        }
      }
      const sb = getClient();
      const user = window.FrpAuth?.getUser();
      if (!sb || !user?.id) return false;
      try {
        const { error } = await sb.from('reports').delete().eq('user_id', String(user.id));
        return !error;
      } catch {
        return false;
      }
    },

    async emptyTrash() {
      if (USE_SERVER_BRIDGE) {
        try {
          const data = await serverRequest('/api/reports/trash/all', { method: 'DELETE' });
          return Boolean(data?.success);
        } catch {
          return false;
        }
      }
      const sb = getClient();
      if (!sb) return false;
      try {
        await requireSuccess(sb.from('reports').delete().eq('is_deleted', true));
        return true;
      } catch {
        return false;
      }
    },

    // ── 8. KATEGORİLER (Categories CRUD) ────────────────────────────
    async loadCategories() {
      const sb = getClient();
      if (!sb) return null;
      try {
        const { data, error } = await sb.from('categories').select('*').order('created_at', { ascending: true });
        if (error || !Array.isArray(data)) return null;
        return data;
      } catch {
        return null;
      }
    },

    async saveCategory(categoryObj) {
      const sb = getClient();
      if (!sb || !categoryObj) return false;
      try {
        await requireSuccess(sb.from('categories').upsert(categoryObj, { onConflict: 'id' }));
        return true;
      } catch {
        return false;
      }
    },

    async deleteCategory(id) {
      const sb = getClient();
      if (!sb || !id) return false;
      try {
        await requireSuccess(sb.from('categories').delete().eq('id', String(id)));
        return true;
      } catch {
        return false;
      }
    },

    // ── 9. SORGU KÜTÜPHANESİ (Snippets CRUD) ───────────────────────
    async loadSnippets() {
      const sb = getClient();
      if (!sb) return null;
      try {
        const { data, error } = await sb.from('snippets').select('*').order('created_at', { ascending: false });
        if (error || !Array.isArray(data)) return null;
        return data.map(s => ({
          id: s.id,
          title: s.title,
          sql: s.sql,
          reportName: s.report_name,
          category: s.category,
          createdAt: s.created_at
        }));
      } catch {
        return null;
      }
    },

    async saveSnippet(snippet) {
      const sb = getClient();
      if (!sb || !snippet) return false;
      try {
        const row = {
          id: String(snippet.id || Date.now()),
          title: String(snippet.title || 'SQL Sorgusu'),
          sql: String(snippet.sql || ''),
          report_name: String(snippet.reportName || '—'),
          category: String(snippet.category || 'Genel'),
          updated_at: new Date().toISOString()
        };
        await requireSuccess(sb.from('snippets').upsert(row, { onConflict: 'id' }));
        return true;
      } catch {
        return false;
      }
    },

    async deleteSnippet(id) {
      const sb = getClient();
      if (!sb || !id) return false;
      try {
        await requireSuccess(sb.from('snippets').delete().eq('id', String(id)));
        return true;
      } catch {
        return false;
      }
    },

    // ── 10. KULLANICI AYARLARI (Settings Sync) ─────────────────────
    async loadSettings() {
      if (USE_SERVER_BRIDGE) {
        try {
          const data = await serverRequest('/api/settings');
          return data?.settings || null;
        } catch {
          return null;
        }
      }
      const sb = getClient();
      if (!sb) return null;
      try {
        const user = window.FrpAuth?.getUser();
        if (!user?.id) return null;
        const { data, error } = await sb.from('user_settings').select('*').eq('id', String(user.id)).single();
        if (error || !data) return null;
        return data;
      } catch {
        return null;
      }
    },

    async saveSettings(settings) {
      if (USE_SERVER_BRIDGE) {
        try {
          const data = await serverRequest('/api/settings', { method: 'PATCH', body: JSON.stringify(settings) });
          return Boolean(data?.success);
        } catch {
          return false;
        }
      }
      const sb = getClient();
      if (!sb || !settings) return false;
      try {
        const user = window.FrpAuth?.getUser();
        if (!user?.id) return false;
        const row = {
          id: String(user.id),
          theme: settings.theme || 'light',
          preferences: settings.preferences || {},
          recent_reports: settings.recent_reports || [],
          custom_tags: settings.custom_tags ?? settings.customTags ?? [],
          updated_at: new Date().toISOString()
        };
        const { error } = await sb.from('user_settings').upsert(row, { onConflict: 'id' });
        return !error;
      } catch {
        return false;
      }
    },

    // ── 11. DENETİM GÜNLÜĞÜ (Audit Logs Cloud Sync) ───────────────
    async loadAuditLogs() {
      const sb = getClient();
      if (!sb) return null;
      try {
        const { data, error } = await sb.from('user_settings').select('*').eq('id', 'system_audit_logs').single();
        if (error || !data || !data.preferences || !Array.isArray(data.preferences.logs)) return null;
        return data.preferences.logs;
      } catch {
        return null;
      }
    },

    async saveAuditLogs(logs) {
      const sb = getClient();
      if (!sb || !Array.isArray(logs)) return false;
      try {
        const row = {
          id: 'system_audit_logs',
          theme: 'light',
          preferences: { logs: logs.slice(0, 1000) },
          updated_at: new Date().toISOString()
        };
        await requireSuccess(sb.from('user_settings').upsert(row, { onConflict: 'id' }));
        return true;
      } catch {
        return false;
      }
    },

    async appendAuditLog(entry) {
      if (!entry) return false;
      try {
        const current = (await this.loadAuditLogs()) || [];
        const combined = [entry, ...current.filter(l => l.id !== entry.id)].slice(0, 1000);
        return await this.saveAuditLogs(combined);
      } catch {
        return false;
      }
    }
  };

  window.FrpCloud = FrpCloud;
})();
