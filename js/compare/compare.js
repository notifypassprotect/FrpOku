// ============================================================
//  compare.js — Karşılaştırma Ekranı (compare.html) Mantığı
// ============================================================

let fileA = null;
let fileB = null;
let fileC = null;
let activeTab = 'pascal'; // 'pascal', 'meta' veya sql query name
let currentDiffIndices = [];
let activeDiffPointer = -1;
let isFoldUnchanged = false;
let currentDiffTheme = 'default';

const selectFileA             = document.getElementById('selectFileA');
const selectFileB             = document.getElementById('selectFileB');
const selectFileC             = document.getElementById('selectFileC');
const labelPaneA              = document.getElementById('labelPaneA');
const labelPaneB              = document.getElementById('labelPaneB');
const labelPaneC              = document.getElementById('labelPaneC');
const tablePaneA              = document.getElementById('tablePaneA');
const tablePaneB              = document.getElementById('tablePaneB');
const tablePaneC              = document.getElementById('tablePaneC');
const scrollPaneA             = document.getElementById('scrollPaneA');
const scrollPaneB             = document.getElementById('scrollPaneB');
const scrollPaneC             = document.getElementById('scrollPaneC');
const paneC                   = document.getElementById('paneC');
const diffGrid                = document.getElementById('diffGrid');
const diffTabBar              = document.getElementById('diffTabBar');
const tabBarScrollWrap        = document.getElementById('tabBarScrollWrap');
const btnTabScrollLeft        = document.getElementById('btnTabScrollLeft');
const btnTabScrollRight       = document.getElementById('btnTabScrollRight');
const selectQueryJump         = document.getElementById('selectQueryJump');
const queryAccordionContainer = document.getElementById('queryAccordionContainer');
const diffSummaryBar          = document.getElementById('diffSummaryBar');
const btnThemeToggle          = document.getElementById('btnThemeToggle');
const btnToggleFold           = document.getElementById('btnToggleFold');
const selectDiffTheme         = document.getElementById('selectDiffTheme');
const diffMinimap             = document.getElementById('diffMinimap');

const btnPrevDiff             = document.getElementById('btnPrevDiff');
const btnNextDiff             = document.getElementById('btnNextDiff');
const diffCounterBadge        = document.getElementById('diffCounterBadge');

// New slot UI elements
const titleFileA = document.getElementById('titleFileA');
const titleFileB = document.getElementById('titleFileB');
const titleFileC = document.getElementById('titleFileC');
const slotBtnC   = document.getElementById('btnPickerC');

