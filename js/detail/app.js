// ============================================================
//  app.js — Detay Sayfası (detail.html) Mantığı (Gelişmiş v6)
//  Diziler için Güvenli Varsayılanlar, Hatasız Detay Sayfası
// ============================================================

let currentFontSize = 13;
const FONT_MIN = 5, FONT_MAX = 60;
let activeTabs = [];
let currentFile = null;
let hasUnsavedChanges = false;

let matchElements = [];
let currentMatchIdx = -1;

const btnThemeToggle = document.getElementById('btnThemeToggle');

function updateThemeBtn() {
  const cur = FrpStore.getTheme();
  if (btnThemeToggle) {
    btnThemeToggle.textContent = cur === 'dark' ? '☀️ Aydınlık Mod' : '🌙 Koyu Mod';
  }
  if (Array.isArray(activeTabs)) {
    activeTabs.forEach(t => syncEditorBackdrop(t.id));
  }
}

if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', () => {
    const cur = FrpStore.getTheme();
    const next = cur === 'dark' ? 'light' : 'dark';
    FrpStore.setTheme(next);
    updateThemeBtn();
  });
}

updateThemeBtn();

// Yazı Boyutu Kontrolleri
const fontDec = document.getElementById('fontDec');
const fontInc = document.getElementById('fontInc');
const fontSizeVal = document.getElementById('fontSizeVal');

function updateFontSize(size) {
  currentFontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, size));
  document.documentElement.style.setProperty('--code-size', currentFontSize + 'px');
  if (fontSizeVal) fontSizeVal.textContent = currentFontSize + 'px';
  if (Array.isArray(activeTabs)) {
    activeTabs.forEach(t => syncEditorBackdrop(t.id));
  }
}

if (fontDec) fontDec.addEventListener('click', () => updateFontSize(currentFontSize - 1));
if (fontInc) fontInc.addEventListener('click', () => updateFontSize(currentFontSize + 1));

const btnPrint = document.getElementById('btnPrintDoc');
if (btnPrint) btnPrint.addEventListener('click', () => {
  let printHeader = document.getElementById('printHeader');
  if (!printHeader) {
    printHeader = document.createElement('div');
    printHeader.id = 'printHeader';
    printHeader.className = 'print-header';
    document.body.prepend(printHeader);
  }

  const reportName = currentFile?.meta?.reportName || currentFile?.name || 'Rapor Detayı';
  const activeTabObj = activeTabs.find(t => document.getElementById(t.id + '_panel')?.classList.contains('active'));
  const sectionTitle = activeTabObj ? activeTabObj.label : 'Tüm Bölümler';

  printHeader.innerHTML = `
    <div style="font-size:1.3rem;font-weight:800;color:#000;">${esc(reportName)}</div>
    <div style="font-size:.85rem;color:#444;margin-top:.2rem;">
      Dosya: ${esc(currentFile?.name || '')} · Görünüm: ${esc(sectionTitle)} · Tarih: ${new Date().toLocaleString('tr-TR')}
    </div>
  `;

  if (!activeTabObj) {
    document.body.classList.add('print-all-tabs');
  } else {
    document.body.classList.remove('print-all-tabs');
  }

  window.print();
});

const btnBack = document.getElementById('btnBack');
if (btnBack) {
  btnBack.addEventListener('click', () => {
    window.location.href = 'index.html';
  });
}

