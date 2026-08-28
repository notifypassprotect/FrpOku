async function readFileAsText(file) {
  try {
    const buffer = await file.arrayBuffer();
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      let decoded = utf8Decoder.decode(buffer);
      if (typeof fixTurkishMojibake === 'function') {
        decoded = fixTurkishMojibake(decoded);
      }
      return decoded;
    } catch {
      const win1254Decoder = new TextDecoder('windows-1254');
      let decoded = win1254Decoder.decode(buffer);
      if (typeof fixTurkishMojibake === 'function') {
        decoded = fixTurkishMojibake(decoded);
      }
      return decoded;
    }
  } catch (err) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        let res = e.target.result;
        if (typeof fixTurkishMojibake === 'function') res = fixTurkishMojibake(res);
        resolve(res);
      };
      reader.onerror = () => reject(new Error('Dosya okunamadı'));
      reader.readAsText(file, 'utf-8');
    });
  }
}

// ── YÜKLEME VE İLERLEME PENCERESİ (PROGRESS MODAL) ────────
function showProgressModal(title, sub, icon = '⚡') {
  const pm = document.getElementById('progressModal');
  if (!pm) return;
  const pTitle = document.getElementById('progressTitle');
  const pSub   = document.getElementById('progressSub');
  const pIcon  = document.getElementById('progressIcon');
  const pFill  = document.getElementById('progressBarFill');
  const pCount = document.getElementById('progressCountText');
  const pPct   = document.getElementById('progressPercentText');

  if (pTitle) pTitle.textContent = title || 'İşlem Yapılıyor...';
  if (pSub)   pSub.textContent   = sub || 'Lütfen bekleyin';
  if (pIcon)  pIcon.textContent  = icon || '⚡';
  if (pFill)  pFill.style.width  = '0%';
  if (pCount) pCount.textContent = '0 / 0 dosya';
  if (pPct)   pPct.textContent   = '0%';
  pm.style.display = 'flex';
}

function updateProgressModal(current, total, filename = '') {
  const pm = document.getElementById('progressModal');
  if (!pm || pm.style.display === 'none') return;
  const pct = Math.min(100, Math.round((current / (total || 1)) * 100));
  const pFill  = document.getElementById('progressBarFill');
  const pCount = document.getElementById('progressCountText');
  const pPct   = document.getElementById('progressPercentText');
  const pSub   = document.getElementById('progressSub');

  if (pFill)  pFill.style.width  = pct + '%';
  if (pCount) pCount.textContent = `${current} / ${total} dosya`;
  if (pPct)   pPct.textContent   = pct + '%';
  if (pSub && filename) pSub.textContent = `İşleniyor: ${filename}`;
}

function hideProgressModal() {
  const pm = document.getElementById('progressModal');
  if (pm) pm.style.display = 'none';
}

