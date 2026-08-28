/**
 * FrpOku — Oracle Database Entegrasyonu ve Canlı Sorgu Çalıştırıcı
 * Thin mode destekli, parametre enjeksiyonlu ve Excel aktarımlı interaktif veri tablosu.
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'frpoku_oracle_config';

  const FrpOracle = {
    getConfig() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {
        console.warn('Oracle config parse hatası:', e);
      }
      return {
        host: 'localhost',
        port: 1521,
        connType: 'serviceName', // 'serviceName' | 'sid'
        serviceName: 'ORCL',
        sid: 'ORCL',
        user: '',
        password: '',
        maxRows: 250
      };
    },

    saveConfig(cfg) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
        return true;
      } catch (e) {
        console.error('Oracle config kaydedilemedi:', e);
        return false;
      }
    },

    async testConnection(cfg) {
      const config = cfg || this.getConfig();
      const res = await fetch('/api/oracle/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      return await res.json();
    },

    async executeQuery({ sql, params = {}, maxRows = 250 }) {
      const config = this.getConfig();
      if (!config.host || !config.user || !config.password) {
        return {
          success: false,
          reason: 'Oracle veritabanı bağlantı ayarları eksik. Lütfen Ayarlar -> Oracle sekmesinden bağlantı bilgilerinizi kaydediniz.'
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
      const config = this.getConfig();
      const isConfigured = Boolean(config.host && config.user && config.password);

      // SQL içerisindeki tüm :PARAMETRE değişkenlerini regex ile yakala
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
        <div class="modal" style="max-width:960px;width:95vw;max-height:90vh;display:flex;flex-direction:column;padding:0;border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,.45);border:1px solid var(--border);background:var(--bg-surface);overflow:hidden;animation:fadeIn .2s ease-out;">
          
          <!-- Başlık Çubuğu -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding:1.1rem 1.4rem;border-bottom:1px solid var(--border-light);background:var(--bg-raised);">
            <div style="display:flex;align-items:center;gap:.75rem;">
              <span style="font-size:1.6rem;">⚡</span>
              <div>
                <div style="font-size:1.05rem;font-weight:800;color:var(--text-primary);">Oracle Canlı Sorgu Çalıştırıcı</div>
                <div style="font-size:.76rem;color:var(--text-muted);display:flex;align-items:center;gap:.4rem;">
                  <span>Sunucu: <strong>${esc(config.host || 'Tanımsız')}:${esc(config.port || 1521)}</strong></span>
                  <span>•</span>
                  <span>Şema / Kullanıcı: <strong>${esc(config.user || 'Tanımsız')}</strong></span>
                  ${!isConfigured ? '<span style="color:#ef4444;font-weight:700;">(Ayarlar Eksik)</span>' : '<span style="color:#10b981;font-weight:700;">(Hazır)</span>'}
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem;">
              <button class="btn btn-sm btn-ghost" id="btnOracleModalSettings" title="Oracle Bağlantı Ayarlarını Düzenle" style="padding:.35rem .75rem;font-size:.8rem;">⚙️ Ayarlar</button>
              <button class="btn btn-sm btn-ghost" id="btnOracleModalClose" style="font-size:1.2rem;padding:.2rem .6rem;line-height:1;">✕</button>
            </div>
          </div>

          <!-- Gövde -->
          <div style="flex:1;overflow-y:auto;padding:1.25rem 1.4rem;display:flex;flex-direction:column;gap:1.1rem;">
            
            ${!isConfigured ? `
              <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:.85rem 1rem;color:#ef4444;font-size:.85rem;display:flex;align-items:center;justify-content:space-between;">
                <div>⚠️ Oracle bağlantı bilgileriniz henüz ayarlanmamış. Sorguyu çalıştırmadan önce lütfen ayarlarınızı kaydedin.</div>
                <button class="btn btn-sm" id="btnGoToOracleConfig" style="background:#ef4444;color:#fff;border:none;font-weight:700;padding:.35rem .8rem;border-radius:6px;cursor:pointer;">Ayarları Aç</button>
              </div>
            ` : ''}

            <!-- Parametreler Alanı (Varsa) -->
            ${paramList.length > 0 ? `
              <div style="background:var(--bg-raised);border:1px solid var(--border-light);border-radius:12px;padding:1rem;">
                <div style="font-size:.85rem;font-weight:800;color:var(--text-primary);margin-bottom:.65rem;display:flex;align-items:center;gap:.4rem;">
                  <span>🏷️ SQL Parametreleri (${paramList.length})</span>
                  <span style="font-size:.72rem;color:var(--text-muted);font-weight:400;">(Oracle bind değişkenleri olarak gönderilir)</span>
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
                <label style="font-size:.8rem;font-weight:600;color:var(--text-secondary);">Maksimum Satır:</label>
                <select id="oracleMaxRowsSelect" style="padding:.35rem .6rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.82rem;font-weight:600;">
                  <option value="50">50 Satır</option>
                  <option value="100">100 Satır</option>
                  <option value="250" selected>250 Satır</option>
                  <option value="500">500 Satır</option>
                  <option value="1000">1000 Satır</option>
                </select>
              </div>

              <div style="display:flex;align-items:center;gap:.6rem;">
                <button class="btn btn-primary" id="btnExecuteOracleQuery" style="padding:.5rem 1.4rem;font-weight:800;display:flex;align-items:center;gap:.4rem;">
                  <span>⚡</span><span>Sorguyu Çalıştır (F5)</span>
                </button>
              </div>
            </div>

            <!-- Sonuç Alanı -->
            <div id="oracleResultsContainer" style="flex:1;min-height:220px;display:flex;flex-direction:column;background:var(--bg-raised);border:1px solid var(--border-light);border-radius:12px;overflow:hidden;position:relative;">
              <div id="oracleInitialEmptyState" style="padding:3rem;text-align:center;color:var(--text-muted);">
                <div style="font-size:2.4rem;margin-bottom:.6rem;">🎯</div>
                <div style="font-size:.92rem;font-weight:700;color:var(--text-secondary);">Sorgu Çalıştırılmaya Hazır</div>
                <div style="font-size:.78rem;margin-top:.25rem;">Parametreleri doldurup "Sorguyu Çalıştır" butonuna tıklayınız.</div>
              </div>
            </div>

          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const closeBtn = overlay.querySelector('#btnOracleModalClose');
      const settingsBtn = overlay.querySelector('#btnOracleModalSettings');
      const goToConfigBtn = overlay.querySelector('#btnGoToOracleConfig');
      const execBtn = overlay.querySelector('#btnExecuteOracleQuery');
      const resultsContainer = overlay.querySelector('#oracleResultsContainer');
      const maxRowsSelect = overlay.querySelector('#oracleMaxRowsSelect');

      const doClose = () => overlay.remove();
      closeBtn.addEventListener('click', doClose);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) doClose(); });

      const openSettings = () => {
        doClose();
        if (typeof window.openSettingsModal === 'function') {
          window.openSettingsModal('oracle');
        }
      };
      if (settingsBtn) settingsBtn.addEventListener('click', openSettings);
      if (goToConfigBtn) goToConfigBtn.addEventListener('click', openSettings);

      // Çalıştırma fonksiyonu
      const runQuery = async () => {
        execBtn.disabled = true;
        execBtn.innerHTML = `<span>⏳</span><span>Çalıştırılıyor...</span>`;
        
        resultsContainer.innerHTML = `
          <div style="padding:3.5rem;text-align:center;color:var(--text-muted);display:flex;flex-direction:column;align-items:center;gap:.75rem;">
            <div style="font-size:2.8rem;animation:pulse 1.2s infinite ease-in-out;">⚡</div>
            <div style="font-size:1rem;font-weight:700;color:var(--text-primary);">Oracle veritabanında sorgulanıyor...</div>
            <div style="font-size:.78rem;">Lütfen bekleyiniz, kayıt seti aktarılıyor</div>
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
            sql,
            params: paramValues,
            maxRows
          });

          if (!res.success) {
            resultsContainer.innerHTML = `
              <div style="padding:2rem;color:#ef4444;">
                <div style="font-size:1.05rem;font-weight:800;margin-bottom:.5rem;display:flex;align-items:center;gap:.4rem;">
                  <span>❌</span><span>Oracle Sorgu Hatası</span>
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
                </div>
              </div>
              <div style="padding:3rem;text-align:center;color:var(--text-muted);">
                <div style="font-size:2.4rem;margin-bottom:.5rem;">📭</div>
                <div style="font-size:.9rem;font-weight:700;">Bu filtreye uygun kayıt bulunamadı.</div>
              </div>
            `;
            return;
          }

          // Tablo HTML Oluştur
          let tableHtml = `
            <div style="padding:.75rem 1.25rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-light);background:var(--bg-surface);flex-wrap:wrap;gap:.5rem;">
              <div style="display:flex;align-items:center;gap:.6rem;font-size:.82rem;">
                <span style="background:rgba(16,185,129,0.15);color:#10b981;font-weight:800;padding:.25rem .65rem;border-radius:6px;">⚡ ${duration} ms</span>
                <span style="font-weight:700;color:var(--text-primary);">${rows.length} Satır</span>
                ${res.truncated ? '<span style="color:#f59e0b;font-weight:700;font-size:.75rem;">(Maksimum sınıra ulaşıldı)</span>' : ''}
              </div>
              <div style="display:flex;gap:.4rem;">
                <button class="btn btn-sm" id="btnExportOracleExcel" style="background:#059669;color:#fff;border:none;font-weight:700;padding:.32rem .75rem;border-radius:6px;cursor:pointer;">📊 Excel (XLSX) İndir</button>
                <button class="btn btn-sm btn-ghost" id="btnExportOracleCsv" style="font-weight:700;padding:.32rem .75rem;border-radius:6px;">📄 CSV İndir</button>
              </div>
            </div>

            <div style="flex:1;overflow:auto;max-height:420px;">
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

          // Excel & CSV Export İşleyicileri
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
              a.download = `oracle_sorgu_sonucu_${Date.now()}.xls`;
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
              a.download = `oracle_sorgu_sonucu_${Date.now()}.csv`;
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
          execBtn.innerHTML = `<span>⚡</span><span>Sorguyu Çalıştır (F5)</span>`;
        }
      };

      execBtn.addEventListener('click', runQuery);

      // F5 Kısayolu ile çalıştırma
      const handleKeyDown = (e) => {
        if (e.key === 'F5') {
          e.preventDefault();
          runQuery();
        }
      };
      document.addEventListener('keydown', handleKeyDown);
      const origClose = doClose;
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