function updateThemeBtn() {
  const cur = FrpStore.getTheme();
  if (btnThemeToggle) {
    btnThemeToggle.textContent = cur === 'dark' ? 'Aydınlık Mod' : 'Koyu Mod';
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

// Canlı Tema Senkronizasyonu
window.addEventListener('storage', (e) => {
  if (e.key === 'frpoku_theme' || e.key === 'frpoku_code_theme') {
    updateThemeBtn();
  }
});
window.addEventListener('frpoku:themeChanged', () => {
  updateThemeBtn();
});

const btnUndoTransfer       = document.getElementById('btnUndoTransfer');
const compareUndoStack       = [];

if (btnToggleFold) {
  btnToggleFold.addEventListener('click', () => {
    isFoldUnchanged = !isFoldUnchanged;
    btnToggleFold.classList.toggle('active', isFoldUnchanged);
    btnToggleFold.textContent = isFoldUnchanged ? 'Tümünü Göster' : 'Sadece Farklar';
    renderDiff();
  });
}

if (selectDiffTheme) {
  selectDiffTheme.addEventListener('change', () => {
    currentDiffTheme = selectDiffTheme.value;
    document.body.setAttribute('data-diff-theme', currentDiffTheme);
    if (diffGrid) diffGrid.setAttribute('data-diff-theme', currentDiffTheme);
  });
}

function toastCompare(msg, type = 'info') {
  const stack = document.getElementById('toastCompare') || document.body;
  const el = document.createElement('div');
  el.className = 'toast-item ' + type;
  el.innerHTML = `<span>${esc(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

function copyLineText(encodedText) {
  const text = decodeURIComponent(encodedText || '');
  navigator.clipboard.writeText(text).then(() => {
    toastCompare('Satır panoya kopyalandı.', 'success');
  });
}
window.copyLineText = copyLineText;

function undoTransfer() {
  if (compareUndoStack.length === 0) {
    toastCompare('Geri alınacak aktarım bulunmuyor.', 'warning');
    return;
  }

  const lastState = compareUndoStack.pop();
  if (lastState.type === 'pascal') {
    FrpStore.updateCode(lastState.targetFileId, { pascalScript: lastState.oldCode });
  } else if (lastState.type === 'sql') {
    FrpStore.updateCode(lastState.targetFileId, { queryIndex: lastState.queryIndex, sql: lastState.oldCode });
  }

  fileA = FrpStore.getById(fileA.id);
  fileB = FrpStore.getById(fileB.id);
  if (fileC) fileC = FrpStore.getById(fileC.id);

  toastCompare('Aktarım geri alındı.', 'info');
  renderDiff();
}
window.undoTransfer = undoTransfer;

if (btnUndoTransfer) {
  btnUndoTransfer.addEventListener('click', undoTransfer);
}

function transferLine(fromPane, lineIdx) {
  if (!fileA || !fileB) return;
  const isPascal = activeTab === 'pascal';

  if (isPascal) {
    const targetFile = fromPane === 'A' ? fileB : fileA;
    compareUndoStack.push({
      type: 'pascal',
      targetFileId: targetFile.id,
      oldCode: targetFile.pascalScript || ''
    });

    const textA = String(fileA.pascalScript || '');
    const textB = String(fileB.pascalScript || '');
    const alignedDiff = DiffEngine.computeLineDiff(textA, textB);
    const transferred = DiffEngine.applyLineTransfer(alignedDiff, fromPane, lineIdx, textA, textB);
    if (transferred === null) return;

    if (fromPane === 'A') {
      FrpStore.updateCode(fileB.id, { pascalScript: transferred });
      fileB = FrpStore.getById(fileB.id);
      toastCompare('Satır Rapor 2\'ye aktarıldı ➔ (Geri Al: Ctrl+Z)', 'success');
    } else {
      FrpStore.updateCode(fileA.id, { pascalScript: transferred });
      fileA = FrpStore.getById(fileA.id);
      toastCompare('Satır Rapor 1\'e aktarıldı ⬅ (Geri Al: Ctrl+Z)', 'success');
    }
  } else if (activeTab.startsWith('sql_')) {
    const qName = activeTab.replace('sql_', '');
    const qIdxA = (fileA.queries || []).findIndex(q => q.name === qName);
    const qIdxB = (fileB.queries || []).findIndex(q => q.name === qName);

    const targetFile = fromPane === 'A' ? fileB : fileA;
    const targetQIdx = fromPane === 'A' ? qIdxB : qIdxA;
    const targetSql  = targetQIdx >= 0 ? (targetFile.queries[targetQIdx]?.sql || '') : '';

    compareUndoStack.push({
      type: 'sql',
      targetFileId: targetFile.id,
      queryIndex: targetQIdx,
      oldCode: targetSql
    });

    const sqlA = qIdxA >= 0 ? fileA.queries[qIdxA].sql : '';
    const sqlB = qIdxB >= 0 ? fileB.queries[qIdxB].sql : '';

    const alignedDiff = DiffEngine.computeLineDiff(sqlA, sqlB);
    const transferred = DiffEngine.applyLineTransfer(alignedDiff, fromPane, lineIdx, sqlA, sqlB);
    if (transferred === null) return;

    if (fromPane === 'A') {
      if (qIdxB >= 0) {
        FrpStore.updateCode(fileB.id, { queryIndex: qIdxB, sql: transferred });
        fileB = FrpStore.getById(fileB.id);
        toastCompare('SQL Satırı Rapor 2\'ye aktarıldı ➔ (Geri Al: Ctrl+Z)', 'success');
      }
    } else {
      if (qIdxA >= 0) {
        FrpStore.updateCode(fileA.id, { queryIndex: qIdxA, sql: transferred });
        fileA = FrpStore.getById(fileA.id);
        toastCompare('SQL Satırı Rapor 1\'e aktarıldı ⬅ (Geri Al: Ctrl+Z)', 'success');
      }
    }
  }

  renderDiff();
}
window.transferLine = transferLine;

function renderMinimap(linesA, linesB) {
  if (!diffMinimap) return;
  diffMinimap.innerHTML = '';
  const total = linesA.length;
  if (total === 0) return;

  const marksHtml = [];
  for (let i = 0; i < total; i++) {
    const lA = linesA[i];
    const lB = linesB[i];
    if (lA && (lA.type === 'del' || (lB && lB.type === 'add'))) {
      const topPct = (i / total) * 100;
      const cls = lB && lB.type === 'add' ? 'add' : 'del';
      marksHtml.push(`<div class="minimap-mark ${cls}" style="top:${topPct}%;"></div>`);
    }
  }
  diffMinimap.innerHTML = marksHtml.join('');
}

if (diffMinimap) {
  diffMinimap.addEventListener('click', e => {
    const rect = diffMinimap.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const pct = clickY / rect.height;
    if (scrollPaneA) scrollPaneA.scrollTop = scrollPaneA.scrollHeight * pct;
    if (scrollPaneB) scrollPaneB.scrollTop = scrollPaneB.scrollHeight * pct;
    if (scrollPaneC) scrollPaneC.scrollTop = scrollPaneC.scrollHeight * pct;
  });
}

function renderMetaDiff() {
  const threeWay = isThreeWayEnabled();

  const getMetaRows = (f) => {
    if (!f) return [];
    return [
      { label: 'Rapor Adı', val: f.meta?.reportName || f.name },
      { label: 'Dosya Adı', val: f.name },
      { label: 'GUID', val: f.meta?.guid || '—' },
      { label: 'Yazar', val: f.meta?.author || '—' },
      { label: 'Açıklama', val: f.meta?.description || '—' },
      { label: 'Yüklenme Tarihi', val: new Date(f.loadedAt).toLocaleString('tr-TR') },
      { label: 'Dosya Boyutu', val: f.sizeBytes > 1024 ? Math.round(f.sizeBytes / 1024) + ' KB' : f.sizeBytes + ' B' },
      { label: 'SQL Sorgu Sayısı', val: (f.queries || []).length + ' adet' },
      { label: 'Sorgu İsimleri', val: (f.queries || []).map(q => q.name).join(', ') || '—' },
      { label: 'Dataset Sayısı', val: (f.datasets || []).length + ' adet' },
      { label: 'PascalScript Var mı', val: f.pascalScript ? 'Evet (' + countLines(f.pascalScript) + ' satır)' : 'Hayır' },
      { label: 'Nesne Ağacı Elemanı', val: (f.tree || []).length + ' eleman' }
    ];
  };

  const rowsA = getMetaRows(fileA);
  const rowsB = getMetaRows(fileB);
  const rowsC = threeWay ? getMetaRows(fileC) : [];

  const htmlA = [];
  const htmlB = [];
  const htmlC = [];

  for (let i = 0; i < rowsA.length; i++) {
    const rA = rowsA[i];
    const rB = rowsB[i] || { label: rA.label, val: '' };
    const rC = rowsC[i] || { label: rA.label, val: '' };

    const isDiffAB = String(rA.val) !== String(rB.val);
    const clsA = isDiffAB ? 'del' : 'same';
    const clsB = isDiffAB ? 'add' : 'same';

    htmlA.push(`<div class="diff-row ${clsA}"><span class="diff-num">${i+1}</span><span class="diff-content"><strong>${esc(rA.label)}:</strong> ${esc(rA.val)}</span></div>`);
    htmlB.push(`<div class="diff-row ${clsB}"><span class="diff-num">${i+1}</span><span class="diff-content"><strong>${esc(rB.label)}:</strong> ${esc(rB.val)}</span></div>`);

    if (threeWay) {
      const isDiffAC = String(rA.val) !== String(rC.val);
      const clsC = isDiffAC ? 'add' : 'same';
      htmlC.push(`<div class="diff-row ${clsC}"><span class="diff-num">${i+1}</span><span class="diff-content"><strong>${esc(rC.label)}:</strong> ${esc(rC.val)}</span></div>`);
    }
  }

  tablePaneA.innerHTML = htmlA.join('');
  tablePaneB.innerHTML = htmlB.join('');
  if (threeWay && tablePaneC) tablePaneC.innerHTML = htmlC.join('');

  diffSummaryBar.innerHTML = `<span><strong>${rowsA.length}</strong> meta ve yapısal özellik karşılaştırıldı.</span>`;
  renderMinimap([], []);
}

updateThemeBtn();

// Senkronize kaydırma (2 ya da 3 panel)
let isSyncing = false;
function getActiveScrollPanes() {
  const panes = [scrollPaneA, scrollPaneB];
  if (isThreeWayEnabled()) panes.push(scrollPaneC);
  return panes;
}

function bindSyncScroll(pane) {
  pane.addEventListener('scroll', () => {
    if (isSyncing) return;
    isSyncing = true;
    const panes = getActiveScrollPanes();
    panes.forEach(other => {
      if (other === pane) return;
      other.scrollTop = pane.scrollTop;
      other.scrollLeft = pane.scrollLeft;
    });
    isSyncing = false;
  });
}

bindSyncScroll(scrollPaneA);
bindSyncScroll(scrollPaneB);
if (scrollPaneC) bindSyncScroll(scrollPaneC);

document.getElementById('btnBack')?.addEventListener('click', () => {
  window.location.href = 'index.html';
});

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function countLines(text) {
  return String(text || '').split('\n').length;
}

function isThreeWayEnabled() {
  return !!fileC;
}

function updatePickerLabels() {
  const rNameA = fileA ? (fileA.meta?.reportName || fileA.name) : null;
  const rNameB = fileB ? (fileB.meta?.reportName || fileB.name) : null;
  const rNameC = fileC ? (fileC.meta?.reportName || fileC.name) : null;

  if (titleFileA) titleFileA.textContent = rNameA || 'Rapor seçilmedi...';
  if (titleFileB) titleFileB.textContent = rNameB || 'Rapor seçilmedi...';
  if (titleFileC) {
    titleFileC.textContent = rNameC || '+ Panel Ekle';
    if (slotBtnC) slotBtnC.classList.toggle('active', !!fileC);
  }

  if (labelPaneA) labelPaneA.textContent = rNameA || 'Rapor 1';
  if (labelPaneB) labelPaneB.textContent = rNameB || 'Rapor 2';
  if (labelPaneC) labelPaneC.textContent = rNameC || 'Rapor 3';
}

function updateThreeWayLayout() {
  const threeWay = isThreeWayEnabled();
  if (paneC) paneC.style.display = threeWay ? '' : 'none';
  if (diffGrid) diffGrid.classList.toggle('three-way', threeWay);
  if (!threeWay && tablePaneC) tablePaneC.innerHTML = '';
}

/* ═══════════════════════════════════════════════════════════
   RAPOR SEÇİCİ MODAL — Arama, Filtre, Sıralama destekli
═══════════════════════════════════════════════════════════ */
function openReportPickerForDiff(slot) {
  const files = FrpStore.getAll();
  if (files.length === 0) return;

  let cats = [];
  try { cats = FrpStore.getCategories ? FrpStore.getCategories() : []; } catch(e) {}

  let searchQuery = '';
  let activeCat = '';
  let sortMode = 'date'; // 'date' | 'name' | 'size' | 'queries'

  const conflictId = slot === 'A' ? fileB?.id : (slot === 'B' ? fileA?.id : null);
  const currentSelectedId = slot === 'A' ? fileA?.id : (slot === 'B' ? fileB?.id : fileC?.id);

  const titles = { A: '1. Raporu Seç · Sol Panel (Baz)', B: '2. Raporu Seç · Sağ Panel (Karşılaştırılan)', C: '3. Raporu Seç · Opsiyonel Panel' };
  const slotColors = { A: 'var(--accent)', B: '#10b981', C: '#f59e0b' };

  const overlay = document.createElement('div');
  overlay.className = 'cmp-picker-overlay';

  function getFiltered() {
    let list = files;
    if (activeCat) list = list.filter(f => f.category === activeCat);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(f => {
        const name = (f.meta?.reportName || f.name || '').toLowerCase();
        const fn = (f.name || '').toLowerCase();
        const guid = (f.meta?.guid || '').toLowerCase();
        const cat = (f.category || '').toLowerCase();
        return name.includes(q) || fn.includes(q) || guid.includes(q) || cat.includes(q);
      });
    }
    if (sortMode === 'name') list = [...list].sort((a, b) => (a.meta?.reportName || a.name).localeCompare(b.meta?.reportName || b.name));
    else if (sortMode === 'size') list = [...list].sort((a, b) => b.sizeBytes - a.sizeBytes);
    else if (sortMode === 'queries') list = [...list].sort((a, b) => (b.queries||[]).length - (a.queries||[]).length);
    else list = [...list].sort((a, b) => new Date(b.loadedAt) - new Date(a.loadedAt));
    return list;
  }

  function renderList() {
    const filtered = getFiltered();
    const listEl = overlay.querySelector('#cmpPickerList');
    const footerCount = overlay.querySelector('#cmpPickerCount');
    if (footerCount) footerCount.textContent = `${filtered.length} rapor listelendi`;
    if (!listEl) return;

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="cmp-picker-empty">Eşleşen rapor bulunamadı.<br><small>Arama terimini veya kategori filtresini değiştirin.</small></div>`;
      return;
    }

    listEl.innerHTML = filtered.map(f => {
      const isSelected = f.id === currentSelectedId;
      const isConflict = f.id === conflictId;
      const rName = f.meta?.reportName || f.name;
      const size = f.sizeBytes > 1024 ? Math.round(f.sizeBytes / 1024) + ' KB' : f.sizeBytes + ' B';
      const dateStr = new Date(f.loadedAt).toLocaleDateString('tr-TR');
      const qCount = (f.queries || []).length;

      return `<div class="cmp-picker-item${isSelected ? ' is-selected' : ''}${isConflict ? ' is-conflict' : ''}" data-id="${f.id}" title="${isConflict ? 'Bu rapor diğer panelde zaten seçili' : ''}">
        <span class="cmp-picker-item-icon" style="color:var(--accent);display:inline-flex;align-items:center;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </span>
        <div class="cmp-picker-item-body">
          <div class="cmp-picker-item-name">${isSelected ? '✓ ' : ''}${esc(rName)}</div>
          <div class="cmp-picker-item-meta">${esc(f.name)} · ${size} · ${dateStr}</div>
        </div>
        <div class="cmp-picker-item-badges">
          ${f.category ? `<span class="badge badge-purple" style="font-size:.66rem;">${esc(f.category)}</span>` : ''}
          ${qCount > 0 ? `<span class="badge badge-blue" style="font-size:.66rem;">${qCount} SQL</span>` : ''}
          ${isConflict ? `<span class="badge" style="font-size:.65rem;background:rgba(239,68,68,.12);color:#dc2626;">Seçili</span>` : `<button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-ghost'}" style="font-size:.7rem;padding:2px 9px;" data-id="${f.id}">${isSelected ? 'Seçili' : 'Seç'}</button>`}
        </div>
      </div>`;
    }).join('');

    // bind clicks
    listEl.querySelectorAll('.cmp-picker-item:not(.is-conflict)').forEach(el => {
      el.addEventListener('click', () => selectFile(el.dataset.id));
    });
  }

  function selectFile(id) {
    const selFile = FrpStore.getById(id);
    if (!selFile) return;
    if (slot === 'A') fileA = selFile;
    else if (slot === 'B') fileB = selFile;
    else fileC = selFile;
    document.body.removeChild(overlay);
    updateThreeWayLayout();
    updatePickerLabels();
    buildTabs();
    buildQueryAccordions();
    renderDiff();
  }

  const catOptions = cats.map(c => `<option value="${esc(c)}"${c === activeCat ? ' selected' : ''}>${esc(c)}</option>`).join('');

  overlay.innerHTML = `
    <div class="cmp-picker-modal">
      <div class="cmp-picker-header">
        <div class="cmp-picker-title" style="color:${slotColors[slot]}">${titles[slot]}</div>
        <button class="btn btn-sm btn-ghost" id="cmpPickerClose" style="font-size:1rem;padding:2px 10px;">✕</button>
      </div>

      <div class="cmp-picker-toolbar">
        <div class="cmp-picker-search-wrap">
          <input type="text" id="cmpPickerSearch" placeholder="Ad, dosya adı, GUID veya kategori ile ara..." autocomplete="off" />
        </div>
        <select id="cmpPickerCat" class="field-select" style="font-size:.8rem;height:36px;">
          <option value="">Tüm Kategoriler</option>
          ${catOptions}
        </select>
        <select id="cmpPickerSort" class="field-select" style="font-size:.8rem;height:36px;">
          <option value="date">Son Yüklenen</option>
          <option value="name">Ada Göre</option>
          <option value="size">Boyuta Göre</option>
          <option value="queries">SQL Sayısına Göre</option>
        </select>
        ${slot === 'C' && fileC ? `<button class="btn btn-sm btn-ghost" id="cmpPickerRemoveC" style="color:#ef4444;border-color:#ef4444;font-size:.75rem;">✕ Paneli Kaldır</button>` : ''}
      </div>

      <div class="cmp-picker-list" id="cmpPickerList"></div>

      <div class="cmp-picker-footer">
        <span id="cmpPickerCount">…</span>
        <button class="btn btn-sm btn-ghost" id="cmpPickerCancel">Kapat</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  renderList();

  const searchInp = overlay.querySelector('#cmpPickerSearch');
  searchInp?.focus();

  let debounceTimer;
  searchInp?.addEventListener('input', e => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      searchQuery = e.target.value;
      renderList();
    }, 120);
  });

  overlay.querySelector('#cmpPickerCat')?.addEventListener('change', e => {
    activeCat = e.target.value;
    renderList();
  });

  overlay.querySelector('#cmpPickerSort')?.addEventListener('change', e => {
    sortMode = e.target.value;
    renderList();
  });

  overlay.querySelector('#cmpPickerClose')?.addEventListener('click', () => document.body.removeChild(overlay));
  overlay.querySelector('#cmpPickerCancel')?.addEventListener('click', () => document.body.removeChild(overlay));

  overlay.querySelector('#cmpPickerRemoveC')?.addEventListener('click', () => {
    fileC = null;
    document.body.removeChild(overlay);
    updateThreeWayLayout();
    updatePickerLabels();
    buildTabs();
    buildQueryAccordions();
    renderDiff();
  });

  // close on backdrop click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) document.body.removeChild(overlay);
  });

  // keyboard escape
  const escHandler = e => { if (e.key === 'Escape' && document.body.contains(overlay)) { document.body.removeChild(overlay); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
}

function initSelectors() {
  const files = FrpStore.getAll();
  if (files.length < 2) {
    document.body.innerHTML = `
      <div style="display:flex;height:100vh;align-items:center;justify-content:center;flex-direction:column;gap:1.25rem;background:var(--bg-body);color:var(--text-primary);font-family:var(--font);">
        <div style="font-size:3.5rem;">⚠️</div>
        <div style="font-size:1.1rem;font-weight:800;">Karşılaştırma için en az 2 rapor gerekli.</div>
        <div style="font-size:.88rem;color:var(--text-muted);">Sistemde <strong>${files.length}</strong> rapor yüklü. En az 2 rapor yükleyin.</div>
        <button class="btn btn-primary" onclick="window.location.href='index.html'">← Ana Sayfaya Dön</button>
      </div>`;
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const idA = params.get('file1');
  const idB = params.get('file2');
  const idC = params.get('file3') || '';

  // Doğrudan URL parametrelerinden yükle, yoksa ilk iki raporu seç
  fileA = (idA && FrpStore.getById(idA)) || files[0];
  fileB = (idB && FrpStore.getById(idB)) || (files.length > 1 ? files[1] : files[0]);
  fileC = idC ? (FrpStore.getById(idC) || null) : null;

  // Picker buton bağlantıları
  document.getElementById('btnPickerA')?.addEventListener('click', () => openReportPickerForDiff('A'));
  document.getElementById('btnPickerB')?.addEventListener('click', () => openReportPickerForDiff('B'));
  document.getElementById('btnPickerC')?.addEventListener('click', () => openReportPickerForDiff('C'));

  updateThreeWayLayout();
  updatePickerLabels();
  buildTabs();
  buildQueryAccordions();
  renderDiff();
}

function buildTabs() {
  diffTabBar.innerHTML = '';

  const btnMeta = document.createElement('button');
  btnMeta.className = 'tab' + (activeTab === 'meta' ? ' active' : '');
  btnMeta.dataset.tab = 'meta';
  btnMeta.innerHTML = `Meta & Yapı`;
  btnMeta.addEventListener('click', () => {
    activeTab = 'meta';
    updateTabActive();
    renderDiff();
  });
  diffTabBar.appendChild(btnMeta);

  const btnPascal = document.createElement('button');
  btnPascal.className = 'tab' + (activeTab === 'pascal' ? ' active' : '');
  btnPascal.dataset.tab = 'pascal';
  btnPascal.innerHTML = `PascalScript`;
  btnPascal.addEventListener('click', () => {
    activeTab = 'pascal';
    updateTabActive();
    renderDiff();
  });
  diffTabBar.appendChild(btnPascal);

  const queriesA = fileA ? (fileA.queries || []).map(q => q.name) : [];
  const queriesB = fileB ? (fileB.queries || []).map(q => q.name) : [];
  const queriesC = fileC ? (fileC.queries || []).map(q => q.name) : [];
  const allQueries = [...new Set([...queriesA, ...queriesB, ...queriesC])];

  allQueries.forEach(qName => {
    const tabId = 'sql_' + qName;
    const btnSql = document.createElement('button');
    btnSql.className = 'tab' + (activeTab === tabId ? ' active' : '');
    btnSql.dataset.tab = tabId;
    btnSql.innerHTML = `${esc(qName)}`;
    btnSql.addEventListener('click', () => {
      activeTab = tabId;
      updateTabActive();
      renderDiff();
    });
    diffTabBar.appendChild(btnSql);
  });

  // Hızlı Sorgu Seçim Açılır Menüsü (Dropdown)
  if (selectQueryJump) {
    if (allQueries.length > 3) {
      selectQueryJump.style.display = 'inline-block';
      let optionsHtml = `
        <option value="pascal" ${activeTab === 'pascal' ? 'selected' : ''}>PascalScript</option>
        <option value="meta" ${activeTab === 'meta' ? 'selected' : ''}>Meta & Yapı</option>
        <optgroup label="SQL Sorguları (${allQueries.length})">
      `;
      allQueries.forEach(qName => {
        const tabId = 'sql_' + qName;
        optionsHtml += `<option value="${tabId}" ${activeTab === tabId ? 'selected' : ''}>${esc(qName)}</option>`;
      });
      optionsHtml += `</optgroup>`;
      selectQueryJump.innerHTML = optionsHtml;
    } else {
      selectQueryJump.style.display = 'none';
    }
  }

  updateTabActive();
}

// Sekme Kaydırma Butonları Olay Dinleyicileri
btnTabScrollLeft?.addEventListener('click', () => {
  tabBarScrollWrap?.scrollBy({ left: -220, behavior: 'smooth' });
});
btnTabScrollRight?.addEventListener('click', () => {
  tabBarScrollWrap?.scrollBy({ left: 220, behavior: 'smooth' });
});

selectQueryJump?.addEventListener('change', () => {
  if (selectQueryJump.value) {
    activeTab = selectQueryJump.value;
    updateTabActive();
    renderDiff();
  }
});

function buildQueryAccordions() {
  if (queryAccordionContainer) queryAccordionContainer.innerHTML = '';
}

function updateTabActive() {
  Array.from(diffTabBar.children).forEach(btn => {
    const isActive = btn.dataset.tab === activeTab;
    btn.classList.toggle('active', isActive);
    if (isActive) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });

  if (selectQueryJump && selectQueryJump.value !== activeTab) {
    selectQueryJump.value = activeTab;
  }
}

function formatDiffText(rawText, isPascal) {
  if (!rawText) return '';
  if (isPascal && typeof window.highlightPascal === 'function') {
    return window.highlightPascal(rawText);
  }
  if (!isPascal && typeof window.highlightSQL === 'function') {
    return window.highlightSQL(rawText);
  }
  return esc(rawText);
}

function renderDiff() {
  labelPaneA.textContent = fileA ? (fileA.meta.reportName || fileA.name) : 'Rapor 1';
  labelPaneB.textContent = fileB ? (fileB.meta.reportName || fileB.name) : 'Rapor 2';
  if (labelPaneC) {
    labelPaneC.textContent = fileC ? (fileC.meta.reportName || fileC.name) : 'Rapor 3';
  }

  if (activeTab === 'meta') {
    renderMetaDiff();
    return;
  }

  let textA = '';
  let textB = '';
  let textC = '';
  const isPascal = activeTab === 'pascal';

  if (isPascal) {
    textA = fileA ? (fileA.pascalScript || '') : '';
    textB = fileB ? (fileB.pascalScript || '') : '';
    textC = fileC ? (fileC.pascalScript || '') : '';
  } else if (activeTab.startsWith('sql_')) {
    const qName = activeTab.replace('sql_', '');
    const qA = fileA ? fileA.queries.find(q => q.name === qName) : null;
    const qB = fileB ? fileB.queries.find(q => q.name === qName) : null;
    const qC = fileC ? fileC.queries.find(q => q.name === qName) : null;
    textA = qA ? qA.sql : '';
    textB = qB ? qB.sql : '';
    textC = qC ? qC.sql : '';
  }

  const threeWay = isThreeWayEnabled();
  const alignedDiff = threeWay
    ? DiffEngine.computeThreeWayDiff(textA, textB, textC)
    : DiffEngine.computeLineDiff(textA, textB);
  const { linesA, linesB } = alignedDiff;
  const linesC = threeWay ? alignedDiff.linesC : null;

  renderMinimap(linesA, linesB);

  let addedCount = 0;
  let deletedCount = 0;
  currentDiffIndices = [];

  linesB.forEach((l, idx) => {
    if (l.type === 'add') addedCount++;
    if (l.type === 'del' || l.type === 'add') {
      if (currentDiffIndices.length === 0 || currentDiffIndices[currentDiffIndices.length - 1] !== idx - 1) {
        currentDiffIndices.push(idx);
      }
    }
  });

  linesA.forEach((l, idx) => {
    if (l.type === 'del') deletedCount++;
    if (l.type === 'del' && !currentDiffIndices.includes(idx)) {
      if (currentDiffIndices.length === 0 || currentDiffIndices[currentDiffIndices.length - 1] !== idx - 1) {
        currentDiffIndices.push(idx);
      }
    }
  });

  currentDiffIndices.sort((x, y) => x - y);
  activeDiffPointer = currentDiffIndices.length > 0 ? 0 : -1;
  updateDiffCounterUI();

  if (!threeWay) {
    diffSummaryBar.innerHTML = `
      <span><strong>${linesA.length}</strong> satır karşılaştırıldı</span>
      <span class="diff-stat-add">+${addedCount} satır eklendi</span>
      <span class="diff-stat-del">-${deletedCount} satır silindi</span>
      <span style="margin-left:auto;color:var(--text-muted);font-size:.75rem;">Aralarında gezinmek için Alt + N / Alt + P tuşlarını kullanabilirsiniz.</span>
    `;
  } else {
    diffSummaryBar.innerHTML = `
      <span><strong>${linesA.length}</strong> satır karşılaştırıldı</span>
      <span class="diff-stat-add">B: +${addedCount}</span>
      <span class="diff-stat-del">B: -${deletedCount}</span>
    `;
  }

  const renderedA = [];
  const renderedB = [];

  let i = 0;
  while (i < linesA.length) {
    const lA = linesA[i];
    const lB = linesB[i];

    // Fold unchanged logic
    if (isFoldUnchanged && !threeWay && lA.type === 'same' && lB.type === 'same') {
      let sameCount = 0;
      let startIdx = i;
      while (i < linesA.length && linesA[i].type === 'same' && linesB[i].type === 'same') {
        sameCount++;
        i++;
      }
      if (sameCount > 4) {
        const foldLabel = `... ${sameCount} aynı satır gizlendi (Tümünü göster) ...`;
        renderedA.push(`<div class="diff-row same folded-row" onclick="unfoldAll()"><span class="diff-num">...</span><span class="diff-content">${foldLabel}</span></div>`);
        renderedB.push(`<div class="diff-row same folded-row" onclick="unfoldAll()"><span class="diff-num">...</span><span class="diff-content">${foldLabel}</span></div>`);
        continue;
      } else {
        // Rollback i to render individually if less than 5
        i = startIdx;
      }
    }

    const transferRowIndex = lA.pairRowIndex ?? lB.pairRowIndex ?? i;
    const actionsA = lA.type === 'empty' && lB.text && transferRowIndex !== null
      ? `<span class="diff-row-actions"><button class="btn-inline-action" onclick="transferLine('A', ${transferRowIndex})" title="Bu farkı sağ panelden sil">Sağdan sil</button></span>`
      : (lA.type === 'del' || lA.type === 'add') && lA.text && transferRowIndex !== null ? `<span class="diff-row-actions"><button class="btn-inline-action" onclick="transferLine('A', ${transferRowIndex})" title="Sağ panele aktar">Aktar</button><button class="btn-inline-action" onclick="copyLineText('${encodeInlineArg(lA.text)}')" title="Kopyala">Kopyala</button></span>` : '';
    const actionsB = lB.type === 'empty' && lA.text && transferRowIndex !== null
      ? `<span class="diff-row-actions"><button class="btn-inline-action" onclick="transferLine('B', ${transferRowIndex})" title="Bu farkı sol panelden sil">Soldan sil</button></span>`
      : (lB.type === 'add' || lB.type === 'del') && lB.text && transferRowIndex !== null ? `<span class="diff-row-actions"><button class="btn-inline-action" onclick="transferLine('B', ${transferRowIndex})" title="Sol panele aktar">Aktar</button><button class="btn-inline-action" onclick="copyLineText('${encodeInlineArg(lB.text)}')" title="Kopyala">Kopyala</button></span>` : '';

    if (lA.type === 'del' && lB.type === 'add' && lA.pairedText !== undefined) {
      const { wordsA, wordsB } = DiffEngine.computeWordDiff(lA.text, lB.text);
      
      const contentA = wordsA.map(w => w.type === 'del' ? `<mark class="diff-word-del">${esc(w.text)}</mark>` : formatDiffText(w.text, isPascal)).join('');
      const contentB = wordsB.map(w => w.type === 'add' ? `<mark class="diff-word-add">${esc(w.text)}</mark>` : formatDiffText(w.text, isPascal)).join('');

      renderedA.push(`<div class="diff-row del" id="rowA_${i}"><span class="diff-num">${lA.num}</span><span class="diff-content">${actionsA}${contentA}</span></div>`);
      renderedB.push(`<div class="diff-row add" id="rowB_${i}"><span class="diff-num">${lB.num}</span><span class="diff-content">${actionsB}${contentB}</span></div>`);
    } else {
      const contentA = lA.type !== 'empty' ? formatDiffText(lA.text, isPascal) : '';
      const contentB = lB.type !== 'empty' ? formatDiffText(lB.text, isPascal) : '';

      renderedA.push(`<div class="diff-row ${lA.type}" id="rowA_${i}"><span class="diff-num">${lA.num !== null ? lA.num : ''}</span><span class="diff-content">${actionsA}${contentA}</span></div>`);
      renderedB.push(`<div class="diff-row ${lB.type}" id="rowB_${i}"><span class="diff-num">${lB.num !== null ? lB.num : ''}</span><span class="diff-content">${actionsB}${contentB}</span></div>`);
    }

    i++;
  }

  tablePaneA.innerHTML = renderedA.join('');
  tablePaneB.innerHTML = renderedB.join('');

  if (threeWay && linesC && tablePaneC) {
    const renderedC = [];
    for (let j = 0; j < linesC.length; j++) {
      const lC = linesC[j];
      const contentC = lC.type !== 'empty' ? formatDiffText(lC.text, isPascal) : '';
      renderedC.push(`<div class="diff-row ${lC.type}" id="rowC_${j}"><span class="diff-num">${lC.num !== null ? lC.num : ''}</span><span class="diff-content">${contentC}</span></div>`);
    }
    tablePaneC.innerHTML = renderedC.join('');
  }

  if (!threeWay && tablePaneC) {
    tablePaneC.innerHTML = '';
  }
}

function unfoldAll() {
  isFoldUnchanged = false;
  if (btnToggleFold) {
    btnToggleFold.classList.remove('active');
    btnToggleFold.textContent = 'Sadece Farklar';
  }
  renderDiff();
}
window.unfoldAll = unfoldAll;

function updateDiffCounterUI() {
  if (!diffCounterBadge) return;
  const total = currentDiffIndices.length;
  if (total === 0) {
    diffCounterBadge.textContent = 'Fark Yok';
    diffCounterBadge.className = 'badge badge-gray';
    if (btnPrevDiff) btnPrevDiff.disabled = true;
    if (btnNextDiff) btnNextDiff.disabled = true;
  } else {
    diffCounterBadge.textContent = `Fark ${activeDiffPointer + 1} / ${total}`;
    diffCounterBadge.className = 'badge badge-primary';
    if (btnPrevDiff) btnPrevDiff.disabled = false;
    if (btnNextDiff) btnNextDiff.disabled = false;
  }
}

function scrollToCurrentDiff() {
  if (activeDiffPointer < 0 || activeDiffPointer >= currentDiffIndices.length) return;
  const rowIdx = currentDiffIndices[activeDiffPointer];

  document.querySelectorAll('.diff-row.active-diff').forEach(r => r.classList.remove('active-diff'));

  const rowA = document.getElementById(`rowA_${rowIdx}`);
  const rowB = document.getElementById(`rowB_${rowIdx}`);
  const rowC = document.getElementById(`rowC_${rowIdx}`);

  if (rowA) rowA.classList.add('active-diff');
  if (rowB) rowB.classList.add('active-diff');
  if (rowC) rowC.classList.add('active-diff');

  const targetEl = rowA || rowB;
  if (targetEl && scrollPaneA) {
    const top = targetEl.offsetTop - 100;
    scrollPaneA.scrollTop = Math.max(0, top);
    if (scrollPaneB) scrollPaneB.scrollTop = Math.max(0, top);
    if (scrollPaneC) scrollPaneC.scrollTop = Math.max(0, top);
  }
  updateDiffCounterUI();
}

if (btnPrevDiff) {
  btnPrevDiff.addEventListener('click', () => {
    if (currentDiffIndices.length === 0) return;
    activeDiffPointer = (activeDiffPointer - 1 + currentDiffIndices.length) % currentDiffIndices.length;
    scrollToCurrentDiff();
  });
}

if (btnNextDiff) {
  btnNextDiff.addEventListener('click', () => {
    if (currentDiffIndices.length === 0) return;
    activeDiffPointer = (activeDiffPointer + 1) % currentDiffIndices.length;
    scrollToCurrentDiff();
  });
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
    e.preventDefault();
    undoTransfer();
  }
  if (e.altKey && (e.key === 'n' || e.key === 'N')) {
    e.preventDefault();
    btnNextDiff?.click();
  }
  if (e.altKey && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault();
    btnPrevDiff?.click();
  }
});

window.refreshAll = () => {
  initSelectors();
};

if (window.FrpStoreReady) {
  window.FrpStoreReady.then(() => {
    initSelectors();
  });
} else {
  initSelectors();
}
