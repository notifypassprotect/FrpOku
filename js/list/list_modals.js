// ============================================================
//  list_modals.js — Liste Sayfası Diyalog & Analiz Modalları
//  Parametreler, Bağımlılıklar, Karmaşıklık, Tablo Kullanımı, Son Açılanlar & Son İndirilenler
// ============================================================

window.FrpListModals = window.FrpListModals || {};

(function () {
  'use strict';

  const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const encodeInlineArg = window.encodeInlineArg || (s => encodeURIComponent(String(s || '')));

  // 1. Parametre Yönetim Paneli
  window.FrpListModals.openParamsModal = async function() {
    const files = FrpStore.getAll ? FrpStore.getAll() : [];
    let usage = FrpStore.getParameterUsage ? FrpStore.getParameterUsage(files) : [];

    // Eğer özet modundan dolayı sorgular bellekte değilse ve paramNames boşsa tüm raporları otomatik tara:
    if ((!usage || usage.length === 0) && files.length > 0 && FrpStore.ensureFullReport) {
      const filesNeedingLoad = files.filter(f => (!f.queries || f.queries.length === 0) && (!f.paramNames || f.paramNames.length === 0));
      if (filesNeedingLoad.length > 0) {
        const batchSize = 15;
        for (let i = 0; i < filesNeedingLoad.length; i += batchSize) {
          const chunk = filesNeedingLoad.slice(i, i + batchSize);
          await Promise.all(chunk.map(f => FrpStore.ensureFullReport(f.id).catch(() => {})));
        }
        usage = FrpStore.getParameterUsage ? FrpStore.getParameterUsage(files) : [];
      }
    }

    if (!usage || usage.length === 0) {
      if (typeof window.showModal === 'function') {
        await window.showModal({
          title: 'SQL Parametre Yönetim Paneli',
          body: `
            <div style="padding:2rem;text-align:center;display:flex;flex-direction:column;align-items:center;gap:1rem;">
              <div style="width:52px;height:52px;border-radius:50%;background:rgba(59,130,246,0.12);display:flex;align-items:center;justify-content:center;font-size:1.6rem;color:var(--accent);">
                ⚡
              </div>
              <div>
                <h4 style="margin:0 0 .4rem 0;font-size:1.05rem;font-weight:700;color:var(--text-primary);">SQL Parametresi Bulunamadı</h4>
                <p style="margin:0;font-size:.82rem;color:var(--text-muted);max-width:460px;line-height:1.5;">
                  Sistemdeki raporlar incelendi ancak parametreli SQL sorgusu (:PARAM) tespit edilemedi.
                </p>
              </div>
            </div>
          `,
          confirmText: 'Kapat',
          cancelText: '',
          maxWidth: '520px'
        });
      }
      return;
    }

    usage.forEach(u => {
      const reportsMap = new Map();
      const reps = u.reports || u.usages || [];
      reps.forEach(r => {
        if (!reportsMap.has(r.fileId)) {
          reportsMap.set(r.fileId, {
            fileId: r.fileId,
            fileName: r.fileName,
            reportName: r.reportName,
            queries: []
          });
        }
        reportsMap.get(r.fileId).queries.push(r.queryName || 'Sorgu');
      });
      u.groupedReports = Array.from(reportsMap.values());
      u.reportCount = u.reportCount || u.groupedReports.length;
    });

    const bodyHtml = `
      <div class="modal-master-detail">
        <div class="master-pane">
          <div class="master-search-wrap">
            <input type="text" id="paramMasterSearch" class="master-search-input" placeholder="Parametre ara... (:TARIH, :KOD)" autocomplete="off" />
            <div style="font-size:.72rem;color:var(--text-muted);display:flex;justify-content:space-between;">
              <span>Toplam: <strong>${usage.length}</strong> parametre</span>
              <span id="paramFilterCount"></span>
            </div>
          </div>
          <div class="master-list" id="paramMasterList">
            ${usage.map((u, i) => `
              <div class="master-item ${i === 0 ? 'active' : ''}" data-idx="${i}">
                <div style="min-width:0;flex:1;">
                  <div class="param-name" style="color:var(--accent);font-weight:700;font-size:.82rem;overflow:hidden;text-overflow:ellipsis;">
                    ${escHtml(u.param)}
                  </div>
                  <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem;">
                    ${u.count} kullanım
                  </div>
                </div>
                <span class="badge badge-blue" style="font-size:.7rem;padding:.15rem .45rem;">${u.reportCount} rapor</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="detail-pane">
          <div class="detail-header" id="paramDetailHeader"></div>
          <div style="margin-bottom:.65rem;">
            <input type="text" id="paramDetailReportSearch" class="master-search-input" placeholder="Bu parametreyi kullanan raporlarda ara..." autocomplete="off" />
          </div>
          <div class="detail-body" id="paramDetailBody"></div>
        </div>
      </div>
    `;

    if (typeof window.showModal === 'function') {
      await window.showModal({
        title: `SQL Parametre Yönetim Paneli (${usage.length} Parametre)`,
        body: bodyHtml,
        confirmText: 'Kapat',
        cancelText: '',
        maxWidth: '1200px',
        onOpen: (overlay) => {
          let activeIdx = 0;
          let activeReportQuery = '';

          const masterListEl = overlay.querySelector('#paramMasterList');
          const headerEl = overlay.querySelector('#paramDetailHeader');
          const bodyEl = overlay.querySelector('#paramDetailBody');
          const masterSearchEl = overlay.querySelector('#paramMasterSearch');
          const reportSearchEl = overlay.querySelector('#paramDetailReportSearch');
          const filterCountEl = overlay.querySelector('#paramFilterCount');

          function renderDetail() {
            const item = usage[activeIdx];
            if (!item) {
              headerEl.innerHTML = '';
              bodyEl.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">Parametre seçilmedi</div>';
              return;
            }

            headerEl.innerHTML = `
              <div>
                <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                  <span style="font-size:1.15rem;font-weight:800;color:var(--accent);">${escHtml(item.param)}</span>
                  <span class="badge badge-blue">${item.reportCount} farklı rapor</span>
                  <span class="badge badge-purple">${item.count} toplam kullanım</span>
                </div>
                <div style="font-size:.74rem;color:var(--text-muted);margin-top:.2rem;">
                  Bu parametrenin kullanıldığı tüm raporlar ve bağlı sorgular aşağıda listelenmiştir.
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:.4rem;">
                <button class="btn btn-sm" id="btnCopyParamReports" title="Rapor isimlerini panoya kopyala">Raporları Kopyala</button>
              </div>
            `;

            const q = (activeReportQuery || '').toLowerCase().trim();
            const filteredReports = item.groupedReports.filter(r => {
              if (!q) return true;
              return r.reportName.toLowerCase().includes(q) ||
                     r.fileName.toLowerCase().includes(q) ||
                     r.queries.some(qn => qn.toLowerCase().includes(q));
            });

            if (filteredReports.length === 0) {
              bodyEl.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);font-size:.85rem;">"${escHtml(activeReportQuery)}" ile eşleşen rapor bulunamadı.</div>`;
              return;
            }

            bodyEl.innerHTML = filteredReports.map(r => `
              <div class="detail-group-card">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.35rem;">
                  <div style="min-width:0;flex:1;">
                    <div style="font-weight:700;font-size:.88rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      ${escHtml(r.reportName)}
                    </div>
                    <div style="font-size:.72rem;color:var(--text-muted);font-family:var(--mono);">
                      ${escHtml(r.fileName)}
                    </div>
                  </div>
                  <button type="button" class="btn btn-sm btn-primary" style="padding:.2rem .65rem;font-size:.74rem;white-space:nowrap;" data-list-action="open-detail" data-id="${encodeInlineArg(r.fileId)}">Detayda Aç →</button>
                </div>
                <div style="margin-top:.4rem;padding-top:.35rem;border-top:1px dashed var(--border-light);">
                  <span style="font-size:.72rem;color:var(--text-muted);font-weight:600;">Kullanan Sorgular:</span>
                  <div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.2rem;">
                    ${r.queries.map(qn => `<span class="query-chip">${escHtml(qn)}</span>`).join('')}
                  </div>
                </div>
              </div>
            `).join('');

            overlay.querySelector('#btnCopyParamReports')?.addEventListener('click', () => {
              const text = item.groupedReports.map(r => `${r.reportName} (${r.fileName}) [${r.queries.join(', ')}]`).join('\n');
              navigator.clipboard.writeText(text).then(() => {
                if (typeof window.toast === 'function') window.toast('Rapor listesi panoya kopyalandı.', 'success');
              });
            });
          }

          function filterMaster() {
            const q = masterSearchEl.value.toLowerCase().trim();
            let visibleCount = 0;
            masterListEl.querySelectorAll('.master-item').forEach(el => {
              const idx = parseInt(el.dataset.idx, 10);
              const u = usage[idx];
              const match = !q || u.param.toLowerCase().includes(q);
              el.style.display = match ? '' : 'none';
              if (match) visibleCount++;
            });
            if (filterCountEl) filterCountEl.textContent = q ? `${visibleCount} bulundu` : '';
          }

          masterListEl.addEventListener('click', e => {
            const itemEl = e.target.closest('.master-item');
            if (!itemEl) return;
            masterListEl.querySelectorAll('.master-item').forEach(el => el.classList.remove('active'));
            itemEl.classList.add('active');
            activeIdx = parseInt(itemEl.dataset.idx, 10);
            renderDetail();
          });

          masterSearchEl.addEventListener('input', filterMaster);
          reportSearchEl.addEventListener('input', () => {
            activeReportQuery = reportSearchEl.value;
            renderDetail();
          });

          renderDetail();
        }
      });
    }
  };

  // 2. Bağımlılık Haritası Modalı
  window.FrpListModals.openDependenciesModal = async function() {
    const files = FrpStore.getAll ? FrpStore.getAll() : [];
    let deps = FrpStore.getDependencyMap ? FrpStore.getDependencyMap(files) : [];

    // Özet modunda tablolar çıkarılmadıysa otomatik tara:
    if ((!deps || deps.length === 0) && files.length > 0 && FrpStore.ensureFullReport) {
      const filesNeedingLoad = files.filter(f => (!f.queries || f.queries.length === 0) && (!f.tableNames || f.tableNames.length === 0));
      if (filesNeedingLoad.length > 0) {
        const batchSize = 15;
        for (let i = 0; i < filesNeedingLoad.length; i += batchSize) {
          const chunk = filesNeedingLoad.slice(i, i + batchSize);
          await Promise.all(chunk.map(f => FrpStore.ensureFullReport(f.id).catch(() => {})));
        }
        deps = FrpStore.getDependencyMap ? FrpStore.getDependencyMap(files) : [];
      }
    }

    if (!deps || deps.length === 0) {
      if (typeof window.showModal === 'function') {
        await window.showModal({
          title: 'Tablo Bağımlılık Haritası',
          body: `
            <div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:.88rem;line-height:1.5;">
              Bağımlılık analizi için henüz veritabanı tablosu içeren bir rapor bulunamadı.<br>
              Lütfen önce veritabanı tablolarına bağlı .frp raporları yükleyin veya raporları inceleyin.
            </div>
          `,
          confirmText: 'Kapat',
          cancelText: '',
          maxWidth: '520px'
        });
      }
      return;
    }

    deps.forEach(d => {
      const reportsMap = new Map();
      d.deps.forEach(dp => {
        if (!reportsMap.has(dp.fileId)) {
          reportsMap.set(dp.fileId, {
            fileId: dp.fileId,
            fileName: dp.fileName,
            reportName: dp.reportName,
            queries: []
          });
        }
        reportsMap.get(dp.fileId).queries.push(dp.queryName);
      });
      d.groupedReports = Array.from(reportsMap.values());
    });

    const bodyHtml = `
      <div class="modal-master-detail">
        <div class="master-pane">
          <div class="master-search-wrap">
            <input type="text" id="tableMasterSearch" class="master-search-input" placeholder="Tablo ara... (BIRIM, HASTA)" autocomplete="off" />
            <div style="font-size:.72rem;color:var(--text-muted);display:flex;justify-content:space-between;">
              <span>Toplam: <strong>${deps.length}</strong> veritabanı tablosu</span>
              <span id="tableFilterCount"></span>
            </div>
          </div>
          <div class="master-list" id="tableMasterList">
            ${deps.map((d, i) => `
              <div class="master-item ${i === 0 ? 'active' : ''}" data-idx="${i}">
                <div style="min-width:0;flex:1;">
                  <div class="table-name" style="color:var(--accent);font-weight:700;font-size:.82rem;overflow:hidden;text-overflow:ellipsis;">
                    ${escHtml(d.table)}
                  </div>
                  <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem;">
                    ${d.count} sorgu
                  </div>
                </div>
                <span class="badge badge-purple" style="font-size:.7rem;padding:.15rem .45rem;">${d.reportCount} rapor</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="detail-pane">
          <div class="detail-header" id="tableDetailHeader"></div>
          <div style="margin-bottom:.65rem;">
            <input type="text" id="tableDetailReportSearch" class="master-search-input" placeholder="Bu tabloya bağımlı raporlarda ara..." autocomplete="off" />
          </div>
          <div class="detail-body" id="tableDetailBody"></div>
        </div>
      </div>
    `;

    if (typeof window.showModal === 'function') {
      await window.showModal({
        title: `Veritabanı Tablo Bağımlılık Haritası (${deps.length} Tablo)`,
        body: bodyHtml,
        confirmText: 'Kapat',
        cancelText: '',
        maxWidth: '1200px',
        onOpen: (overlay) => {
          let activeIdx = 0;
          let activeReportQuery = '';

          const masterListEl = overlay.querySelector('#tableMasterList');
          const headerEl = overlay.querySelector('#tableDetailHeader');
          const bodyEl = overlay.querySelector('#tableDetailBody');
          const masterSearchEl = overlay.querySelector('#tableMasterSearch');
          const reportSearchEl = overlay.querySelector('#tableDetailReportSearch');
          const filterCountEl = overlay.querySelector('#tableFilterCount');

          function renderDetail() {
            const item = deps[activeIdx];
            if (!item) {
              headerEl.innerHTML = '';
              bodyEl.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">Tablo seçilmedi</div>';
              return;
            }

            const impactLevel = item.reportCount > 50 ? 'Yüksek Etki Riski' : (item.reportCount > 10 ? 'Orta Etki' : 'Düşük Etki');
            const impactColor = item.reportCount > 50 ? 'var(--red)' : (item.reportCount > 10 ? 'var(--orange)' : 'var(--green)');

            headerEl.innerHTML = `
              <div>
                <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                  <span style="font-size:1.15rem;font-weight:800;color:var(--accent);">${escHtml(item.table)}</span>
                  <span class="badge badge-purple">${item.reportCount} bağımlı rapor</span>
                  <span class="badge badge-blue">${item.count} sorgu</span>
                  <span style="font-size:.74rem;font-weight:700;color:${impactColor};background:var(--bg-raised);padding:.2rem .5rem;border-radius:6px;border:1px solid var(--border);">${impactLevel}</span>
                </div>
                <div style="font-size:.74rem;color:var(--text-muted);margin-top:.2rem;">
                  Bu tabloda yapılacak şema değişikliklerinden etkilenecek raporlar aşağıda listelenmiştir.
                </div>
              </div>
            `;

            const q = (activeReportQuery || '').toLowerCase().trim();
            const filteredReports = item.groupedReports.filter(r => {
              if (!q) return true;
              return r.reportName.toLowerCase().includes(q) ||
                     r.fileName.toLowerCase().includes(q) ||
                     r.queries.some(qn => qn.toLowerCase().includes(q));
            });

            if (filteredReports.length === 0) {
              bodyEl.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);font-size:.85rem;">"${escHtml(activeReportQuery)}" ile eşleşen rapor bulunamadı.</div>`;
              return;
            }

            bodyEl.innerHTML = filteredReports.map(r => `
              <div class="detail-group-card">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.35rem;">
                  <div style="min-width:0;flex:1;">
                    <div style="font-weight:700;font-size:.88rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      ${escHtml(r.reportName)}
                    </div>
                    <div style="font-size:.72rem;color:var(--text-muted);font-family:var(--mono);">
                      ${escHtml(r.fileName)}
                    </div>
                  </div>
                  <button type="button" class="btn btn-sm btn-primary" style="padding:.2rem .65rem;font-size:.74rem;white-space:nowrap;" data-list-action="open-detail" data-id="${encodeInlineArg(r.fileId)}">Detayda Aç →</button>
                </div>
                <div style="margin-top:.4rem;padding-top:.35rem;border-top:1px dashed var(--border-light);">
                  <span style="font-size:.72rem;color:var(--text-muted);font-weight:600;">Bağlı SQL Sorguları:</span>
                  <div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.2rem;">
                    ${r.queries.map(qn => `<span class="query-chip">${escHtml(qn)}</span>`).join('')}
                  </div>
                </div>
              </div>
            `).join('');
          }

          function filterMaster() {
            const q = masterSearchEl.value.toLowerCase().trim();
            let visibleCount = 0;
            masterListEl.querySelectorAll('.master-item').forEach(el => {
              const idx = parseInt(el.dataset.idx, 10);
              const d = deps[idx];
              const match = !q || d.table.toLowerCase().includes(q);
              el.style.display = match ? '' : 'none';
              if (match) visibleCount++;
            });
            if (filterCountEl) filterCountEl.textContent = q ? `${visibleCount} bulundu` : '';
          }

          masterListEl.addEventListener('click', e => {
            const itemEl = e.target.closest('.master-item');
            if (!itemEl) return;
            masterListEl.querySelectorAll('.master-item').forEach(el => el.classList.remove('active'));
            itemEl.classList.add('active');
            activeIdx = parseInt(itemEl.dataset.idx, 10);
            renderDetail();
          });

          masterSearchEl.addEventListener('input', filterMaster);
          reportSearchEl.addEventListener('input', () => {
            activeReportQuery = reportSearchEl.value;
            renderDetail();
          });

          renderDetail();
        }
      });
    }
  };

  // 3. Veritabanı Tablo Kullanım Analizi Modalı (Master-Detail Gelişmiş Görünüm)
  window.FrpListModals.openTableUsageModal = async function() {
    const files = FrpStore.getAll ? FrpStore.getAll() : [];
    let usage = FrpStore.getTableUsage ? FrpStore.getTableUsage(files) : [];

    // Özet modunda tablolar çıkarılmadıysa otomatik tara:
    if ((!usage || usage.length === 0) && files.length > 0 && FrpStore.ensureFullReport) {
      const filesNeedingLoad = files.filter(f => (!f.queries || f.queries.length === 0) && (!f.tableNames || f.tableNames.length === 0) && (!f.datasets || f.datasets.length === 0));
      if (filesNeedingLoad.length > 0) {
        const batchSize = 15;
        for (let i = 0; i < filesNeedingLoad.length; i += batchSize) {
          const chunk = filesNeedingLoad.slice(i, i + batchSize);
          await Promise.all(chunk.map(f => FrpStore.ensureFullReport(f.id).catch(() => {})));
        }
        usage = FrpStore.getTableUsage ? FrpStore.getTableUsage(files) : [];
      }
    }

    if (!usage || usage.length === 0) {
      if (typeof window.showModal === 'function') {
        await window.showModal({
          title: 'Veritabanı Tablo Kullanım Analizi',
          body: `
            <div style="padding:2rem;text-align:center;color:var(--text-muted);font-size:.88rem;line-height:1.5;">
              Sistemde henüz analiz edilmiş veritabanı tablosu bulunamadı.<br>
              Lütfen önce veritabanı tablolarına bağlı .frp raporları yükleyin veya raporları inceleyin.
            </div>
          `,
          confirmText: 'Kapat',
          cancelText: '',
          maxWidth: '520px'
        });
      }
      return;
    }

    const bodyHtml = `
      <div class="modal-master-detail">
        <div class="master-pane">
          <div class="master-search-wrap">
            <input type="text" id="tableUsageSearch" class="master-search-input" placeholder="Tablo adı ara... (HASTA, FATURA)" autocomplete="off" />
            <div style="font-size:.72rem;color:var(--text-muted);display:flex;justify-content:space-between;">
              <span>Toplam: <strong>${usage.length}</strong> tablo</span>
              <span id="tableUsageFilterCount"></span>
            </div>
          </div>
          <div class="master-list" id="tableUsageList">
            ${usage.map((t, i) => `
              <div class="master-item ${i === 0 ? 'active' : ''}" data-idx="${i}">
                <div style="min-width:0;flex:1;">
                  <div class="table-name" style="color:var(--accent);font-weight:700;font-size:.82rem;overflow:hidden;text-overflow:ellipsis;font-family:var(--mono);">
                    ${escHtml(t.tableName)}
                  </div>
                  <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem;">
                    ${t.count} farklı raporda geçiyor
                  </div>
                </div>
                <span class="badge badge-purple" style="font-size:.7rem;padding:.15rem .45rem;">${t.count} Rapor</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="detail-pane">
          <div class="detail-header" id="tableUsageDetailHeader"></div>
          <div style="margin-bottom:.65rem;">
            <input type="text" id="tableUsageReportSearch" class="master-search-input" placeholder="Bu tabloyu kullanan raporlarda ara..." autocomplete="off" />
          </div>
          <div class="detail-body" id="tableUsageDetailBody"></div>
        </div>
      </div>
    `;

    if (typeof window.showModal === 'function') {
      await window.showModal({
        title: `Veritabanı Tablo Kullanım Analizi (${usage.length} Tablo)`,
        body: bodyHtml,
        confirmText: 'Kapat',
        cancelText: '',
        maxWidth: '1200px',
        onOpen: (overlay) => {
          let activeIdx = 0;
          let activeReportQuery = '';

          const masterListEl = overlay.querySelector('#tableUsageList');
          const headerEl = overlay.querySelector('#tableUsageDetailHeader');
          const bodyEl = overlay.querySelector('#tableUsageDetailBody');
          const masterSearchEl = overlay.querySelector('#tableUsageSearch');
          const reportSearchEl = overlay.querySelector('#tableUsageReportSearch');
          const filterCountEl = overlay.querySelector('#tableUsageFilterCount');

          function renderDetail() {
            const item = usage[activeIdx];
            if (!item) {
              headerEl.innerHTML = '';
              bodyEl.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-muted);">Tablo seçilmedi</div>';
              return;
            }

            headerEl.innerHTML = `
              <div>
                <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                  <span style="font-size:1.15rem;font-weight:800;color:var(--accent);font-family:var(--mono);">${escHtml(item.tableName)}</span>
                  <span class="badge badge-purple">${item.count} farklı rapor</span>
                </div>
                <div style="font-size:.74rem;color:var(--text-muted);margin-top:.2rem;">
                  Bu veritabanı tablosunu kullanan tüm raporlar aşağıda listelenmiştir.
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:.4rem;">
                <button class="btn btn-sm" id="btnCopyTableReports" title="Rapor isimlerini panoya kopyala">Raporları Kopyala</button>
              </div>
            `;

            const q = (activeReportQuery || '').toLowerCase().trim();
            const repList = item.files || [];
            const filteredReports = repList.filter(f => {
              if (!q) return true;
              const rName = (f.meta?.reportName || f.name || '').toLowerCase();
              const fName = (f.name || '').toLowerCase();
              return rName.includes(q) || fName.includes(q);
            });

            if (filteredReports.length === 0) {
              bodyEl.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);font-size:.85rem;">"${escHtml(activeReportQuery)}" ile eşleşen rapor bulunamadı.</div>`;
              return;
            }

            bodyEl.innerHTML = filteredReports.map(f => {
              const rName = f.meta?.reportName || f.name;
              return `
                <div class="detail-group-card">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;">
                    <div style="min-width:0;flex:1;">
                      <div style="font-weight:700;font-size:.88rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                        ${escHtml(rName)}
                      </div>
                      <div style="font-size:.72rem;color:var(--text-muted);font-family:var(--mono);margin-top:.15rem;">
                        ${escHtml(f.name)}
                      </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-primary" style="padding:.2rem .65rem;font-size:.74rem;white-space:nowrap;" data-list-action="open-detail" data-id="${encodeInlineArg(f.id)}">Detayda Aç →</button>
                  </div>
                </div>
              `;
            }).join('');

            overlay.querySelector('#btnCopyTableReports')?.addEventListener('click', () => {
              const text = (item.files || []).map(f => `${f.meta?.reportName || f.name} (${f.name})`).join('\n');
              navigator.clipboard.writeText(text).then(() => {
                if (typeof window.toast === 'function') window.toast('Rapor listesi panoya kopyalandı.', 'success');
              });
            });
          }

          function filterMaster() {
            const q = masterSearchEl.value.toLowerCase().trim();
            let visibleCount = 0;
            masterListEl.querySelectorAll('.master-item').forEach(el => {
              const idx = parseInt(el.dataset.idx, 10);
              const t = usage[idx];
              const match = !q || t.tableName.toLowerCase().includes(q);
              el.style.display = match ? '' : 'none';
              if (match) visibleCount++;
            });
            if (filterCountEl) filterCountEl.textContent = q ? `${visibleCount} bulundu` : '';
          }

          masterListEl.addEventListener('click', e => {
            const itemEl = e.target.closest('.master-item');
            if (!itemEl) return;
            masterListEl.querySelectorAll('.master-item').forEach(el => el.classList.remove('active'));
            itemEl.classList.add('active');
            activeIdx = parseInt(itemEl.dataset.idx, 10);
            renderDetail();
          });

          masterSearchEl.addEventListener('input', filterMaster);
          reportSearchEl.addEventListener('input', () => {
            activeReportQuery = reportSearchEl.value;
            renderDetail();
          });

          renderDetail();
        }
      });
    }
  };

  // 5. Son İncelenen Raporlar Modalı
  window.FrpListModals.openRecentModal = async function() {
    const recent = FrpStore.getRecent ? FrpStore.getRecent() : [];
    if (!recent || recent.length === 0) {
      if (typeof window.toast === 'function') window.toast('Henüz incelenen bir rapor geçmişi bulunmuyor.', 'info');
      return;
    }

    const bodyHtml = `
      <div style="display:flex;flex-direction:column;gap:.6rem;max-height:60vh;overflow-y:auto;">
        ${recent.map(f => {
          const repName = f.meta?.reportName || f.name;
          const timeStr = f.recentTs ? new Date(f.recentTs).toLocaleString('tr-TR') : 'Bilinmiyor';
          return `
            <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:10px;padding:.75rem 1rem;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:background .15s;" data-list-action="open-detail" data-id="${encodeInlineArg(f.id)}">
              <div style="min-width:0;flex:1;">
                <div style="font-weight:700;font-size:.88rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(repName)}</div>
                <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem;">Dosya: ${escHtml(f.name)} · Son İnceleme: ${timeStr}</div>
              </div>
              <button class="btn btn-sm btn-primary" style="font-size:.74rem;padding:.25rem .65rem;">Aç →</button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    if (typeof window.showModal === 'function') {
      await window.showModal({
        title: `Son İncelenen Raporlar (${recent.length})`,
        body: bodyHtml,
        confirmText: 'Kapat',
        cancelText: '',
        maxWidth: '700px'
      });
    }
  };

  // 6. Son İndirilen Dosyalar Modalı
  window.FrpListModals.openDownloadHistoryModal = async function() {
    const history = FrpStore.getDownloadHistory ? FrpStore.getDownloadHistory() : [];
    if (!history || history.length === 0) {
      if (typeof window.toast === 'function') window.toast('Henüz indirme geçmişi kaydı bulunmuyor.', 'info');
      return;
    }

    function formatHistoryTime(raw) {
      if (!raw) return '-';
      try {
        const d = new Date(raw);
        if (isNaN(d.getTime())) return '-';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}.${mm}.${yyyy} - ${hh}:${min}`;
      } catch {
        return String(raw);
      }
    }

    const bodyHtml = `
      <div style="display:flex;flex-direction:column;gap:.65rem;max-height:60vh;overflow-y:auto;padding-right:.25rem;">
        ${history.map(item => {
          const rawTime = item.downloadedAt || item.timestamp || item.date || item.createdAt;
          const timeStr = formatHistoryTime(rawTime);
          return `
            <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:10px;padding:.85rem 1.1rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;">
              <div style="min-width:0;flex:1;">
                <div style="font-weight:700;font-size:.88rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(item.fileName)}</div>
                <div style="font-size:.74rem;color:var(--text-muted);margin-top:.2rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                  <span>Format: <strong>${escHtml(item.format || 'frp')}</strong></span>
                  <span>·</span>
                  <span>Zaman: <strong style="font-family:var(--mono);color:var(--text-secondary);">${timeStr}</strong></span>
                  ${item.reportName && item.reportName !== item.fileName ? `<span>·</span><span>${escHtml(item.reportName)}</span>` : ''}
                </div>
              </div>
              <span class="badge badge-blue" style="font-size:.74rem;font-family:var(--mono);padding:.25rem .6rem;">${escHtml(item.format?.toUpperCase() || 'FRP')}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    if (typeof window.showModal === 'function') {
      await window.showModal({
        title: `Son İndirilen Dosyalar (${history.length})`,
        body: bodyHtml,
        confirmText: 'Kapat',
        cancelText: '',
        maxWidth: '700px'
      });
    }
  };

  // Kısayol aliasları
  window.openParamsModal = window.FrpListModals.openParamsModal;
  window.openDependenciesModal = window.FrpListModals.openDependenciesModal;
  window.openComplexityCenter = window.FrpListModals.openComplexityCenter;
  window.openTableUsageModal = window.FrpListModals.openTableUsageModal;
  window.openRecentModal = window.FrpListModals.openRecentModal;
  window.openDownloadHistoryModal = window.FrpListModals.openDownloadHistoryModal;
})();