// ── Sidebar Render ─────────────────────────────────────────
function renderSidebar(file) {
  const sb = document.getElementById('sidebarBody');
  if (!sb) return;

  const favBtn = document.getElementById('btnFavDetail');
  if (favBtn) favBtn.classList.toggle('active', !!file.isFavorite);
  const pinBtn = document.getElementById('btnPinDetail');
  if (pinBtn) pinBtn.style.opacity = file.isPinned ? '1' : '0.4';

  const queries = Array.isArray(file.queries) ? file.queries : [];
  const datasets = Array.isArray(file.datasets) ? file.datasets : [];
  const tags = Array.isArray(file.tags) ? file.tags : [];
  const meta = file.meta || {};

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



  // Meta inline edit event binding
  bindMetaEditEvents(sb, file.id);

  // Açıklama inline edit
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

  // PascalScript Outline Ağacını Çiz
  const outlineContainer = sb.querySelector('#pascalOutlineContainer');
  if (outlineContainer && file.pascalScript && window.PascalOutline) {
    const data = PascalOutline.parseOutline(file.pascalScript);
    PascalOutline.renderOutlineTree(outlineContainer, data, (lineNum) => {
      // PascalScript sekmesini aktif et ve o satıra kaydır
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

const favDetailBtn = document.getElementById('btnFavDetail');
if (favDetailBtn) {
  favDetailBtn.addEventListener('click', () => {
    if (!currentFile) return;
    const isFav = FrpStore.toggleFavorite(currentFile.id);
    currentFile = FrpStore.getById(currentFile.id);
    favDetailBtn.classList.toggle('active', isFav);
    showToast(isFav ? 'Favorilere eklendi ⭐' : 'Favorilerden çıkarıldı', 'info');
  });
}

const pinDetailBtn = document.getElementById('btnPinDetail');
if (pinDetailBtn) {
  pinDetailBtn.addEventListener('click', () => {
    if (!currentFile) return;
    const isPinned = FrpStore.togglePin(currentFile.id);
    currentFile = FrpStore.getById(currentFile.id);
    pinDetailBtn.style.opacity = isPinned ? '1' : '0.4';
    showToast(isPinned ? 'Rapor üste sabitlendi 📌' : 'Sabitleme kaldırıldı', 'info');
  });
}

function metaRow(label, value, accent = false) {
  return `<div class="meta-row">
    <div class="meta-label">${esc(label)}</div>
    <div class="meta-value ${accent ? 'accent' : ''}">${esc(value)}</div>
  </div>`;
}

function buildLineTable(rawCode, highlightFn, errorLineSet) {
  const lines = (rawCode || '').split('\n');
  const digits = String(lines.length).length;
  let html = '<div class="code-table">';
  lines.forEach((line, i) => {
    const lineNum = i + 1;
    const isError = errorLineSet && errorLineSet.has(lineNum);
    html += `<div class="code-line ${isError ? 'syntax-error-line' : ''}" data-line="${lineNum}">` +
      `<span class="line-num ${isError ? 'err-num' : ''}">${String(lineNum).padStart(digits, ' ')}</span>` +
      `<span class="line-src">${highlightFn(line)}</span>` +
      `</div>`;
  });
  html += '</div>';
  return html;
}

function addTab(cfg) {
  const tabBar = document.getElementById('tabBar');
  const panels = document.getElementById('panels');
  if (!tabBar || !panels) return;

  const btn = document.createElement('button');
  btn.className = 'tab' + (cfg.type === 'sql' ? ' sql-tab' : '');
  btn.id = cfg.id + '_btn';
  btn.innerHTML = `${esc(cfg.label)} <span class="tab-badge">${esc(cfg.badge)}</span>`;
  btn.addEventListener('click', () => activateTab(cfg.id));
  tabBar.appendChild(btn);

  const panel = document.createElement('div');
  panel.className = 'code-panel';
  panel.id = cfg.id + '_panel';

  if (cfg.isDesigner) {
    panel.innerHTML = `<div id="${cfg.id}_designer_wrap" style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;height:100%;"></div>`;
    panels.appendChild(panel);
    activeTabs.push(cfg);
    setTimeout(() => {
      const wrap = document.getElementById(`${cfg.id}_designer_wrap`);
      if (wrap && window.FastReportDesigner && currentFile) {
        window.FastReportDesigner.render(currentFile, wrap);
      }
    }, 50);
    return;
  }

  if (cfg.isTree) {
    panel.innerHTML = `
      <div class="code-toolbar">
        <div class="code-toolbar-left">
          <span class="lang-badge lang-tree">Eleman Ağacı</span>
          <span class="line-count">${cfg.badge}</span>
        </div>
      </div>
      <div class="code-scroll">${cfg.treeHtml}</div>
    `;
  } else {
    const codeHtml = buildLineTable(cfg.rawCode, cfg.highlightFn);

    // Edit modu için benzersiz ID'ler
    const editAreaId = cfg.id + '_editarea';
    const editToolId = cfg.id + '_edittool';
    const viewScrollId = cfg.id + '_viewscroll';

    const sqlComments = cfg.type === 'sql' ? extractSqlCommentsList(cfg.rawCode) : [];
    const commentsNoticeHtml = sqlComments.length > 0 ? `
      <div class="sql-comments-notice" style="padding:.45rem .9rem;background:var(--bg-raised);border-bottom:1px solid var(--border-light);font-size:.78rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
        <span style="font-weight:700;color:var(--orange);display:flex;align-items:center;gap:.3rem;">💡 Sorgu İçi Hatırlatma & Yorumlar (${sqlComments.length}):</span>
        <div style="display:flex;gap:.35rem;flex-wrap:wrap;flex:1;">
          ${sqlComments.map(c => `<span style="font-family:var(--mono);font-size:.74rem;background:var(--green-light);color:var(--green);padding:.15rem .5rem;border-radius:6px;border:1px solid rgba(16,185,129,.25);">${esc(c)}</span>`).join('')}
        </div>
      </div>
    ` : '';

    panel.innerHTML = `
      <div class="code-toolbar">
        <div class="code-toolbar-left">
          <span class="lang-badge ${esc(cfg.langClass)}">${esc(cfg.langLabel)}</span>
          <span class="line-count">${esc(cfg.badge)}</span>
        </div>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
          ${cfg.type === 'sql' ? `
            <button class="btn-copy" onclick="formatSqlInTab('${esc(cfg.id)}')" title="SQL Güzelleştir (Büyük harf & Girintileme)">🎨 Formatla</button>
            <button class="btn-copy" onclick="minifySqlInTab('${esc(cfg.id)}')" title="SQL'i Tek Satıra İndir">⚡ Minify</button>
            <button class="btn-copy" onclick="changeSqlCaseInTab('${esc(cfg.id)}', 'upper')" title="SQL Anahtar Kelimelerini BÜYÜK HARF Yap">🔠 BÜYÜK</button>
            <button class="btn-copy" onclick="openComplexityModal(${cfg.queryIndex})" title="SQL Karmaşıklık Puanı & Zeki Analiz">📊 Karmaşıklık</button>
            <button class="btn-copy" onclick="addToSnippetLibrary(${cfg.queryIndex})">📌 Kütüphaneye Ekle</button>
            <button class="btn-copy" onclick="openParamInjector(${cfg.queryIndex})">⚡ SQL Testi</button>
          ` : ''}
          ${cfg.type === 'pascal' ? `
            <button class="btn-copy" id="btnCheckPascalSyntax" onclick="checkPascalSyntaxInTab()" title="PascalScript Sözdizimi Kontrolü">🔍 Sözdizimi Kontrol</button>
          ` : ''}
          <button class="btn-copy" id="${esc(cfg.id)}_lasteditbtn" onclick="openLastEditDiffModal('${esc(cfg.id)}')" title="Son yapılan değişikliklerin farkını gör">📜 Son Değişiklik</button>
          <button class="btn-copy btn-edit-toggle" id="${esc(cfg.id)}_editbtn" onclick="toggleEditMode('${esc(cfg.id)}')">✏️ Düzenle</button>
          <button class="btn-copy" id="${esc(cfg.id)}_copy" onclick="copyTabCode('${esc(cfg.id)}', this)">📋 Kopyala</button>
        </div>
      </div>

      ${commentsNoticeHtml}

      <!-- Görüntüleme modu -->
      <div class="code-scroll" id="${viewScrollId}">${codeHtml}</div>

      <!-- Düzenleme modu (gizli) -->
      <div class="edit-mode-toolbar" id="${editToolId}" style="display:none;align-items:center;padding:.4rem .85rem;background:var(--bg-surface);border-bottom:1px solid var(--border);gap:.6rem;flex-wrap:wrap;">
        <span style="font-size:.78rem;color:var(--orange);font-weight:700;">✏️ Canlı Düzenleme Modu</span>
        <span id="${cfg.id}_cursor_pos" style="font-size:.74rem;background:var(--bg-raised);padding:.15rem .55rem;border-radius:4px;border:1px solid var(--border-light);color:var(--text-primary);font-family:var(--mono);font-weight:600;">📍 Satır: 1, Sütun: 1</span>
        <span style="font-size:.72rem;color:var(--text-muted);">ℹ️ Anlık sözdizimi doğrulaması aktif</span>
        <div style="display:flex;gap:.4rem;margin-left:auto;">
          <button class="btn btn-sm btn-primary" onclick="saveEditMode('${esc(cfg.id)}')">💾 Kaydet</button>
          <button class="btn btn-sm" onclick="saveAndDownloadEditMode('${esc(cfg.id)}')">📤 Kaydet & İndir</button>
          <button class="btn btn-sm" onclick="cancelEditMode('${esc(cfg.id)}')">✕ İptal</button>
        </div>
      </div>

      <!-- Sözdizimi Hataları Bildirim Bandı -->
      <div class="syntax-error-notice" id="${cfg.id}_errnotice" style="display:none;padding:.45rem .9rem;background:rgba(239,68,68,.12);border-bottom:1px solid rgba(239,68,68,.3);font-size:.78rem;align-items:center;gap:.6rem;flex-wrap:wrap;"></div>

      <!-- Renkli Canlı Düzenleyici (Live Highlighting Editor) -->
      <div class="code-editor-wrap" id="${cfg.id}_editorwrap" style="display:none;">
        <div class="editor-gutter" id="${cfg.id}_gutter"></div>
        <div class="editor-main">
          <div class="code-editor-backdrop" id="${cfg.id}_backdrop"></div>
          <textarea class="edit-mode-textarea" id="${editAreaId}" spellcheck="false"></textarea>
        </div>
      </div>
    `;
  }

  panels.appendChild(panel);

  if (!cfg.isTree) {
    // cfg'yi panele sakla (edit modu için erişim)
    panel._tabCfg = cfg;
  }

  activeTabs.push(cfg);
}

function updateEditorCursorInfo(tabId) {
  const editArea = document.getElementById(tabId + '_editarea');
  const posEl = document.getElementById(tabId + '_cursor_pos');
  if (!editArea || !posEl) return;
  const val = editArea.value || '';
  const selStart = editArea.selectionStart || 0;
  const lines = val.slice(0, selStart).split('\n');
  const lineNum = lines.length;
  const colNum = lines[lines.length - 1].length + 1;
  const totalLines = val.split('\n').length;
  posEl.innerHTML = `📍 Satır: <strong>${lineNum}</strong>, Sütun: <strong>${colNum}</strong> <span style="opacity:.6;margin-left:.3rem;">(Toplam ${totalLines} Satır)</span>`;
}
window.updateEditorCursorInfo = updateEditorCursorInfo;

function jumpToEditorLine(tabId, targetLine, token) {
  const editWrap = document.getElementById(tabId + '_editorwrap');
  if (editWrap && editWrap.style.display === 'none') {
    toggleEditMode(tabId);
  }

  setTimeout(() => {
    const ta = document.getElementById(tabId + '_editarea');
    const bd = document.getElementById(tabId + '_backdrop');
    const gt = document.getElementById(tabId + '_gutter');
    if (!ta) return;
    const lines = ta.value.split('\n');
    let pos = 0;
    for (let i = 0; i < Math.min(targetLine - 1, lines.length); i++) {
      pos += lines[i].length + 1;
    }
    const lineText = lines[targetLine - 1] || '';
    let tokenOffset = 0;
    if (token && lineText.includes(token)) {
      tokenOffset = lineText.indexOf(token);
    }
    const targetPos = pos + tokenOffset;
    ta.focus();
    // Yazının üzerini kapatmamak için sadece imleci hatanın başına odakla
    ta.setSelectionRange(targetPos, targetPos + (token ? token.length : 0));

    // Satırı ekranda ortala
    const lineHeight = 22.1;
    const targetScroll = Math.max(0, (targetLine - 6) * lineHeight);
    ta.scrollTop = targetScroll;
    if (bd) bd.scrollTop = targetScroll;
    if (gt) gt.scrollTop = targetScroll;

    if (bd) {
      const lineEl = bd.querySelector(`.code-line-raw[data-line="${targetLine}"]`);
      if (lineEl) {
        lineEl.classList.add('flash-jump-line');
        setTimeout(() => lineEl.classList.remove('flash-jump-line'), 1600);
      }
    }
    updateEditorCursorInfo(tabId);
  }, 60);
}
window.jumpToEditorLine = jumpToEditorLine;

function syncEditorBackdrop(tabId) {
  const tabCfg = activeTabs.find(t => t.id === tabId);
  const editArea = document.getElementById(tabId + '_editarea');
  const backdrop = document.getElementById(tabId + '_backdrop');
  const gutter = document.getElementById(tabId + '_gutter');
  if (!tabCfg || !editArea || !backdrop) return;

  const rawCode = editArea.value || '';
  const lines = rawCode.split('\n');
  const total = lines.length;

  const errors = typeof findSyntaxErrors === 'function' ? findSyntaxErrors(rawCode, tabCfg.type) : [];
  const errorLineSet = new Set(errors.map(e => e.line));

  const hlFn = tabCfg.type === 'sql' ? (window.highlightSQL || (s => esc(s))) : (window.highlightPascal || (s => esc(s)));

  // Gutter Render (Sol Satır Numaraları)
  if (gutter) {
    let gutterHtml = '';
    for (let i = 1; i <= total; i++) {
      const isErr = errorLineSet.has(i);
      gutterHtml += `<div class="editor-gutter-line ${isErr ? 'gutter-err' : ''}" data-line="${i}" title="${isErr ? '⚠️ Bu satırda sözdizimi uyarısı var' : `Satır ${i}`}">${i}</div>`;
    }
    gutter.innerHTML = gutterHtml;
    gutter.scrollTop = editArea.scrollTop;
  }

  // Backdrop Render (Kod Renklendirmesi)
  let backdropHtml = '';
  lines.forEach((line, idx) => {
    const lnum = idx + 1;
    const isErr = errorLineSet.has(lnum);
    backdropHtml += `<div class="code-line-raw ${isErr ? 'syntax-error-line' : ''}" data-line="${lnum}">${hlFn(line) || '&nbsp;'}</div>`;
  });
  backdrop.innerHTML = backdropHtml;
  backdrop.scrollTop = editArea.scrollTop;
  backdrop.scrollLeft = editArea.scrollLeft;

  updateSyntaxErrorNotice(tabId, errors);
  updateEditorCursorInfo(tabId);
  if (tabId === 'tab_pascal') refreshPascalSyntaxButtonState();
}

function updateSyntaxErrorNotice(tabId, existingErrors) {
  const tabCfg = activeTabs.find(t => t.id === tabId);
  const editArea = document.getElementById(tabId + '_editarea');
  const errNotice = document.getElementById(tabId + '_errnotice');
  if (!tabCfg || !editArea || !errNotice) return;

  const errors = existingErrors || (typeof findSyntaxErrors === 'function' ? findSyntaxErrors(editArea.value, tabCfg.type) : []);
  if (errors.length === 0) {
    errNotice.style.display = 'none';
    errNotice.innerHTML = '';
  } else {
    errNotice.style.display = 'flex';
    errNotice.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;gap:.5rem;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;flex:1;">
          <span style="font-weight:800;color:var(--red);display:flex;align-items:center;gap:.3rem;font-size:.78rem;">⚠️ Sözdizimi (${errors.length}):</span>
          <div style="display:flex;gap:.35rem;flex-wrap:wrap;flex:1;">
            ${errors.slice(0, 6).map(e => `
              <span style="font-family:var(--mono);font-size:.74rem;background:rgba(239,68,68,.15);color:var(--red);padding:.15rem .5rem;border-radius:6px;border:1px solid rgba(239,68,68,.3);cursor:pointer;"
                    onclick="jumpToEditorLine('${tabId}', ${e.line}, '${esc(e.token || '')}')"
                    title="${esc(e.message)} — Satıra sıçramak için tıklayın">
                Satır ${e.line}: <strong>${esc(e.token)}</strong> (${esc(e.suggestion)})
              </span>
            `).join('')}
          </div>
        </div>
        <button type="button" class="btn btn-sm" style="background:rgba(239,68,68,0.18);color:var(--red);border:1px solid rgba(239,68,68,0.4);font-size:.74rem;font-weight:700;padding:.2rem .6rem;border-radius:6px;cursor:pointer;"
                onclick="openAllSyntaxErrorsModal('${tabId}')"
                title="Tüm ${errors.length} hatayı detaylı liste olarak aç">
          📋 Tümünü Listele (${errors.length})
        </button>
      </div>
    `;
  }
}

function openAllSyntaxErrorsModal(tabId) {
  const tabCfg = activeTabs.find(t => t.id === tabId);
  const editArea = document.getElementById(tabId + '_editarea');
  if (!tabCfg || !editArea) return;

  const errors = typeof findSyntaxErrors === 'function' ? findSyntaxErrors(editArea.value, tabCfg.type) : [];
  if (errors.length === 0) {
    showToast('Tebrikler! Sözdizimi hatası bulunamadı. ✅', 'success');
    return;
  }

  const errItemsHtml = errors.map((e, idx) => `
    <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:.6rem .8rem;margin-bottom:.5rem;display:flex;align-items:center;justify-content:space-between;gap:.75rem;cursor:pointer;"
         onclick="jumpToEditorLine('${tabId}', ${e.line}, '${esc(e.token || '')}'); const m = document.querySelector('.modal-overlay'); if (m) m.remove();"
         title="Satır ${e.line}'e git">
      <div style="flex:1;">
        <div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.2rem;">
          <span class="badge" style="background:rgba(239,68,68,0.2);color:var(--red);font-weight:800;font-size:.72rem;">Satır ${e.line}</span>
          <span style="font-family:var(--mono);font-weight:700;color:var(--text-primary);font-size:.8rem;">${esc(e.token || '')}</span>
        </div>
        <div style="font-size:.78rem;color:var(--text-secondary);line-height:1.4;">${esc(e.message || '')}</div>
        ${e.suggestion ? `<div style="font-size:.74rem;color:var(--accent);margin-top:.2rem;font-weight:600;">💡 Öneri: ${esc(e.suggestion)}</div>` : ''}
      </div>
      <button type="button" class="btn btn-sm btn-primary" style="font-size:.74rem;padding:.25rem .6rem;flex-shrink:0;">
        Git ➔
      </button>
    </div>
  `).join('');

  showModal({
    title: `🔍 Sözdizimi Analiz Raporu (${errors.length} Hata / Uyarı)`,
    body: `<div style="max-height:65vh;overflow-y:auto;padding-right:.3rem;">${errItemsHtml}</div>`,
    confirmText: 'Kapat',
    cancelText: ''
  });
}
window.openAllSyntaxErrorsModal = openAllSyntaxErrorsModal;

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

  let start = editArea.selectionStart;
  let end = editArea.selectionEnd;

  // Eğer seçim yoksa imlecin altındaki kelimeyi otomatik bul
  if (start != null && end != null && start === end) {
    const val = editArea.value;
    let s = start;
    let e = start;
    while (s > 0 && /\w/.test(val[s - 1])) s--;
    while (e < val.length && /\w/.test(val[e])) e++;
    if (e > s) {
      editArea.setSelectionRange(s, e);
      start = s;
      end = e;
    }
  }

  const selectedText = (start != null && end != null && start !== end)
    ? editArea.value.slice(start, end)
    : '';

  const anchor = measureTextareaSelectionAnchor(editArea, end || start || 0);

  removeSelectionReplacePopover(tabId);

  const popover = document.createElement('div');
  popover.className = 'code-replace-popover';
  popover.id = tabId + '_replacePopover';
  popover.innerHTML = `
    <div class="code-replace-head">
      <span>🔍 Seçili İfadeyi Değiştir (Ctrl+R)</span>
      <button type="button" class="code-replace-close" title="Kapat">×</button>
    </div>
    ${selectedText ? `<div class="code-replace-selected" title="Seçilen İfade">${esc(selectedText)}</div>` : ''}
    <input type="text" class="code-replace-input" placeholder="${selectedText ? 'Yeni ifade girin...' : 'Aranacak ve değiştirilecek ifade...'}" />
    <div class="code-replace-actions" style="display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.4rem;">
      <button type="button" class="btn btn-sm btn-primary code-replace-apply-all" title="Tüm Eşleşmeleri Değiştir">Tümünü Değiştir</button>
      <button type="button" class="btn btn-sm code-replace-apply-one" title="Yalnızca Bu Seçimi Değiştir">Yalnızca Seçileni Değiştir</button>
      <button type="button" class="btn btn-sm code-replace-cancel">İptal</button>
    </div>
  `;

  const maxLeft = Math.max(12, editWrap.clientWidth - 360);
  const maxTop = Math.max(12, editWrap.clientHeight - 190);
  const left = anchor.left - editArea.scrollLeft + 18;
  const top = anchor.top - editArea.scrollTop - 6;
  popover.style.left = Math.min(Math.max(12, left), maxLeft) + 'px';
  popover.style.top = Math.min(Math.max(12, top), maxTop) + 'px';

  editWrap.appendChild(popover);

  const input = popover.querySelector('.code-replace-input');
  const applyAllBtn = popover.querySelector('.code-replace-apply-all');
  const applyOneBtn = popover.querySelector('.code-replace-apply-one');
  const cancelBtn = popover.querySelector('.code-replace-cancel');
  const closeBtn = popover.querySelector('.code-replace-close');

  const closePopover = () => removeSelectionReplacePopover(tabId);

  const applyReplace = (replaceAll = true) => {
    const replacement = input ? input.value : '';
    const currentText = editArea.value;
    const searchText = selectedText;
    if (!searchText) {
      closePopover();
      return;
    }
    let nextText = currentText;

    if (replaceAll) {
      const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      nextText = currentText.replace(new RegExp(escapedSearch, 'g'), replacement);
    } else {
      nextText = currentText.slice(0, start) + replacement + currentText.slice(end);
    }

    editArea.value = nextText;

    if (editArea._undoStack) {
      editArea._undoStack.push(nextText);
      if (editArea._undoStack.length > 100) editArea._undoStack.shift();
      editArea._redoStack = [];
    }

    if (currentFile) {
      sessionStorage.setItem(`draft_${currentFile.id}_${tabId}`, nextText);
    }

    const caretPos = start + replacement.length;
    editArea.focus();
    editArea.setSelectionRange(caretPos, caretPos);
    syncEditorBackdrop(tabId);
    hasUnsavedChanges = true;
    closePopover();
    showToast(`İfade ${replaceAll ? 'tüm kodda' : 'seçilen yerde'} değiştirildi. ✏️`, 'info');
  };

  if (input) {
    input.focus();
    input.select();
  }
  if (applyAllBtn) applyAllBtn.addEventListener('click', () => applyReplace(true));
  if (applyOneBtn) applyOneBtn.addEventListener('click', () => applyReplace(false));
  if (cancelBtn) cancelBtn.addEventListener('click', closePopover);
  if (closeBtn) closeBtn.addEventListener('click', closePopover);

  popover.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePopover();
    if (e.key === 'Enter') applyReplace(true);
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

// ── Edit Modu Yönetimi ──────────────────────────────────────
function toggleEditMode(tabId) {
  const viewScroll = document.getElementById(tabId + '_viewscroll');
  const editWrap = document.getElementById(tabId + '_editorwrap');
  const editArea = document.getElementById(tabId + '_editarea');
  const backdrop = document.getElementById(tabId + '_backdrop');
  const editTool = document.getElementById(tabId + '_edittool');
  const editBtn = document.getElementById(tabId + '_editbtn');
  if (!viewScroll || !editArea) return;

  const isEditing = editWrap ? (editWrap.style.display !== 'none') : (editArea.style.display !== 'none');
  if (isEditing) {
    const tabCfg = activeTabs.find(t => t.id === tabId);
    if (tabCfg && viewScroll) {
      viewScroll.innerHTML = buildLineTable(editArea.value, tabCfg.highlightFn);
    }
    cancelEditMode(tabId);
  } else {
    const tabCfg = activeTabs.find(t => t.id === tabId);
    const draftKey = currentFile ? `draft_${currentFile.id}_${tabId}` : null;
    const draftContent = draftKey ? sessionStorage.getItem(draftKey) : null;
    
    const btn = document.getElementById('btnCheckPascalSyntax');
    if (btn) btn.classList.remove('flash-red-btn');

    if (draftContent) {
      editArea.value = draftContent;
      showToast('Taslak kod yüklendi. 📝', 'info');
    } else if (tabCfg) {
      editArea.value = tabCfg.rawCode || '';
    }

    if (!editArea._liveBound) {
      editArea._liveBound = true;
      editArea.addEventListener('input', () => {
        syncEditorBackdrop(tabId);
        updateEditorCursorInfo(tabId);
        hasUnsavedChanges = true;
        if (currentFile) {
          sessionStorage.setItem(`draft_${currentFile.id}_${tabId}`, editArea.value);
        }
      });
      editArea.addEventListener('keyup', () => updateEditorCursorInfo(tabId));
      editArea.addEventListener('click', () => updateEditorCursorInfo(tabId));
      editArea.addEventListener('select', () => updateEditorCursorInfo(tabId));
      editArea.addEventListener('scroll', () => {
        const backdropEl = document.getElementById(tabId + '_backdrop');
        const gutterEl = document.getElementById(tabId + '_gutter');
        if (backdropEl) {
          backdropEl.scrollTop = editArea.scrollTop;
          backdropEl.scrollLeft = editArea.scrollLeft;
        }
        if (gutterEl) {
          gutterEl.scrollTop = editArea.scrollTop;
        }
      });
    }

    bindSelectionReplaceEvents(tabId);

    if (!editArea._undoBound) {
      editArea._undoBound = true;
      editArea._undoStack = [editArea.value];
      editArea._redoStack = [];
      let lastPushTime = 0;

      editArea.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
          e.preventDefault();
          if (editArea._undoStack.length > 1) {
            editArea._redoStack.push(editArea._undoStack.pop());
            const prevVal = editArea._undoStack[editArea._undoStack.length - 1];
            editArea.value = prevVal;
            if (currentFile) sessionStorage.setItem(`draft_${currentFile.id}_${tabId}`, prevVal);
            syncEditorBackdrop(tabId);
            showToast('Geri alındı (Undo) ↩️', 'info');
          }
          return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'Z' && e.shiftKey))) {
          e.preventDefault();
          if (editArea._redoStack.length > 0) {
            const nextVal = editArea._redoStack.pop();
            editArea._undoStack.push(nextVal);
            editArea.value = nextVal;
            if (currentFile) sessionStorage.setItem(`draft_${currentFile.id}_${tabId}`, nextVal);
            syncEditorBackdrop(tabId);
            showToast('Yeniden uygulandı (Redo) ↪️', 'info');
          }
          return;
        }
      });

      editArea.addEventListener('input', () => {
        const now = Date.now();
        if (now - lastPushTime > 400 || editArea.value.endsWith(' ') || editArea.value.endsWith('\n')) {
          if (editArea._undoStack[editArea._undoStack.length - 1] !== editArea.value) {
            editArea._undoStack.push(editArea.value);
            if (editArea._undoStack.length > 100) editArea._undoStack.shift();
            editArea._redoStack = [];
            lastPushTime = now;
          }
        }
      });
    }

    viewScroll.style.display = 'none';
    if (editWrap) editWrap.style.display = 'flex';
    editArea.style.display = 'block';
    if (editTool) editTool.style.display = 'flex';
    if (editBtn) editBtn.textContent = '👁️ Görüntüle';

    syncEditorBackdrop(tabId);
  }
}

function cancelEditMode(tabId) {
  const viewScroll = document.getElementById(tabId + '_viewscroll');
  const editWrap = document.getElementById(tabId + '_editorwrap');
  const editArea = document.getElementById(tabId + '_editarea');
  const editTool = document.getElementById(tabId + '_edittool');
  const editBtn = document.getElementById(tabId + '_editbtn');
  const errNotice = document.getElementById(tabId + '_errnotice');
  if (viewScroll) viewScroll.style.display = '';
  if (editWrap) editWrap.style.display = 'none';
  if (editArea) {
    editArea.style.display = 'none';
    editArea.value = ''; // Reset value to force reload from rawCode on next open
  }
  if (editTool) editTool.style.display = 'none';
  if (errNotice) errNotice.style.display = 'none';
  removeSelectionReplacePopover(tabId);
  if (editBtn) editBtn.textContent = '✏️ Düzenle';
  hasUnsavedChanges = false;
  if (tabId === 'tab_pascal') refreshPascalSyntaxButtonState();
}

function saveEditMode(tabId) {
  const editArea = document.getElementById(tabId + '_editarea');
  const viewScroll = document.getElementById(tabId + '_viewscroll');
  if (!editArea || !currentFile) return;

  const newCode = editArea.value;
  const tabCfg = activeTabs.find(t => t.id === tabId);
  if (!tabCfg) return;

  if (tabCfg.type === 'sql') {
    FrpStore.updateCode(currentFile.id, { queryIndex: tabCfg.queryIndex, sql: newCode });
    currentFile = FrpStore.getById(currentFile.id);
    tabCfg.rawCode = newCode;
    if (viewScroll) viewScroll.innerHTML = buildLineTable(newCode, tabCfg.highlightFn);
    showToast('SQL sorgusu kaydedildi. 💾', 'success');
  } else if (tabCfg.type === 'pascal') {
    FrpStore.updateCode(currentFile.id, { pascalScript: newCode });
    currentFile = FrpStore.getById(currentFile.id);
    tabCfg.rawCode = newCode;
    if (viewScroll) viewScroll.innerHTML = buildLineTable(newCode, tabCfg.highlightFn);
    showToast('PascalScript kaydedildi. 💾', 'success');
  }

  // Sidebar'daki sağlık skorunu güncelle
  renderSidebar(currentFile);

  // Draft temizle
  if (currentFile) sessionStorage.removeItem(`draft_${currentFile.id}_${tabId}`);

  updateLastEditBtnState(tabId);
  cancelEditMode(tabId);
  if (tabId === 'tab_pascal') refreshPascalSyntaxButtonState();
}

async function saveAndDownloadEditMode(tabId) {
  await saveEditMode(tabId);
  const tabCfg = activeTabs.find(t => t.id === tabId);
  if (!tabCfg || !currentFile) return;
  await exportFrpOrSqlWithVersion(tabId, tabCfg.queryIndex);
}

async function copyTabCode(tabId, btn) {
  let textToCopy = '';

  // 1. Edit modundaysa textarea değeri
  const editArea = document.getElementById(tabId + '_editarea');
  if (editArea && editArea.style.display !== 'none' && editArea.value) {
    textToCopy = editArea.value;
  }

  // 2. activeTabs listesinden rawCode
  if (!textToCopy) {
    const cfg = activeTabs.find(t => t.id === tabId);
    if (cfg && cfg.rawCode) textToCopy = cfg.rawCode;
  }

  // 3. Panel DOM elementi üzerinden _tabCfg
  if (!textToCopy) {
    const panel = document.getElementById(tabId + '_panel');
    if (panel && panel._tabCfg && panel._tabCfg.rawCode) textToCopy = panel._tabCfg.rawCode;
  }

  // 4. currentFile nesnesinden doğrudan
  if (!textToCopy && currentFile) {
    if (tabId === 'tab_pascal') {
      textToCopy = currentFile.pascalScript || '';
    } else if (tabId.startsWith('tab_sql_')) {
      const idx = parseInt(tabId.replace('tab_sql_', ''), 10);
      if (currentFile.queries && currentFile.queries[idx]) {
        textToCopy = currentFile.queries[idx].sql || '';
      }
    }
  }

  // 5. DOM viewScroll üzerinden satır metinlerini birleştir
  if (!textToCopy) {
    const scrollEl = document.getElementById(tabId + '_viewscroll') || document.querySelector(`#${tabId}_panel .code-scroll`);
    if (scrollEl) {
      const lines = scrollEl.querySelectorAll('.line-src');
      if (lines && lines.length > 0) {
        textToCopy = Array.from(lines).map(l => l.innerText || l.textContent || '').join('\n');
      }
    }
  }

  if (!textToCopy) {
    showToast('Kopyalanacak kod bulunamadı.', 'warning');
    return;
  }

  const ok = await (typeof copyTextToClipboard === 'function' ? copyTextToClipboard(textToCopy) : (async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = textToCopy;
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const s = document.execCommand('copy');
      document.body.removeChild(ta);
      return s;
    }
  })());

  if (ok) {
    if (btn) {
      btn.textContent = '✅ Kopyalandı!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '📋 Kopyala';
        btn.classList.remove('copied');
      }, 2000);
    }
    showToast('Kod panoya kopyalandı! 📋', 'success');
  } else {
    showToast('Panoya kopyalama başarısız oldu.', 'error');
  }
}

