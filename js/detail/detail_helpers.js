function removeSelectionReplacePopover(tabId) {
  const existing = document.getElementById(tabId + '_replacePopover');
  if (existing) existing.remove();
}

function measureTextareaSelectionAnchor(textarea, selectionEnd) {
  const mirror = document.createElement('div');
  const style = window.getComputedStyle(textarea);
  const copiedStyles = [
    'boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'paddingTop', 'paddingRight',
    'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
    'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
    'lineHeight', 'tabSize', 'MozTabSize', 'textAlign', 'textTransform', 'textIndent', 'direction'
  ];

  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.left = '0';
  mirror.style.top = '0';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.overflow = 'hidden';

  copiedStyles.forEach(prop => {
    if (style[prop] != null) mirror.style[prop] = style[prop];
  });

  mirror.textContent = textarea.value.slice(0, selectionEnd);
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const anchor = {
    left: marker.offsetLeft,
    top: marker.offsetTop,
    height: marker.offsetHeight || parseFloat(style.lineHeight) || 18
  };

  mirror.remove();
  return anchor;
}

function showSelectionReplacePopover(tabId) {
  const editArea = document.getElementById(tabId + '_editarea');
  const editWrap = document.getElementById(tabId + '_editorwrap');
  if (!editArea || !editWrap || editArea.style.display === 'none') return;

  const start = editArea.selectionStart;
  const end = editArea.selectionEnd;

  if (start == null || end == null || start === end) {
    removeSelectionReplacePopover(tabId);
    return;
  }

  const selectedText = editArea.value.slice(start, end);
  const anchor = measureTextareaSelectionAnchor(editArea, end);

  removeSelectionReplacePopover(tabId);

  const popover = document.createElement('div');
  popover.className = 'code-replace-popover';
  popover.id = tabId + '_replacePopover';
  popover.innerHTML = `
    <div class="code-replace-head">
      <span>Seçili ifadeyi değiştir</span>
      <button type="button" class="code-replace-close" title="Kapat">×</button>
    </div>
    <div class="code-replace-selected">${esc(selectedText)}</div>
    <input type="text" class="code-replace-input" placeholder="Yeni ifade" />
    <div class="code-replace-actions">
      <button type="button" class="btn btn-sm btn-primary code-replace-apply">Değiştir</button>
      <button type="button" class="btn btn-sm code-replace-cancel">İptal</button>
    </div>
  `;

  const maxLeft = Math.max(12, editWrap.clientWidth - 360);
  const maxTop = Math.max(12, editWrap.clientHeight - 170);
  const left = anchor.left - editArea.scrollLeft + 18;
  const top = anchor.top - editArea.scrollTop - 6;
  popover.style.left = Math.min(Math.max(12, left), maxLeft) + 'px';
  popover.style.top = Math.min(Math.max(12, top), maxTop) + 'px';

  editWrap.appendChild(popover);

  const input = popover.querySelector('.code-replace-input');
  const applyBtn = popover.querySelector('.code-replace-apply');
  const cancelBtn = popover.querySelector('.code-replace-cancel');
  const closeBtn = popover.querySelector('.code-replace-close');

  const closePopover = () => removeSelectionReplacePopover(tabId);

  const applyReplace = () => {
    const replacement = input ? input.value : '';
    const currentText = editArea.value;
    const searchText = selectedText;
    const nextText = currentText.replaceAll ? currentText.replaceAll(searchText, replacement) : currentText.split(searchText).join(replacement);
    editArea.value = nextText;
    const firstMatchIndex = currentText.indexOf(searchText);
    const caretPos = firstMatchIndex >= 0 ? firstMatchIndex + replacement.length : start + replacement.length;
    editArea.focus();
    editArea.setSelectionRange(caretPos, caretPos);
    syncEditorBackdrop(tabId);
    hasUnsavedChanges = true;
    closePopover();
  };

  if (input) input.focus();
  if (applyBtn) applyBtn.addEventListener('click', applyReplace);
  if (cancelBtn) cancelBtn.addEventListener('click', closePopover);
  if (closeBtn) closeBtn.addEventListener('click', closePopover);

  popover.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePopover();
    if (e.key === 'Enter') applyReplace();
  });
}

function bindSelectionReplaceEvents(tabId) {
  const editArea = document.getElementById(tabId + '_editarea');
  if (!editArea || editArea._replaceBound) return;
  editArea._replaceBound = true;

  editArea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      showSelectionReplacePopover(tabId);
    }
  });

  editArea.addEventListener('scroll', () => {
    const popover = document.getElementById(tabId + '_replacePopover');
    if (popover) showSelectionReplacePopover(tabId);
  });
}