// ── TEKLİ RAPOR İNDİRME MODALI & AKIŞI (YALNIZCA .FRP) ────────────
async function downloadSingleReport(id) {
  const file = FrpStore.getById(id);
  if (!file) {
    toast('İndirilecek rapor bulunamadı.', 'error');
    return;
  }
  const reportName = file.meta?.reportName || file.name;
  const currentFilename = file.name;
  let versionBump = 1;

  const initialTargetName = FrpStore.bumpVersionFilename ? FrpStore.bumpVersionFilename(currentFilename, 1) : currentFilename;
  let finalChosenName = initialTargetName;

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:1.15rem;">
      <!-- Rapor Kartı -->
      <div style="background:var(--bg-raised);padding:.9rem 1.15rem;border-radius:12px;border:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
        <div style="min-width:0;flex:1;">
          <div style="font-weight:800;font-size:1rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📋 ${escHtml(reportName)}</div>
          <div style="font-size:.78rem;color:var(--text-muted);font-family:var(--font);margin-top:.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Mevcut dosya: <strong>${escHtml(currentFilename)}</strong></div>
        </div>
        <div style="display:flex;align-items:center;gap:.4rem;">
          <span class="badge badge-blue">🗄️ ${(file.queries || []).length} SQL</span>
          ${file.category ? `<span class="badge badge-purple">🏷️ ${escHtml(file.category)}</span>` : ''}
        </div>
      </div>

      <!-- Versiyon & Dosya Adı -->
      <div style="background:var(--bg-raised);padding:1.1rem;border-radius:12px;border:1px solid var(--border-light);display:flex;flex-direction:column;gap:.9rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">
          <label style="font-size:.82rem;font-weight:700;color:var(--text-primary);">Versiyon Numarası Artırımı:</label>
          <div style="display:flex;align-items:center;gap:.4rem;" id="versionQuickBtns">
            <button type="button" class="btn btn-sm btn-ghost v-btn" data-v="0" style="padding:3px 10px;font-size:.78rem;">Değiştirme (0)</button>
            <button type="button" class="btn btn-sm btn-primary v-btn active" data-v="1" style="padding:3px 10px;font-size:.78rem;font-weight:800;">+1 Artır</button>
            <button type="button" class="btn btn-sm btn-ghost v-btn" data-v="2" style="padding:3px 10px;font-size:.78rem;">+2</button>
            <button type="button" class="btn btn-sm btn-ghost v-btn" data-v="5" style="padding:3px 10px;font-size:.78rem;">+5</button>
          </div>
        </div>

        <div>
          <label style="font-size:.76rem;font-weight:700;color:var(--text-muted);display:block;margin-bottom:.35rem;">İndirilecek Dosya Adı (İsteğe bağlı düzenleyebilirsiniz):</label>
          <div style="display:flex;align-items:center;gap:.5rem;">
            <input type="text" id="targetFileNameInp" class="master-search-input" style="flex:1;font-family:var(--font);font-weight:700;color:var(--accent-bright);font-size:.9rem;" value="${escHtml(initialTargetName)}" />
          </div>
        </div>
      </div>
    </div>
  `;

  const confirmed = await showModal({
    title: '📥 FRP Raporu İndir',
    body: bodyHtml,
    confirmText: '💾 Hemen İndir',
    cancelText: '✕ İptal',
    maxWidth: '540px',
    onOpen: (modalEl) => {
      const nameInp = modalEl.querySelector('#targetFileNameInp');
      const vBtns = modalEl.querySelectorAll('.v-btn');

      function updateTargetName() {
        let baseName = currentFilename;
        if (versionBump > 0 && typeof FrpStore.bumpVersionFilename === 'function') {
          baseName = FrpStore.bumpVersionFilename(baseName, versionBump);
        }
        if (!baseName.toLowerCase().endsWith('.frp')) {
          baseName = baseName.replace(/\.[^/.]+$/, "") + '.frp';
        }
        if (nameInp) nameInp.value = baseName;
      }

      vBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          vBtns.forEach(b => {
            b.classList.remove('active', 'btn-primary');
            b.classList.add('btn-ghost');
          });
          btn.classList.add('active', 'btn-primary');
          btn.classList.remove('btn-ghost');
          versionBump = parseInt(btn.dataset.v, 10) || 0;
          updateTargetName();
        });
      });
    },
    onConfirm: (modalEl) => {
      const nameInp = modalEl.querySelector('#targetFileNameInp');
      let val = (nameInp?.value || '').trim();
      if (!val) val = initialTargetName;
      if (!val.toLowerCase().endsWith('.frp')) val += '.frp';
      finalChosenName = val;
      return true;
    }
  });

  if (!confirmed) return;

  showProgressModal('FRP Hazırlanıyor...', finalChosenName, '📥');
  updateProgressModal(1, 1, finalChosenName);
  await new Promise(r => setTimeout(r, 120));

  try {
    const xmlData = window.buildUpdatedFrpXml ? window.buildUpdatedFrpXml(file, null) : (file.rawXml || '');
    const blob = new Blob([xmlData], { type: 'application/octet-stream;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalChosenName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);

    if (typeof FrpStore.addDownloadHistory === 'function') {
      FrpStore.addDownloadHistory({
        reportId: file.id,
        reportName: reportName,
        fileName: finalChosenName,
        format: 'frp',
        customVersion: versionBump > 0 ? `+${versionBump}` : ''
      });
    }

    if (window.FrpAudit) {
      window.FrpAudit.logAction({
        action: 'FRP_DOWNLOAD',
        target: finalChosenName,
        details: `'${file.name}' raporu (${finalChosenName}) olarak indirildi.`
      });
    }

    hideProgressModal();
    toast(`'${finalChosenName}' başarıyla indirildi. 📥`, 'success');
  } catch (err) {
    hideProgressModal();
    toast('İndirme hatası: ' + err.message, 'error');
  }
}

// ── SON İNDİRİLENLER MODALI ──────────────────────────────────────
async function showDownloadHistoryModal() {
  const history = typeof FrpStore.getDownloadHistory === 'function' ? FrpStore.getDownloadHistory() : [];
  
  const bodyHtml = history.length === 0 ? `
    <div style="padding:2.5rem 1rem;text-align:center;color:var(--text-muted);">
      <div style="font-size:2.5rem;margin-bottom:.5rem;">📥</div>
      <div style="font-weight:700;font-size:1rem;color:var(--text-secondary);">Henüz İndirilen Dosya Yok</div>
      <div style="font-size:.8rem;margin-top:.25rem;">İndirdiğiniz tekli veya toplu raporlar burada listelenecektir.</div>
    </div>
  ` : `
    <div style="display:flex;flex-direction:column;gap:.6rem;max-height:420px;overflow-y:auto;padding-right:.25rem;">
      ${history.map(item => {
        const timeStr = new Date(item.timestamp).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const formatBadge = item.format === 'zip' ? '📦 ZIP' : (item.format === 'sql' ? '🗄️ SQL' : (item.format === 'html' ? '🌐 HTML' : '📄 FRP'));
        return `
          <div style="background:var(--bg-raised);padding:.75rem .95rem;border-radius:10px;border:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;gap:.8rem;">
            <div style="min-width:0;flex:1;">
              <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.2rem;">
                <span class="badge badge-blue" style="font-size:.68rem;padding:2px 6px;">${formatBadge}</span>
                <span style="font-weight:800;font-size:.85rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(item.fileName)}</span>
              </div>
              <div style="font-size:.72rem;color:var(--text-muted);display:flex;align-items:center;gap:.6rem;">
                <span>🕒 ${timeStr}</span>
                ${item.reportName && item.reportName !== item.fileName ? `<span>• 📋 ${escHtml(item.reportName)}</span>` : ''}
              </div>
            </div>
            ${item.reportId && item.reportId !== 'bulk' ? `
              <button type="button" class="btn btn-sm btn-ghost" onclick="window.downloadSingleReport && window.downloadSingleReport('${item.reportId}')" title="Tekrar İndir" style="font-size:.72rem;padding:.25rem .55rem;">
                📥 İndir
              </button>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  await showModal({
    title: '📥 Son İndirilenler & İndirme Geçmişi',
    body: bodyHtml,
    confirmText: 'Tamam',
    cancelText: history.length > 0 ? '🗑️ Geçmişi Temizle' : null,
    maxWidth: '560px'
  }).then(res => {
    if (res === false && history.length > 0) {
      localStorage.removeItem('frpoku_download_history');
      toast('İndirme geçmişi temizlendi. 🗑️', 'info');
    }
  });
}

window.downloadSingleReport = downloadSingleReport;
window.showDownloadHistoryModal = showDownloadHistoryModal;
window.showProgressModal = showProgressModal;
window.updateProgressModal = updateProgressModal;
window.hideProgressModal = hideProgressModal;

// ── TOPLU RAPOR İNDİRME PANELİ (YENİLENMİŞ TEK PANEL) ────────────
async function downloadBulkReports() {
  const selectedList = allFiles.filter(f => selectedIds.has(f.id));
  if (selectedList.length === 0) {
    toast('Lütfen indirilecek en az bir rapor seçin.', 'warning');
    return;
  }

  const count = selectedList.length;
  let isZip = true;
  let useFolders = false;
  let versionBump = 1;

  // Akıllı ve dinamik tarih-saat formatlı ZIP adı
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const defaultZipName = `FrpOku_Raporlar_${dateStr}.zip`;
  let customZipName = defaultZipName;

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:1.15rem;">
      <!-- Bilgi & İstatistik Başlığı -->
      <div style="background:var(--bg-raised);padding:.85rem 1.15rem;border-radius:12px;border:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
        <div>
          <div style="font-weight:800;font-size:.95rem;color:var(--text-primary);">📦 Toplu İndirme Paketi</div>
          <div style="font-size:.76rem;color:var(--text-muted);margin-top:.2rem;">Toplam <strong>${count} adet</strong> rapor dışa aktarılacak.</div>
        </div>
        <div style="display:flex;align-items:center;gap:.4rem;">
          <span class="badge badge-purple" style="font-size:.78rem;font-weight:800;">${count} Rapor Seçili</span>
        </div>
      </div>

      <!-- Seçilen Tüm Raporların Canlı Önizleme Listesi -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem;">
          <label style="font-size:.78rem;font-weight:700;color:var(--text-secondary);">Seçilen Raporların Canlı Önizleme Listesi (${count}):</label>
          <span style="font-size:.72rem;color:var(--text-muted);">Yeni isimler anlık hesaplanır</span>
        </div>
        <div id="bulkPreviewList" style="max-height:160px;overflow-y:auto;background:var(--bg-surface);border:1px solid var(--border-light);border-radius:10px;padding:.4rem .6rem;display:flex;flex-direction:column;gap:.35rem;">
        </div>
      </div>

      <!-- Paketleme ve İndirme Türü -->
      <div>
        <label style="font-size:.78rem;font-weight:700;color:var(--text-secondary);margin-bottom:.4rem;display:block;">Paketleme / İndirme Türü:</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;">
          <label class="bulk-method-card active" data-method="zip" style="display:flex;align-items:flex-start;gap:.6rem;padding:.75rem .95rem;border-radius:12px;border:1.5px solid var(--accent);background:var(--bg-raised);cursor:pointer;">
            <input type="radio" name="bulkMethodRadio" value="zip" checked style="accent-color:var(--accent);margin-top:.2rem;" />
            <div>
              <div style="font-weight:800;font-size:.85rem;color:var(--text-primary);">📦 ZIP Arşivi Olarak Paketle</div>
              <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem;">Tüm raporlar tek bir sıkıştırılmış ZIP dosyasında iner.</div>
            </div>
          </label>
          <label class="bulk-method-card" data-method="separate" style="display:flex;align-items:flex-start;gap:.6rem;padding:.75rem .95rem;border-radius:12px;border:1.5px solid var(--border);background:var(--bg-surface);cursor:pointer;">
            <input type="radio" name="bulkMethodRadio" value="separate" style="accent-color:var(--accent);margin-top:.2rem;" />
            <div>
              <div style="font-weight:800;font-size:.85rem;color:var(--text-primary);">📄 Ayrı Ayrı İndir</div>
              <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem;">Her rapor ayrı bir dosya olarak tarayıcınızdan iner.</div>
            </div>
          </label>
        </div>
      </div>

      <!-- ZIP Ayarları (Özel ZIP Adı & Klasörleme) -->
      <div id="zipSettingsBox" style="background:var(--bg-raised);padding:1rem;border-radius:12px;border:1px solid var(--border-light);display:flex;flex-direction:column;gap:.75rem;">
        <div>
          <label style="font-size:.78rem;font-weight:700;color:var(--text-primary);display:block;margin-bottom:.3rem;">
            ZIP Arşiv Adı:
          </label>
          <input type="text" id="bulkZipNameInp" class="master-search-input" style="width:100%;font-family:var(--font);font-weight:700;" placeholder="${escHtml(defaultZipName)}" value="${escHtml(defaultZipName)}" />
          <div style="font-size:.71rem;color:var(--text-muted);margin-top:.25rem;">Boş bırakırsanız otomatik güncel tarih ve saat atanır.</div>
        </div>

        <label style="display:flex;align-items:center;gap:.6rem;cursor:pointer;font-size:.8rem;font-weight:700;color:var(--text-primary);padding-top:.3rem;border-top:1px solid var(--border-light);">
          <input type="checkbox" id="bulkFolderCb" style="accent-color:var(--accent);width:16px;height:16px;cursor:pointer;" />
          <span>📁 Kategorilere göre alt klasörler oluştur (Örn: <code>Muhasebe/rapor.frp</code>)</span>
        </label>
      </div>

      <!-- Versiyon Numarası Artırımı -->
      <div style="background:var(--bg-raised);padding:1rem;border-radius:12px;border:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;gap:.8rem;flex-wrap:wrap;">
        <div>
          <div style="font-weight:700;font-size:.82rem;color:var(--text-primary);">Tüm Raporların Versiyonunu Artır:</div>
          <div style="font-size:.72rem;color:var(--text-muted);">Örn: <code>rapor_v1.frp</code> ➔ <code>rapor_v2.frp</code></div>
        </div>
        <div style="display:flex;align-items:center;gap:.35rem;" id="bulkVersionBtns">
          <button type="button" class="btn btn-sm btn-ghost bv-btn" data-v="0" style="padding:3px 9px;font-size:.74rem;">Değiştirme (0)</button>
          <button type="button" class="btn btn-sm btn-primary bv-btn active" data-v="1" style="padding:3px 9px;font-size:.74rem;font-weight:800;">+1 Artır</button>
          <button type="button" class="btn btn-sm btn-ghost bv-btn" data-v="2" style="padding:3px 9px;font-size:.74rem;">+2</button>
          <button type="button" class="btn btn-sm btn-ghost bv-btn" data-v="5" style="padding:3px 9px;font-size:.74rem;">+5</button>
        </div>
      </div>
    </div>
  `;

  const confirmed = await showModal({
    title: `📦 Toplu Rapor İndirme (${count} Rapor)`,
    body: bodyHtml,
    confirmText: `💾 ${count} Raporu İndir`,
    cancelText: '✕ İptal',
    maxWidth: '680px',
    onOpen: (modalEl) => {
      const previewList = modalEl.querySelector('#bulkPreviewList');
      const zipSettingsBox = modalEl.querySelector('#zipSettingsBox');
      const zipNameInp = modalEl.querySelector('#bulkZipNameInp');
      const folderCb = modalEl.querySelector('#bulkFolderCb');
      const methodCards = modalEl.querySelectorAll('.bulk-method-card');
      const bvBtns = modalEl.querySelectorAll('.bv-btn');

      function renderPreview() {
        if (!previewList) return;
        previewList.innerHTML = selectedList.map((file, idx) => {
          let targetName = file.name;
          if (versionBump > 0 && typeof FrpStore.bumpVersionFilename === 'function') {
            targetName = FrpStore.bumpVersionFilename(targetName, versionBump);
          }
          const catStr = (useFolders && file.category) ? `📁 ${escHtml(file.category)}/` : '';
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;font-size:.75rem;padding:.32rem .55rem;background:var(--bg-raised);border-radius:6px;">
              <span style="font-weight:700;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px;">
                ${idx + 1}. ${escHtml(file.meta?.reportName || file.name)}
              </span>
              <span style="font-family:var(--font);color:var(--accent-bright);font-weight:600;white-space:nowrap;">
                ${catStr}${escHtml(targetName)}
              </span>
            </div>
          `;
        }).join('');
      }

      bvBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          bvBtns.forEach(b => {
            b.classList.remove('active', 'btn-primary');
            b.classList.add('btn-ghost');
          });
          btn.classList.add('active', 'btn-primary');
          btn.classList.remove('btn-ghost');
          versionBump = parseInt(btn.dataset.v, 10) || 0;
          renderPreview();
        });
      });

      folderCb?.addEventListener('change', () => {
        useFolders = folderCb.checked;
        renderPreview();
      });

      methodCards.forEach(card => {
        card.addEventListener('click', () => {
          methodCards.forEach(c => {
            c.classList.remove('active');
            c.style.borderColor = 'var(--border)';
            c.style.background = 'var(--bg-surface)';
          });
          card.classList.add('active');
          card.style.borderColor = 'var(--accent)';
          card.style.background = 'var(--bg-raised)';
          const radio = card.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;
          isZip = (card.dataset.method === 'zip');
          if (zipSettingsBox) zipSettingsBox.style.display = isZip ? 'flex' : 'none';
        });
      });

      renderPreview();
    },
    onConfirm: (modalEl) => {
      const zipNameInp = modalEl.querySelector('#bulkZipNameInp');
      let entered = (zipNameInp?.value || '').trim();
      if (entered) {
        if (!entered.toLowerCase().endsWith('.zip')) entered += '.zip';
        customZipName = entered;
      } else {
        customZipName = defaultZipName;
      }
      return true;
    }
  });

  if (!confirmed) return;

  showProgressModal('Toplu Raporlar Hazırlanıyor...', `${count} dosya işleniyor`, '📦');
  const errors = [];
  let successCount = 0;

  if (isZip) {
    const zip = new window.ZipWriter();
    for (let i = 0; i < selectedList.length; i++) {
      const file = selectedList[i];
      try {
        let fName = file.name;
        if (versionBump > 0 && typeof FrpStore.bumpVersionFilename === 'function') {
          fName = FrpStore.bumpVersionFilename(fName, versionBump);
        }
        if (useFolders && file.category) {
          fName = `${file.category.replace(/[/\\?%*:|"<>]/g, '_')}/${fName}`;
        }
        const xml = window.buildUpdatedFrpXml ? window.buildUpdatedFrpXml(file, null) : (file.rawXml || '');
        zip.addFile(fName, xml);
        successCount++;
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
      }
      updateProgressModal(i + 1, count, file.name);
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    if (successCount > 0) {
      updateProgressModal(count, count, 'ZIP Dosyası Paketleniyor...');
      await new Promise(r => setTimeout(r, 120));
      const zipBlob = zip.generateBlob();
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = customZipName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 150);

      if (typeof FrpStore.addDownloadHistory === 'function') {
        FrpStore.addDownloadHistory({
          reportId: 'bulk',
          reportName: `${successCount} Adet Rapor`,
          fileName: customZipName,
          format: 'zip',
          customVersion: versionBump > 0 ? `+${versionBump}` : ''
        });
      }

      if (window.FrpAudit) {
        window.FrpAudit.logAction({
          action: 'BULK_DOWNLOAD',
          target: customZipName,
          details: `${successCount} adet rapor ZIP arşivi olarak indirildi.`
        });
      }

      hideProgressModal();
      toast(`📦 ${successCount} rapor '${customZipName}' olarak indirildi!`, 'success');
    } else {
      hideProgressModal();
      toast('Hiçbir rapor paketlenemedi.', 'error');
    }
  } else {
    for (let i = 0; i < selectedList.length; i++) {
      const file = selectedList[i];
      try {
        let fName = file.name;
        if (versionBump > 0 && typeof FrpStore.bumpVersionFilename === 'function') {
          fName = FrpStore.bumpVersionFilename(fName, versionBump);
        }
        const xml = window.buildUpdatedFrpXml ? window.buildUpdatedFrpXml(file, null) : (file.rawXml || '');
        const blob = new Blob([xml], { type: 'application/octet-stream;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 150);
        successCount++;

        if (typeof FrpStore.addDownloadHistory === 'function') {
          FrpStore.addDownloadHistory({
            reportId: file.id,
            reportName: file.meta?.reportName || file.name,
            fileName: fName,
            format: 'frp',
            customVersion: versionBump > 0 ? `+${versionBump}` : ''
          });
        }
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
      }
      updateProgressModal(i + 1, count, file.name);
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    if (window.FrpAudit) {
      window.FrpAudit.logAction({
        action: 'BULK_DOWNLOAD',
        target: `${successCount} Dosya`,
        details: `${successCount} adet rapor ayrı ayrı indirildi.`
      });
    }

    hideProgressModal();
    toast(`📄 ${successCount} rapor ayrı ayrı indirildi!`, 'success');
  }

  if (errors.length > 0) {
    showModal({
      title: '⚠️ Bazı Dosyalar İndirilemedi',
      body: `<div style="font-size:.82rem;color:var(--red);margin-bottom:.5rem;"><strong>${successCount}/${count}</strong> dosya indirildi. Hata alan dosyalar:</div><div style="font-family:var(--mono);font-size:.78rem;background:var(--bg-raised);padding:.6rem;border-radius:6px;max-height:200px;overflow-y:auto;">${errors.map(e => escHtml(e)).join('<br>')}</div>`,
      confirmText: 'Anladım',
      cancelText: ''
    });
  }
}

window.downloadBulkReports = downloadBulkReports;

document.getElementById('btnDownloadSelected')?.addEventListener('click', downloadBulkReports);
document.getElementById('btnDownloadZipSelected')?.addEventListener('click', downloadBulkReports);

document.getElementById('btnExportAllSqls')?.addEventListener('click', async () => {
  const filename = 'tum_sorgular-1.sql';
  const ok = await showModal({
    title: '📦 Tüm SQL Sorgularını Dışa Aktar',
    body: 'Sistemdeki tüm raporlara ait SQL sorguları tek dosyada indirilecektir.',
    confirmText: 'İndir',
    cancelText: 'İptal'
  });
  if (!ok) return;

  const sqlContent = FrpStore.exportAllSqls();
  const blob = new Blob([sqlContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Tüm SQL sorguları indirildi. 📦', 'success');
});

document.getElementById('btnExportBackup')?.addEventListener('click', async () => {
  const lastFolder = localStorage.getItem('frp_last_save_path') || 'İndirilenler (Downloads)';

  const optionsHtml = `
    <div style="font-size:.85rem;color:var(--text-secondary);line-height:1.6;margin-bottom:1rem;">
      Sistemdeki tüm <strong>${allFiles.length} rapor</strong>, etiketler ve notlar tam yedek JSON olarak paketlenecektir.
    </div>
    <div style="background:var(--bg-raised);padding:.8rem;border-radius:8px;border:1px solid var(--border-light);margin-bottom:.8rem;">
      <div style="font-weight:700;font-size:.82rem;color:var(--accent);margin-bottom:.3rem;">📁 Varsayılan İndirme Konumu:</div>
      <div style="font-family:var(--mono);font-size:.78rem;color:var(--text-primary);">${escHtml(lastFolder)}</div>
    </div>
  `;

  const ok = await showModal({
    title: '💾 Sistem Veri Yedeği Oluştur & İndir',
    body: optionsHtml,
    confirmText: '💾 Yedeği İndir',
    cancelText: 'Vazgeç'
  });

  if (!ok) return;

  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: `frpoku_yedek_${new Date().toISOString().slice(0,10)}.json`,
        types: [{ description: 'JSON Veri Yedeği', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      const jsonStr = FrpStore.exportBackup();
      await writable.write(jsonStr);
      await writable.close();
      localStorage.setItem('frp_last_save_path', handle.name || lastFolder);
      toast('Veri yedeği seçilen konuma kaydedildi! 💾', 'success');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  showProgressModal('JSON Yedeği Oluşturuluyor...', 'Veriler paketleniyor', '💾');
  updateProgressModal(1, 1, 'Yedek JSON dosyası');
  await new Promise(r => setTimeout(r, 200));

  const jsonStr = FrpStore.exportBackup();
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frpoku_yedek_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  hideProgressModal();
  toast('Veri yedeği JSON dosyası olarak indirildi. 💾', 'success');
});

const fileInputBackup = document.getElementById('fileInputBackup');
document.getElementById('btnImportBackup')?.addEventListener('click', () => fileInputBackup?.click());

fileInputBackup?.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await readFileAsText(file);
    const count = FrpStore.importBackup(text);
    toast(`${count} adet rapor yedekten geri yüklendi! 🎉`, 'success');
    refreshAll();
  } catch (err) {
    toast('Yedek yükleme hatası: ' + err.message, 'error');
  }
  e.target.value = '';
});

async function showTransferGuide() {
  await showModal({
    title: '🖥️ Başka PC\'ye Taşıma Rehberi',
    body: `
      <div style="font-size:.85rem;line-height:1.75;">
        <p style="margin:0 0 .75rem;">FrpOku verileriniz <strong>tarayıcı deposunda</strong> saklanır (LocalStorage + IndexedDB). Başka bir bilgisayara taşımak için:</p>
        <ol style="margin:0;padding-left:1.4rem;">
          <li style="margin-bottom:.5rem;"><strong>Bu PC'de:</strong> Sağ üstteki <strong>💾 Yedekle</strong> butonuna tıklayın → JSON dosyası iner.</li>
          <li style="margin-bottom:.5rem;"><strong>Diğer PC'de:</strong> FrpOku klasörünü kopyalayın ve <code>index.html</code>'i açın.</li>
          <li style="margin-bottom:.5rem;"><strong>Diğer PC'de:</strong> <strong>📥 Yedek Yükle</strong> butonuyla indirdiğiniz JSON'u seçin.</li>
          <li>Tüm raporlarınız karşı tarafta görünecektir. ✅</li>
        </ol>
        <div style="margin-top:.85rem;padding:.6rem .8rem;background:var(--accent-light);border-radius:8px;border-left:3px solid var(--accent-bright);">
          <strong>ℹ️ Localhost gerekmez:</strong> FrpOku <code>file://</code> protokolüyle doğrudan çalışır, herhangi bir sunucu kurmanıza gerek yoktur.
        </div>
      </div>
    `,
    confirmText: '💾 Hemen Yedekle',
    cancelText: 'Kapat'
  }).then(ok => {
    if (ok) document.getElementById('btnExportBackup')?.click();
  });
}

window.showTransferGuide = showTransferGuide;