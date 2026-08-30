// ============================================================
//  audit_tab.js — Kullanıcı İşlem Geçmişi & Denetim Günlüğü v7
//  Genişletilmiş (Wide / Fullscreen) Modal, Temiz Kurumsal Tasarım
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

(function () {
  'use strict';

  const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const ACTION_MAP = {
    // Oturum & Güvenlik
    LOGIN:               { label: 'Kullanıcı Girişi', badge: 'badge-blue', group: 'auth' },
    LOGOUT:              { label: 'Kullanıcı Çıkışı', badge: 'badge-gray', group: 'auth' },
    REGISTER:            { label: 'Kullanıcı Kaydı', badge: 'badge-green', group: 'auth' },
    USER_UPDATE:         { label: 'Profil Güncelleme', badge: 'badge-purple', group: 'auth' },
    USERNAME_CHANGE:     { label: 'Kullanıcı Adı Değişimi', badge: 'badge-purple', group: 'auth' },
    PASSWORD_CHANGE:     { label: 'Şifre Güncelleme', badge: 'badge-purple', group: 'auth' },
    EMAIL_CHANGE:        { label: 'E-Posta Değişimi', badge: 'badge-purple', group: 'auth' },
    INIT:                { label: 'Sistem Başlatma', badge: 'badge-gray', group: 'system' },
    SYSTEM_INIT:         { label: 'Sistem Başlatma', badge: 'badge-gray', group: 'system' },

    // Rapor Dosya & İndirme
    REPORT_UPLOAD:       { label: 'Rapor Yükleme', badge: 'badge-green', group: 'files' },
    REPORT_BULK_UPLOAD:  { label: 'Toplu Rapor Yükleme', badge: 'badge-green', group: 'files' },
    FRP_DOWNLOAD:        { label: 'Rapor İndirme', badge: 'badge-purple', group: 'files' },
    REPORT_DOWNLOAD:     { label: 'Rapor İndirme', badge: 'badge-purple', group: 'files' },
    BULK_DOWNLOAD:       { label: 'Toplu İndirme', badge: 'badge-purple', group: 'files' },
    REPORT_BULK_DOWNLOAD:{ label: 'Toplu İndirme', badge: 'badge-purple', group: 'files' },
    EXPORT:              { label: 'Dışa Aktarma', badge: 'badge-blue', group: 'files' },
    EXPORT_ALL_SQL:      { label: 'Tüm SQL İndirme', badge: 'badge-purple', group: 'files' },
    EXPORT_ALL_SQL_CSV:  { label: 'SQL CSV İndirme', badge: 'badge-purple', group: 'files' },

    // Düzenleme & Kod
    REPORT_UPDATE:       { label: 'Rapor Güncelleme', badge: 'badge-blue', group: 'edits' },
    REPORT_EDIT:         { label: 'Rapor Düzenleme', badge: 'badge-blue', group: 'edits' },
    REPORT_RENAME:       { label: 'Rapor Adı Güncelleme', badge: 'badge-blue', group: 'edits' },
    NOTE_UPDATE:         { label: 'Not Güncelleme', badge: 'badge-blue', group: 'edits' },
    DESIGN_EDIT:         { label: 'Tasarım Düzenleme', badge: 'badge-blue', group: 'edits' },
    SQL_EDIT:            { label: 'SQL Sorgu Düzenleme', badge: 'badge-purple', group: 'edits' },
    PASCAL_EDIT:         { label: 'Pascal Script Düzenleme', badge: 'badge-amber', group: 'edits' },
    REPORT_FAVORITE:     { label: 'Favori İşlemi', badge: 'badge-amber', group: 'edits' },
    REPORT_PIN:          { label: 'Sabitleme İşlemi', badge: 'badge-amber', group: 'edits' },
    REPORT_BULK_FAVORITE:{ label: 'Toplu Favori İşlemi', badge: 'badge-amber', group: 'edits' },

    // Ortak Havuz
    POOL_ADD:            { label: 'Havuz Paylaşımı', badge: 'badge-green', group: 'pool' },
    POOL_ADD_BULK:       { label: 'Toplu Havuz Paylaşımı', badge: 'badge-green', group: 'pool' },
    POOL_REMOVE:         { label: 'Havuzdan Kaldırma', badge: 'badge-amber', group: 'pool' },
    POOL_REMOVE_BULK:    { label: 'Toplu Havuz Çıkarma', badge: 'badge-amber', group: 'pool' },
    POOL_CLONE:          { label: 'Havuzdan İçe Aktarma', badge: 'badge-blue', group: 'pool' },

    // Çöp Kutusu & Silme
    REPORT_DELETE:       { label: 'Çöp Kutusuna Taşıma', badge: 'badge-red', group: 'trash' },
    REPORT_BULK_DELETE:  { label: 'Toplu Çöpe Taşıma', badge: 'badge-red', group: 'trash' },
    REPORT_CLEAR_ALL:    { label: 'Tüm Raporları Çöpe Taşıma', badge: 'badge-red', group: 'trash' },
    TRASH_MOVE:          { label: 'Çöp Kutusuna Taşıma', badge: 'badge-red', group: 'trash' },
    TRASH_BULK_MOVE:     { label: 'Toplu Çöpe Taşıma', badge: 'badge-red', group: 'trash' },
    TRASH_RESTORE:       { label: 'Çöpten Geri Yükleme', badge: 'badge-green', group: 'trash' },
    TRASH_BULK_RESTORE:  { label: 'Toplu Çöpten Kurtarma', badge: 'badge-green', group: 'trash' },
    TRASH_PURGE:         { label: 'Kalıcı Silme', badge: 'badge-red', group: 'trash' },
    TRASH_BULK_PURGE:    { label: 'Toplu Kalıcı Silme', badge: 'badge-red', group: 'trash' },
    TRASH_EMPTY:         { label: 'Çöpü Boşaltma', badge: 'badge-red', group: 'trash' },

    // Kategori & Etiket
    TAG_ADD:             { label: 'Etiket Ekleme', badge: 'badge-blue', group: 'tags' },
    TAG_REMOVE:          { label: 'Etiket Kaldırma', badge: 'badge-amber', group: 'tags' },
    TAG_CREATE:          { label: 'Özel Etiket Ekleme', badge: 'badge-blue', group: 'tags' },
    TAG_DELETE:          { label: 'Özel Etiket Silme', badge: 'badge-red', group: 'tags' },
    CATEGORY_CREATE:     { label: 'Kategori Oluşturma', badge: 'badge-green', group: 'tags' },
    CATEGORY_UPDATE:     { label: 'Kategori Güncelleme', badge: 'badge-blue', group: 'tags' },
    CATEGORY_DELETE:     { label: 'Kategori Silme', badge: 'badge-red', group: 'tags' },
    CATEGORY_ASSIGN:     { label: 'Kategori Atama', badge: 'badge-blue', group: 'tags' },

    // Sistem & Ayarlar
    SETTINGS_UPDATE:     { label: 'Kullanıcı Ayarları', badge: 'badge-blue', group: 'system' },
    SETTINGS_CHANGE:     { label: 'Arayüz Tercihleri', badge: 'badge-blue', group: 'system' },
    THEME_CHANGE:        { label: 'Tema Değişimi', badge: 'badge-blue', group: 'system' },
    DATA_RESET:          { label: 'Veritabanı Sıfırlama', badge: 'badge-red', group: 'system' },
    AUTO_BACKUP:         { label: 'Otomatik Yedekleme', badge: 'badge-green', group: 'system' },
    BACKUP_EXPORT:       { label: 'Sistem Yedeği Alma', badge: 'badge-green', group: 'system' },
    BACKUP_IMPORT:       { label: 'Yedekten Geri Yükleme', badge: 'badge-green', group: 'system' }
  };

  const LEGACY_ACTION_TEXTS = {
    'TOPLU İNDİRME':       'BULK_DOWNLOAD',
    'TOPLU INDIRME':       'BULK_DOWNLOAD',
    'RAPOR YÜKLEME':       'REPORT_UPLOAD',
    'RAPOR YUKLEME':       'REPORT_UPLOAD',
    'TOPLU HAVUZ EKLEME':  'POOL_ADD_BULK',
    'HAVUZ PAYLAŞIMI':     'POOL_ADD',
    'HAVUZDAN KALDIRMA':   'POOL_REMOVE',
    'TOPLU HAVUZ ÇIKARMA': 'POOL_REMOVE_BULK',
    'ÇÖP KUTUSUNA TAŞIMA': 'TRASH_MOVE',
    'ÇÖPTEN GERİ YÜKLEME': 'TRASH_RESTORE',
    'KALICI SİLME':        'TRASH_PURGE',
    'ÇÖPÜ BOŞALTMA':       'TRASH_EMPTY',
    'TASARIM DÜZENLEME':   'DESIGN_EDIT',
    'SQL SORGU DÜZENLEME': 'SQL_EDIT',
    'PASCAL SCRİPT DÜZENLEME': 'PASCAL_EDIT',
    'GİRİŞ':               'LOGIN',
    'GİRİŞ YAPMA':         'LOGIN',
    'KULLANICI AYARLARI':  'SETTINGS_UPDATE',
    'PROFİL GÜNCELLEME':   'USER_UPDATE'
  };

  function getActionInfo(action) {
    let act = String(action || 'INFO').trim().toUpperCase();
    if (LEGACY_ACTION_TEXTS[act]) {
      act = LEGACY_ACTION_TEXTS[act];
    }
    if (ACTION_MAP[act]) {
      return ACTION_MAP[act];
    }
    const cleanLabel = act.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
    return { label: cleanLabel, badge: 'badge-blue', group: 'other' };
  }

  function formatTimestamp(isoStr) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '-';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dd}.${mm}.${yyyy} - ${hh}:${min}`;
    } catch {
      return String(isoStr);
    }
  }

  function showLogDetailModal(log) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '9999999';

    const actInfo = getActionInfo(log.action);
    const dateStr = formatTimestamp(log.timestamp);
    const ipDisplay = (log.ip && log.ip !== '-' && log.ip !== '') ? log.ip : '127.0.0.1';

    // Rapor Listesini Çıkar (Toplu veya Tekil İşlemlerde)
    let reportsList = [];
    if (Array.isArray(log.reports) && log.reports.length > 0) {
      reportsList = log.reports;
    } else if (Array.isArray(log.metadata?.reports) && log.metadata.reports.length > 0) {
      reportsList = log.metadata.reports;
    } else if (Array.isArray(log.items) && log.items.length > 0) {
      reportsList = log.items;
    } else {
      const allStored = typeof window.FrpStore !== 'undefined' && typeof window.FrpStore.getAll === 'function' ? window.FrpStore.getAll() : [];
      const targetStr = String(log.target || '').trim();
      const detailsStr = String(log.details || '').trim();

      if (targetStr && targetStr !== 'Genel Sistem' && !/^\d+\s*Rapor$/i.test(targetStr)) {
        const found = allStored.find(f => f.name.toLowerCase() === targetStr.toLowerCase() || (f.meta?.reportName && f.meta.reportName.toLowerCase() === targetStr.toLowerCase()) || f.id === log.reportId);
        if (found) {
          reportsList.push({ id: found.id, name: found.name, title: found.meta?.reportName || found.name });
        } else {
          reportsList.push({ name: targetStr, title: targetStr });
        }
      } else {
        const quoted = detailsStr.match(/'([^']+)'/g) || [];
        quoted.forEach(q => {
          const cleanName = q.replace(/^'|'$/g, '').trim();
          if (cleanName && cleanName.endsWith('.frp')) {
            const found = allStored.find(f => f.name.toLowerCase() === cleanName.toLowerCase() || (f.meta?.reportName && f.meta.reportName.toLowerCase() === cleanName.toLowerCase()));
            if (found) {
              reportsList.push({ id: found.id, name: found.name, title: found.meta?.reportName || found.name });
            } else {
              reportsList.push({ name: cleanName, title: cleanName });
            }
          }
        });
      }
    }

    // Tekrarlanan raporları tekilleştir
    const uniqueReports = [];
    const seenMap = new Set();
    reportsList.forEach(r => {
      const key = (r.id || '') + '_' + (r.name || r.title || '');
      if (!seenMap.has(key)) {
        seenMap.add(key);
        uniqueReports.push(r);
      }
    });

    const reportsSectionHtml = uniqueReports.length > 0 ? `
      <div style="margin-bottom:1.2rem;">
        <div style="font-size:.72rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:.45rem;display:flex;align-items:center;justify-content:space-between;">
          <span>İşleme Dahil Edilen Raporlar (${uniqueReports.length} Rapor)</span>
        </div>
        <div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;max-height:220px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding:6px;">
          ${uniqueReports.map(r => {
            const repId = r.id;
            const repTitle = r.title || r.reportName || r.name;
            const repFile = r.name || r.fileName || '';
            const existsInStore = repId ? Boolean(window.FrpStore && window.FrpStore.getById && window.FrpStore.getById(repId)) : false;
            return `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;padding:.5rem .75rem;background:var(--bg-surface);border-radius:8px;border:1px solid var(--border-light);">
                <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1;">
                  <div style="font-weight:700;font-size:.82rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(repTitle)}</div>
                  ${repFile && repFile !== repTitle ? `<div style="font-size:.72rem;color:var(--text-muted);font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(repFile)}</div>` : ''}
                </div>
                ${repId && existsInStore ? `
                  <button type="button" class="btn btn-sm btn-primary btn-go-report-detail" data-rep-id="${escHtml(repId)}" style="padding:.28rem .7rem;font-size:.74rem;font-weight:700;white-space:nowrap;flex-shrink:0;">
                    Rapora Git ➔
                  </button>
                ` : `
                  <span class="badge badge-gray" style="font-size:.68rem;padding:.2rem .5rem;flex-shrink:0;">Kayıt / Arşiv</span>
                `}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : '';

    overlay.innerHTML = `
      <div class="modal" style="max-width:620px;width:94vw;padding:1.6rem;border-radius:18px;box-shadow:0 28px 70px rgba(0,0,0,.5);border:1.5px solid var(--border);background:var(--bg-surface);animation:fadeIn .18s ease-out;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem;border-bottom:1px solid var(--border-light);padding-bottom:.75rem;">
          <div style="font-size:1.1rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:.6rem;">
            <span>İşlem Detay Kartı</span>
            <span class="badge ${actInfo.badge}">${escHtml(actInfo.label)}</span>
          </div>
          <button type="button" class="btn btn-sm btn-ghost btn-close-detail" style="font-size:1rem;padding:4px 8px;border-radius:8px;" title="Kapat">Kapat</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.85rem;font-size:.84rem;margin-bottom:1.2rem;background:var(--bg-raised);padding:1rem;border-radius:12px;border:1px solid var(--border-light);">
          <div>
            <div style="font-size:.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;">İşlem Zamanı</div>
            <div style="font-weight:700;color:var(--text-primary);font-family:var(--mono);font-size:.82rem;">${dateStr}</div>
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;">Kullanıcı & Rol</div>
            <div style="font-weight:700;color:var(--text-primary);">@${escHtml(log.username || 'misafir')} <span class="badge ${log.role === 'admin' ? 'badge-purple' : 'badge-gray'}" style="font-size:.65rem;margin-left:4px;">${escHtml(log.role || 'user')}</span></div>
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;">İstemci IP Adresi</div>
            <div style="font-weight:800;font-family:var(--mono);color:var(--accent);font-size:.82rem;">${escHtml(ipDisplay)}</div>
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;">Hedef / Rapor</div>
            <div style="font-weight:700;color:var(--text-primary);word-break:break-all;">${escHtml(log.target || 'Genel Sistem')}</div>
          </div>
        </div>

        ${reportsSectionHtml}

        <div style="margin-bottom:1.4rem;">
          <div style="font-size:.72rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:.45rem;">Açıklama & Detaylar</div>
          <div style="background:var(--bg-raised);padding:.85rem 1rem;border-radius:10px;border:1px solid var(--border);font-size:.84rem;line-height:1.6;color:var(--text-secondary);word-break:break-word;max-height:180px;overflow-y:auto;">
            ${escHtml(log.details || 'Açıklama bulunmuyor.')}
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;">
          <button type="button" class="btn btn-sm btn-primary btn-close-detail" style="padding:.5rem 1.4rem;font-weight:800;border-radius:9px;font-size:.84rem;">Kapat</button>
        </div>
      </div>
    `;

    overlay.querySelectorAll('.btn-close-detail').forEach(btn => btn.addEventListener('click', () => overlay.remove()));
    overlay.querySelectorAll('.btn-go-report-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const repId = btn.getAttribute('data-rep-id');
        if (repId) {
          window.location.href = `detail.html?id=${encodeURIComponent(repId)}`;
        }
      });
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function exportAuditToExcel(logs) {
    if (!logs || logs.length === 0) {
      if (typeof window.safeToast === 'function') window.safeToast('Dışa aktarılacak denetim kaydı bulunamadı.', 'info');
      return;
    }

    const tableRows = logs.map(l => {
      const actInfo = getActionInfo(l.action);
      const targetDisplay = l.target || l.reportName || l.fileName || 'Genel Sistem';
      const detailsDisplay = l.details || `${actInfo.label} işlemi gerçekleştirildi.`;
      const userDisplay = l.username || (l.role === 'admin' ? 'admin' : 'misafir');
      const timeStr = formatTimestamp(l.timestamp);

      return `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;font-family:Consolas,monospace;">${timeStr}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">@${escHtml(userDisplay)}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${escHtml(l.role || 'user')}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;color:#1e40af;font-weight:bold;">${escHtml(actInfo.label)}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${escHtml(targetDisplay)}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${escHtml(detailsDisplay)}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-family:Consolas,monospace;">${escHtml(l.ip || '127.0.0.1')}</td>
        </tr>
      `;
    }).join('');

    const excelContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style>
          th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; font-family: Segoe UI, sans-serif; font-size: 10pt; padding: 8px; border: 1px solid #93c5fd; }
          td { font-family: Segoe UI, sans-serif; font-size: 9pt; vertical-align: middle; }
          tr:nth-child(even) td { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <h2 style="font-family:Segoe UI,sans-serif;color:#1e3a8a;margin-bottom:4px;">FrpOku - Kullanıcı İşlem Geçmişi & Denetim Günlüğü</h2>
        <p style="font-family:Segoe UI,sans-serif;font-size:9pt;color:#64748b;margin-top:0;">Dışa Aktarma Tarihi: ${new Date().toLocaleString('tr-TR')} | Toplam Kayıt: ${logs.length}</p>
        <table style="border-collapse:collapse;width:100%;">
          <thead>
            <tr>
              <th style="width:160px;">Zaman</th>
              <th style="width:130px;">Kullanıcı</th>
              <th style="width:90px;">Rol</th>
              <th style="width:160px;">İşlem Türü</th>
              <th style="width:200px;">Hedef</th>
              <th style="width:360px;">Açıklama / Detay</th>
              <th style="width:120px;">IP Adresi</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `denetim_gunlugu_${new Date().toISOString().slice(0, 10)}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    if (typeof window.safeToast === 'function') window.safeToast('Denetim günlüğü Excel tablosu (.xls) olarak indirildi.', 'success');
  }

  // ── DEDICATED FULLSCREEN / WIDE AUDIT MODAL ──────────────────
  window.openAuditLogModal = async function () {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '999999';

    overlay.innerHTML = `
      <div class="modal" style="width:96vw;max-width:1440px;height:92vh;min-height:680px;max-height:980px;padding:0;overflow:hidden;display:flex;flex-direction:column;border-radius:20px;box-shadow:0 32px 80px rgba(0,0,0,.5);border:1.5px solid var(--border);background:var(--bg-surface);animation:fadeIn .2s ease-out;">
        
        <!-- Üst Başlık Çubuğu -->
        <div style="background:var(--bg-raised);border-bottom:1px solid var(--border-light);padding:1.2rem 1.6rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
          <div>
            <div style="font-size:1.25rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:.6rem;letter-spacing:-.3px;">
              <span>Kullanıcı İşlem & Denetim Günlüğü</span>
              <span class="badge badge-purple" style="font-size:.72rem;padding:.2rem .6rem;border-radius:8px;">Bulut Senkronize (Supabase)</span>
            </div>
            <div style="font-size:.8rem;color:var(--text-muted);margin-top:.2rem;">
              Sistem oturumları, indirme, silme, yükleme, havuz ve kod düzenleme hareketleri.
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:.6rem;">
            <button type="button" class="btn btn-sm btn-ghost" id="btnWideRefreshAudit" style="font-weight:700;padding:.45rem .9rem;font-size:.82rem;border:1px solid var(--border);">
              Yenile
            </button>
            <button type="button" class="btn btn-sm btn-primary" id="btnWideExportExcel" style="font-weight:800;font-size:.82rem;background:linear-gradient(135deg,#059669,#10b981);border:none;box-shadow:0 4px 12px rgba(16,185,129,0.35);padding:.45rem 1.1rem;">
              Excel (.xls) İndir
            </button>
            <button type="button" class="btn btn-sm btn-ghost" id="btnCloseWideAuditModal" style="font-size:.84rem;font-weight:700;padding:.45rem .85rem;border-radius:10px;margin-left:.4rem;" title="Kapat">Kapat</button>
          </div>
        </div>

        <!-- Gövde Alanı -->
        <div style="flex:1;display:flex;flex-direction:column;padding:1.25rem 1.6rem;gap:1rem;min-height:0;overflow:hidden;">
          
          <!-- KPI Sayaç Şeridi -->
          <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;background:var(--bg-raised);padding:.6rem 1rem;border-radius:12px;border:1px solid var(--border-light);font-size:.84rem;">
            <div style="display:flex;align-items:center;gap:.4rem;color:var(--text-secondary);font-weight:600;">
              <span>Toplam Kayıt:</span>
              <span id="kpiWideTotal" style="font-weight:800;color:var(--accent);background:var(--bg-surface);padding:2px 8px;border-radius:7px;border:1px solid var(--border-light);">0</span>
            </div>
            <div style="color:var(--border);">|</div>
            <div style="display:flex;align-items:center;gap:.4rem;color:var(--text-secondary);font-weight:600;">
              <span>Yükleme & İndirme:</span>
              <span id="kpiWideFiles" style="font-weight:800;color:var(--green);background:var(--bg-surface);padding:2px 8px;border-radius:7px;border:1px solid var(--border-light);">0</span>
            </div>
            <div style="color:var(--border);">|</div>
            <div style="display:flex;align-items:center;gap:.4rem;color:var(--text-secondary);font-weight:600;">
              <span>Kod & Tasarım:</span>
              <span id="kpiWideEdits" style="font-weight:800;color:var(--purple);background:var(--bg-surface);padding:2px 8px;border-radius:7px;border:1px solid var(--border-light);">0</span>
            </div>
            <div style="color:var(--border);">|</div>
            <div style="display:flex;align-items:center;gap:.4rem;color:var(--text-secondary);font-weight:600;">
              <span>Silme & Çöp:</span>
              <span id="kpiWideDeletes" style="font-weight:800;color:var(--red);background:var(--bg-surface);padding:2px 8px;border-radius:7px;border:1px solid var(--border-light);">0</span>
            </div>
          </div>

          <!-- Arama ve Filtre Çubuğu -->
          <div style="display:flex;gap:.75rem;width:100%;box-sizing:border-box;flex-wrap:wrap;">
            <div style="flex:1;min-width:240px;">
              <input type="text" id="wideAuditSearchInput" placeholder="Loglarda ara (Kullanıcı, işlem, rapor adı, IP, açıklama)..." class="master-search-input" style="width:100%;font-size:.86rem;padding:.5rem .9rem;box-sizing:border-box;border-radius:10px;" />
            </div>
            <select id="wideAuditActionFilter" class="master-search-input" style="width:260px;font-size:.84rem;font-weight:700;border-radius:10px;padding:.5rem .8rem;">
              <option value="">Tüm İşlem Türleri</option>
              <optgroup label="Dosya & Aktarım">
                <option value="REPORT_UPLOAD">Rapor Yükleme</option>
                <option value="REPORT_BULK_UPLOAD">Toplu Rapor Yükleme</option>
                <option value="FRP_DOWNLOAD">Rapor İndirme</option>
                <option value="BULK_DOWNLOAD">Toplu İndirme</option>
                <option value="EXPORT_ALL_SQL">SQL Dışa Aktarma</option>
              </optgroup>
              <optgroup label="Düzenleme & Kod">
                <option value="REPORT_UPDATE">Rapor Güncelleme</option>
                <option value="DESIGN_EDIT">Tasarım Düzenleme</option>
                <option value="SQL_EDIT">SQL Düzenleme</option>
                <option value="PASCAL_EDIT">Pascal Script Düzenleme</option>
                <option value="NOTE_UPDATE">Not Güncelleme</option>
                <option value="REPORT_FAVORITE">Favori / Sabitleme</option>
              </optgroup>
              <optgroup label="Ortak Havuz">
                <option value="POOL_ADD">Havuz Paylaşımı</option>
                <option value="POOL_REMOVE">Havuzdan Kaldırma</option>
                <option value="POOL_CLONE">Havuzdan İçe Aktarma</option>
              </optgroup>
              <optgroup label="Çöp Kutusu & Silme">
                <option value="REPORT_DELETE">Çöp Kutusuna Taşıma</option>
                <option value="TRASH_RESTORE">Çöpten Geri Yükleme</option>
                <option value="TRASH_PURGE">Kalıcı Silme</option>
                <option value="TRASH_EMPTY">Çöpü Boşaltma</option>
              </optgroup>
              <optgroup label="Kategori & Etiket">
                <option value="TAG_ADD">Etiket Ekleme / Kaldırma</option>
                <option value="CATEGORY_CREATE">Kategori İşlemleri</option>
              </optgroup>
              <optgroup label="Oturum & Sistem">
                <option value="LOGIN">Kullanıcı Girişi</option>
                <option value="USER_UPDATE">Profil & Güvenlik</option>
                <option value="SETTINGS_UPDATE">Kullanıcı Ayarları</option>
                <option value="BACKUP_EXPORT">Sistem Yedeği</option>
                <option value="DATA_RESET">Veritabanı Sıfırlama</option>
              </optgroup>
            </select>
          </div>

          <!-- Tablo Alanı (Scrollable Grid) -->
          <div id="wideAuditTableContainer" style="flex:1;background:var(--bg-surface);border:1.5px solid var(--border-light);border-radius:14px;overflow-x:auto;overflow-y:auto;box-shadow:inset 0 1px 4px rgba(0,0,0,0.03);min-height:0;">
            <div style="text-align:center;padding:4rem 1rem;color:var(--text-muted);">
              <div class="splash-spinner" style="margin-bottom:.8rem;width:28px;height:28px;"></div>
              <div style="font-weight:700;font-size:.88rem;">Denetim kayıtları yükleniyor...</div>
            </div>
          </div>

        </div>

        <!-- Alt Durum Çubuğu -->
        <div style="background:var(--bg-raised);border-top:1px solid var(--border-light);padding:.75rem 1.6rem;display:flex;align-items:center;justify-content:space-between;font-size:.78rem;color:var(--text-muted);">
          <div>Detayını görüntülemek istediğiniz kaydın satırına tıklayabilirsiniz.</div>
          <button type="button" class="btn btn-sm btn-ghost" id="btnBottomCloseWideAudit" style="font-weight:700;">Kapat</button>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    const tableContainer = overlay.querySelector('#wideAuditTableContainer');
    const searchInp = overlay.querySelector('#wideAuditSearchInput');
    const filterSelect = overlay.querySelector('#wideAuditActionFilter');
    const btnRefresh = overlay.querySelector('#btnWideRefreshAudit');
    const btnExportExcel = overlay.querySelector('#btnWideExportExcel');
    const btnClose = overlay.querySelector('#btnCloseWideAuditModal');
    const btnBottomClose = overlay.querySelector('#btnBottomCloseWideAudit');

    let loadedLogs = [];

    const updateKpis = (logs) => {
      const totalEl = overlay.querySelector('#kpiWideTotal');
      const filesEl = overlay.querySelector('#kpiWideFiles');
      const editsEl = overlay.querySelector('#kpiWideEdits');
      const delsEl = overlay.querySelector('#kpiWideDeletes');
      if (!totalEl) return;

      const total = (logs || []).length;
      const fileOps = (logs || []).filter(l => ['REPORT_UPLOAD', 'REPORT_UPDATE', 'FRP_DOWNLOAD', 'BULK_DOWNLOAD', 'POOL_ADD', 'POOL_REMOVE', 'POOL_CLONE'].includes(l.action)).length;
      const editOps = (logs || []).filter(l => ['DESIGN_EDIT', 'SQL_EDIT', 'PASCAL_EDIT', 'USERNAME_CHANGE', 'USER_UPDATE'].includes(l.action)).length;
      const delOps = (logs || []).filter(l => ['REPORT_DELETE', 'REPORT_DELETE_BULK', 'TRASH_PURGE', 'TRASH_EMPTY', 'DATA_RESET'].includes(l.action)).length;

      totalEl.textContent = total;
      if (filesEl) filesEl.textContent = fileOps;
      if (editsEl) editsEl.textContent = editOps;
      if (delsEl) delsEl.textContent = delOps;
    };

    const renderTable = (logs) => {
      if (!tableContainer) return;
      if (!logs || logs.length === 0) {
        tableContainer.innerHTML = `<div style="text-align:center;padding:4rem 1rem;color:var(--text-muted);font-size:.88rem;font-weight:600;">Eşleşen herhangi bir işlem kaydı bulunamadı.</div>`;
        return;
      }

      const rowsHtml = logs.map((l, idx) => {
        const dateStr = formatTimestamp(l.timestamp);
        const actInfo = getActionInfo(l.action);
        const ipDisplay = (l.ip && l.ip !== '-' && l.ip !== '') ? l.ip : '127.0.0.1';
        const targetDisplay = l.target || l.reportName || l.fileName || 'Genel Sistem';
        const detailsDisplay = l.details || `${actInfo.label} işlemi gerçekleştirildi.`;
        const userDisplay = l.username || (l.role === 'admin' ? 'admin' : 'misafir');

        return `
          <tr data-log-idx="${idx}" class="wide-audit-row" style="border-bottom:1px solid var(--border-light);font-size:.82rem;cursor:pointer;transition:background .12s;">
            <td style="padding:.7rem .9rem;white-space:nowrap;color:var(--text-muted);font-family:var(--mono);font-size:.78rem;">${dateStr}</td>
            <td style="padding:.7rem .9rem;font-weight:700;color:var(--text-primary);white-space:nowrap;">
              <div style="display:flex;align-items:center;gap:.35rem;">
                <span>@${escHtml(userDisplay)}</span>
                ${l.role === 'admin' ? '<span class="badge badge-purple" style="font-size:.62rem;padding:1px 5px;border-radius:4px;">Admin</span>' : ''}
              </div>
            </td>
            <td style="padding:.7rem .9rem;white-space:nowrap;">
              <span class="badge ${actInfo.badge}" style="font-size:.72rem;padding:.2rem .55rem;border-radius:6px;">${escHtml(actInfo.label)}</span>
            </td>
            <td style="padding:.7rem .9rem;font-weight:700;color:var(--accent);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(targetDisplay)}">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(targetDisplay)}</span>
                <span class="badge badge-blue" style="font-size:.62rem;padding:1px 6px;border-radius:4px;cursor:pointer;flex-shrink:0;">Detay</span>
              </div>
            </td>
            <td style="padding:.7rem .9rem;color:var(--text-secondary);max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(detailsDisplay)}">
              ${escHtml(detailsDisplay)}
            </td>
            <td style="padding:.7rem .9rem;color:var(--text-muted);font-family:var(--mono);font-size:.78rem;white-space:nowrap;">
              ${escHtml(ipDisplay)}
            </td>
          </tr>
        `;
      }).join('');

      tableContainer.innerHTML = `
        <table style="width:100%;border-collapse:collapse;text-align:left;font-size:.82rem;">
          <thead>
            <tr style="background:var(--bg-raised);border-bottom:1.5px solid var(--border);font-size:.78rem;font-weight:800;color:var(--text-secondary);position:sticky;top:0;z-index:2;">
              <th style="padding:.75rem .9rem;width:160px;white-space:nowrap;">Zaman</th>
              <th style="padding:.75rem .9rem;width:140px;white-space:nowrap;">Kullanıcı</th>
              <th style="padding:.75rem .9rem;width:170px;white-space:nowrap;">İşlem Türü</th>
              <th style="padding:.75rem .9rem;width:220px;white-space:nowrap;">Hedef / Rapor</th>
              <th style="padding:.75rem .9rem;">Açıklama / Detay</th>
              <th style="padding:.75rem .9rem;width:120px;white-space:nowrap;">IP Adresi</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      `;

      tableContainer.querySelectorAll('.wide-audit-row').forEach(tr => {
        tr.addEventListener('click', () => {
          const idx = parseInt(tr.dataset.logIdx, 10);
          if (logs[idx]) showLogDetailModal(logs[idx]);
        });
        tr.addEventListener('mouseenter', () => { tr.style.backgroundColor = 'var(--bg-raised)'; });
        tr.addEventListener('mouseleave', () => { tr.style.backgroundColor = 'transparent'; });
      });
    };

    const filterAndDisplay = () => {
      const q = (searchInp?.value || '').toLowerCase().trim();
      const act = (filterSelect?.value || '').toUpperCase();

      let filtered = loadedLogs;
      if (act) {
        filtered = filtered.filter(l => {
          let rawAct = String(l.action || '').trim().toUpperCase();
          if (LEGACY_ACTION_TEXTS[rawAct]) rawAct = LEGACY_ACTION_TEXTS[rawAct];
          if (rawAct === act) return true;
          if (act === 'REPORT_UPLOAD' && ['REPORT_UPLOAD', 'REPORT_BULK_UPLOAD'].includes(rawAct)) return true;
          if (act === 'FRP_DOWNLOAD' && ['FRP_DOWNLOAD', 'REPORT_DOWNLOAD', 'BULK_DOWNLOAD', 'REPORT_BULK_DOWNLOAD'].includes(rawAct)) return true;
          if (act === 'POOL_ADD' && ['POOL_ADD', 'POOL_ADD_BULK'].includes(rawAct)) return true;
          if (act === 'POOL_REMOVE' && ['POOL_REMOVE', 'POOL_REMOVE_BULK'].includes(rawAct)) return true;
          if (act === 'REPORT_DELETE' && ['REPORT_DELETE', 'REPORT_BULK_DELETE', 'REPORT_CLEAR_ALL', 'TRASH_MOVE', 'TRASH_BULK_MOVE'].includes(rawAct)) return true;
          if (act === 'TRASH_RESTORE' && ['TRASH_RESTORE', 'TRASH_BULK_RESTORE'].includes(rawAct)) return true;
          if (act === 'TRASH_PURGE' && ['TRASH_PURGE', 'TRASH_BULK_PURGE'].includes(rawAct)) return true;
          if (act === 'TAG_ADD' && ['TAG_ADD', 'TAG_REMOVE', 'TAG_CREATE', 'TAG_DELETE'].includes(rawAct)) return true;
          if (act === 'CATEGORY_CREATE' && ['CATEGORY_CREATE', 'CATEGORY_UPDATE', 'CATEGORY_DELETE', 'CATEGORY_ASSIGN'].includes(rawAct)) return true;
          if (act === 'REPORT_FAVORITE' && ['REPORT_FAVORITE', 'REPORT_PIN', 'REPORT_BULK_FAVORITE'].includes(rawAct)) return true;
          return false;
        });
      }
      if (q) {
        filtered = filtered.filter(l => {
          const actInfo = getActionInfo(l.action);
          return (l.username || '').toLowerCase().includes(q) ||
            (l.details || '').toLowerCase().includes(q) ||
            (l.target || '').toLowerCase().includes(q) ||
            (l.action || '').toLowerCase().includes(q) ||
            (actInfo.label || '').toLowerCase().includes(q) ||
            (l.ip || '').includes(q);
        });
      }
      renderTable(filtered);
    };

    const fetchLogs = async () => {
      if (tableContainer) {
        tableContainer.innerHTML = `<div style="text-align:center;padding:4rem 1rem;color:var(--text-muted);"><div class="splash-spinner" style="margin-bottom:.8rem;width:28px;height:28px;"></div><div style="font-weight:700;font-size:.88rem;">Denetim kayıtları yükleniyor...</div></div>`;
      }
      try {
        if (window.FrpAudit && typeof window.FrpAudit.getLogs === 'function') {
          loadedLogs = await window.FrpAudit.getLogs();
        } else if (window.FrpCloud && typeof window.FrpCloud.loadAuditLogs === 'function') {
          loadedLogs = (await window.FrpCloud.loadAuditLogs()) || [];
        } else {
          const res = await fetch('/api/admin/audit-logs?limit=500', {
            headers: window.FrpAuth ? window.FrpAuth.getAuthHeaders() : {}
          });
          const data = await res.json();
          loadedLogs = (data && data.success && Array.isArray(data.logs)) ? data.logs : [];
        }
      } catch (e) {
        console.warn('Audit logs fetch hatası:', e.message);
        try {
          const stored = localStorage.getItem('frp_audit_logs');
          loadedLogs = stored ? JSON.parse(stored) : [];
        } catch {
          loadedLogs = [];
        }
      }
      updateKpis(loadedLogs);
      filterAndDisplay();
    };

    searchInp?.addEventListener('input', filterAndDisplay);
    filterSelect?.addEventListener('change', filterAndDisplay);
    btnRefresh?.addEventListener('click', fetchLogs);
    btnExportExcel?.addEventListener('click', () => exportAuditToExcel(loadedLogs));

    const closeHandler = () => overlay.remove();
    btnClose?.addEventListener('click', closeHandler);
    btnBottomClose?.addEventListener('click', closeHandler);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeHandler(); });

    fetchLogs();
  };

  // Standart Sekme Modülü Arayüzü (Geriye Dönük Uyumluluk)
  window.FrpSettingsTabs.audit = {
    render() {
      return `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 1.5rem;text-align:center;gap:1.25rem;">
          <div style="width:64px;height:64px;border-radius:20px;background:var(--accent-light);color:var(--accent);display:flex;align-items:center;justify-content:center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          </div>
          <div>
            <div style="font-size:1.2rem;font-weight:900;color:var(--text-primary);margin-bottom:.4rem;">Kullanıcı İşlem & Denetim Günlüğü</div>
            <div style="font-size:.84rem;color:var(--text-muted);max-width:480px;line-height:1.5;">
              Tüm sistem hareketleri, indirme, yükleme ve güvenlik kayıtları tam ekran genişletilmiş arayüzde sunulmaktadır.
            </div>
          </div>
          <button type="button" class="btn btn-primary" id="btnOpenWideAuditModalDirect" style="font-weight:800;padding:.6rem 1.6rem;font-size:.9rem;box-shadow:0 4px 14px rgba(37,99,235,0.35);">
            Denetim Günlüğünü Geniş Pencerede Aç
          </button>
        </div>
      `;
    },

    bind({ overlay }) {
      overlay.querySelector('#btnOpenWideAuditModalDirect')?.addEventListener('click', () => {
        window.openAuditLogModal();
      });
    }
  };

})();