async function exportFrpOrSqlWithVersion(tabId, queryIndex) {
  if (!currentFile) return;

  const originalName = currentFile.meta?.reportName || currentFile.name;
  const baseName = currentFile.name.replace(/\.frp$/i, '');

  const match = baseName.match(/^(.*?)([-_])(\d+)$/);
  let prefix = baseName;
  let sep = '-';
  let currentVerNum = 1;
  if (match) {
    prefix = match[1];
    sep = match[2];
    currentVerNum = parseInt(match[3], 10) || 1;
  }

  const suggestedVerNum = currentVerNum + 1;
  const initialFrpName = `${prefix}${sep}${suggestedVerNum}.frp`;
  let userVersionVal = String(suggestedVerNum);

  const bodyHtml = `
    <div style="font-size:.85rem;line-height:1.6;margin-bottom:1rem;color:var(--text-secondary);">
      Mevcut dosya adı: <strong style="color:var(--text-primary);">${esc(originalName)}</strong><br>
      İndirmeden önce versiyon numarasını (<code>${sep}${currentVerNum}</code> kısmını) belirleyebilirsiniz:
    </div>
    <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:1rem;background:var(--bg-raised);padding:.75rem;border-radius:10px;border:1px solid var(--border-light);">
      <label style="font-weight:700;font-size:.82rem;color:var(--text-primary);white-space:nowrap;">Yeni Versiyon No:</label>
      <input type="text" id="inputVersionNum" class="tag-add-input" style="width:110px;font-weight:700;font-size:.9rem;text-align:center;color:var(--accent-bright);" value="${suggestedVerNum}" />
    </div>
    <div style="font-size:.82rem;background:rgba(59,130,246,.08);padding:.65rem .8rem;border-radius:8px;border:1px solid rgba(59,130,246,.2);margin-bottom:.5rem;">
      Oluşacak FRP Dosya Adı: <strong id="previewVersionedFilename" style="color:var(--accent-bright);">${esc(initialFrpName)}</strong>
    </div>
  `;

  const confirmed = await showModal({
    title: '📥 Rapor Versiyonu Güncelle & İndir',
    body: bodyHtml,
    confirmText: '💾 FRP Olarak İndir',
    cancelText: 'Vazgeç',
    onOpen: (modalEl) => {
      const inp = modalEl.querySelector('#inputVersionNum');
      const preview = modalEl.querySelector('#previewVersionedFilename');
      if (inp && preview) {
        inp.addEventListener('input', () => {
          const val = inp.value.trim();
          userVersionVal = val ? val : String(suggestedVerNum);
          preview.textContent = `${prefix}${sep}${userVersionVal}.frp`;
        });
        inp.select();
      }
    },
    onConfirm: (modalEl) => {
      const inp = modalEl.querySelector('#inputVersionNum');
      const val = inp ? inp.value.trim() : '';
      userVersionVal = val ? val : String(suggestedVerNum);
      return true;
    }
  });

  if (!confirmed) return;

  const inpVal = userVersionVal || String(suggestedVerNum);
  const finalFrpName = `${prefix}${sep}${inpVal}.frp`;

  try {
    const frpXml = window.buildUpdatedFrpXml ? window.buildUpdatedFrpXml(currentFile, inpVal) : (currentFile.rawXml || '');
    const blob = new Blob([frpXml], { type: 'application/octet-stream;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFrpName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);

    FrpStore.updateFileName(currentFile.id, finalFrpName);
    currentFile.name = finalFrpName;
    const pSub = document.getElementById('pageSubTitle');
    if (pSub) pSub.textContent = finalFrpName;

    showToast(`'${finalFrpName}' indirildi ve güncellendi. 📦`, 'success');
  } catch (err) {
    showToast('İndirme hatası: ' + err.message, 'error');
  }
}

async function exportSqlWithVersion(queryIndex) {
  if (!currentFile || !currentFile.queries || !currentFile.queries[queryIndex]) return;
  await exportFrpOrSqlWithVersion(null, queryIndex);
}

async function exportReportJson() {
  if (!currentFile) return;
  const reportTitle = currentFile.meta?.reportName || currentFile.name;

  const ok = typeof showModal === 'function'
    ? await showModal({
        title: '📄 Rapor JSON İndir',
        body: `<strong>${esc(reportTitle)}</strong> raporuna ait ham JSON verisini indirmek istediğinize emin misiniz?`,
        confirmText: 'Evet, İndir',
        cancelText: 'İptal'
      })
    : true;
  if (!ok) return;

  const baseName = currentFile.name.replace(/\.frp$/i, '');
  let fileName = `${baseName}_rapor.json`;

  const exportData = {
    app: 'FrpOku',
    version: 3,
    exportedAt: new Date().toISOString(),
    files: [currentFile],
    snippets: []
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast(`'${fileName}' indirildi. 📥`, 'success');
}

async function exportHtmlDoc() {
  if (!currentFile) return;
  const reportTitle = currentFile.meta?.reportName || currentFile.name;

  const ok = typeof showModal === 'function'
    ? await showModal({
        title: '🌐 HTML Dokümantasyon Üret',
        body: `<strong>${esc(reportTitle)}</strong> raporunun tam teknik dokümantasyonunu HTML dosyası olarak indirmek istiyor musunuz?`,
        confirmText: 'Evet, Üret ve İndir',
        cancelText: 'İptal'
      })
    : true;
  if (!ok) return;

  const baseName = currentFile.name.replace(/\.frp$/i, '');
  const fileName = `${baseName}_dokumantasyon.html`;

  const meta = currentFile.meta || {};
  const queries = currentFile.queries || [];

  const queriesHtml = queries.map((q, idx) => `
    <div class="card">
      <h3>🗄️ Sorgu ${idx + 1}: ${esc(q.name)}</h3>
      <pre class="code-block"><code>${esc(q.sql)}</code></pre>
    </div>
  `).join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <title>${esc(reportTitle)} — Rapor Dokümantasyonu</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; line-height: 1.6; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { color: #3b82f6; border-bottom: 2px solid #334155; padding-bottom: .5rem; }
    h2 { color: #60a5fa; margin-top: 1.5rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .meta-item { background: #0f172a; padding: .75rem; border-radius: 6px; border: 1px solid #334155; }
    .meta-label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; }
    .meta-val { font-size: 0.95rem; font-weight: bold; color: #f8fafc; word-break: break-all; }
    .code-block { background: #090d16; padding: 1rem; border-radius: 6px; overflow-x: auto; color: #38bdf8; font-family: monospace; font-size: 0.85rem; border: 1px solid #1e293b; white-space: pre-wrap; }
    @media print { body { background: #fff; color: #000; } .card, .meta-item { border-color: #ccc; background: #fff; } .code-block { background: #f5f5f5; color: #000; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>📋 ${esc(reportTitle)}</h1>
    <div class="card">
      <h2>Metadatalar</h2>
      <div class="meta-grid">
        <div class="meta-item"><div class="meta-label">Dosya Adı</div><div class="meta-val">${esc(currentFile.name)}</div></div>
        <div class="meta-item"><div class="meta-label">GUID</div><div class="meta-val">${esc(meta.guid || '—')}</div></div>
        <div class="meta-item"><div class="meta-label">Yazar / Kodlayan</div><div class="meta-val">${esc(meta.author || '—')}</div></div>
        <div class="meta-item"><div class="meta-label">Kategori</div><div class="meta-val">${esc(currentFile.category || '—')}</div></div>
        ${meta.description ? `<div class="meta-item" style="grid-column:1/-1;"><div class="meta-label">Açıklama</div><div class="meta-val">${esc(meta.description)}</div></div>` : ''}
      </div>
    </div>

    ${currentFile.userNote && currentFile.userNote.trim() ? `
    <div class="card" style="border-left:4px solid #3b82f6;background:rgba(59,130,246,0.06);">
      <h2 style="color:#60a5fa;margin-top:0;">📝 Kullanıcı Notu</h2>
      <div style="font-size:0.92rem;color:#e2e8f0;white-space:pre-wrap;line-height:1.6;">${esc(currentFile.userNote.trim())}</div>
    </div>` : ''}

    ${queries.length > 0 ? `<h2>🗄️ SQL Sorguları (${queries.length} Adet)</h2>${queriesHtml}` : ''}

    ${currentFile.pascalScript ? `
    <div class="card">
      <h2>📜 PascalScript</h2>
      <pre class="code-block"><code>${esc(currentFile.pascalScript)}</code></pre>
    </div>` : ''}
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast(`'${fileName}' HTML dokümanı başarıyla üretildi. 🌐`, 'success');
}

async function exportSqlQueryModal(queryIndex) {
  if (!currentFile || !currentFile.queries || !currentFile.queries[queryIndex]) return;
  const q = currentFile.queries[queryIndex];

  let chosenFormat = 'sql';

  const body = `
    <div style="font-size:.9rem;margin-bottom:1rem;color:var(--text-primary);">
      <strong>${esc(q.name)}</strong> sorgusunu hangi formatta dışa aktarmak istersiniz?
    </div>
    <div style="display:flex;gap:1.5rem;margin-bottom:.5rem;">
      <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;">
        <input type="radio" name="queryFormatChoice" value="sql" checked />
        <strong>.SQL</strong> (Veritabanı Dosyası)
      </label>
      <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;">
        <input type="radio" name="queryFormatChoice" value="txt" />
        <strong>.TXT</strong> (Metin Dosyası)
      </label>
    </div>
  `;

  const ok = typeof showModal === 'function'
    ? await showModal({
        title: `📤 ${esc(q.name)} Sorgusunu İndir`,
        body: body,
        confirmText: 'İndir',
        cancelText: 'İptal',
        onConfirm: (modalEl) => {
          const selectedEl = modalEl.querySelector('input[name="queryFormatChoice"]:checked');
          if (selectedEl) chosenFormat = selectedEl.value;
          return true;
        }
      })
    : true;

  if (!ok) return;

  try {
    const fileName = `${q.name}.${chosenFormat}`;
    const blob = new Blob([q.sql || ''], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);

    showToast(`'${fileName}' başarıyla indirildi. 📥`, 'success');
  } catch (err) {
    showToast('İndirme hatası: ' + err.message, 'error');
  }
}

window.exportHtmlDoc = exportHtmlDoc;
window.exportSqlQueryModal = exportSqlQueryModal;