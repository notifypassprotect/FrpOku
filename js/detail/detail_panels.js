function copyGuidText(guid) {
  if (!guid) return;
  if (typeof copyTextToClipboard === 'function') {
    copyTextToClipboard(guid).then(ok => {
      if (ok) showToast('GUID panoya kopyalandı! 📋', 'success');
      else showToast('Kopyalama başarısız oldu.', 'error');
    });
  } else {
    navigator.clipboard?.writeText(guid).then(() => {
      showToast('GUID panoya kopyalandı! 📋', 'success');
    });
  }
}

async function openParamInjector(queryIndex) {
  if (!currentFile || !currentFile.queries || !currentFile.queries[queryIndex]) return;
  const q = currentFile.queries[queryIndex];
  const rawSql = q.sql;
  const queryName = q.name;

  function isDateParamName(p) {
    if (typeof detectParamType === 'function') {
      return detectParamType(rawSql, p) === 'tarih';
    }
    const u = (p || '').replace(/^:/, '').toUpperCase();
    return u === 'T1' || u === 'T2' || u === 'T3' || u === 'T4' ||
      u.includes('TARIH') || u.includes('DATE') ||
      u === 'BASLANGIC' || u === 'BITIS' ||
      u.includes('BASTARIH') || u.includes('BITTARIH') || u.includes('BAS_TARIH') || u.includes('BIT_TARIH');
  }

  const params = extractParams(rawSql);
  const inputsHtml = params.length > 0 ? params.map(p => {
    const isDate = isDateParamName(p);
    return `
      <div style="margin-bottom:.6rem;display:flex;align-items:center;gap:.6rem;background:var(--bg-raised);padding:.5rem .75rem;border-radius:8px;border:1px solid var(--border-light);">
        <label style="font-family:var(--mono);font-size:.84rem;font-weight:700;color:var(--orange);min-width:110px;">${esc(p)} =</label>
        ${isDate ? `
          <input type="date" min="1900-01-01" max="2100-12-31" class="tag-add-input param-input-val" data-param="${esc(p)}" data-is-date="true" style="padding:.3rem .6rem;border-radius:8px;border:1.5px solid var(--border);color:var(--text-primary);background:var(--bg-surface);" />
          <span style="font-size:.72rem;color:var(--text-muted);font-weight:600;">📅 Takvim Seçimi ('DD.MM.YYYY')</span>
        ` : `
          <input type="text" class="tag-add-input param-input-val" data-param="${esc(p)}" placeholder="Değer (ör: 100 veya 'METIN')" style="flex:1;padding:.3rem .6rem;border-radius:8px;border:1.5px solid var(--border);" />
        `}
      </div>
    `;
  }).join('') : '<div style="font-size:.82rem;color:var(--text-muted);margin-bottom:.5rem;">Bu sorguda <code>:param</code> bulunmamaktadır. Sorguyu aşağıdan doğrudan kopyalayabilir veya direkt test edebilirsiniz:</div>';

  const body = `
    <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:.75rem;">
      SQL sorgusundaki parametrelere test değerleri girerek DB araçlarında direkt çalıştırılabilir SQL elde edin:
    </div>
    ${inputsHtml}
    <div style="margin-top:.75rem;">
      <label style="font-size:.75rem;font-weight:700;color:var(--text-muted);">Çalıştırılabilir Ham SQL:</label>
      <textarea id="paramResultSql" class="note-textarea" style="height:150px;font-family:var(--mono);font-size:.78rem;" readonly>${esc(rawSql)}</textarea>
    </div>
    <button class="btn btn-sm btn-primary" id="btnCopyInjectedSql" style="margin-top:.6rem;">📋 Ham SQL'i Kopyala</button>
  `;

  showModal({
    title: `⚡ ${esc(queryName)} — SQL Parametre Injector / Testi`,
    body,
    confirmText: 'Kapat',
    maxWidth: '680px'
  });

  setTimeout(() => {
    const modalEl = document.querySelector('.modal');
    if (!modalEl) return;
    const inputs = modalEl.querySelectorAll('.param-input-val');
    const resultArea = modalEl.querySelector('#paramResultSql');

    function updateInjected() {
      let finalSql = rawSql;
      inputs.forEach(inp => {
        const p = inp.dataset.param;
        const val = inp.value.trim();
        if (val) {
          let injectedVal = val;
          if (inp.dataset.isDate === 'true') {
            if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
              const parts = val.split('-');
              const yr = parseInt(parts[0], 10);
              if (yr >= 1900 && yr <= 2100) {
                injectedVal = `'${parts[2]}.${parts[1]}.${parts[0]}'`;
              } else {
                injectedVal = `'GECERSIZ_YIL'`;
              }
            } else if (!val.startsWith("'") && !val.endsWith("'")) {
              injectedVal = `'${val}'`;
            }
          }
          const safeP = typeof escapeRegex === 'function' ? escapeRegex(p) : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const rx = new RegExp(safeP + '(?=[^a-zA-Z0-9_]|$)', 'g');
          finalSql = finalSql.replace(rx, injectedVal);
        }
      });
      if (resultArea) resultArea.value = finalSql;
    }

    inputs.forEach(inp => inp.addEventListener('input', updateInjected));
    inputs.forEach(inp => inp.addEventListener('change', updateInjected));

    const btnCopy = modalEl.querySelector('#btnCopyInjectedSql');
    if (btnCopy) {
      btnCopy.addEventListener('click', function () {
        if (resultArea) {
          navigator.clipboard.writeText(resultArea.value).then(() => {
            this.textContent = '✅ Kopyalandı!';
            setTimeout(() => this.textContent = '📋 Ham SQL\'i Kopyala', 2000);
            showToast('Ham SQL panoya kopyalandı.', 'success');
          });
        }
      });
    }
  }, 100);
}

