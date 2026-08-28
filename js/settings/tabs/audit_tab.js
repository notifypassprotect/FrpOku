// ============================================================
//  audit_tab.js — Kullanıcı İşlem Geçmişi & Denetim Günlüğü (Geniş & Net UX)
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.audit = {
  loadedLogs: [],

  render() {
    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        
        <!-- Üst Başlık ve Eylem Barı -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;padding-bottom:.5rem;border-bottom:1px solid var(--border-light);">
          <div>
            <div style="font-size:1.2rem;font-weight:900;color:var(--text-primary);display:flex;align-items:center;gap:.5rem;">
              <span>📋</span> <span>Kullanıcı İşlem Geçmişi & Denetim Günlüğü</span>
              <span class="badge badge-purple" style="font-size:.7rem;padding:.2rem .5rem;">Canlı Sistem Logları</span>
            </div>
            <div style="font-size:.82rem;color:var(--text-muted);margin-top:.3rem;">
              Kullanıcıların oturum açma, rapor yükleme, indirme, silme, havuz paylaşımı ve sistem olaylarını takip edin.
            </div>
          </div>
          <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;">
            <button type="button" class="btn btn-sm btn-ghost" id="btnRefreshAuditLogs" style="font-weight:700;padding:.5rem .85rem;border:1px solid var(--border);">
              🔄 Yenile
            </button>
            <button type="button" class="btn btn-sm btn-primary" id="btnExportAuditExcel" style="font-weight:800;background:linear-gradient(135deg,#059669,#10b981);border:none;box-shadow:0 3px 10px rgba(16,185,129,0.35);padding:.5rem 1.1rem;">
              📊 Excel (.xls) Olarak İndir
            </button>
          </div>
        </div>

        <!-- KPI Özet Sayaç Kartları (4 Sütunlu Geniş Düzen) -->
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:.85rem;" id="auditKpiRow">
          <div style="background:var(--bg-raised);border:1.5px solid var(--border-light);border-radius:12px;padding:.85rem 1.1rem;display:flex;flex-direction:column;gap:.25rem;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
            <div style="font-size:.74rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Toplam Kayıt</div>
            <div id="kpiAuditTotal" style="font-size:1.6rem;font-weight:900;color:var(--accent);">0</div>
          </div>
          <div style="background:var(--bg-raised);border:1.5px solid var(--border-light);border-radius:12px;padding:.85rem 1.1rem;display:flex;flex-direction:column;gap:.25rem;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
            <div style="font-size:.74rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Yükleme / İndirme</div>
            <div id="kpiAuditFiles" style="font-size:1.6rem;font-weight:900;color:var(--green);">0</div>
          </div>
          <div style="background:var(--bg-raised);border:1.5px solid var(--border-light);border-radius:12px;padding:.85rem 1.1rem;display:flex;flex-direction:column;gap:.25rem;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
            <div style="font-size:.74rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Kod / Tasarım</div>
            <div id="kpiAuditEdits" style="font-size:1.6rem;font-weight:900;color:var(--purple);">0</div>
          </div>
          <div style="background:var(--bg-raised);border:1.5px solid var(--border-light);border-radius:12px;padding:.85rem 1.1rem;display:flex;flex-direction:column;gap:.25rem;box-shadow:0 2px 6px rgba(0,0,0,0.03);">
            <div style="font-size:.74rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Silme & Çöp</div>
            <div id="kpiAuditDeletes" style="font-size:1.6rem;font-weight:900;color:var(--red);">0</div>
          </div>
        </div>

        <!-- Arama ve Filtre Kontrolleri -->
        <div style="display:grid;grid-template-columns:1fr 240px;gap:.75rem;">
          <div style="position:relative;">
            <input type="text" id="auditSearchInput" placeholder="🔍 Loglarda anında ara (Kullanıcı, işlem türü, hedef rapor, IP adresi, detay)..." class="master-search-input" style="width:100%;font-size:.88rem;padding:.6rem .95rem;box-sizing:border-box;border-radius:10px;" />
          </div>
          <select id="auditActionFilter" class="master-search-input" style="font-size:.85rem;font-weight:700;border-radius:10px;padding:.55rem .8rem;">
            <option value="">Tüm İşlem Türleri</option>
            <option value="FRP_DOWNLOAD">📥 İndirmeler (FRP_DOWNLOAD)</option>
            <option value="REPORT_UPLOAD">📤 Yüklemeler (REPORT_UPLOAD)</option>
            <option value="REPORT_UPDATE">🔄 Güncellemeler (REPORT_UPDATE)</option>
            <option value="POOL_ADD">🌐 Havuz Paylaşımı (POOL_ADD)</option>
            <option value="POOL_REMOVE">🔒 Havuzdan Kaldırma (POOL_REMOVE)</option>
            <option value="REPORT_DELETE">🗑️ Çöp Kutusuna Taşıma</option>
            <option value="TRASH_RESTORE">♻️ Çöpten Geri Yükleme</option>
            <option value="TRASH_PURGE">❌ Kalıcı Silme (TRASH_PURGE)</option>
            <option value="TRASH_EMPTY">🧹 Çöp Kutusunu Boşaltma</option>
            <option value="DESIGN_EDIT">🎨 Tasarım Düzenleme</option>
            <option value="SQL_EDIT">🗄️ SQL Sorgu Düzenleme</option>
            <option value="PASCAL_EDIT">📜 Pascal Script Düzenleme</option>
            <option value="USERNAME_CHANGE">✏️ Kullanıcı Adı Değişikliği</option>
            <option value="LOGIN">🔐 Giriş Yapma (LOGIN)</option>
            <option value="USER_UPDATE">👤 Profil Güncelleme</option>
            <option value="EMAIL_CHANGE">✉️ E-Posta Değişikliği</option>
            <option value="DATA_RESET">🚨 Tüm Verileri Sıfırlama</option>
          </select>
        </div>

        <!-- Geniş Tablo Alanı -->
        <div id="auditLogsContainer" style="background:var(--bg-surface);border:1.5px solid var(--border-light);border-radius:14px;overflow-x:auto;max-height:520px;overflow-y:auto;box-shadow:inset 0 1px 4px rgba(0,0,0,0.04);">
          <div style="text-align:center;padding:3.5rem;color:var(--text-muted);">
            <div class="splash-spinner" style="margin-bottom:.8rem;"></div>
            <div style="font-weight:700;">Denetim kayıtları yükleniyor...</div>
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
      <div class="modal" style="max-width:580px;width:92vw;padding:1.75rem;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.45);border:1.5px solid var(--border);background:var(--bg-surface);animation:fadeIn .18s ease-out;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem;border-bottom:1px solid var(--border-light);padding-bottom:.75rem;">
          <div style="font-size:1.12rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:.5rem;">
            <span>🔍 Denetim İşlem Detayı</span>
            <span class="badge badge-blue" style="font-size:.76rem;padding:.2rem .55rem;">${esc(log.action)}</span>
          </div>
          <button type="button" class="btn btn-sm btn-ghost btn-close-detail" style="font-size:1.1rem;padding:2px 10px;border-radius:50%;">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.9rem;font-size:.84rem;margin-bottom:1.2rem;background:var(--bg-raised);padding:1rem;border-radius:12px;border:1px solid var(--border-light);">
          <div>
            <div style="font-size:.72rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">İşlem Zamanı</div>
            <div style="font-weight:700;color:var(--text-primary);font-family:var(--mono);">${log.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : '-'}</div>
          </div>
          <div>
            <div style="font-size:.72rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">Kullanıcı & Rol</div>
            <div style="font-weight:700;color:var(--text-primary);">@${esc(log.username || 'misafir')} (${esc(log.role || 'user')})</div>
          </div>
          <div>
            <div style="font-size:.72rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">İstemci IP Adresi</div>
            <div style="font-weight:800;font-family:var(--mono);color:var(--accent);">${esc(log.ip || '127.0.0.1')}</div>
          </div>
          <div>
            <div style="font-size:.72rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">Hedef Rapor / Dosya</div>
            <div style="font-weight:700;color:var(--text-primary);word-break:break-all;">${esc(log.target || '-')}</div>
          </div>
        </div>

        <div style="margin-bottom:1.4rem;">
          <div style="font-size:.74rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;margin-bottom:.4rem;">Açıklama & Detaylar</div>
          <div style="background:var(--bg-surface);padding:.9rem;border-radius:10px;border:1.5px solid var(--border);font-size:.85rem;line-height:1.5;color:var(--text-secondary);word-break:break-word;max-height:180px;overflow-y:auto;">
            ${esc(log.details || 'Detay bulunmuyor.')}
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;">
          <button type="button" class="btn btn-sm btn-primary btn-close-detail" style="padding:.5rem 1.4rem;font-weight:800;border-radius:8px;">Kapat</button>
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

    const renderLogTable = (logs) => {
      if (!container) return;
      if (!logs || logs.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:3.5rem;color:var(--text-muted);"><div style="font-size:2.2rem;margin-bottom:.5rem;">🔍</div>Herhangi bir işlem kaydı bulunamadı.</div>`;
        return;
      }

      const actionBadges = {
        LOGIN: 'badge-blue',
        REGISTER: 'badge-green',
        USER_UPDATE: 'badge-purple',
        USERNAME_CHANGE: 'badge-purple',
        EMAIL_CHANGE: 'badge-amber',
        DELETE: 'badge-red',
        REPORT_DELETE: 'badge-red',
        REPORT_DELETE_BULK: 'badge-red',
        TRASH_PURGE: 'badge-red',
        TRASH_EMPTY: 'badge-red',
        TRASH_RESTORE: 'badge-green',
        REPORT_UPLOAD: 'badge-green',
        REPORT_UPDATE: 'badge-blue',
        FRP_DOWNLOAD: 'badge-purple',
        BULK_DOWNLOAD: 'badge-purple',
        POOL_ADD: 'badge-green',
        POOL_ADD_BULK: 'badge-green',
        POOL_REMOVE: 'badge-amber',
        POOL_REMOVE_BULK: 'badge-amber',
        POOL_CLONE: 'badge-blue',
        DESIGN_EDIT: 'badge-blue',
        SQL_EDIT: 'badge-purple',
        PASCAL_EDIT: 'badge-amber',
        DATA_RESET: 'badge-red',
        REPORT_EDIT: 'badge-blue',
        AUTO_BACKUP: 'badge-green',
        EXPORT: 'badge-blue'
      };

      const rows = logs.map((l, idx) => {
        const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleString('tr-TR') : '-';
        const badgeClass = actionBadges[l.action] || 'badge-blue';
        const ipDisplay = (l.ip && l.ip !== '-' && l.ip !== '') ? l.ip : '127.0.0.1';

        return `
          <tr data-log-idx="${idx}" class="audit-row" style="border-bottom:1px solid var(--border-light);font-size:.82rem;cursor:pointer;transition:background .15s;">
            <td style="padding:.75rem .95rem;white-space:nowrap;color:var(--text-muted);font-family:var(--mono);">${dateStr}</td>
            <td style="padding:.75rem .95rem;font-weight:700;color:var(--text-primary);">
              <div style="display:flex;align-items:center;gap:.35rem;">
                <span>@${escHtml(l.username || 'misafir')}</span>
                ${l.role === 'admin' ? '<span class="badge badge-purple" style="font-size:.65rem;padding:1px 5px;">Admin</span>' : ''}
              </div>
            </td>
            <td style="padding:.75rem .95rem;">
              <span class="badge ${badgeClass}" style="font-size:.72rem;padding:.25rem .6rem;">${escHtml(l.action || 'INFO')}</span>
            </td>
            <td style="padding:.75rem .95rem;font-weight:700;color:var(--accent);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(l.target || '')}">
              ${escHtml(l.target || '-')}
            </td>
            <td style="padding:.75rem .95rem;color:var(--text-secondary);max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(l.details || '')}">
              ${escHtml(l.details || '-')}
            </td>
            <td style="padding:.75rem .95rem;color:var(--text-muted);font-family:var(--mono);font-weight:700;">
              ${escHtml(ipDisplay)}
            </td>
          </tr>
        `;
      }).join('');

      container.innerHTML = `
        <table style="width:100%;border-collapse:collapse;text-align:left;">
          <thead>
            <tr style="background:var(--bg-raised);border-bottom:2px solid var(--border);font-size:.78rem;font-weight:800;color:var(--text-secondary);position:sticky;top:0;z-index:2;">
              <th style="padding:.8rem .95rem;width:160px;">Zaman</th>
              <th style="padding:.8rem .95rem;width:140px;">Kullanıcı</th>
              <th style="padding:.8rem .95rem;width:150px;">İşlem Türü</th>
              <th style="padding:.8rem .95rem;width:190px;">Hedef</th>
              <th style="padding:.8rem .95rem;">Açıklama / Detay</th>
              <th style="padding:.8rem .95rem;width:120px;">IP Adresi</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;

      // Satıra tıklayınca detay popup aç
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
        container.innerHTML = `<div style="text-align:center;padding:3.5rem;color:var(--text-muted);"><div class="splash-spinner" style="margin-bottom:.8rem;"></div><div style="font-weight:700;">Kayıtlar yükleniyor...</div></div>`;
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

    // EXCEL İNDİRME MOTORU
    btnExportExcel?.addEventListener('click', () => {
      if (!this.loadedLogs || this.loadedLogs.length === 0) {
        safeToast('Dışa aktarılacak denetim kaydı bulunamadı.', 'info');
        return;
      }

      const tableRows = this.loadedLogs.map(l => `
        <tr>
          <td style="border:1px solid #cbd5e1;padding:6px;font-family:Consolas,monospace;">${l.timestamp ? new Date(l.timestamp).toLocaleString('tr-TR') : '-'}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">@${escHtml(l.username || 'misafir')}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${escHtml(l.role || 'user')}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;color:#1e40af;font-weight:bold;">${escHtml(l.action || '-')}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${escHtml(l.target || '-')}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;">${escHtml(l.details || '-')}</td>
          <td style="border:1px solid #cbd5e1;padding:6px;font-family:Consolas,monospace;">${escHtml(l.ip || '127.0.0.1')}</td>
        </tr>
      `).join('');

      const excelContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <style>
            th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; font-family: Segoe UI, sans-serif; font-size: 11pt; padding: 8px; border: 1px solid #93c5fd; }
            td { font-family: Segoe UI, sans-serif; font-size: 10pt; vertical-align: middle; }
            tr:nth-child(even) td { background-color: #f8fafc; }
          </style>
        </head>
        <body>
          <h2 style="font-family:Segoe UI,sans-serif;color:#1e3a8a;margin-bottom:4px;">FrpOku - Kullanıcı İşlem Geçmişi & Denetim Günlüğü</h2>
          <p style="font-family:Segoe UI,sans-serif;font-size:10pt;color:#64748b;margin-top:0;">Dışa Aktarma Tarihi: ${new Date().toLocaleString('tr-TR')} | Toplam Kayıt: ${this.loadedLogs.length}</p>
          <table style="border-collapse:collapse;width:100%;">
            <thead>
              <tr>
                <th style="width:160px;">Zaman</th>
                <th style="width:140px;">Kullanıcı</th>
                <th style="width:100px;">Rol</th>
                <th style="width:160px;">İşlem Türü</th>
                <th style="width:200px;">Hedef</th>
                <th style="width:380px;">Açıklama / Detay</th>
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
      safeToast('Denetim günlüğü Excel tablosu (.xls) olarak indirildi! 📊', 'success');
    });

    fetchLogs();
  }
};
