/**
 * FrpOku — Oracle Database Entegrasyonu ve Canlı Çoklu Bağlantı Yöneticisi (TOAD Stili)
 * Çoklu bağlantı profilleri (Alias, Host, Port, Service Name/SID, User, Password),
 * Sorgu esnasında hedef veritabanı seçimi, parametre bağlama ve Excel/CSV dışa aktarma.
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'frpoku_oracle_connections';
  const ACTIVE_KEY = 'frpoku_oracle_active_conn_id';

  // Varsayılan / Başlangıç Bağlantı Listesi
  const DEFAULT_CONNECTIONS = [
    {
      id: 'conn_default',
      alias: 'Yerel Oracle XE / Test DB',
      host: 'localhost',
      port: 1521,
      connType: 'serviceName',
      serviceName: 'XEPDB1',
      sid: 'XE',
      user: 'SYSTEM',
      password: '',
      color: '#3b82f6',
      isDefault: true
    }
  ];

  const FrpOracle = {
    getConnections() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) return list;
        }
      } catch (e) {
        console.warn('Oracle bağlantı listesi parse hatası:', e);
      }
      return DEFAULT_CONNECTIONS;
    },

    saveConnections(list) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        return true;
      } catch (e) {
        console.error('Oracle bağlantıları kaydedilemedi:', e);
        return false;
      }
    },

    getActiveConnId() {
      return localStorage.getItem(ACTIVE_KEY) || (this.getConnections()[0]?.id) || 'conn_default';
    },

    setActiveConnId(id) {
      localStorage.setItem(ACTIVE_KEY, id);
    },

    getActiveConnection() {
      const conns = this.getConnections();
      const activeId = this.getActiveConnId();
      return conns.find(c => c.id === activeId) || conns[0] || DEFAULT_CONNECTIONS[0];
    },

    saveConnection(conn) {
      const conns = this.getConnections();
      const idx = conns.findIndex(c => c.id === conn.id);
      if (idx !== -1) {
        conns[idx] = { ...conns[idx], ...conn };
      } else {
        conn.id = conn.id || 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        conns.push(conn);
      }
      this.saveConnections(conns);
      return conn;
    },

    deleteConnection(id) {
      let conns = this.getConnections();
      conns = conns.filter(c => c.id !== id);
      if (conns.length === 0) conns = DEFAULT_CONNECTIONS;
      this.saveConnections(conns);
      if (this.getActiveConnId() === id) {
        this.setActiveConnId(conns[0].id);
      }
      return conns;
    },

    async testConnection(connConfig) {
      const cfg = connConfig || this.getActiveConnection();
      const res = await fetch('/api/oracle/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
      return await res.json();
    },

    async executeQuery({ connId, connConfig, sql, params = {}, maxRows = 250 }) {
      let config = connConfig;
      if (!config) {
        const conns = this.getConnections();
        config = conns.find(c => c.id === connId) || this.getActiveConnection();
      }

      if (!config || !config.host || !config.user || !config.password) {
        return {
          success: false,
          reason: 'Seçili Oracle veritabanı bağlantı bilgileri (Host, Kullanıcı veya Şifre) eksik.'
        };
      }

      const payload = {
        ...config,
        sql,
        params,
        maxRows
      };

      const res = await fetch('/api/oracle/execute-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    },

    openRunnerModal(sql, rawParams = []) {
      const conns = this.getConnections();
      let activeConn = this.getActiveConnection();

      // SQL içerisindeki :PARAMETRE değişkenlerini regex ile yakala
      const paramMatches = (sql.match(/(:[a-zA-Z0-9_]+)/g) || []);
      const paramSet = new Set(paramMatches.map(p => p.toUpperCase()));

      if (Array.isArray(rawParams)) {
        rawParams.forEach(p => {
          const name = typeof p === 'string' ? p : (p.name || p.param || '');
          if (name) paramSet.add(':' + name.replace(/^:/, '').toUpperCase());
        });
      }

      const paramList = Array.from(paramSet);

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.style.zIndex = '999999';

      const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      overlay.innerHTML = `
        <div class="modal" style="max-width:1050px;width:95vw;max-height:92vh;display:flex;flex-direction:column;padding:0;border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,.45);border:1px solid var(--border);background:var(--bg-surface);overflow:hidden;animation:fadeIn .18s ease-out;">
          
          <!-- Başlık Çubuğu & Hedef Oracle Bağlantı Seçimi (TOAD Modeli) -->
          <div style="padding:1rem 1.4rem;border-bottom:1px solid var(--border-light);background:var(--bg-raised);display:flex;flex-direction:column;gap:.75rem;">
            
            <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">
              <div style="display:flex;align-items:center;gap:.75rem;">
                <span style="font-size:1.6rem;">⚡</span>
                <div>
                  <div style="font-size:1.08rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:.5rem;">
                    <span>Oracle Canlı Sorgu Çalıştırıcı</span>
                    <span style="font-size:.7rem;background:rgba(217,119,6,0.15);color:var(--orange,#d97706);padding:.15rem .5rem;border-radius:6px;font-weight:800;">TOAD Login Modeli</span>
                  </div>
                  <div style="font-size:.76rem;color:var(--text-muted);">Çalıştırmak istediğiniz hedef veritabanını listeden seçin ve parametreleri girin.</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:.5rem;">
                <button class="btn btn-sm btn-ghost" id="btnOracleModalSettings" title="TOAD Bağlantı Listesini Yönet" style="padding:.35rem .8rem;font-size:.8rem;font-weight:700;">⚙️ Bağlantı Yönetimi</button>
                <button class="btn btn-sm btn-ghost" id="btnOracleModalClose" style="font-size:1.2rem;padding:.2rem .6rem;line-height:1;">✕</button>
              </div>
            </div>

            <!-- HEDEF VERİTABANI SEÇİM ALANI (DROPDOWN + ANLIK ŞİFRE VE DETAY) -->
            <div style="background:var(--bg-surface);border:1.5px solid var(--border);border-radius:12px;padding:.75rem 1rem;display:grid;grid-template-columns:1.8fr 1.2fr 1fr auto;gap:.75rem;align-items:center;">
              
              <!-- 1. Bağlantı Profili Seçimi -->
              <div>
                <label style="font-size:.74rem;font-weight:800;color:var(--text-secondary);display:block;margin-bottom:.25rem;">🎯 Hedef Veritabanı (Alias / Kurum)</label>
                <select id="oracleTargetConnSelect" style="width:100%;padding:.4rem .6rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.84rem;font-weight:700;">
                  ${conns.map(c => `
                    <option value="${esc(c.id)}" ${c.id === activeConn.id ? 'selected' : ''}>
                      ${esc(c.alias || c.host)} — (${esc(c.user)} @ ${esc(c.host)}:${esc(c.port)}/${esc(c.connType === 'sid' ? c.sid : c.serviceName)})
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- 2. Kullanıcı Adı (Görüntüleme & Değiştirme) -->
              <div>
                <label style="font-size:.74rem;font-weight:800;color:var(--text-secondary);display:block;margin-bottom:.25rem;">👤 Kullanıcı (Schema)</label>
                <input type="text" id="oracleTargetUserInp" class="master-search-input" style="width:100%;font-size:.82rem;padding:.38rem .6rem;" value="${esc(activeConn.user || '')}" placeholder="Kullanıcı..." />
              </div>

              <!-- 3. Şifre (Gerekirse Anlık Giriş) -->
              <div>
                <label style="font-size:.74rem;font-weight:800;color:var(--text-secondary);display:block;margin-bottom:.25rem;">🔒 Şifre</label>
                <input type="password" id="oracleTargetPassInp" class="master-search-input" style="width:100%;font-size:.82rem;padding:.38rem .6rem;" value="${esc(activeConn.password || '')}" placeholder="••••••••" />
              </div>

              <!-- 4. Hızlı Test Butonu -->
              <div style="padding-top:1.1rem;">
                <button class="btn btn-sm btn-ghost" id="btnQuickTestTargetConn" title="Seçili bağlantıyı anında sına" style="padding:.4rem .8rem;font-size:.78rem;font-weight:800;border:1px solid var(--border);">
                  🔄 Test Et
                </button>
              </div>

            </div>

          </div>

          <!-- Gövde -->
          <div style="flex:1;overflow-y:auto;padding:1.25rem 1.4rem;display:flex;flex-direction:column;gap:1.1rem;">
            
            <!-- Durum Bildirim Kutusu -->
            <div id="oracleModalAlertBox" style="display:none;padding:.65rem .9rem;border-radius:10px;font-size:.8rem;font-weight:700;"></div>

            <!-- Parametreler Alanı (Varsa) -->
            ${paramList.length > 0 ? `
              <div style="background:var(--bg-raised);border:1px solid var(--border-light);border-radius:12px;padding:1rem;">
                <div style="font-size:.85rem;font-weight:800;color:var(--text-primary);margin-bottom:.65rem;display:flex;align-items:center;gap:.4rem;">
                  <span>🏷️ SQL Parametreleri (${paramList.length})</span>
                  <span style="font-size:.72rem;color:var(--text-muted);font-weight:400;">(Oracle bind parametreleri olarak gönderilir)</span>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:.65rem;">
                  ${paramList.map(p => `
                    <div style="display:flex;flex-direction:column;gap:.25rem;">
                      <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);font-family:var(--mono);">${esc(p)}</label>
                      <input type="text" class="oracle-param-input master-search-input" data-param="${esc(p)}" placeholder="Değer..." style="font-size:.82rem;padding:.35rem .6rem;" />
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Kontrol ve Çalıştırma Butonları -->
            <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:.75rem;">
                <label style="font-size:.8rem;font-weight:700;color:var(--text-secondary);">Maksimum Satır Limiti:</label>
                <select id="oracleMaxRowsSelect" style="padding:.35rem .6rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.82rem;font-weight:600;">
                  <option value="50">50 Satır</option>
                  <option value="100">100 Satır</option>
                  <option value="250" selected>250 Satır</option>
                  <option value="500">500 Satır</option>
                  <option value="1000">1000 Satır</option>
                </select>
              </div>

              <div style="display:flex;align-items:center;gap:.6rem;">
                <button class="btn btn-primary" id="btnExecuteOracleQuery" style="padding:.5rem 1.5rem;font-weight:800;display:flex;align-items:center;gap:.4rem;box-shadow:0 4px 14px rgba(37,99,235,.35);">
                  <span>⚡</span><span>Seçili Veritabanında Çalıştır (F5)</span>
                </button>
              </div>
            </div>

            <!-- Sonuç Alanı -->
            <div id="oracleResultsContainer" style="flex:1;min-height:240px;display:flex;flex-direction:column;background:var(--bg-raised);border:1px solid var(--border-light);border-radius:12px;overflow:hidden;position:relative;">
              <div id="oracleInitialEmptyState" style="padding:3.5rem;text-align:center;color:var(--text-muted);">
                <div style="font-size:2.6rem;margin-bottom:.6rem;">🎯</div>
                <div style="font-size:.95rem;font-weight:800;color:var(--text-secondary);">Sorgu Çalıştırılmaya Hazır</div>
                <div style="font-size:.78rem;margin-top:.3rem;">Yukarıdan hedef Oracle veritabanını seçip <strong>"Çalıştır"</strong> butonuna tıklayınız.</div>
              </div>
            </div>

          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const closeBtn = overlay.querySelector('#btnOracleModalClose');
      const settingsBtn = overlay.querySelector('#btnOracleModalSettings');
      const targetSelect = overlay.querySelector('#oracleTargetConnSelect');
      const userInp = overlay.querySelector('#oracleTargetUserInp');
      const passInp = overlay.querySelector('#oracleTargetPassInp');
      const quickTestBtn = overlay.querySelector('#btnQuickTestTargetConn');
      const alertBox = overlay.querySelector('#oracleModalAlertBox');
      const execBtn = overlay.querySelector('#btnExecuteOracleQuery');
      const resultsContainer = overlay.querySelector('#oracleResultsContainer');
      const maxRowsSelect = overlay.querySelector('#oracleMaxRowsSelect');

      const doClose = () => overlay.remove();
      closeBtn.addEventListener('click', doClose);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) doClose(); });

      // Veritabanı seçimi değiştiğinde
      targetSelect.addEventListener('change', () => {
        const selectedId = targetSelect.value;
        FrpOracle.setActiveConnId(selectedId);
        const conn = FrpOracle.getActiveConnection();
        if (conn) {
          userInp.value = conn.user || '';
          passInp.value = conn.password || '';
        }
      });

      // Hızlı Test Butonu
      quickTestBtn.addEventListener('click', async () => {
        const conn = { ...FrpOracle.getActiveConnection(), user: userInp.value.trim(), password: passInp.value };
        quickTestBtn.disabled = true;
        quickTestBtn.textContent = 'Sınanıyor... ⏳';
        alertBox.style.display = 'none';

        try {
          const res = await FrpOracle.testConnection(conn);
          alertBox.style.display = 'block';
          if (res.success) {
            alertBox.style.background = '#f0fdf4'; alertBox.style.border = '1px solid #bbf7d0'; alertBox.style.color = '#15803d';
            alertBox.innerHTML = `✅ <strong>${esc(conn.alias)}</strong> bağlantısı başarılı! (${res.dbVersion || ''})`;
          } else {
            alertBox.style.background = '#fef2f2'; alertBox.style.border = '1px solid #fecaca'; alertBox.style.color = '#b91c1c';
            alertBox.innerHTML = `❌ <strong>Bağlantı Hatası:</strong> ${esc(res.reason || 'Bilinmeyen hata.')}`;
          }
        } catch (e) {
          alertBox.style.display = 'block';
          alertBox.style.background = '#fef2f2'; alertBox.style.border = '1px solid #fecaca'; alertBox.style.color = '#b91c1c';
          alertBox.textContent = 'Bağlantı isteği başarısız: ' + e.message;
        } finally {
          quickTestBtn.disabled = false;
          quickTestBtn.textContent = '🔄 Test Et';
        }
      });

      // Ayarları Aç
      settingsBtn.addEventListener('click', () => {
        doClose();
        if (typeof window.openSettingsModal === 'function') {
          window.openSettingsModal('oracle');
        }
      });

      // Çalıştırma fonksiyonu
      const runQuery = async () => {
        const targetConn = {
          ...FrpOracle.getActiveConnection(),
          user: userInp.value.trim(),
          password: passInp.value
        };

        if (!targetConn.host || !targetConn.user || !targetConn.password) {
          alertBox.style.display = 'block';
          alertBox.style.background = '#fef2f2'; alertBox.style.border = '1px solid #fecaca'; alertBox.style.color = '#b91c1c';
          alertBox.textContent = '⚠️ Lütfen seçili bağlantı için Kullanıcı Adı ve Şifre bilgilerini doldurunuz.';
          return;
        }

        execBtn.disabled = true;
        execBtn.innerHTML = `<span>⏳</span><span>${esc(targetConn.alias)} üzerinde sorgulanıyor...</span>`;
        
        resultsContainer.innerHTML = `
          <div style="padding:3.5rem;text-align:center;color:var(--text-muted);display:flex;flex-direction:column;align-items:center;gap:.75rem;">
            <div style="font-size:2.8rem;animation:pulse 1.2s infinite ease-in-out;">⚡</div>
            <div style="font-size:1rem;font-weight:800;color:var(--text-primary);">${esc(targetConn.alias)} veritabanına bağlanılıyor...</div>
            <div style="font-size:.78rem;color:var(--text-muted);">Sorgu çalıştırılıyor ve kayıt seti alınıyor</div>
          </div>
        `;

        // Parametreleri topla
        const paramValues = {};
        overlay.querySelectorAll('.oracle-param-input').forEach(inp => {
          const pName = inp.getAttribute('data-param');
          if (pName) {
            paramValues[pName] = inp.value.trim();
          }
        });

        const maxRows = parseInt(maxRowsSelect.value, 10) || 250;

        try {
          const res = await FrpOracle.executeQuery({
            connConfig: targetConn,
            sql,
            params: paramValues,
            maxRows
          });

          if (!res.success) {
            resultsContainer.innerHTML = `
              <div style="padding:2rem;color:#ef4444;">
                <div style="font-size:1.05rem;font-weight:800;margin-bottom:.5rem;display:flex;align-items:center;gap:.4rem;">
                  <span>❌</span><span>Oracle Sorgu Hatası (${esc(targetConn.alias)})</span>
                </div>
                <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:1rem;font-family:var(--mono);font-size:.82rem;white-space:pre-wrap;line-height:1.5;">${esc(res.reason || 'Bilinmeyen hata oluştu.')}</div>
              </div>
            `;
            return;
          }

          const columns = res.columns || [];
          const rows = res.rows || [];
          const duration = res.durationMs || 0;

          if (rows.length === 0) {
            resultsContainer.innerHTML = `
              <div style="padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-light);background:var(--bg-surface);">
                <div style="display:flex;align-items:center;gap:.6rem;font-size:.82rem;">
                  <span style="background:rgba(16,185,129,0.15);color:#10b981;font-weight:800;padding:.2rem .6rem;border-radius:6px;">⚡ ${duration} ms</span>
                  <span style="color:var(--text-muted);font-weight:600;">0 Satır Döndü</span>
                  <span style="font-size:.75rem;color:var(--text-muted);">(${esc(targetConn.alias)})</span>
                </div>
              </div>
              <div style="padding:3.5rem;text-align:center;color:var(--text-muted);">
                <div style="font-size:2.4rem;margin-bottom:.5rem;">📭</div>
                <div style="font-size:.9rem;font-weight:700;">Bu sorgu veya parametreler için kayıt dönmedi.</div>
              </div>
            `;
            return;
          }

          // Tablo HTML Oluştur
          let tableHtml = `
            <div style="padding:.75rem 1.25rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-light);background:var(--bg-surface);flex-wrap:wrap;gap:.5rem;">
              <div style="display:flex;align-items:center;gap:.6rem;font-size:.82rem;">
                <span style="background:rgba(16,185,129,0.15);color:#10b981;font-weight:800;padding:.25rem .65rem;border-radius:6px;">⚡ ${duration} ms</span>
                <span style="font-weight:800;color:var(--text-primary);">${rows.length} Satır</span>
                <span style="font-size:.76rem;color:var(--accent-bright);font-weight:700;background:rgba(37,99,235,0.08);padding:.15rem .45rem;border-radius:4px;">${esc(targetConn.alias)}</span>
                ${res.truncated ? '<span style="color:#f59e0b;font-weight:700;font-size:.75rem;">(Maksimum satır sınırına ulaşıldı)</span>' : ''}
              </div>
              <div style="display:flex;gap:.4rem;">
                <button class="btn btn-sm" id="btnExportOracleExcel" style="background:#059669;color:#fff;border:none;font-weight:700;padding:.32rem .75rem;border-radius:6px;cursor:pointer;">📊 Excel (XLSX) İndir</button>
                <button class="btn btn-sm btn-ghost" id="btnExportOracleCsv" style="font-weight:700;padding:.32rem .75rem;border-radius:6px;">📄 CSV İndir</button>
              </div>
            </div>

            <div style="flex:1;overflow:auto;max-height:450px;">
              <table id="oracleDataTable" style="width:100%;border-collapse:collapse;font-size:.78rem;font-family:var(--mono);text-align:left;">
                <thead style="position:sticky;top:0;background:var(--bg-surface);box-shadow:0 1px 2px rgba(0,0,0,.1);z-index:2;">
                  <tr>
                    <th style="padding:.6rem .8rem;border-bottom:1px solid var(--border);color:var(--text-muted);font-weight:800;width:45px;">#</th>
                    ${columns.map(col => `
                      <th style="padding:.6rem .8rem;border-bottom:1px solid var(--border);color:var(--text-primary);font-weight:800;white-space:nowrap;">${esc(col)}</th>
                    `).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((row, idx) => `
                    <tr style="border-bottom:1px solid rgba(0,0,0,.04);background:${idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.02)'};">
                      <td style="padding:.5rem .8rem;color:var(--text-muted);font-weight:700;">${idx + 1}</td>
                      ${columns.map(col => {
                        const val = row[col];
                        const displayVal = (val === null || val === undefined) ? '<span style="color:var(--text-muted);font-style:italic;">NULL</span>' : esc(String(val));
                        return `<td style="padding:.5rem .8rem;color:var(--text-primary);white-space:nowrap;">${displayVal}</td>`;
                      }).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;

          resultsContainer.innerHTML = tableHtml;

          // Excel & CSV Export
          const exportExcelBtn = resultsContainer.querySelector('#btnExportOracleExcel');
          const exportCsvBtn = resultsContainer.querySelector('#btnExportOracleCsv');

          if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => {
              const table = resultsContainer.querySelector('#oracleDataTable');
              if (!table) return;
              const html = `<html><head><meta charset="utf-8"></head><body>${table.outerHTML}</body></html>`;
              const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `oracle_${targetConn.alias.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.xls`;
              a.click();
              URL.revokeObjectURL(url);
            });
          }

          if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
              let csvContent = '\uFEFF';
              csvContent += columns.map(c => `"${c.replace(/"/g, '""')}"`).join(';') + '\r\n';
              rows.forEach(r => {
                const line = columns.map(c => {
                  const val = r[c];
                  if (val === null || val === undefined) return '""';
                  return `"${String(val).replace(/"/g, '""')}"`;
                }).join(';');
                csvContent += line + '\r\n';
              });
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `oracle_${targetConn.alias.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            });
          }

        } catch (execErr) {
          resultsContainer.innerHTML = `
            <div style="padding:2rem;color:#ef4444;">
              <div style="font-size:1rem;font-weight:800;margin-bottom:.4rem;">İstek Hatası</div>
              <div>${esc(execErr.message)}</div>
            </div>
          `;
        } finally {
          execBtn.disabled = false;
          execBtn.innerHTML = `<span>⚡</span><span>Seçili Veritabanında Çalıştır (F5)</span>`;
        }
      };

      execBtn.addEventListener('click', runQuery);

      // F5 Kısayolu
      const handleKeyDown = (e) => {
        if (e.key === 'F5') {
          e.preventDefault();
          runQuery();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      overlay.querySelector('#btnOracleModalClose').addEventListener('click', () => {
        document.removeEventListener('keydown', handleKeyDown);
      });
    }
  };

  window.FrpOracle = FrpOracle;
  window.openOracleRunner = function(queryIndex) {
    let sqlText = '';
    let params = [];

    if (window.currentReport && Array.isArray(window.currentReport.queries) && window.currentReport.queries[queryIndex]) {
      const q = window.currentReport.queries[queryIndex];
      sqlText = q.sql || q.rawCode || q.text || '';
      params = q.params || [];
    }

    if (!sqlText && window.activeTabs) {
      const tab = window.activeTabs.find(t => t.queryIndex === queryIndex);
      if (tab) sqlText = tab.rawCode || '';
    }

    if (!sqlText) {
      if (typeof window.showToast === 'function') window.showToast('Çalıştırılacak SQL sorgusu bulunamadı.', 'error');
      return;
    }

    FrpOracle.openRunnerModal(sqlText, params);
  };

})();
