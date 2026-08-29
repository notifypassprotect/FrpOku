// ============================================================
//  audit_tab.js — Kullanıcı İşlem Geçmişi & Denetim Günlüğü v6
//  Kompakt, Yüksek Çözünürlüklü ve Hatasız Tasarım
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.audit = {
  loadedLogs: [],

  render() {
    return `
      <div style="display:flex;flex-direction:column;gap:.9rem;width:100%;box-sizing:border-box;max-width:100%;">
        
        <!-- Üst Başlık ve Kompakt Eylem Çubuğu -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.65rem;padding-bottom:.55rem;border-bottom:1px solid var(--border-light);width:100%;box-sizing:border-box;">
          <div>
            <div style="font-size:1.08rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:.5rem;">
              <span>Kullanıcı İşlem & Denetim Günlüğü</span>
              <span class="badge badge-purple" style="font-size:.68rem;padding:.15rem .5rem;border-radius:6px;">Canlı Kayıtlar</span>
            </div>
            <div style="font-size:.76rem;color:var(--text-muted);margin-top:.15rem;">
              Sistem oturumları, indirme, silme, yükleme, havuz ve kod düzenleme hareketleri.
            </div>
          </div>
          <div style="display:flex;gap:.45rem;align-items:center;flex-wrap:wrap;">
            <button type="button" class="btn btn-sm btn-ghost" id="btnRefreshAuditLogs" style="font-weight:700;padding:.35rem .75rem;font-size:.78rem;border:1px solid var(--border);">
              🔄 Yenile
            </button>
            <button type="button" class="btn btn-sm btn-primary" id="btnExportAuditExcel" style="font-weight:800;font-size:.78rem;background:linear-gradient(135deg,#059669,#10b981);border:none;box-shadow:0 2px 8px rgba(16,185,129,0.3);padding:.35rem .95rem;">
              📊 Excel (.xls) İndir
            </button>
          </div>
        </div>

        <!-- Kompakt Sayaç Rozetleri Şeridi -->
        <div style="display:flex;align-items:center;gap:.55rem;flex-wrap:wrap;background:var(--bg-raised);padding:.45rem .75rem;border-radius:10px;border:1px solid var(--border-light);font-size:.78rem;" id="auditKpiRow">
          <div style="display:flex;align-items:center;gap:.35rem;color:var(--text-secondary);font-weight:600;">
            <span>Toplam:</span>
            <span id="kpiAuditTotal" style="font-weight:800;color:var(--accent);background:var(--bg-surface);padding:1px 6px;border-radius:6px;border:1px solid var(--border-light);">0</span>
          </div>
          <div style="color:var(--border);">|</div>
          <div style="display:flex;align-items:center;gap:.35rem;color:var(--text-secondary);font-weight:600;">
            <span>Yükleme/İndirme:</span>
            <span id="kpiAuditFiles" style="font-weight:800;color:var(--green);background:var(--bg-surface);padding:1px 6px;border-radius:6px;border:1px solid var(--border-light);">0</span>
          </div>
          <div style="color:var(--border);">|</div>
          <div style="display:flex;align-items:center;gap:.35rem;color:var(--text-secondary);font-weight:600;">
            <span>Kod/Düzenleme:</span>
            <span id="kpiAuditEdits" style="font-weight:800;color:var(--purple);background:var(--bg-surface);padding:1px 6px;border-radius:6px;border:1px solid var(--border-light);">0</span>
          </div>
          <div style="color:var(--border);">|</div>
          <div style="display:flex;align-items:center;gap:.35rem;color:var(--text-secondary);font-weight:600;">
            <span>Silme/Çöp:</span>
            <span id="kpiAuditDeletes" style="font-weight:800;color:var(--red);background:var(--bg-surface);padding:1px 6px;border-radius:6px;border:1px solid var(--border-light);">0</span>
          </div>
        </div>

        <!-- Kompakt Arama ve Filtre Kontrolleri -->
        <div style="display:flex;gap:.55rem;width:100%;box-sizing:border-box;flex-wrap:wrap;">
          <div style="flex:1;min-width:180px;">
            <input type="text" id="auditSearchInput" placeholder="🔍 Loglarda ara (Kullanıcı, işlem, rapor adı, IP, detay)..." class="master-search-input" style="width:100%;font-size:.8rem;padding:.4rem .7rem;box-sizing:border-box;border-radius:8px;" />
          </div>
          <select id="auditActionFilter" class="master-search-input" style="width:200px;font-size:.8rem;font-weight:700;border-radius:8px;padding:.4rem .6rem;">
            <option value="">Tüm İşlem Türleri</option>
            <option value="FRP_DOWNLOAD">📥 İndirme (FRP_DOWNLOAD)</option>
            <option value="REPORT_UPLOAD">📤 Yükleme (REPORT_UPLOAD)</option>
            <option value="REPORT_UPDATE">✏️ Güncelleme (REPORT_UPDATE)</option>
            <option value="POOL_ADD">🌐 Havuz Paylaşımı</option>
            <option value="POOL_REMOVE">🔒 Havuzdan Kaldırma</option>
            <option value="REPORT_DELETE">🗑️ Çöp Kutusuna Taşıma</option>
            <option value="TRASH_RESTORE">♻️ Çöpten Geri Yükleme</option>
            <option value="TRASH_PURGE">💥 Kalıcı Silme</option>
            <option value="TRASH_EMPTY">🧹 Çöpü Boşaltma</option>
            <option value="DESIGN_EDIT">🎨 Tasarım Düzenleme</option>
            <option value="SQL_EDIT">💻 SQL Sorgu Düzenleme</option>
            <option value="PASCAL_EDIT">📜 Pascal Script Düzenleme</option>
            <option value="LOGIN">🔐 Giriş Yapma (LOGIN)</option>
            <option value="USER_UPDATE">👤 Profil Güncelleme</option>
            <option value="DATA_RESET">🚨 Veritabanı Sıfırlama</option>
          </select>
        </div>

        <!-- Kompakt ve Taşmayan Tablo Alanı -->
        <div id="auditLogsContainer" style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:10px;overflow-x:auto;max-height:390px;overflow-y:auto;box-shadow:inset 0 1px 3px rgba(0,0,0,0.03);width:100%;box-sizing:border-box;">
          <div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);">
            <div class="splash-spinner" style="margin-bottom:.6rem;width:24px;height:24px;"></div>
            <div style="font-weight:700;font-size:.82rem;">Denetim kayıtları yükleniyor...</div>
          </div>
        </div>
      </div>
    `;
  },

  showLogDetailModal(log) {
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '999999';

    overlay.innerHTML = `
      <div class="modal" style="max-width:540px;width:92vw;padding:1.4rem;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.45);border:1.5px solid var(--border);background:var(--bg-surface);animation:fadeIn .18s ease-out;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid var(--border-light);padding-bottom:.6rem;">
          <div style="font-size:1.05rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:.5rem;">
            <span>Denetim Kayıt Detayı</span>
            <span class="badge badge-blue" style="font-size:.74rem;padding:.15rem .5rem;">${esc(log.action)}</span>
          </div>
          <button type="button" class="btn btn-sm btn-ghost btn-close-detail" style="font-size:1.1rem;padding:2px 10px;border-radius:50%;">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;font-size:.82rem;margin-bottom:1rem;background:var(--bg-raised);padding:.85rem;border-radius:10px;border:1px solid var(--border-light);">
          <div>
            <div style="font-size:.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">İşlem Zamanı</div>
            <div style="font-weight:700;color:var(--text-primary);font-family:var(--mono);font-size:.78rem;">${log.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : '-'}</div>
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">Kullanıcı & Rol</div>
            <div style="font-weight:700;color:var(--text-primary);">@${esc(log.username || 'misafir')} (${esc(log.role || 'user')})</div>
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">İstemci IP Adresi</div>
            <div style="font-weight:800;font-family:var(--mono);color:var(--accent);font-size:.78rem;">${esc(log.ip || '127.0.0.1')}</div>
          </div>
          <div>
            <div style="font-size:.7rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">Hedef Rapor / Dosya</div>
            <div style="font-weight:700;color:var(--text-primary);word-break:break-all;">${esc(log.target || 'Genel Sistem')}</div>
          </div>
        </div>

        <div style="margin-bottom:1.2rem;">
          <div style="font-size:.72rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:.35rem;">Açıklama & Detaylar</div>
          <div style="background:var(--bg-surface);padding:.75rem .85rem;border-radius:8px;border:1px solid var(--border);font-size:.82rem;line-height:1.5;color:var(--text-secondary);word-break:break-word;max-height:160px;overflow-y:auto;">
            ${esc(log.details || 'Açıklama bulunmuyor.')}
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;">
          <button type="button" class="btn btn-sm btn-primary btn-close-detail" style="padding:.45rem 1.2rem;font-weight:800;border-radius:8px;font-size:.82rem;">Kapat</button>
        </div>
      </div>
    `;

    overlay.querySelectorAll('.btn-close-detail').forEach(btn => {
      btn.addEventListener('click', () => overlay.remove());
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  },

  bind({ overlay, safeToast }) {
    const container = overlay.querySelector('#auditLogsContainer');
    const searchInp = overlay.querySelector('#auditSearchInput');
    const filterSelect = overlay.querySelector('#auditActionFilter');
    const btnRefresh = overlay.querySelector('#btnRefreshAuditLogs');
    const btnExportExcel = overlay.querySelector('#btnExportAuditExcel');

    const updateKpis = (logs) => {
      const totalEl = overlay.querySelector('#kpiAuditTotal');
      const filesEl = overlay.querySelector('#kpiAuditFiles');
      const editsEl = overlay.querySelector('#kpiAuditEdits');
      const delsEl = overlay.querySelector('#kpiAuditDeletes');
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

    const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const getActionLabelAndBadge = (action) => {
      const act = String(action || 'INFO').toUpperCase();
      const map = {
        LOGIN:               { label: '🔐 Giriş', badge: 'badge-blue' },
        REGISTER:            { label: '✨ Kayıt', badge: 'badge-green' },
        USER_UPDATE:         { label: '👤 Profil', badge: 'badge-purple' },
        USERNAME_CHANGE:     { label: '🏷️ Kullanıcı Adı', badge: 'badge-purple' },
        EMAIL_CHANGE:        { label: '📧 E-Posta', badge: 'badge-amber' },
        REPORT_UPLOAD:       { label: '📤 Yükleme', badge: 'badge-green' },
        REPORT_UPDATE:       { label: '✏️ Güncelleme', badge: 'badge-blue' },
        REPORT_EDIT:         { label: '✏️ Düzenleme', badge: 'badge-blue' },
        FRP_DOWNLOAD:        { label: '📥 İndirme', badge: 'badge-purple' },
        BULK_DOWNLOAD:       { label: '📦 Toplu İndir', badge: 'badge-purple' },
        POOL_ADD:            { label: '🌐 Havuz Ekle', badge: 'badge-green' },
        POOL_ADD_BULK:       { label: '🌐 Toplu Havuz', badge: 'badge-green' },
        POOL_REMOVE:         { label: '🔒 Havuz Çıkar', badge: 'badge-amber' },
        POOL_REMOVE_BULK:    { label: '🔒 Toplu Çıkar', badge: 'badge-amber' },
        POOL_CLONE:          { label: '📋 Klonlama', badge: 'badge-blue' },
        DESIGN_EDIT:         { label: '🎨 Tasarım', badge: 'badge-blue' },
        SQL_EDIT:            { label: '💻 SQL Düzenle', badge: 'badge-purple' },
        PASCAL_EDIT:         { label: '📜 Pascal', badge: 'badge-amber' },
        REPORT_DELETE:       { label: '🗑️ Çöp', badge: 'badge-red' },
        REPORT_DELETE_BULK:  { label: '🗑️ Toplu Çöp', badge: 'badge-red' },
        TRASH_RESTORE:       { label: '♻️ Kurtar', badge: 'badge-green' },
        TRASH_PURGE:         { label: '💥 Kalıcı Sil', badge: 'badge-red' },
        TRASH_EMPTY:         { label: '🧹 Çöpü Boşalt', badge: 'badge-red' },
        DATA_RESET:          { label: '🚨 Sıfırla', badge: 'badge-red' },
        AUTO_BACKUP:         { label: '⏱️ Oto Yedek', badge: 'badge-green' },
        EXPORT:              { label: '📊 Dışa Aktar', badge: 'badge-blue' }
      };
      return map[act] || { label: act, badge: 'badge-blue' };
    };

    const renderLogTable = (logs) => {
      if (!container) return;
      if (!logs || logs.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);font-size:.82rem;">Herhangi bir işlem kaydı bulunamadı.</div>`;
        return;
      }

      const rows = logs.map((l, idx) => {
        const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
        const { label: actLabel, badge: badgeClass } = getActionLabelAndBadge(l.action);
        const ipDisplay = (l.ip && l.ip !== '-' && l.ip !== '') ? l.ip : '127.0.0.1';
        const targetDisplay = l.target || l.reportName || l.fileName || 'Genel Sistem';
        const detailsDisplay = l.details || `${actLabel} işlemi gerçekleştirildi.`;
        const userDisplay = l.username || (l.role === 'admin' ? 'admin' : 'misafir');

        return `
          <tr data-log-idx="${idx}" class="audit-row" style="border-bottom:1px solid var(--border-light);font-size:.78rem;cursor:pointer;transition:background .12s;">
            <td style="padding:.55rem .75rem;white-space:nowrap;color:var(--text-muted);font-family:var(--mono);font-size:.74rem;">${dateStr}</td>
            <td style="padding:.55rem .75rem;font-weight:700;color:var(--text-primary);white-space:nowrap;">
              <div style="display:flex;align-items:center;gap:.3rem;">
                <span>@${escHtml(userDisplay)}</span>
                ${l.role === 'admin' ? '<span class="badge badge-purple" style="font-size:.62rem;padding:1px 4px;border-radius:4px;">Admin</span>' : ''}
              </div>
            </td>
            <td style="padding:.55rem .75rem;white-space:nowrap;">
              <span class="badge ${badgeClass}" style="font-size:.68rem;padding:.15rem .45rem;border-radius:6px;">${escHtml(actLabel)}</span>
            </td>
            <td style="padding:.55rem .75rem;font-weight:700;color:var(--accent);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(targetDisplay)}">
              ${escHtml(targetDisplay)}
            </td>
            <td style="padding:.55rem .75rem;color:var(--text-secondary);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(detailsDisplay)}">
              ${escHtml(detailsDisplay)}
            </td>
            <td style="padding:.55rem .75rem;color:var(--text-muted);font-family:var(--mono);font-size:.72rem;white-space:nowrap;">
              ${escHtml(ipDisplay)}
            </td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <table style="width:100%;border-collapse:collapse;text-align:left;font-size:.78rem;">
          <thead>
            <tr style="background:var(--bg-raised);border-bottom:1.5px solid var(--border);font-size:.74rem;font-weight:800;color:var(--text-secondary);position:sticky;top:0;z-index:2;">
              <th style="padding:.6rem .75rem;width:125px;white-space:nowrap;">Zaman</th>
              <th style="padding:.6rem .75rem;width:120px;white-space:nowrap;">Kullanıcı</th>
              <th style="padding:.6rem .75rem;width:130px;white-space:nowrap;">İşlem</th>
              <th style="padding:.6rem .75rem;width:160px;white-space:nowrap;">Hedef / Rapor</th>
              <th style="padding:.6rem .75rem;">Açıklama / Detay</th>
              <th style="padding:.6rem .75rem;width:105px;white-space:nowrap;">IP Adresi</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      container.querySelectorAll('.audit-row').forEach(tr => {
        tr.addEventListener('click', () => {
          const idx = parseInt(tr.dataset.logIdx, 10);
          if (logs[idx]) this.showLogDetailModal(logs[idx]);
        });
        tr.addEventListener('mouseenter', () => { tr.style.backgroundColor = 'var(--bg-raised)'; });
        tr.addEventListener('mouseleave', () => { tr.style.backgroundColor = 'transparent'; });
      });
    };

    const filterAndDisplayLogs = () => {
      const q = (searchInp?.value || '').toLowerCase().trim();
      const act = filterSelect?.value || '';

      let filtered = this.loadedLogs;
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
      renderLogTable(filtered);
    };

    const fetchLogs = async () => {
      if (container) {
        container.innerHTML = `<div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);"><div class="splash-spinner" style="margin-bottom:.6rem;width:24px;height:24px;"></div><div style="font-weight:700;font-size:.82rem;">Kayıtlar yükleniyor...</div></div>`;
      }
      try {
        if (window.FrpAudit && typeof window.FrpAudit.getLogs === 'function') {
          this.loadedLogs = await window.FrpAudit.getLogs();
        } else {
          const res = await fetch('/api/admin/audit-logs?limit=500', {
            headers: window.FrpAuth ? window.FrpAuth.getAuthHeaders() : {}
          });
          const data = await res.json();
          this.loadedLogs = (data && data.success && Array.isArray(data.logs)) ? data.logs : [];
        }
      } catch (e) {
        console.warn('Audit logs fetch hatası:', e.message);
        try {
          const stored = localStorage.getItem('frp_audit_logs');
          this.loadedLogs = stored ? JSON.parse(stored) : [];
        } catch {
          this.loadedLogs = [];
        }
      }
      updateKpis(this.loadedLogs);
      filterAndDisplayLogs();
    };

    searchInp?.addEventListener('input', filterAndDisplayLogs);
    filterSelect?.addEventListener('change', filterAndDisplayLogs);
    btnRefresh?.addEventListener('click', fetchLogs);

    // EXCEL İNDİRME
    btnExportExcel?.addEventListener('click', () => {
      if (!this.loadedLogs || this.loadedLogs.length === 0) {
        safeToast('Dışa aktarılacak denetim kaydı bulunamadı.', 'info');
        return;
      }

      const tableRows = this.loadedLogs.map(l => {
        const { label: actLabel } = getActionLabelAndBadge(l.action);
        const targetDisplay = l.target || l.reportName || l.fileName || 'Genel Sistem';
        const detailsDisplay = l.details || `${actLabel} işlemi gerçekleştirildi.`;
        const userDisplay = l.username || (l.role === 'admin' ? 'admin' : 'misafir');

        return `
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;font-family:Consolas,monospace;">${l.timestamp ? new Date(l.timestamp).toLocaleString('tr-TR') : '-'}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">@${escHtml(userDisplay)}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${escHtml(l.role || 'user')}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;color:#1e40af;font-weight:bold;">${escHtml(actLabel)}</td>
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
          <p style="font-family:Segoe UI,sans-serif;font-size:9pt;color:#64748b;margin-top:0;">Dışa Aktarma Tarihi: ${new Date().toLocaleString('tr-TR')} | Toplam Kayıt: ${this.loadedLogs.length}</p>
          <table style="border-collapse:collapse;width:100%;">
            <thead>
              <tr>
                <th style="width:150px;">Zaman</th>
                <th style="width:130px;">Kullanıcı</th>
                <th style="width:90px;">Rol</th>
                <th style="width:140px;">İşlem Türü</th>
                <th style="width:190px;">Hedef</th>
                <th style="width:340px;">Açıklama / Detay</th>
                <th style="width:110px;">IP Adresi</th>
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
      safeToast('Denetim günlüğü Excel tablosu (.xls) olarak indirildi.', 'success');
    });

    fetchLogs();
  }
};