window.toggleEditMode = toggleEditMode;
window.cancelEditMode = cancelEditMode;
window.saveEditMode = saveEditMode;
window.saveAndDownloadEditMode = saveAndDownloadEditMode;
window.copyTabCode = copyTabCode;

function activateTab(id) {
  activeTabs.forEach(t => {
    const btn = document.getElementById(t.id + '_btn');
    const panel = document.getElementById(t.id + '_panel');
    const isTarget = t.id === id;
    if (btn) btn.classList.toggle('active', isTarget);
    if (panel) panel.classList.toggle('active', isTarget);
  });
  updateLastEditBtnState(id);
  if (id === 'tab_pascal') refreshPascalSyntaxButtonState();
  if (id === 'tab_designer') {
    const wrap = document.getElementById('tab_designer_designer_wrap');
    if (wrap && window.FastReportDesigner && !wrap.hasChildNodes() && currentFile) {
      window.FastReportDesigner.render(currentFile, wrap);
    }
  }
  performCodeSearch();
  if (typeof onTabActivated === 'function') {
    onTabActivated(id);
  }
}

function renderViewer(file) {
  const tabBar = document.getElementById('tabBar');
  const panels = document.getElementById('panels');
  if (!tabBar || !panels) return;
  tabBar.innerHTML = ''; panels.innerHTML = '';
  activeTabs = [];

  // 1. Görsel Tasarım & Önizleme Sekmesi (FastReport Designer Canvas)
  const totalPagesCount = (file.pages?.length || 0) + (file.dialogPages?.length || 0);
  if (totalPagesCount > 0) {
    const pageBadge = `${file.pages?.length || 0} Sayfa${file.dialogPages?.length ? ` · ${file.dialogPages.length} Form` : ''}`;
    addTab({
      id: 'tab_designer',
      label: '🎨 Tasarım Önizleme',
      badge: pageBadge,
      isDesigner: true
    });
  }

  const tree = Array.isArray(file.tree) ? file.tree : [];
  const queries = Array.isArray(file.queries) ? file.queries : [];

  if (tree.length > 0) {
    const treeHtml = `
      <div class="tree-container">
        ${tree.map(b => `
          <div class="tree-band">
            <div class="tree-band-name">📐 ${esc(b.bandName)} (${esc(b.type)})</div>
            <div class="tree-memos">
              ${(b.memos || []).map(m => `
                <div class="tree-memo">
                  <span class="tree-memo-name">${esc(m.name)}:</span>
                  <span class="tree-memo-text">${esc(m.text)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    addTab({
      id: 'tab_tree', label: '🌲 Rapor Yapısı',
      badge: tree.length + ' bant',
      isTree: true, treeHtml
    });
  }

  if (file.pascalScript) {
    addTab({
      id: 'tab_pascal', label: '📜 PascalScript',
      badge: countLines(file.pascalScript) + ' satır',
      type: 'pascal', rawCode: file.pascalScript,
      highlightFn: highlightPascal,
      langClass: 'lang-pascal', langLabel: 'PascalScript'
    });
  }

  queries.forEach((q, i) => {
    const params = extractParams(q.sql);
    addTab({
      id: 'tab_sql_' + i,
      label: '🗄️ ' + q.name,
      badge: countLines(q.sql) + ' satır' + (params.length ? ' · ' + params.length + ' param' : ''),
      type: 'sql', rawCode: q.sql, queryName: q.name, queryIndex: i,
      highlightFn: highlightSQL,
      langClass: 'lang-sql', langLabel: 'SQL'
    });
  });

  if (activeTabs.length > 0) {
    activateTab(activeTabs[0].id);
    activeTabs.forEach(t => updateLastEditBtnState(t.id));
    refreshPascalSyntaxButtonState();
  }
}

// ── Kod İçi Canlı Arama ────────────────────────────────────
const codeSearchInput = document.getElementById('codeSearchInput');
const codeSearchCount = document.getElementById('codeSearchCount');
const codeSearchNext = document.getElementById('codeSearchNext');
const codeSearchPrev = document.getElementById('codeSearchPrev');

if (codeSearchInput) codeSearchInput.addEventListener('input', performCodeSearch);
if (codeSearchNext) codeSearchNext.addEventListener('click', () => navigateMatch(1));
if (codeSearchPrev) codeSearchPrev.addEventListener('click', () => navigateMatch(-1));

function showError(msg) {
  const errText = document.getElementById('errorMsg');
  const errWrap = document.getElementById('errorWrap');
  const viewer = document.getElementById('viewer');
  const sb = document.getElementById('sidebarBody');
  if (errText) errText.textContent = msg;
  if (errWrap) {
    errWrap.style.display = 'flex';
    errWrap.style.flex = '1';
    errWrap.style.alignItems = 'center';
    errWrap.style.justifyContent = 'center';
  }
  if (viewer) viewer.style.display = 'none';
  if (sb) {
    sb.innerHTML = `
      <div class="sidebar-empty" style="padding:1.5rem 1rem;text-align:center;">
        <div class="sidebar-empty-icon" style="font-size:2rem;margin-bottom:.5rem;">⚠️</div>
        <div class="sidebar-empty-title" style="font-size:.85rem;font-weight:700;color:var(--red);line-height:1.4;">${esc(msg)}</div>
        <div style="margin-top:.8rem;">
          <button class="btn btn-sm btn-primary" onclick="window.location.href='index.html'">← Ana Sayfaya Dön</button>
        </div>
      </div>`;
  }
}

async function init() {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) { showError('Rapor ID\'si bulunamadı veya URL hatalı.'); return; }

    if (window.FrpStoreReady) {
      await window.FrpStoreReady;
    }

    let file = FrpStore.getById(id);

    // Eğer LocalStorage boşsa veya rapor tekil bulunamadıysa IndexedDB yedeğinden çekmeyi dene
    if (!file && FrpStore.restoreFromIndexedDB) {
      const restored = await FrpStore.restoreFromIndexedDB();
      if (restored && restored.length > 0) {
        file = FrpStore.getById(id);
      }
    }

    if (!file) {
      showError('Rapor bulunamadı veya silinmiş olabilir.');
      return;
    }

    if (file.rawXml && typeof parseFrp === 'function') {
      try {
        const reParsed = parseFrp(file.rawXml);
        file.pages = reParsed.pages;
        file.dialogPages = reParsed.dialogPages;
        file.queries = reParsed.queries;
        file.tree = reParsed.tree;
        file.pascalScript = reParsed.pascalScript;
        file.datasets = reParsed.datasets;
      } catch (e) {
        console.error('parseFrp hatası:', e);
      }
    }

    currentFile = file;
    window.currentFile = file;
    FrpStore.addRecent(file.id);

    const metaName = file.meta?.reportName || file.name;
    document.title = `FrpOku — ${metaName}`;
    const pTitle = document.getElementById('pageTitle');
    const pSub = document.getElementById('pageSubTitle');
    if (pTitle) pTitle.textContent = metaName;
    if (pSub) pSub.textContent = file.name;

    renderSidebar(file);

    const queries = Array.isArray(file.queries) ? file.queries : [];
    const tree = Array.isArray(file.tree) ? file.tree : [];
    const hasPages = Array.isArray(file.pages) && file.pages.length > 0;
    const hasDialogs = Array.isArray(file.dialogPages) && file.dialogPages.length > 0;

    if (!file.pascalScript && queries.length === 0 && tree.length === 0 && !hasPages && !hasDialogs) {
      showError('Bu raporda gösterilecek kod veya tasarım bulunamadı.');
      return;
    }

    const errWrap = document.getElementById('errorWrap');
    const viewer = document.getElementById('viewer');
    if (errWrap) errWrap.style.display = 'none';
    if (viewer) viewer.style.display = 'flex';
    renderViewer(file);

    // ── Ortak Havuz Bannerı & Salt-Okunur Kontrolü ─────────────
    const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
    const isOwner = curUser && file.userId === curUser.id;
    const isAdmin = curUser && curUser.role === 'admin';
    const isOwnerOrAdmin = isOwner || isAdmin || !file.userId || file.userId === 'public';
    const isPublic = !!(file.isPublic || file.is_public);

    const poolBanner = document.getElementById('poolDetailBanner');
    const poolOwnerInfo = document.getElementById('poolDetailOwnerInfo');
    const btnCloneFromPool = document.getElementById('btnCloneFromPool');
    const btnTogglePoolDetail = document.getElementById('btnTogglePoolDetail');

    if (isPublic) {
      if (poolBanner) {
        poolBanner.style.display = 'flex';
        const ownerName = file.ownerName || file.owner_name || 'Kurum Personeli';
        const ownerDept = file.ownerDepartment || file.owner_department || '';
        if (poolOwnerInfo) {
          poolOwnerInfo.textContent = `Yükleyen / Paylaşan: 👤 ${ownerName}${ownerDept ? ' · 🏢 ' + ownerDept : ''}`;
        }
      }
    } else {
      if (poolBanner) poolBanner.style.display = 'none';
    }

    if (btnCloneFromPool) {
      btnCloneFromPool.onclick = () => {
        const cloned = FrpStore.cloneReportToPersonal(file.id);
        if (cloned) {
          showToast(`"${cloned.name}" kişisel raporlarınıza kopyalandı! 📋`, 'success');
          setTimeout(() => {
            window.location.href = `detail.html?id=${encodeURIComponent(cloned.id)}`;
          }, 800);
        }
      };
    }

    if (btnTogglePoolDetail) {
      btnTogglePoolDetail.style.display = 'inline-flex';
      btnTogglePoolDetail.textContent = isPublic ? '🔒 Havuzdan Kaldır' : '🌐 Havuzda Paylaş';
      btnTogglePoolDetail.className = isPublic ? 'btn btn-sm btn-ghost' : 'btn btn-sm btn-primary';

      btnTogglePoolDetail.onclick = () => {
        if (!isOwnerOrAdmin) {
          showToast('Bu raporu yalnızca sahibi veya Admin havuzdan çekebilir.', 'warning');
          return;
        }
        const newState = FrpStore.toggleReportPool(file.id, !isPublic);
        showToast(newState ? 'Rapor Ortak Havuzda Paylaşıldı! 🌐' : 'Rapor havuzdan kaldırıldı ve gizlendi 🔒', 'success');
        setTimeout(() => location.reload(), 600);
      };
    }

    // Topbar'a Tema Seçici ve Zen Butonu Ekle
    const topbarRight = document.querySelector('.topbar-right');
    if (topbarRight && window.FrpThemes && !topbarRight.querySelector('.theme-selector-wrap')) {
      FrpThemes.createThemeSelector(topbarRight);
    }
    if (topbarRight && !topbarRight.querySelector('#btnZenMode')) {
      const zenBtn = document.createElement('button');
      zenBtn.className = 'btn btn-sm';
      zenBtn.id = 'btnZenMode';
      zenBtn.title = 'Tam Ekran Kod Editörü Odaklanma Modu (Esc ile çıkış)';
      zenBtn.innerHTML = '⛶ Tam Ekran';
      zenBtn.addEventListener('click', toggleZenMode);
      topbarRight.appendChild(zenBtn);
    }

    // Auto-Save Draft interval
    setInterval(autoSaveDraft, 30000);
    
  } catch (err) {
    showError('Rapor yüklenirken hata oluştu: ' + (err.message || err));
  }
}

// Native beforeunload kaldırıldı (sistemsel pop-up uyarısını engellemek için)


// ── ORTAK KOD GÜNCELLEME VE RENKLENDİRME YARDIMCISI ────────
function applyCodeUpdateInTab(tabId, newCode) {
  const panel = document.getElementById(tabId + '_panel');
  const cfg = panel ? panel._tabCfg : null;
  if (!cfg) return;

  cfg.rawCode = newCode;
  const viewScroll = document.getElementById(tabId + '_viewscroll');
  const editArea = document.getElementById(tabId + '_editarea');

  if (viewScroll) {
    viewScroll.innerHTML = buildLineTable(newCode, cfg.highlightFn);
  }
  if (editArea) {
    editArea.value = newCode;
  }

  // Editör aktifse backdrop'u da senkronize et
  const editWrap = document.getElementById(tabId + '_editorwrap');
  if (editWrap && editWrap.style.display !== 'none') {
    syncEditorBackdrop(tabId);
  }
}

// ── SQL FORMATTER ENTEGRASYONU ───────────────────────────
function formatSqlInTab(tabId) {
  const panel = document.getElementById(tabId + '_panel');
  const cfg = panel ? panel._tabCfg : null;
  if (!cfg) return;

  const editWrap = document.getElementById(tabId + '_editorwrap');
  const editArea = document.getElementById(tabId + '_editarea');
  const isEditing = editWrap ? (editWrap.style.display !== 'none') : (editArea && editArea.style.display !== 'none');
  const rawSql = isEditing ? editArea.value : cfg.rawCode;

  if (cfg._formatApplied) {
    const restored = cfg._formatOriginalCode != null ? cfg._formatOriginalCode : rawSql;
    applyCodeUpdateInTab(tabId, restored);
    cfg._formatApplied = false;
    cfg._formatOriginalCode = null;
    showToast('SQL eski haline döndürüldü ↩️', 'info');
    return;
  }

  const formatted = window.formatSQL ? window.formatSQL(rawSql) : rawSql;
  cfg._formatOriginalCode = rawSql;
  cfg._formatApplied = true;
  applyCodeUpdateInTab(tabId, formatted);
  showToast('SQL güzelleştirildi. Tekrar basınca eski haline döner 🎨', 'success');
}

// ── SQL MINIFIER (TEK SATIRA İNDİRME - TOGGLE DESTEKLİ) ───
function minifySqlInTab(tabId) {
  const panel = document.getElementById(tabId + '_panel');
  const cfg = panel ? panel._tabCfg : null;
  if (!cfg) return;

  const editWrap = document.getElementById(tabId + '_editorwrap');
  const editArea = document.getElementById(tabId + '_editarea');
  const isEditing = editWrap ? (editWrap.style.display !== 'none') : (editArea && editArea.style.display !== 'none');
  const currentCode = isEditing ? editArea.value : cfg.rawCode;

  if (cfg._isMinified) {
    applyCodeUpdateInTab(tabId, cfg._originalCode || currentCode);
    cfg._isMinified = false;
    cfg._formatApplied = false;
    cfg._formatOriginalCode = null;
    showToast('SQL varsayılan görünümüne geri döndürüldü ↩️', 'info');
  } else {
    cfg._originalCode = currentCode;
    const minified = (currentCode || '')
      .replace(/--[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .trim();

    applyCodeUpdateInTab(tabId, minified);
    cfg._isMinified = true;
    cfg._isUpper = false;
    cfg._formatApplied = false;
    cfg._formatOriginalCode = null;
    showToast('SQL tek satıra indirildi ⚡ (Tekrar basarak geri alabilirsiniz)', 'success');
  }
}

// ── SQL HARF BÜYÜKLÜĞÜ DÖNÜŞTÜRÜCÜ (TOGGLE DESTEKLİ) ─────
function changeSqlCaseInTab(tabId, mode = 'upper') {
  const panel = document.getElementById(tabId + '_panel');
  const cfg = panel ? panel._tabCfg : null;
  if (!cfg) return;

  const editWrap = document.getElementById(tabId + '_editorwrap');
  const editArea = document.getElementById(tabId + '_editarea');
  const isEditing = editWrap ? (editWrap.style.display !== 'none') : (editArea && editArea.style.display !== 'none');
  const currentCode = isEditing ? editArea.value : cfg.rawCode;

  if (cfg._isUpper) {
    applyCodeUpdateInTab(tabId, cfg._originalCode || currentCode);
    cfg._isUpper = false;
    cfg._formatApplied = false;
    cfg._formatOriginalCode = null;
    showToast('SQL harf biçimlendirmesi sıfırlandı ↩️', 'info');
  } else {
    cfg._originalCode = currentCode;
    const SQL_KW = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'ON', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'UNION', 'ALL', 'DISTINCT', 'AS', 'WITH', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IS', 'NULL', 'BETWEEN', 'LIKE', 'EXISTS'];
    let res = currentCode;

    SQL_KW.forEach(kw => {
      const rx = new RegExp('\\b' + kw + '\\b', 'gi');
      res = res.replace(rx, mode === 'upper' ? kw.toUpperCase() : kw.toLowerCase());
    });

    applyCodeUpdateInTab(tabId, res);
    cfg._isUpper = true;
    cfg._isMinified = false;
    cfg._formatApplied = false;
    cfg._formatOriginalCode = null;
    showToast('SQL anahtar kelimeleri BÜYÜK yapıldı 🔠 (Tekrar basarak geri alabilirsiniz)', 'success');
  }
}

// ── RENKLENDİRME YARDIMCISI ─────────────────────────────────────

function renderComponentTreeHtml(components) {
  if (!Array.isArray(components) || components.length === 0) {
    return '<div style="padding:1rem;color:var(--text-muted);font-size:.82rem;">Eleman ağacı bulunamadı.</div>';
  }
  let html = '<div style="padding:1rem;font-family:var(--mono);font-size:.82rem;line-height:1.6;">';
  components.forEach(c => {
    html += `<div style="margin-bottom:.3rem;padding-left:${(c.depth || 0) * 1.2}rem;">🔹 <strong>${esc(c.type || 'Object')}</strong>: ${esc(c.name || 'unnamed')}</div>`;
  });
  html += '</div>';
  return html;
}

function setupCodeSearch() {
  const input = document.getElementById('codeSearchInput');
  const count = document.getElementById('codeSearchCount');
  const prev = document.getElementById('codeSearchPrev');
  const next = document.getElementById('codeSearchNext');
  if (!input) return;

  let matches = [];
  let currentIdx = -1;

  function doSearch() {
    const q = input.value.trim().toLowerCase();
    const activePanel = document.querySelector('.code-panel.active');
    if (!activePanel || !q) {
      if (count) count.textContent = '';
      return;
    }
    const lineSrcs = activePanel.querySelectorAll('.line-src');
    matches = [];
    lineSrcs.forEach(el => {
      if (el.textContent.toLowerCase().includes(q)) {
        matches.push(el);
      }
    });

    if (count) count.textContent = matches.length ? `1/${matches.length}` : '0 sonuç';
    if (matches.length > 0) {
      currentIdx = 0;
      scrollToMatch(currentIdx);
    }
  }

  function scrollToMatch(idx) {
    if (!matches[idx]) return;
    matches[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (count) count.textContent = `${idx + 1}/${matches.length}`;
  }

  input.addEventListener('input', doSearch);
  if (next) next.addEventListener('click', () => {
    if (matches.length > 0) {
      currentIdx = (currentIdx + 1) % matches.length;
      scrollToMatch(currentIdx);
    }
  });
  if (prev) prev.addEventListener('click', () => {
    if (matches.length > 0) {
      currentIdx = (currentIdx - 1 + matches.length) % matches.length;
      scrollToMatch(currentIdx);
    }
  });
}

// ── SQL KARMAŞIKLIK & STATİK ANALİZ DETAY MODALI (Zeki DBA Motoru) ────────
function openComplexityModal(qIdx) {
  let targetIdx = qIdx;
  let sql = '';
  let queryName = 'SQL Sorgusu';

  // 1. qIdx sayısal değilse veya aktif sekmeden çıkarılacaksa
  if (typeof targetIdx !== 'number' || isNaN(targetIdx)) {
    const activeSqlTab = activeTabs.find(t => t.type === 'sql' && document.getElementById(t.id + '_panel')?.classList.contains('active'));
    if (activeSqlTab) {
      targetIdx = typeof activeSqlTab.queryIndex === 'number' ? activeSqlTab.queryIndex : 0;
    } else {
      targetIdx = 0;
    }
  }

  // 2. Canlı düzenleyici açıksa oradaki güncel kodu al, yoksa currentFile'dan oku
  const tabId = 'tab_sql_' + targetIdx;
  const editArea = document.getElementById(tabId + '_editarea');
  if (editArea && editArea.style.display !== 'none' && editArea.value) {
    sql = editArea.value;
  } else if (currentFile && currentFile.queries && currentFile.queries[targetIdx]) {
    sql = currentFile.queries[targetIdx].sql || '';
    queryName = currentFile.queries[targetIdx].name || `Sorgu ${targetIdx + 1}`;
  } else {
    const tabObj = activeTabs.find(t => t.id === tabId);
    if (tabObj) {
      sql = tabObj.rawCode || '';
      queryName = tabObj.queryName || tabObj.label || 'SQL Sorgusu';
    }
  }

  if (!sql || !sql.trim()) {
    showToast('Analiz edilecek SQL sorgusu bulunamadı.', 'warning');
    return;
  }

  const comp = FrpStore.getSqlComplexity(sql);
  const d = comp.details || {};

  let issuesHtml = '';
  if (comp.warnings && comp.warnings.length > 0) {
    issuesHtml = comp.warnings.map((w, wIdx) => {
      const recIdx = comp.recommendations.findIndex(r => r.category === w.category);
      const rec = recIdx !== -1 ? comp.recommendations[recIdx] : (comp.recommendations[wIdx] || {});
      const actualRecIdx = recIdx !== -1 ? recIdx : wIdx;

      return `
        <div style="background:var(--bg-surface);border:1px solid ${w.type === 'danger' ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.3)'};border-radius:12px;padding:.9rem 1.1rem;display:flex;flex-direction:column;gap:.65rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap;">
            <div style="font-weight:800;font-size:.88rem;color:${w.type === 'danger' ? '#ef4444' : '#f59e0b'};display:flex;align-items:center;gap:.4rem;">
              ${w.type === 'danger' ? '🚨' : '⚠️'} ${esc(w.title)}
            </div>
            <div style="display:flex;align-items:center;gap:.4rem;">
              ${w.categoryLabel ? `<span class="badge" style="font-size:.7rem;">${esc(w.categoryLabel)}</span>` : ''}
              ${rec.after ? `<button type="button" class="btn btn-sm btn-primary" style="font-size:.72rem;padding:.2rem .6rem;" onclick="window.applyDbaSuggestion(${targetIdx}, ${actualRecIdx})">⚡ Editöre Uygula</button>` : ''}
            </div>
          </div>

          <div style="font-size:.8rem;color:var(--text-secondary);line-height:1.45;background:rgba(0,0,0,.08);padding:.55rem .8rem;border-radius:6px;">
            <strong style="color:var(--text-primary);">❌ Neden Kötü?:</strong> ${esc(w.text)}
          </div>

          ${rec.desc ? `
            <div style="font-size:.8rem;color:var(--text-primary);line-height:1.45;">
              <strong style="color:var(--green);">💡 Çözüm & Tavsiye:</strong> ${esc(rec.desc)}
            </div>
          ` : ''}

          ${(rec.before || rec.after) ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:.3rem;">
              <div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.25);border-radius:8px;padding:.6rem .75rem;">
                <div style="font-size:.7rem;font-weight:700;color:var(--red);margin-bottom:.3rem;display:flex;align-items:center;justify-content:space-between;">
                  <span>❌ Mevcut / Riskli Kod:</span>
                  <button type="button" class="btn btn-sm" style="font-size:.65rem;padding:.1rem .35rem;" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(rec.before || '')}')); showToast('Kopyalandı', 'success');">📋</button>
                </div>
                <pre style="margin:0;font-family:var(--mono);font-size:.73rem;color:var(--text-primary);white-space:pre-wrap;line-height:1.4;max-height:140px;overflow-y:auto;">${esc(rec.before || '')}</pre>
              </div>
              <div style="background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.25);border-radius:8px;padding:.6rem .75rem;">
                <div style="font-size:.7rem;font-weight:700;color:var(--green);margin-bottom:.3rem;display:flex;align-items:center;justify-content:space-between;">
                  <span>✅ Önerilen Optimize Kod:</span>
                  <button type="button" class="btn btn-sm" style="font-size:.65rem;padding:.1rem .35rem;" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(rec.after || '')}')); showToast('Kopyalandı', 'success');">📋</button>
                </div>
                <pre style="margin:0;font-family:var(--mono);font-size:.73rem;color:var(--text-primary);white-space:pre-wrap;line-height:1.4;max-height:140px;overflow-y:auto;">${esc(rec.after || '')}</pre>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } else {
    issuesHtml = `
      <div style="background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.25);border-radius:12px;padding:1.2rem 1.4rem;color:var(--green);font-size:.85rem;font-weight:600;display:flex;align-items:center;gap:.5rem;">
        ✨ Harika! Bu SQL sorgusunda bilinen kritik bir anti-pattern tespit edilmedi. Kod temiz ve optimize görünüyor.
      </div>
    `;
  }

  const body = `
    <div style="display:flex;flex-direction:column;gap:1.1rem;max-height:75vh;overflow-y:auto;padding-right:.3rem;">
      
      <!-- Skor Özeti & Termometre Barı -->
      <div style="background:var(--bg-raised);border-radius:12px;border:1px solid var(--border-light);padding:1rem 1.25rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;">
          <div>
            <div style="font-size:.76rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;letter-spacing:.5px;">SQL Karmaşıklık & Sağlık Skoru</div>
            <div style="font-size:1.35rem;font-weight:800;color:${comp.color};margin-top:.2rem;display:flex;align-items:center;gap:.6rem;">
              <span>${comp.score}/100</span>
              <span style="font-size:.85rem;padding:.2rem .65rem;border-radius:20px;background:${comp.color}20;border:1px solid ${comp.color}40;color:${comp.color};">${comp.level}</span>
            </div>
          </div>
          <div style="text-align:right;display:flex;align-items:center;gap:.8rem;">
            <div>
              <div style="font-size:.72rem;color:var(--text-muted);font-weight:600;">Sağlık Notu</div>
              <div style="font-size:.85rem;font-weight:700;color:var(--green);">${comp.healthScore || 100} / 100</div>
            </div>
            <div style="display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:50%;background:${comp.color};color:#fff;font-size:1.4rem;font-weight:900;box-shadow:0 6px 16px ${comp.color}40;">
              ${comp.grade || 'A'}
            </div>
          </div>
        </div>

        <!-- Görsel Gösterge Çubuğu -->
        <div style="background:var(--bg-surface);border-radius:10px;height:10px;overflow:hidden;border:1px solid var(--border);position:relative;">
          <div style="background:linear-gradient(90deg, #10b981 0%, #3b82f6 35%, #f59e0b 65%, #ef4444 100%);height:100%;width:100%;opacity:.2;position:absolute;"></div>
          <div style="background:${comp.color};height:100%;width:${comp.score}%;transition:width .4s ease;position:relative;border-radius:10px;"></div>
        </div>

        <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--text-muted);margin-top:.35rem;">
          <span>0 Basit (A+)</span>
          <span>40 Orta (A)</span>
          <span>65 Karmaşık (B)</span>
          <span>85 Çok Karmaşık (C)</span>
          <span>100 Kritik (F)</span>
        </div>
      </div>

      <!-- Sorunlar ve DBA Çözümleri -->
      <div style="display:flex;flex-direction:column;gap:.75rem;">
        <div style="font-size:.85rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;justify-content:space-between;">
          <span>🔍 Tespit Edilen Riskler & DBA Çözüm Önerileri</span>
          <span style="font-size:.74rem;color:var(--text-muted);font-weight:normal;">(${comp.warnings.length} tespit)</span>
        </div>
        ${issuesHtml}
      </div>

      <!-- Katlanabilir Yapısal Bileşen Sayımları -->
      <details style="background:var(--bg-raised);border:1px solid var(--border-light);border-radius:12px;padding:.85rem 1.1rem;">
        <summary style="cursor:pointer;font-weight:700;font-size:.82rem;color:var(--accent);user-select:none;">
          📊 Sorgunun Yapısal Bileşen Sayımları (Aç / Kapat)
        </summary>
        <table class="dash-tbl" style="font-size:.78rem;width:100%;margin-top:.6rem;">
          <tbody>
            <tr><td>Toplam Tablo & JOIN</td><td><strong>${d.totalJoins || 0}</strong> <small style="opacity:.7">(${d.innerJoinCount || 0} Inner, ${d.leftJoinCount || 0} Left, ${d.crossJoinCount || 0} Cross)</small></td></tr>
            <tr><td>Alt Sorgular (Subquery)</td><td><strong>${d.subqCount || 0}</strong> <small style="opacity:.7">(${d.inSubqCount || 0} IN, ${d.notInSubqCount || 0} NOT IN)</small></td></tr>
            <tr><td>CTE (WITH İfadeleri)</td><td><strong>${d.cteCount || 0}</strong> ${(d.cteNames && d.cteNames.length > 0) ? `<span style="font-size:.72rem;background:rgba(59,130,246,.15);color:var(--accent-bright);padding:.1rem .4rem;border-radius:4px;font-family:var(--mono);margin-left:.4rem;">${d.cteNames.join(', ')}</span>` : ''}</td></tr>
            <tr><td>Koşul Mantığı (AND / OR)</td><td><strong>${d.andOrCount || 0}</strong> <small style="opacity:.7">(${d.orCount || 0} OR)</small></td></tr>
            <tr><td>CASE / WHEN Blokları</td><td><strong>${d.caseCount || 0}</strong></td></tr>
            <tr><td>UNION Kümeleri</td><td><strong>${d.unionCount || 0}</strong> <small style="opacity:.7">(${d.unionAllCount || 0} UNION ALL, ${d.unionPureCount || 0} Saf UNION)</small></td></tr>
            <tr><td>Sorgu Satır & Parametre</td><td><strong>${d.lines || 0} satır</strong> · <strong>${d.paramCount || 0} parametre</strong></td></tr>
          </tbody>
        </table>
      </details>

    </div>
  `;

  // DBA önerisini canlı editöre uygulama yardımcısı
  window._lastDbaComplexity = comp;
  window.applyDbaSuggestion = function(qIndex, recIndex) {
    const rec = window._lastDbaComplexity?.recommendations?.[recIndex];
    if (!rec || !rec.before || !rec.after) return;

    const tId = 'tab_sql_' + qIndex;
    const editAreaEl = document.getElementById(tId + '_editarea');
    if (editAreaEl) {
      if (editAreaEl.style.display === 'none') {
        toggleEditMode(tId);
      }
      if (editAreaEl.value.includes(rec.before)) {
        editAreaEl.value = editAreaEl.value.replace(rec.before, rec.after);
        syncEditorBackdrop(tId);
        showToast('Öneri başarıyla editöre uygulandı! ⚡', 'success');
      } else {
        navigator.clipboard.writeText(rec.after);
        showToast('Önerilen kod panoya kopyalandı! 📋', 'info');
      }
    }
  };

  showModal({
    title: `🧠 Zeki SQL Karmaşıklık & DBA Analizi — ${esc(queryName)}`,
    body,
    confirmText: 'Kapat',
    cancelText: '',
    maxWidth: '1100px'
  });
}

