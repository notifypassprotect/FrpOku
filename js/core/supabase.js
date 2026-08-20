/**
 * FrpOku — Supabase Bulut Veritabanı Entegrasyon Katmanı (Nihai & Eksiksiz Sürüm)
 * Raporlar, Çöp Kutusu (Soft Delete), Kategoriler, Snippets ve Kullanıcı Ayarları
 */

(function () {
  'use strict';

  const SUPABASE_CONFIG = {
    url: 'https://wxlmbpognkjlwyksmosd.supabase.co',
    key: 'sb_publishable_ASaLwO7-3T7nRqneM0GW6g_8cgCNzQJ'
  };

  let client = null;

  function getClient() {
    if (client) return client;
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
      is_public: isPublic,
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
    const r = row.data || {};
    r.id = row.id;
    r.name = row.name;
    r.userId = row.user_id || r.userId || 'public';
    r.sizeBytes = Number(row.file_size || r.sizeBytes || 0);
    r.category = row.category || r.category || '';
    r.tags = Array.isArray(row.tags) ? row.tags : (r.tags || []);
    r.userNote = row.user_note || r.userNote || '';
    r.isFavorite = !!row.is_favorite;
    r.isPinned = !!row.is_pinned;
    r.isPublic = !!(row.is_public || r.isPublic || r.is_public);
    r.ownerName = r.ownerName || r.owner_name || row.owner_name || '';
    r.ownerUsername = r.ownerUsername || r.owner_username || row.owner_username || '';
    r.ownerDepartment = r.ownerDepartment || r.owner_department || row.owner_department || '';
    r.sharedAt = r.sharedAt || r.shared_at || row.shared_at || null;
    r.deletedAt = row.deleted_at || r.deletedAt || null;
    return r;
  }

  const FrpCloud = {
    getClient,

    // ── 1. AKTİF RAPORLAR (is_deleted = false) ─────────────────────
    async loadActiveReports() {
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
            .eq('is_deleted', false);

          if (curUser && curUser.role !== 'admin') {
            // Normal kullanıcı: Kendi yükledikleri + Genel/Ortak Havuzdakiler
            query = query.or(`user_id.eq.${curUser.id},user_id.eq.public,is_public.eq.true`);
          }

          const { data, error } = await query
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

        return allRows.map(parseReportFromRow);
      } catch (e) {
        console.warn('Supabase load error:', e);
        return null;
      }
    },

    // ── 2. ÇÖP KUTUSUNDAKİ RAPORLAR (is_deleted = true) ─────────────
    async loadTrashReports() {
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

          if (curUser && curUser.role !== 'admin') {
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
      const sb = getClient();
      if (!sb || !report) return false;
      try {
        const row = formatReportRow(report, false);
        const { error } = await sb.from('reports').upsert(row, { onConflict: 'id' });
        return !error;
      } catch {
        return false;
      }
    },

    // ── 4. ÇOKLU RAPOR KAYDET (Batch) ───────────────────────────────
    async saveReports(reports) {
      const sb = getClient();
      if (!sb || !Array.isArray(reports) || reports.length === 0) return false;
      try {
        const rows = reports.map(r => formatReportRow(r, false)).filter(Boolean);
        const BATCH_SIZE = 50;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const chunk = rows.slice(i, i + BATCH_SIZE);
          await sb.from('reports').upsert(chunk, { onConflict: 'id' });
        }
        return true;
      } catch {
        return false;
      }
    },

    // ── 5. ÇÖP KUTUSUNA TAŞI (Soft Delete) ─────────────────────────
    async moveToTrash(id, reportObj) {
      const sb = getClient();
      if (!sb || !id) return false;
      try {
        const now = new Date().toISOString();
        if (reportObj) {
          const row = formatReportRow(reportObj, true);
          row.deleted_at = now;
          await sb.from('reports').upsert(row, { onConflict: 'id' });
        } else {
          await sb.from('reports').update({ is_deleted: true, deleted_at: now }).eq('id', String(id));
        }
        return true;
      } catch {
        return false;
      }
    },

    async moveManyToTrash(ids) {
      const sb = getClient();
      if (!sb || !Array.isArray(ids) || ids.length === 0) return false;
      try {
        const now = new Date().toISOString();
        const strIds = ids.map(String);
        await sb.from('reports').update({ is_deleted: true, deleted_at: now }).in('id', strIds);
        return true;
      } catch {
        return false;
      }
    },

    // ── 6. ÇÖP KUTUSUNDAN GERİ YÜKLE (Restore) ─────────────────────
    async restoreFromTrash(id) {
      const sb = getClient();
      if (!sb || !id) return false;
      try {
        await sb.from('reports').update({ is_deleted: false, deleted_at: null }).eq('id', String(id));
        return true;
      } catch {
        return false;
      }
    },

    async restoreManyFromTrash(ids) {
      const sb = getClient();
      if (!sb || !Array.isArray(ids) || ids.length === 0) return false;
      try {
        const strIds = ids.map(String);
        await sb.from('reports').update({ is_deleted: false, deleted_at: null }).in('id', strIds);
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
          fetch('/api/reports/toggle-pool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId, makePublic, ownerInfo })
          }).catch(() => {});
        }

        if (sb) {
          await sb.from('reports').update({
            is_public: !!makePublic,
            updated_at: new Date().toISOString()
          }).eq('id', String(reportId));
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
          fetch('/api/reports/bulk-toggle-pool', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportIds, makePublic, ownerInfo })
          }).catch(() => {});
        }

        if (sb) {
          const strIds = reportIds.map(String);
          await sb.from('reports').update({
            is_public: !!makePublic,
            updated_at: new Date().toISOString()
          }).in('id', strIds);
        }
        return true;
      } catch (e) {
        console.warn('Toplu havuz toggle hatası:', e);
        return false;
      }
    },

    // ── 8. KALICI SİL (Purge from Database) ─────────────────────────
    async purgeReport(id) {
      const sb = getClient();
      if (!sb || !id) return false;
      try {
        await sb.from('reports').delete().eq('id', String(id));
        return true;
      } catch {
        return false;
      }
    },

    async purgeManyReports(ids) {
      const sb = getClient();
      if (!sb || !Array.isArray(ids) || ids.length === 0) return false;
      try {
        const strIds = ids.map(String);
        await sb.from('reports').delete().in('id', strIds);
        return true;
      } catch {
        return false;
      }
    },

    async emptyTrash() {
      const sb = getClient();
      if (!sb) return false;
      try {
        await sb.from('reports').delete().eq('is_deleted', true);
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
        await sb.from('categories').upsert(categoryObj, { onConflict: 'id' });
        return true;
      } catch {
        return false;
      }
    },

    async deleteCategory(id) {
      const sb = getClient();
      if (!sb || !id) return false;
      try {
        await sb.from('categories').delete().eq('id', String(id));
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
        await sb.from('snippets').upsert(row, { onConflict: 'id' });
        return true;
      } catch {
        return false;
      }
    },

    async deleteSnippet(id) {
      const sb = getClient();
      if (!sb || !id) return false;
      try {
        await sb.from('snippets').delete().eq('id', String(id));
        return true;
      } catch {
        return false;
      }
    },

    // ── 10. KULLANICI AYARLARI (Settings Sync) ─────────────────────
    async loadSettings() {
      const sb = getClient();
      if (!sb) return null;
      try {
        const { data, error } = await sb.from('user_settings').select('*').eq('id', 'default_user').single();
        if (error || !data) return null;
        return data;
      } catch {
        return null;
      }
    },

    async saveSettings(settings) {
      const sb = getClient();
      if (!sb || !settings) return false;
      try {
        const row = {
          id: 'default_user',
          theme: settings.theme || 'dark',
          preferences: settings.preferences || {},
          recent_reports: settings.recent_reports || [],
          custom_tags: settings.custom_tags || [],
          updated_at: new Date().toISOString()
        };
        await sb.from('user_settings').upsert(row, { onConflict: 'id' });
        return true;
      } catch {
        return false;
      }
    }
  };

  window.FrpCloud = FrpCloud;
})();
