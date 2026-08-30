// ============================================================
//  audit_tab.js — Kullanıcı İşlem Geçmişi & Denetim Günlüğü v7
//  Genişletilmiş (Wide / Fullscreen) Modal, Temiz Kurumsal Tasarım
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

(function () {
  'use strict';

  const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const ACTION_MAP = {
    LOGIN:               { label: 'Giriş', badge: 'badge-blue' },
    REGISTER:            { label: 'Kayıt', badge: 'badge-green' },
    USER_UPDATE:         { label: 'Profil Güncelleme', badge: 'badge-purple' },
    USERNAME_CHANGE:     { label: 'Kullanıcı Adı', badge: 'badge-purple' },
    EMAIL_CHANGE:        { label: 'E-Posta Değişimi', badge: 'badge-amber' },
    REPORT_UPLOAD:       { label: 'Rapor Yükleme', badge: 'badge-green' },
    REPORT_UPDATE:       { label: 'Rapor Güncelleme', badge: 'badge-blue' },
    REPORT_EDIT:         { label: 'Rapor Düzenleme', badge: 'badge-blue' },
    FRP_DOWNLOAD:        { label: 'Rapor İndirme', badge: 'badge-purple' },
    BULK_DOWNLOAD:       { label: 'Toplu İndirme', badge: 'badge-purple' },
    POOL_ADD:            { label: 'Havuza Ekleme', badge: 'badge-green' },
    POOL_ADD_BULK:       { label: 'Toplu Havuz Ekleme', badge: 'badge-green' },
    POOL_REMOVE:         { label: 'Havuzdan Kaldırma', badge: 'badge-amber' },
    POOL_REMOVE_BULK:    { label: 'Toplu Havuz Çıkarma', badge: 'badge-amber' },
    POOL_CLONE:          { label: 'Havuzdan Klonlama', badge: 'badge-blue' },
    DESIGN_EDIT:         { label: 'Tasarım Düzenleme', badge: 'badge-blue' },
    SQL_EDIT:            { label: 'SQL Sorgu Düzenleme', badge: 'badge-purple' },
    PASCAL_EDIT:         { label: 'Pascal Script Düzenleme', badge: 'badge-amber' },
    REPORT_DELETE:       { label: 'Çöp Kutusuna Taşıma', badge: 'badge-red' },
    REPORT_DELETE_BULK:  { label: 'Toplu Çöp Taşıma', badge: 'badge-red' },
    TRASH_RESTORE:       { label: 'Çöpten Kurtarma', badge: 'badge-green' },
    TRASH_PURGE:         { label: 'Kalıcı Silme', badge: 'badge-red' },
    TRASH_EMPTY:         { label: 'Çöpü Boşaltma', badge: 'badge-red' },
    DATA_RESET:          { label: 'Veritabanı Sıfırlama', badge: 'badge-red' },
    AUTO_BACKUP:         { label: 'Otomatik Yedekleme', badge: 'badge-green' },
    EXPORT:              { label: 'Dışa Aktarma', badge: 'badge-blue' }
  };

  function getActionInfo(action) {
    const act = String(action || 'INFO').toUpperCase();
    return ACTION_MAP[act] || { label: act, badge: 'badge-blue' };
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

    overlay.innerHTML = `
      <div class="modal" style="max-width:580px;width:94vw;padding:1.6rem;border-radius:18px;box-shadow:0 28px 70px rgba(0,0,0,.5);border:1.5px solid var(--border);background:var(--bg-surface);animation:fadeIn .18s ease-out;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem;border-bottom:1px solid var(--border-light);padding-bottom:.75rem;">
          <div style="font-size:1.1rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:.6rem;">
            <span>Denetim Kayıt Detayı</span>
            <span class="badge ${actInfo.badge}" style="font-size:.74rem;padding:.2rem .6rem;">${escHtml(actInfo.label)}</span>
          </div>
          <button type="button" class="btn btn-sm btn-ghost btn-close-detail" style="font-size:1.2rem;padding:2px 10px;border-radius:50%;">✕</button>
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
            <div style="font-size:.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;">Hedef Rapor / Dosya</div>
            <div style="font-weight:700;color:var(--text-primary);word-break:break-all;">${escHtml(log.target || 'Genel Sistem')}</div>
          </div>
        </div>

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
            <button type="button" class="btn btn-sm btn-ghost" id="btnCloseWideAuditModal" style="font-size:1.3rem;padding:.3rem .75rem;border-radius:10px;margin-left:.4rem;" title="Kapat">✕</button>
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
              <input type="text" id="wideAuditSearchInput" placeholder="Loglarda ara (Kullanıcı, işlem, rapor adı, IP, detay)..." class="master-search-input" style="width:100%;font-size:.86rem;padding:.5rem .9rem;box-sizing:border-box;border-radius:10px;" />
            </div>
            <select id="wideAuditActionFilter" class="master-search-input" style="width:240px;font-size:.84rem;font-weight:700;border-radius:10px;padding:.5rem .8rem;">
              <option value="">Tüm İşlem Türleri</option>
              <option value="FRP_DOWNLOAD">İndirme (FRP_DOWNLOAD)</option>
              <option value="REPORT_UPLOAD">Yükleme (REPORT_UPLOAD)</option>
              <option value="REPORT_UPDATE">Güncelleme (REPORT_UPDATE)</option>
              <option value="POOL_ADD">Havuz Paylaşımı</option>
              <option value="POOL_REMOVE">Havuzdan Kaldırma</option>
              <option value="REPORT_DELETE">Çöp Kutusuna Taşıma</option>
              <option value="TRASH_RESTORE">Çöpten Geri Yükleme</option>
              <option value="TRASH_PURGE">Kalıcı Silme</option>
              <option value="TRASH_EMPTY">Çöpü Boşaltma</option>
              <option value="DESIGN_EDIT">Tasarım Düzenleme</option>
              <option value="SQL_EDIT">SQL Sorgu Düzenleme</option>
              <option value="PASCAL_EDIT">Pascal Script Düzenleme</option>
              <option value="LOGIN">Giriş Yapma (LOGIN)</option>
              <option value="USER_UPDATE">Profil Güncelleme</option>
              <option value="DATA_RESET">Veritabanı Sıfırlama</option>
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
              ${escHtml(targetDisplay)}
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
      const act = filterSelect?.value || '';

      let filtered = loadedLogs;
      if (act) {
        filtered = filtered.filter(l => (l.action || '').toUpperCase() === act.toUpperCase());
      }
      if (q) {
        filtered = filtered.filter(l =>
          (l.username || '').toLowerCase().includes(q) ||
          (l.details || '').toLowerCase().includes(q) ||
          (l.target || '').toLowerCase().includes(q) ||
          (l.action || '').toLowerCase().includes(q) ||
          (l.ip || '').includes(q)
        );
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