function scrollToPascalLine(lineNum) {
  activateTab('tab_pascal');
  setTimeout(() => {
    const editArea = document.getElementById('tab_pascal_editarea');
    if (editArea && editArea.style.display !== 'none') {
      const lines = editArea.value.split('\n');
      let pos = 0;
      for (let i = 0; i < Math.min(lineNum - 1, lines.length); i++) {
        pos += lines[i].length + 1;
      }
      editArea.focus();
      editArea.setSelectionRange(pos, pos + (lines[lineNum - 1] ? lines[lineNum - 1].length : 0));
    }
    const panel = document.getElementById('tab_pascal_panel');
    if (panel) {
      const lines = panel.querySelectorAll('.code-line');
      if (lines[lineNum - 1]) {
        lines[lineNum - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
        lines[lineNum - 1].style.background = 'rgba(59,130,246,0.25)';
        setTimeout(() => { lines[lineNum - 1].style.background = ''; }, 2200);
      }
    }
  }, 120);
}
window.scrollToPascalLine = scrollToPascalLine;

function updateLastEditBtnState(tabId) {
  const btn = document.getElementById(tabId + '_lasteditbtn');
  if (!btn || !currentFile || !Array.isArray(currentFile.editHistory)) return;

  const tabCfg = activeTabs.find(t => t.id === tabId);
  if (!tabCfg) return;

  const targetField = tabCfg.type === 'pascal' ? 'pascalScript' : `sql[${tabCfg.queryIndex}]`;
  const historyItems = currentFile.editHistory.filter(h => h.field === targetField);
  const count = historyItems.length;

  if (count > 0) {
    btn.textContent = `📜 Son Değişiklik (${count})`;
    btn.classList.add('flash-red-btn');
    btn.title = `Bu kod alanında ${count} kaydedilmiş düzenleme geçmişi var. İncelemek için tıklayın.`;
  } else {
    btn.textContent = '📜 Son Değişiklik';
    btn.classList.remove('flash-red-btn');
    btn.title = 'Son yapılan değişikliğin farkını gör';
  }
}
window.updateLastEditBtnState = updateLastEditBtnState;

function openLastEditDiffModal(tabId) {
  if (!currentFile || !Array.isArray(currentFile.editHistory)) {
    showToast('Henüz bu raporda kaydedilmiş bir değişiklik bulunmuyor.', 'info');
    return;
  }

  const tabCfg = activeTabs.find(t => t.id === tabId);
  if (!tabCfg) return;

  const targetField = tabCfg.type === 'pascal' ? 'pascalScript' : `sql[${tabCfg.queryIndex}]`;
  const historyItems = currentFile.editHistory.filter(h => h.field === targetField);

  if (historyItems.length === 0) {
    showToast('Bu alanda kaydedilmiş geçmiş bir düzenleme bulunamadı.', 'info');
    return;
  }

  const lastEntry = historyItems[historyItems.length - 1];
  const oldCode = lastEntry.fullOldValue || '';
  const newCode = lastEntry.fullNewValue || tabCfg.rawCode || '';

  if (typeof DiffEngine === 'undefined') {
    showToast('Diff kütüphanesi yüklenemedi.', 'error');
    return;
  }

  const { linesA, linesB } = DiffEngine.computeLineDiff(oldCode, newCode);

  let addCount = 0;
  let delCount = 0;
  const diffIndices = [];

  for (let i = 0; i < linesA.length; i++) {
    if (linesA[i].type === 'del') delCount++;
    if (linesB[i].type === 'add') addCount++;
    if (linesA[i].type !== 'same' || linesB[i].type !== 'same') {
      diffIndices.push(i);
    }
  }

  const htmlA = [];
  const htmlB = [];

  for (let i = 0; i < linesA.length; i++) {
    const lA = linesA[i];
    const lB = linesB[i];
    htmlA.push(`<div class="diff-row ${lA.type}" id="modalDiffRowA_${i}"><span class="diff-num">${lA.num || ''}</span><span class="diff-content">${esc(lA.text)}</span></div>`);
    htmlB.push(`<div class="diff-row ${lB.type}" id="modalDiffRowB_${i}"><span class="diff-num">${lB.num || ''}</span><span class="diff-content">${esc(lB.text)}</span></div>`);
  }

  const diffBodyHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-bottom:.75rem;padding:.5rem .75rem;background:var(--bg-surface);border:1px solid var(--border-light);border-radius:8px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:.6rem;">
        <button class="btn btn-sm" id="btnModalDiffPrev" title="Önceki Farklı Satıra Git">◀ Önceki Fark</button>
        <button class="btn btn-sm" id="btnModalDiffNext" title="Sonraki Farklı Satıra Git">▶ Sonraki Fark</button>
        <span class="badge badge-primary" id="modalDiffBadge" style="font-size:.78rem;">Fark ${diffIndices.length > 0 ? 1 : 0} / ${diffIndices.length}</span>
      </div>
      <div style="display:flex;align-items:center;gap:.6rem;">
        <span style="font-size:.78rem;padding:.2rem .6rem;border-radius:12px;background:rgba(16,185,129,0.15);color:var(--green);font-weight:700;">+${addCount} Eklenen</span>
        <span style="font-size:.78rem;padding:.2rem .6rem;border-radius:12px;background:rgba(239,68,68,0.15);color:var(--red);font-weight:700;">-${delCount} Silinen</span>
        <span style="font-size:.75rem;color:var(--text-muted);">📅 ${new Date(lastEntry.editedAt).toLocaleString('tr-TR')}</span>
      </div>
    </div>

    <div class="diff-grid" id="modalDiffGrid" style="height:72vh;max-height:800px;overflow-y:auto;border:1px solid var(--border);border-radius:10px;background:var(--bg-code);">
      <div class="diff-pane" style="overflow-y:auto;" id="modalPaneA">
        <div class="diff-pane-header">Önceki Kayıt (Eski Sürüm)</div>
        <div class="diff-table">${htmlA.join('')}</div>
      </div>
      <div class="diff-pane" style="overflow-y:auto;" id="modalPaneB">
        <div class="diff-pane-header">Değiştirilen / Kaydedilen (Yeni Sürüm)</div>
        <div class="diff-table">${htmlB.join('')}</div>
      </div>
    </div>
  `;

  showModal({
    title: '📜 Son Düzenleme Detaylı Fark Görünümü',
    body: diffBodyHtml,
    confirmText: '↩️ Önceki Koda Dön (Geri Al)',
    cancelText: 'Kapat',
    maxWidth: '94vw'
  }).then(approved => {
    if (approved) {
      undoLastEditInTab(tabId);
    }
  });

  setTimeout(() => {
    let diffPointer = 0;
    const btnPrev = document.getElementById('btnModalDiffPrev');
    const btnNext = document.getElementById('btnModalDiffNext');
    const badge = document.getElementById('modalDiffBadge');
    const paneA = document.getElementById('modalPaneA');
    const paneB = document.getElementById('modalPaneB');

    function jumpToDiff(idx) {
      if (diffIndices.length === 0) return;
      diffPointer = (idx + diffIndices.length) % diffIndices.length;
      const rowIdx = diffIndices[diffPointer];
      if (badge) badge.textContent = `Fark ${diffPointer + 1} / ${diffIndices.length}`;

      document.querySelectorAll('#modalDiffGrid .diff-row.active-diff').forEach(r => r.classList.remove('active-diff'));

      const rA = document.getElementById(`modalDiffRowA_${rowIdx}`);
      const rB = document.getElementById(`modalDiffRowB_${rowIdx}`);
      if (rA) rA.classList.add('active-diff');
      if (rB) rB.classList.add('active-diff');

      const target = rA || rB;
      if (target && paneA) {
        paneA.scrollTop = Math.max(0, target.offsetTop - 120);
        if (paneB) paneB.scrollTop = Math.max(0, target.offsetTop - 120);
      }
    }

    if (btnPrev) btnPrev.addEventListener('click', () => jumpToDiff(diffPointer - 1));
    if (btnNext) btnNext.addEventListener('click', () => jumpToDiff(diffPointer + 1));
    if (diffIndices.length > 0) jumpToDiff(0);
  }, 100);
}
window.openLastEditDiffModal = openLastEditDiffModal;

function undoLastEditInTab(tabId) {
  if (!currentFile || !Array.isArray(currentFile.editHistory)) {
    showToast('Geri alınacak bir düzenleme geçmişi yok.', 'warning');
    return;
  }

  const tabCfg = activeTabs.find(t => t.id === tabId);
  if (!tabCfg) return;

  const targetField = tabCfg.type === 'pascal' ? 'pascalScript' : `sql[${tabCfg.queryIndex}]`;
  const revertedCode = FrpStore.revertLastCodeEdit(currentFile.id, targetField);

  if (revertedCode === null) {
    showToast('Geri alınacak bir düzenleme kaydı bulunamadı.', 'warning');
    return;
  }

  currentFile = FrpStore.getById(currentFile.id);
  tabCfg.rawCode = revertedCode;

  const viewScroll = document.getElementById(tabId + '_viewscroll');
  if (viewScroll) viewScroll.innerHTML = buildLineTable(revertedCode, tabCfg.highlightFn);

  const editArea = document.getElementById(tabId + '_editarea');
  if (editArea) editArea.value = revertedCode;

  updateLastEditBtnState(tabId);
  if (tabId === 'tab_pascal') refreshPascalSyntaxButtonState();
  showToast('Son yapılan düzenleme geri alındı. ↩️', 'success');
}
window.undoLastEditInTab = undoLastEditInTab;

// ── PASCALSCRIPT SÖZDIZIMI KONTROLÜ (Canlı & Otomatik Güncellenen) ─────────────
function refreshPascalSyntaxButtonState() {
  const btn = document.getElementById('btnCheckPascalSyntax');
  if (!btn) return;

  const editArea = document.getElementById('tab_pascal_editarea');
  const code = (editArea && editArea.style.display !== 'none') 
    ? editArea.value 
    : (currentFile ? currentFile.pascalScript : '');

  if (!code) {
    btn.classList.remove('flash-red-btn');
    btn.innerHTML = '🔍 Sözdizimi Kontrol';
    btn.title = 'PascalScript Sözdizimi Kontrolü';
    return;
  }

  const res = (window.FrpStore && window.FrpStore.checkPascalSyntax) 
    ? FrpStore.checkPascalSyntax(code) 
    : { errors: [], warnings: [] };

  if (res.errors && res.errors.length > 0) {
    btn.classList.add('flash-red-btn');
    btn.innerHTML = `🔍 Sözdizimi (${res.errors.length} Hata)`;
    btn.title = `PascalScript'te ${res.errors.length} adet sözdizimi hatası tespit edildi! Tıklayarak detayları görün.`;
  } else if (res.warnings && res.warnings.length > 0) {
    btn.classList.remove('flash-red-btn');
    btn.innerHTML = `🔍 Sözdizimi (${res.warnings.length} Uyarı)`;
    btn.title = `PascalScript'te ${res.warnings.length} adet uyarı var. Tıklayarak inceleyin.`;
  } else {
    btn.classList.remove('flash-red-btn');
    btn.innerHTML = '🔍 Sözdizimi Kontrol';
    btn.title = 'PascalScript Sözdizimi Kontrolü (Hata Yok ✅)';
  }
}