function makeEditableMetaRow(label, field, currentValue, fileId) {
  const safeVal = esc(currentValue || '');
  return `
    <div class="meta-row meta-editable" data-field="${field}" data-file-id="${fileId}">
      <div class="meta-label">${esc(label)}</div>
      <div class="meta-value-wrap">
        <span class="meta-value meta-val-display" title="Düzenlemek için tıklayın">${safeVal || '<span style="color:var(--text-muted);font-style:italic;">—</span>'}</span>
        <input type="text" class="meta-inline-input" value="${safeVal}" style="display:none;" />
        <div class="meta-edit-actions" style="display:none;">
          <button class="btn-meta-save" title="Kaydet">✓</button>
          <button class="btn-meta-cancel" title="İptal">✕</button>
        </div>
      </div>
    </div>`;
}

function activateMetaEdit(rowEl) {
  const display = rowEl.querySelector('.meta-val-display');
  const input = rowEl.querySelector('.meta-inline-input');
  const actions = rowEl.querySelector('.meta-edit-actions');
  if (!display || !input || !actions) return;
  display.style.display = 'none';
  input.style.display = 'block';
  actions.style.display = 'flex';
  input.focus();
  input.select();
}

function deactivateMetaEdit(rowEl, newDisplay) {
  const display = rowEl.querySelector('.meta-val-display');
  const input = rowEl.querySelector('.meta-inline-input');
  const actions = rowEl.querySelector('.meta-edit-actions');
  if (!display || !input || !actions) return;
  if (newDisplay !== undefined) display.innerHTML = newDisplay || '<span style="color:var(--text-muted);font-style:italic;">—</span>';
  display.style.display = '';
  input.style.display = 'none';
  actions.style.display = 'none';
}

function bindMetaEditEvents(container, fileId) {
  container.querySelectorAll('.meta-editable').forEach(rowEl => {
    const field = rowEl.dataset.field;
    const display = rowEl.querySelector('.meta-val-display');
    const input = rowEl.querySelector('.meta-inline-input');
    const saveBtn = rowEl.querySelector('.btn-meta-save');
    const cancelBtn = rowEl.querySelector('.btn-meta-cancel');

    if (display) display.addEventListener('click', () => activateMetaEdit(rowEl));

    function saveEdit() {
      const newVal = input.value.trim();
      FrpStore.updateMeta(fileId, { [field]: newVal });
      currentFile = FrpStore.getById(fileId);
      deactivateMetaEdit(rowEl, esc(newVal));
      showToast(`${field === 'reportName' ? 'Rapor adı' : field === 'author' ? 'Yazar' : 'Açıklama'} güncellendi. ✏️`, 'success');
      if (field === 'reportName') {
        const pTitle = document.getElementById('pageTitle');
        if (pTitle) pTitle.textContent = newVal || currentFile.name;
        document.title = `FrpOku — ${newVal || currentFile.name}`;
      }
    }

    if (saveBtn) saveBtn.addEventListener('click', saveEdit);
    if (cancelBtn) cancelBtn.addEventListener('click', () => deactivateMetaEdit(rowEl));
    if (input) input.addEventListener('keydown', e => {
      if (e.key === 'Enter') saveEdit();
      if (e.key === 'Escape') deactivateMetaEdit(rowEl);
    });
  });
}