function checkPascalSyntaxInTab() {
  const editArea = document.getElementById('tab_pascal_editarea');
  const codeToCheck = (editArea && editArea.style.display !== 'none') ? editArea.value : (currentFile ? currentFile.pascalScript : '');
  if (!codeToCheck) return;
  const res = FrpStore.checkPascalSyntax(codeToCheck);

  refreshPascalSyntaxButtonState();

  if (res.errors.length === 0 && res.warnings.length === 0) {
    showToast('PascalScript sözdiziminde belirgin bir hata bulunamadı. ✅', 'success');
    return;
  }

  const errHtml = res.errors.map(e => `
    <div style="color:var(--red);margin-bottom:.35rem;cursor:pointer;background:rgba(220,38,38,0.08);padding:.45rem .75rem;border-radius:6px;border:1px solid rgba(220,38,38,0.2);"
         onclick="scrollToPascalLine(${e.line}); const m = document.querySelector('.modal-overlay'); if (m) m.remove();"
         title="Tıklayarak Satır ${e.line}'e sıçrayın">
      ❌ ${esc(typeof e === 'object' ? e.text : e)}
      <span style="float:right;font-size:.7rem;text-decoration:underline;font-weight:700;">[Satır ${e.line || 1}'e Git ➔]</span>
    </div>
  `).join('');

  const warnHtml = res.warnings.map(w => `
    <div style="color:var(--orange);margin-bottom:.35rem;cursor:pointer;background:rgba(245,158,11,0.08);padding:.45rem .75rem;border-radius:6px;border:1px solid rgba(245,158,11,0.2);"
         onclick="scrollToPascalLine(${w.line}); const m = document.querySelector('.modal-overlay'); if (m) m.remove();"
         title="Tıklayarak Satır ${w.line}'e sıçrayın">
      ⚠️ ${esc(typeof w === 'object' ? w.text : w)}
      <span style="float:right;font-size:.7rem;text-decoration:underline;font-weight:700;">[Satır ${w.line || 1}'e Git ➔]</span>
    </div>
  `).join('');

  showModal({
    title: '🔍 PascalScript Sözdizimi Analizi',
    body: `<div style="font-size:.85rem;line-height:1.6;">${errHtml}${warnHtml}</div>`,
    confirmText: 'Kapat',
    cancelText: ''
  });
}

// ── TAM EKRAN (ODAKLANMA) MODU ──────────────────────────────
function toggleZenMode() {
  const sb = document.querySelector('.sidebar');
  const tb = document.querySelector('.topbar');
  const isZen = document.body.classList.toggle('zen-mode');

  let floatBar = document.getElementById('zenFloatBar');
  if (!floatBar) {
    floatBar = document.createElement('div');
    floatBar.id = 'zenFloatBar';
    floatBar.style.cssText = `
      position: fixed;
      top: 12px;
      right: 18px;
      z-index: 99999;
      display: none;
      align-items: center;
      gap: .6rem;
      background: var(--bg-surface, #1e293b);
      border: 1px solid var(--border, #334155);
      box-shadow: 0 10px 30px rgba(0,0,0,.35);
      border-radius: 30px;
      padding: .35rem .85rem;
    `;
    floatBar.innerHTML = `
      <span style="font-size:.78rem;font-weight:700;color:var(--text-secondary);display:flex;align-items:center;gap:.3rem;">⛶ Tam Ekran</span>
      <div style="width:1px;height:14px;background:var(--border);"></div>
      <button type="button" class="btn btn-sm btn-ghost" id="zenFontDec" style="padding:.15rem .45rem;font-size:.85rem;" title="Yazı Boyutunu Küçült">−</button>
      <span id="zenFontSizeText" style="font-size:.75rem;font-family:var(--mono);min-width:32px;text-align:center;">${currentFontSize}px</span>
      <button type="button" class="btn btn-sm btn-ghost" id="zenFontInc" style="padding:.15rem .45rem;font-size:.85rem;" title="Yazı Boyutunu Büyüt">+</button>
      <div style="width:1px;height:14px;background:var(--border);"></div>
      <button type="button" class="btn btn-sm btn-primary" id="btnExitZenMode" style="border-radius:20px;padding:.25rem .75rem;font-size:.76rem;font-weight:700;">✕ Çıkış (Esc)</button>
    `;
    document.body.appendChild(floatBar);

    floatBar.querySelector('#btnExitZenMode')?.addEventListener('click', toggleZenMode);
    floatBar.querySelector('#zenFontDec')?.addEventListener('click', () => {
      updateFontSize(currentFontSize - 1);
      const txt = document.getElementById('zenFontSizeText');
      if (txt) txt.textContent = currentFontSize + 'px';
    });
    floatBar.querySelector('#zenFontInc')?.addEventListener('click', () => {
      updateFontSize(currentFontSize + 1);
      const txt = document.getElementById('zenFontSizeText');
      if (txt) txt.textContent = currentFontSize + 'px';
    });
  }

  if (sb) sb.style.display = isZen ? 'none' : '';
  if (tb) tb.style.display = isZen ? 'none' : '';
  if (floatBar) {
    floatBar.style.display = isZen ? 'flex' : 'none';
    const txt = document.getElementById('zenFontSizeText');
    if (txt) txt.textContent = currentFontSize + 'px';
  }

  showToast(isZen ? 'Tam Ekran Modu AÇIK (Çıkmak için Esc tuşuna basın)' : 'Tam Ekran Modundan çıkıldı', 'info');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.classList.contains('zen-mode')) {
    toggleZenMode();
  }
  // ? tuşuyla kısayol modalı (input/textarea dışında)
  if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
    e.preventDefault();
    showModal({
      title: '⌨️ Klavye Kısayolları — Detay Sayfası',
      body: `
        <table style="font-size:.82rem;width:100%;border-collapse:collapse;">
          <tbody>
            <tr><td><kbd style="background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;padding:.1rem .4rem;font-family:var(--mono);">Ctrl+F</kbd></td><td style="padding:.4rem .6rem;">Kodda ara (arama kutusu)</td></tr>
            <tr><td><kbd style="background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;padding:.1rem .4rem;font-family:var(--mono);">Esc</kbd></td><td style="padding:.4rem .6rem;">Tam Ekrandan çık / Modal kapat</td></tr>
            <tr><td><kbd style="background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;padding:.1rem .4rem;font-family:var(--mono);">?</kbd></td><td style="padding:.4rem .6rem;">Bu kısayol menüsünü aç</td></tr>
            <tr><td><kbd style="background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;padding:.1rem .4rem;font-family:var(--mono);">Ctrl+C</kbd></td><td style="padding:.4rem .6rem;">Kopyala butonuyla kod kopyala</td></tr>
            <tr><td style="padding-top:.4rem;"><kbd style="background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;padding:.1rem .4rem;font-family:var(--mono);">Enter</kbd></td><td style="padding:.4rem .6rem;">Inline düzenlemeyi kaydet</td></tr>
          </tbody>
        </table>
      `,
      confirmText: 'Tamam',
      cancelText: ''
    });
  }
});

// ── AUTO-SAVE DRAFT (30 Saniyede Bir) ──────────────────────
function autoSaveDraft() {
  if (!currentFile) return;
  activeTabs.forEach(tab => {
    const editArea = document.getElementById(tab.id + '_editarea');
    if (editArea && editArea.style.display !== 'none' && editArea.value) {
      sessionStorage.setItem(`draft_${currentFile.id}_${tab.id}`, editArea.value);
    }
  });
}

window.addToSnippetLibrary = addToSnippetLibrary;
window.copyGuidText = copyGuidText;
window.formatSqlInTab = formatSqlInTab;
window.minifySqlInTab = minifySqlInTab;
window.changeSqlCaseInTab = changeSqlCaseInTab;
window.openComplexityModal = openComplexityModal;
window.checkPascalSyntaxInTab = checkPascalSyntaxInTab;
window.toggleZenMode = toggleZenMode;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}