function normalizeTrText(str) {
  return String(str || '')
    .replace(/İ/g, 'i').replace(/I/g, 'ı').replace(/ı/g, 'i')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c')
    .replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ş/g, 's').replace(/ş/g, 's')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u')
    .toLowerCase();
}

function filterCheatSheetCards(overlay, searchInputId, cardClass, groupClass) {
  const inp = overlay.querySelector('#' + searchInputId);
  const groups = overlay.querySelectorAll('.' + groupClass);
  const countEl = overlay.querySelector('.cheat-search-count');
  if (!inp) return;

  function doFilter() {
    const q = normalizeTrText(inp.value);
    let shown = 0;
    groups.forEach(group => {
      let groupVisible = false;
      group.querySelectorAll('.' + cardClass).forEach(card => {
        const txt = normalizeTrText((card.dataset.rawTitle || '') + ' ' + (card.dataset.rawCode || '') + ' ' + card.textContent);
        const visible = !q || txt.includes(q);
        card.style.display = visible ? '' : 'none';
        if (visible) {
          shown++;
          groupVisible = true;
        }
      });
      group.style.display = groupVisible ? '' : 'none';
    });
    if (countEl) countEl.textContent = q ? `${shown} sonuç` : 'Arama bekleniyor';
  }

  inp.focus();
  inp.addEventListener('input', doFilter);
  doFilter();
}

function metaRow(label, value, accent = false) {
  return `<div class="meta-row">
    <div class="meta-label">${esc(label)}</div>
    <div class="meta-value ${accent ? 'accent' : ''}">${esc(value)}</div>
  </div>`;
}

function renderSidebar(file) {
  const sb = document.getElementById('sidebarBody');
  if (!sb || !file) return;

  const meta = file.meta || {};
  const queries = file.queries || [];
  const tags = file.tags || [];
  const datasets = Array.isArray(file.datasets) ? file.datasets : [];
  const allParams = new Set();
  queries.forEach(q => extractParams(q.sql).forEach(p => allParams.add(p)));

  const paramPillsHtml = [...allParams].map(p => {
    const type = detectParamType(queries.map(q => q.sql).join(' '), p);
    return `<span class="param-pill" title="Tahmini tip: ${type}">${esc(p)} <small style="opacity:.75">(${type})</small></span>`;
  }).join('');

  const tagsList = tags.map(t => `
    <span class="tag-pill">
      🏷️ ${esc(t)}
      <span class="tag-pill-remove" onclick="removeTagFromDetail('${esc(t)}')">×</span>
    </span>
  `).join('');

  sb.innerHTML = `
    <div class="meta-card">
      ${makeEditableMetaRow('Rapor Adı', 'reportName', meta.reportName, file.id)}
      ${metaRow('Versiyon', (meta.version || '') + (meta.versionBuild ? ' (Build ' + meta.versionBuild + ')' : ''))}
      ${metaRow('Script Dili', meta.scriptLang || '—')}
      <div class="meta-row">
        <div class="meta-label">GUID</div>
        <div class="meta-value" style="font-family:var(--mono);font-size:.68rem;display:flex;align-items:center;justify-content:space-between;gap:.3rem;">
          <span style="overflow:hidden;text-overflow:ellipsis;" title="${esc(meta.guid || '—')}">${esc(meta.guid || '—')}</span>
          ${meta.guid ? `<button class="btn btn-sm" style="padding:.1rem .35rem;font-size:.65rem;" onclick="copyGuidText('${esc(meta.guid)}')">📋</button>` : ''}
        </div>
      </div>
      ${metaRow('Dosya Boyutu', file.sizeBytes > 1024 ? Math.round(file.sizeBytes / 1024) + ' KB' : file.sizeBytes + ' B')}
    </div>

    <div class="meta-card">
      <div class="meta-label">🏷️ Etiketler</div>
      <div class="tag-list" style="margin-top:.3rem;">${tagsList || '<span style="color:var(--text-muted);font-size:.75rem;">Etiket yok</span>'}</div>
      <div class="tag-add-wrap">
        <input type="text" class="tag-add-input" id="inputNewTag" placeholder="Yeni etiket..." />
        <button class="btn btn-sm" id="btnAddTag">Ekle</button>
      </div>
    </div>

    <div class="meta-card meta-editable-area">
      <div class="meta-label">📝 Açıklama</div>
      <div class="meta-value-wrap" data-field="description" data-file-id="${file.id}" style="margin-top:.3rem;">
        <div class="meta-desc-display" style="font-size:.78rem;line-height:1.5;color:var(--text-secondary);cursor:pointer;min-height:1.5em;word-break:break-all;overflow-wrap:anywhere;white-space:pre-wrap;" title="Düzenlemek için tıklayın">${esc(meta.description || '') || '<span style="color:var(--text-muted);font-style:italic;">Açıklama yok — tıklayarak ekle</span>'}</div>
        <textarea class="note-textarea" id="descEditArea" style="display:none;min-height:60px;" placeholder="Açıklama girin...">${esc(meta.description || '')}</textarea>
        <div class="desc-edit-actions" style="display:none;gap:.35rem;margin-top:.3rem;">
          <button class="btn-save-note" id="btnSaveDesc">💾 Kaydet</button>
          <button class="btn btn-sm" id="btnCancelDesc">İptal</button>
        </div>
      </div>
    </div>

    ${allParams.size > 0 ? `
    <div class="meta-card">
      <div class="meta-label">SQL Parametreleri</div>
      <div class="param-list">${paramPillsHtml}</div>
    </div>` : ''}

    <div class="meta-card">
      <div class="meta-label">Dataset'ler</div>
      <div class="ds-list">${datasets.map(d => `<span class="ds-pill">${esc(d)}</span>`).join('') || '<span style="color:var(--text-muted);font-size:.75rem;">—</span>'}</div>
    </div>

    <div class="meta-card">
      <div class="meta-label">SQL Sorguları</div>
      ${queries.length > 0 ? queries.map((q, i) => {
    const params = extractParams(q.sql);
    const paramLabel = params.length ? `${params.length} param` : 'Param yok';
    return `
          <details class="sql-accordion">
            <summary>${esc(q.name)} <span class="query-meta">${countLines(q.sql)} satır · ${esc(paramLabel)}</span></summary>
            <pre class="sql-preview">${esc(q.sql)}</pre>
          </details>
        `;
  }).join('') : '<span style="color:var(--text-muted);font-size:.75rem;">Sorgu bulunamadı.</span>'}
    </div>

    <div class="note-area">
      <div class="meta-label">📝 Kullanıcı Notu</div>
      <textarea class="note-textarea" id="noteTextarea" placeholder="Bu rapora not ekleyin...">${esc(file.userNote || '')}</textarea>
      <button class="btn-save-note" id="btnSaveNote">💾 Kaydet</button>
    </div>

    <div class="meta-card">
      <div class="meta-label">Dışa Aktar & Araçlar</div>
      <div class="export-btns">
        ${queries.map((q, i) => `
          <button class="btn-export" onclick="exportSqlQueryModal(${i})">
            📤 ${esc(q.name)} Sorgusunu İndir (.sql / .txt)
          </button>`).join('')}
        <button class="btn-export" onclick="exportReportJson()">📥 Rapor JSON İndir</button>
        <button class="btn-export" onclick="exportHtmlDoc()">🌐 HTML Dokümantasyon</button>
      </div>
    </div>

    ${file.pascalScript ? `
    <div class="meta-card">
      <div class="meta-label">🌲 PascalScript Fonksiyon Ağacı</div>
      <div id="pascalOutlineContainer" style="margin-top:.4rem;"></div>
    </div>` : ''}

    <div class="meta-card">
      ${metaRow('Pascal Script', file.pascalScript ? countLines(file.pascalScript) + ' satır' : 'Yok')}
      ${metaRow('SQL Sorgusu', queries.length + ' adet')}
      ${metaRow('Yüklenme', new Date(file.loadedAt).toLocaleString('tr-TR'))}
    </div>

    ${Array.isArray(file.editHistory) && file.editHistory.length > 0 ? `
    <div class="meta-card">
      <div class="meta-label">📋 Düzenleme Geçmişi</div>
      <div class="audit-log">
        ${[...file.editHistory].reverse().slice(0, 10).map(h => `
          <div class="audit-row">
            <span class="audit-field">${esc(h.field)}</span>
            <span class="audit-time">${new Date(h.editedAt).toLocaleString('tr-TR')}</span>
          </div>`).join('')}
      </div>
    </div>` : ''}

  `;

  bindMetaEditEvents(sb, file.id);

  const descDisplay = sb.querySelector('.meta-desc-display');
  const descArea = sb.querySelector('#descEditArea');
  const descActions = sb.querySelector('.desc-edit-actions');
  const btnSaveDesc = sb.querySelector('#btnSaveDesc');
  const btnCancelDesc = sb.querySelector('#btnCancelDesc');

  if (descDisplay && descArea) {
    descDisplay.addEventListener('click', () => {
      descDisplay.style.display = 'none';
      descArea.style.display = 'block';
      if (descActions) descActions.style.display = 'flex';
      descArea.focus();
    });
  }
  if (btnSaveDesc) {
    btnSaveDesc.addEventListener('click', () => {
      const newDesc = descArea ? descArea.value.trim() : '';
      FrpStore.updateMeta(file.id, { description: newDesc });
      currentFile = FrpStore.getById(file.id);
      if (descDisplay) {
        descDisplay.innerHTML = newDesc ? esc(newDesc) : '<span style="color:var(--text-muted);font-style:italic;">Açıklama yok — tıklayarak ekle</span>';
        descDisplay.style.display = '';
      }
      if (descArea) descArea.style.display = 'none';
      if (descActions) descActions.style.display = 'none';
      showToast('Açıklama güncellendi. ✏️', 'success');
    });
  }
  if (btnCancelDesc) {
    btnCancelDesc.addEventListener('click', () => {
      if (descDisplay) descDisplay.style.display = '';
      if (descArea) descArea.style.display = 'none';
      if (descActions) descActions.style.display = 'none';
    });
  }

  const btnAddTag = document.getElementById('btnAddTag');
  if (btnAddTag) {
    btnAddTag.addEventListener('click', () => {
      const inp = document.getElementById('inputNewTag');
      const val = inp ? inp.value.trim() : '';
      if (val) {
        FrpStore.addTag(file.id, val);
        currentFile = FrpStore.getById(file.id);
        renderSidebar(currentFile);
        showToast(`'${val}' etiketi eklendi.`, 'success');
      }
    });
  }

  const btnSaveNote = document.getElementById('btnSaveNote');
  if (btnSaveNote) {
    btnSaveNote.addEventListener('click', function () {
      const noteInp = document.getElementById('noteTextarea');
      const note = noteInp ? noteInp.value : '';
      FrpStore.updateNote(file.id, note);
      this.textContent = '✅ Kaydedildi';
      this.classList.add('saved');
      setTimeout(() => { this.textContent = '💾 Kaydet'; this.classList.remove('saved'); }, 2000);
      showToast('Not kaydedildi.', 'success');
    });
  }

  const outlineContainer = sb.querySelector('#pascalOutlineContainer');
  if (outlineContainer && file.pascalScript && window.PascalOutline) {
    const data = PascalOutline.parseOutline(file.pascalScript);
    PascalOutline.renderOutlineTree(outlineContainer, data, (lineNum) => {
      activateTab('tab_pascal');
      setTimeout(() => {
        const panel = document.getElementById('tab_pascal_panel');
        if (panel) {
          const lines = panel.querySelectorAll('.code-line');
          if (lines[lineNum - 1]) {
            lines[lineNum - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
            lines[lineNum - 1].style.background = 'rgba(59,130,246,0.25)';
            setTimeout(() => { lines[lineNum - 1].style.background = ''; }, 2000);
          }
        }
      }, 100);
    });
  }
}

function removeTagFromDetail(tag) {
  if (!currentFile) return;
  FrpStore.removeTag(currentFile.id, tag);
  currentFile = FrpStore.getById(currentFile.id);
  renderSidebar(currentFile);
  showToast(`'${tag}' etiketi çıkarıldı.`, 'info');
}


