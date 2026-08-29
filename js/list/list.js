// ============================================================
//  list.js — Ana Sayfa (index.html) Orkestratörü v7.2
//  Sağ Tık Menüsü, Toplu İşlemler Barı, Analiz Modalları, Çalışma Alanı, Filtreler & Mobil Çekmece
// ============================================================

let allFiles         = [];
window.allFiles      = allFiles;
let selectedIds      = new Set();
window.selectedIds   = selectedIds;
let sortField        = 'loadedAt';
let sortDir          = 'desc';
let searchQuery      = '';
let searchField      = 'all';
let selectedTag      = '';
let selectedCategory = '';
let onlyFavorites    = false;
let onlyPinned       = false;
let onlyNotes        = false;
let isRegexMode      = false;
let isStoreLoaded    = false;
let currentPage      = 1;
let currentViewMode  = 'table';
let _lastSelectedRowId = null;

const tableBody          = document.getElementById('tableBody');
const searchInput        = document.getElementById('searchInput');
const regexBtn           = document.getElementById('regexBtn');
const regexErrMsg        = document.getElementById('regexErrMsg');
const fieldSelect        = document.getElementById('fieldSelect') || document.getElementById('searchFieldSelect');
const tagSelect          = document.getElementById('tagSelect');
const catSelect          = document.getElementById('catSelect');
const btnFavOnly         = document.getElementById('btnFavOnly');
const bulkBar            = document.getElementById('bulkBar');
const resultCount        = document.getElementById('resultCount');
const btnThemeToggle     = document.getElementById('btnThemeToggle');
const ctxMenu            = document.getElementById('tableContextMenu');

let contextTargetId = null;

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
window.escHtml = escHtml;

function toast(msg, type = 'info', duration = 3500) {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast-item ' + type;
  el.innerHTML = `<span>${escHtml(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(40px)';
    el.style.transition = '.3s';
    setTimeout(() => el.remove(), 350);
  }, duration);
}
window.toast = toast;

// ── Tema Yönetimi ───────────────────────────────────────────
function updateThemeBtn() {
  if (!btnThemeToggle) return;
  const cur = FrpStore.getTheme();
  btnThemeToggle.textContent = cur === 'dark' ? 'Aydınlık Mod' : 'Koyu Mod';
}

if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', () => {
    const cur = FrpStore.getTheme();
    FrpStore.setTheme(cur === 'dark' ? 'light' : 'dark');
    updateThemeBtn();
  });
}
updateThemeBtn();

// ── Topbar Dropdown ─────────────────────────────────────────
function setupTopbarDropdowns() {
  document.querySelectorAll('.topbar-dropdown').forEach(dropdown => {
    let leaveTimeout = null;
    const toggleBtn = dropdown.querySelector('.topbar-dropdown-toggle');
    const menu = dropdown.querySelector('.topbar-dropdown-menu');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');
        document.querySelectorAll('.topbar-dropdown.open').forEach(d => d.classList.remove('open'));
        if (!isOpen) dropdown.classList.add('open');
      });
    }

    dropdown.addEventListener('mouseenter', () => {
      if (leaveTimeout) clearTimeout(leaveTimeout);
      dropdown.classList.add('open');
    });

    dropdown.addEventListener('mouseleave', () => {
      leaveTimeout = setTimeout(() => dropdown.classList.remove('open'), 350);
    });

    if (menu) {
      menu.addEventListener('mouseenter', () => { if (leaveTimeout) clearTimeout(leaveTimeout); dropdown.classList.add('open'); });
      menu.addEventListener('mouseleave', () => { leaveTimeout = setTimeout(() => dropdown.classList.remove('open'), 350); });
      menu.querySelectorAll('.topbar-dropdown-item').forEach(item => {
        item.addEventListener('click', () => dropdown.classList.remove('open'));
      });
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar-dropdown')) {
      document.querySelectorAll('.topbar-dropdown.open').forEach(d => d.classList.remove('open'));
    }
  });
}
setupTopbarDropdowns();

// ── Dosya Yükleme & Parse Motoru ────────────────────────────
async function readFileAsText(file) {
  try {
    const buffer = await file.arrayBuffer();
    try {
      const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
      let decoded = utf8Decoder.decode(buffer);
      if (typeof fixTurkishMojibake === 'function') decoded = fixTurkishMojibake(decoded);
      return decoded;
    } catch {
      const win1254Decoder = new TextDecoder('windows-1254');
      let decoded = win1254Decoder.decode(buffer);
      if (typeof fixTurkishMojibake === 'function') decoded = fixTurkishMojibake(decoded);
      return decoded;
    }
  } catch (err) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => {
        let res = e.target.result;
        if (typeof fixTurkishMojibake === 'function') res = fixTurkishMojibake(res);
        resolve(res);
      };
      reader.onerror = () => reject(new Error('Dosya okunamadı'));
      reader.readAsText(file, 'utf-8');
    });
  }
}

async function handleFiles(fileList) {
  const allIncoming = Array.from(fileList || []);
  if (allIncoming.length === 0) return;

  const validFiles = [];
  const rejectedFiles = [];

  allIncoming.forEach(f => {
    const isFrp = f.name.toLowerCase().endsWith('.frp') || f.name.toLowerCase().endsWith('.fr3');
    if (!isFrp) {
      rejectedFiles.push({ name: f.name, reason: 'Yalnızca .frp veya .fr3 dosyaları yüklenebilir.' });
    } else {
      validFiles.push(f);
    }
  });

  if (rejectedFiles.length > 0) {
    toast(`${rejectedFiles.length} dosya geçersiz format nedeniyle atlandı.`, 'warning');
  }

  if (validFiles.length === 0) return;

  const resultsToSave = [];

  for (let i = 0; i < validFiles.length; i++) {
    const file = validFiles[i];
    try {
      const text = await readFileAsText(file);
      if (!text || text.trim().length === 0) continue;
      const parsed = typeof parseFrp === 'function' ? parseFrp(text) : { reportName: file.name, queries: [] };
      resultsToSave.push({ parsedData: parsed, fileName: file.name, fileSize: file.size });
    } catch (err) {
      console.warn('Dosya okuma hatası:', file.name, err);
    }
  }

  if (resultsToSave.length > 0) {
    const res = FrpStore.addMany(resultsToSave);
    const added = res.added || resultsToSave.length;
    const updated = res.updated || 0;
    toast(`${added} rapor başarıyla yüklendi.${updated > 0 ? ` (${updated} güncellendi)` : ''}`, 'success');
    if (window.FrpAudit) {
      window.FrpAudit.logAction({
        action: 'REPORT_UPLOAD',
        target: `${added} Rapor`,
        details: `${added} adet rapor sisteme başarıyla yüklendi.`
      });
    }
    refreshAll();
  }
}
window.handleFiles = handleFiles;

// ── Sıralama Mantığı ────────────────────────────────────────
function sortFiles(files) {
  return [...files].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;

    let va, vb;
    switch (sortField) {
      case 'name':
        va = (a.meta?.reportName || a.name || '').toLowerCase();
        vb = (b.meta?.reportName || b.name || '').toLowerCase();
        break;
      case 'fileName':
        va = (a.name || '').toLowerCase();
        vb = (b.name || '').toLowerCase();
        break;
      case 'sizeBytes':
        va = Number(a.sizeBytes || a.size) || 0;
        vb = Number(b.sizeBytes || b.size) || 0;
        break;
      case 'guid':
        va = (a.meta?.guid || '').toLowerCase();
        vb = (b.meta?.guid || '').toLowerCase();
        break;
      case 'category':
        va = (a.category || '').toLowerCase();
        vb = (b.category || '').toLowerCase();
        break;
      case 'queries':
        va = (a.queries || []).length;
        vb = (b.queries || []).length;
        break;
      case 'lastModified':
        va = new Date(a.updatedAt || a.lastModified || a.loadedAt).getTime() || 0;
        vb = new Date(b.updatedAt || b.lastModified || b.loadedAt).getTime() || 0;
        break;
      case 'loadedAt':
      default:
        va = new Date(a.loadedAt).getTime() || 0;
        vb = new Date(b.loadedAt).getTime() || 0;
        break;
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
}
window.sortFiles = sortFiles;

// ── Arama & Filtreleme ──────────────────────────────────────
function applySearch() {
  currentPage = 1;
  const btnReset = document.getElementById('btnResetFilters');
  if (btnReset) {
    const hasFilter = !!searchQuery || !!selectedTag || !!selectedCategory || onlyFavorites || onlyPinned || onlyNotes;
    btnReset.style.display = hasFilter ? 'inline-flex' : 'none';
  }

  let regex = null;
  if (regexErrMsg) regexErrMsg.style.display = 'none';

  if (isRegexMode && searchQuery) {
    try {
      regex = new RegExp(searchQuery, 'i');
    } catch (err) {
      if (regexErrMsg) {
        regexErrMsg.textContent = 'Geçersiz Regex: ' + err.message;
        regexErrMsg.style.display = 'block';
      }
      return;
    }
  }

  const curWs = FrpStore.getActiveWorkspace ? FrpStore.getActiveWorkspace() : 'personal';
  let baseList = curWs === 'pool'
    ? (FrpStore.getPoolReports ? FrpStore.getPoolReports() : [])
    : (FrpStore.getMyReports ? FrpStore.getMyReports() : FrpStore.getAll());

  allFiles = baseList.filter(file => {
    if (onlyFavorites && !file.isFavorite) return false;
    if (selectedTag && !(file.tags || []).includes(selectedTag)) return false;
    if (onlyPinned && !file.isPinned) return false;
    if (onlyNotes && !(file.userNote && file.userNote.trim())) return false;
    if (selectedCategory && file.category !== selectedCategory) return false;

    if (!searchQuery) return true;

    const name = file.meta?.reportName || file.name || '';
    const fileName = file.name || '';
    const guid = file.meta?.guid || '';
    const owner = file.ownerName || file.owner_name || '';
    const sql = (file.queries || []).map(x => x.sql || '').join(' ');
    const pascal = file.pascalScript || '';
    const notes = file.userNote || '';

    if (regex) {
      if (searchField === 'name') return regex.test(name);
      if (searchField === 'guid') return regex.test(guid);
      if (searchField === 'sql') return regex.test(sql);
      if (searchField === 'pascal') return regex.test(pascal);
      if (searchField === 'notes') return regex.test(notes);
      if (searchField === 'author' || searchField === 'owner') return regex.test(owner);
      return regex.test(name) || regex.test(fileName) || regex.test(guid) || regex.test(owner) || regex.test(sql) || regex.test(pascal) || regex.test(notes);
    }

    const q = searchQuery.toLowerCase();
    const lName = name.toLowerCase();
    const lFileName = fileName.toLowerCase();
    const lGuid = guid.toLowerCase();
    const lOwner = owner.toLowerCase();
    const lSql = sql.toLowerCase();
    const lPascal = pascal.toLowerCase();
    const lNotes = notes.toLowerCase();

    if (searchField === 'name') return lName.includes(q);
    if (searchField === 'guid') return lGuid.includes(q);
    if (searchField === 'sql') return lSql.includes(q);
    if (searchField === 'pascal') return lPascal.includes(q);
    if (searchField === 'notes') return lNotes.includes(q);
    if (searchField === 'author' || searchField === 'owner') return lOwner.includes(q);
    return lName.includes(q) || lFileName.includes(q) || lGuid.includes(q) || lOwner.includes(q) || lSql.includes(q) || lPascal.includes(q) || lNotes.includes(q);
  });

  window.allFiles = allFiles;
  renderCurrentView();
  updateWorkspaceCounts();
}
window.applySearch = applySearch;

function updateWorkspaceCounts() {
  const myCount = (FrpStore.getMyReports ? FrpStore.getMyReports() : FrpStore.getAll()).length;
  const poolCount = (FrpStore.getPoolReports ? FrpStore.getPoolReports() : []).length;
  const myBadge = document.getElementById('badgeMyCount');
  const poolBadge = document.getElementById('badgePoolCount');
  if (myBadge) myBadge.textContent = myCount;
  if (poolBadge) poolBadge.textContent = poolCount;
}

function updateTagList() {
  if (!tagSelect) return;
  const tags = FrpStore.getAllTags ? FrpStore.getAllTags() : [];
  const curVal = tagSelect.value;
  tagSelect.innerHTML = '<option value="">Tüm Etiketler</option>' +
    tags.map(t => `<option value="${escHtml(t)}" ${t === curVal ? 'selected' : ''}>${escHtml(t)}</option>`).join('');
}
window.updateTagList = updateTagList;

function updateCatList() {
  if (!catSelect) return;
  const cats = FrpStore.getCategories ? FrpStore.getCategories() : [];
  const curVal = catSelect.value;
  catSelect.innerHTML = '<option value="">Tüm Kategoriler</option>' +
    cats.map(c => `<option value="${escHtml(c)}" ${c === curVal ? 'selected' : ''}>${escHtml(c)}</option>`).join('');
}
window.updateCatList = updateCatList;

function updateStats() {
  updateWorkspaceCounts();
  updateTagList();
  updateCatList();
}
window.updateStats = updateStats;

// ── Görünüm Değiştirici ─────────────────────────────────────
function renderCurrentView() {
  const tableEl = document.getElementById('reportTable');
  let cardsEl   = document.getElementById('cardsView');
  let timelineEl= document.getElementById('timelineView');

  // Buton aktiflik durumları
  document.getElementById('btnViewTable')?.classList.toggle('active', currentViewMode === 'table');
  document.getElementById('btnViewCards')?.classList.toggle('active', currentViewMode === 'cards');
  document.getElementById('btnViewTimeline')?.classList.toggle('active', currentViewMode === 'timeline');

  if (currentViewMode === 'cards') {
    if (tableEl) tableEl.style.display = 'none';
    if (timelineEl) timelineEl.style.display = 'none';
    if (!cardsEl) {
      cardsEl = document.createElement('div');
      cardsEl.id = 'cardsView';
      cardsEl.className = 'cards-grid';
      document.querySelector('.table-area').appendChild(cardsEl);
    }
    cardsEl.style.display = 'grid';
    renderCards(cardsEl);
  } else if (currentViewMode === 'timeline') {
    if (tableEl) tableEl.style.display = 'none';
    if (cardsEl) cardsEl.style.display = 'none';
    if (!timelineEl) {
      timelineEl = document.createElement('div');
      timelineEl.id = 'timelineView';
      timelineEl.className = 'timeline-wrap';
      document.querySelector('.table-area').appendChild(timelineEl);
    }
    timelineEl.style.display = 'flex';
    renderTimeline(timelineEl);
  } else {
    if (cardsEl) cardsEl.style.display = 'none';
    if (timelineEl) timelineEl.style.display = 'none';
    if (tableEl) tableEl.style.display = '';
    renderTable();
  }
}
window.renderCurrentView = renderCurrentView;

// ── Tablo Görünümü Render ───────────────────────────────────
function renderTable() {
  const sorted = sortFiles(allFiles);
  if (resultCount) resultCount.textContent = sorted.length + ' sonuç';

  const prefs = FrpStore.getPreferences();
  const pageSize = prefs.pageSize || 50;
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * pageSize;
  const pagedFiles = pageSize >= 9999 ? sorted : sorted.slice(startIndex, startIndex + pageSize);

  renderPaginationControls(totalItems, pageSize);

  const visibleCols = {
    reportName: true,
    fileName: true,
    fileSize: true,
    category: true,
    guid: true,
    tags: true,
    queries: false,
    date: true,
    lastModified: true,
    ...(prefs.visibleColumns || {})
  };

  if (window.FrpListRenderers && typeof window.FrpListRenderers.renderTableHeader === 'function') {
    window.FrpListRenderers.renderTableHeader(prefs, visibleCols, sortField, sortDir);
  }

  const validMap = new Set(FrpStore.getAll().map(f => f.id));
  for (const id of selectedIds) {
    if (!validMap.has(id)) selectedIds.delete(id);
  }

  const curSelectAll = document.getElementById('selectAll');
  if (curSelectAll) {
    curSelectAll.checked = pagedFiles.length > 0 && pagedFiles.every(f => selectedIds.has(f.id));
    curSelectAll.onchange = () => {
      if (curSelectAll.checked) pagedFiles.forEach(f => selectedIds.add(f.id));
      else pagedFiles.forEach(f => selectedIds.delete(f.id));
      renderCurrentView();
      updateBulkBar();
    };
  }

  if (!tableBody) return;

  if (sorted.length === 0) {
    tableBody.innerHTML = `
      <tr><td colspan="10">
        <div class="empty-state">
          <div class="empty-title">${searchQuery || selectedTag || onlyFavorites || onlyPinned || onlyNotes ? 'Sonuç bulunamadı' : 'Henüz rapor yüklenmedi'}</div>
          <div class="empty-sub">${searchQuery || selectedTag || onlyFavorites || onlyPinned || onlyNotes ? 'Arama veya filtre kriterlerini değiştirin.' : 'Rapor eklemek için yukarıdaki butonları kullanın.'}</div>
        </div>
      </td></tr>`;
    return;
  }

  const currentOrder = prefs.columnOrder && prefs.columnOrder.length > 0
    ? prefs.columnOrder
    : (window.FrpListRenderers?.DEFAULT_COLUMN_ORDER || ['reportName', 'fileName', 'fileSize', 'category', 'guid', 'tags', 'queries', 'date', 'lastModified']);

  tableBody.innerHTML = pagedFiles.map(file => {
    const isSelected = selectedIds.has(file.id);
    const date = new Date(file.loadedAt).toLocaleDateString('tr-TR');
    const numBytes = Number(file.sizeBytes || file.size) || 0;
    const size = numBytes > 1024 ? (numBytes > 1048576 ? (numBytes / 1048576).toFixed(1) + ' MB' : Math.round(numBytes / 1024) + ' KB') : (numBytes > 0 ? numBytes + ' B' : '—');
    const reportName = file.meta?.reportName || file.name;
    const hasNote = !!(file.userNote && file.userNote.trim());
    
    const tagsHtml = (file.tags || []).map(t => window.renderTag ? window.renderTag(t) : `<span class="tag-pill">${escHtml(t)}</span>`).join(' ');
    
    const guidVal = (file.meta && file.meta.guid) ? file.meta.guid : '';
    const guidColHtml = guidVal
      ? `<span class="badge badge-gray" onclick="event.stopPropagation();copyGuidText('${escHtml(guidVal)}')" title="Tıklayınca GUID kopyalar" style="cursor:pointer;font-family:var(--mono);font-size:.72rem;">${escHtml(guidVal)}</span>`
      : `<span style="color:var(--text-muted);font-size:.75rem;">—</span>`;
      
    const catHtml = file.category
      ? `<span class="badge badge-purple" onclick="event.stopPropagation();openCategoryModalFor('${file.id}')" style="cursor:pointer;">${escHtml(file.category)}</span>`
      : `<button class="btn btn-sm" onclick="event.stopPropagation();openCategoryModalFor('${file.id}')" style="padding:1px 6px;font-size:.72rem;">+ Kategori</button>`;

    const helperData = { reportName, size, date, hasNote, tagsHtml, guidColHtml, catHtml };
    let colsHtml = '';
    currentOrder.forEach(colKey => {
      if (visibleCols[colKey] === false) return;
      const def = window.FrpListRenderers?.COLUMN_DEFS[colKey];
      if (def) colsHtml += def.renderTd(file, helperData);
    });

    return `
      <tr class="${isSelected ? 'selected' : ''} ${file.isPinned ? 'pinned-row' : ''}" data-id="${file.id}" onclick="handleItemClick(event, '${file.id}')" style="cursor:pointer;">
        <td onclick="event.stopPropagation();"><input type="checkbox" class="row-checkbox" data-id="${file.id}" ${isSelected ? 'checked' : ''} onchange="toggleSelect(event, '${file.id}')" /></td>
        <td style="white-space:nowrap;text-align:center;" onclick="event.stopPropagation();">
          <button class="star-btn ${file.isFavorite ? 'active' : ''}" onclick="toggleFav(event, '${file.id}')" title="Favori">★</button>
          <button class="pin-btn ${file.isPinned ? 'active' : ''}" onclick="togglePin(event, '${file.id}')" title="Üste Sabitle" style="background:none;border:none;cursor:pointer;font-size:.95rem;padding:0 .15rem;opacity:${file.isPinned ? '1' : '0.35'};">📌</button>
        </td>
        ${colsHtml}
      </tr>
    `;
  }).join('');

  updateBulkBar();
  bindTableSortHeaders();
}
window.renderTable = renderTable;

// ── Kartlar ve Zaman Tüneli Delegasyonları ───────────────────
function renderCards(container) {
  const sorted = sortFiles(allFiles);
  if (resultCount) resultCount.textContent = sorted.length + ' sonuç';
  const target = container || document.getElementById('cardsView');
  if (window.FrpListRenderers?.renderCards) window.FrpListRenderers.renderCards(sorted, target);
}
window.renderCards = renderCards;

function renderTimeline(container) {
  const sorted = sortFiles(allFiles);
  if (resultCount) resultCount.textContent = sorted.length + ' sonuç';
  const target = container || document.getElementById('timelineView');
  if (window.FrpListRenderers?.renderTimeline) window.FrpListRenderers.renderTimeline(sorted, target);
}
window.renderTimeline = renderTimeline;

// ── Sayfalama Kontrolleri ───────────────────────────────────
function renderPaginationControls(totalItems, pageSize) {
  let pagWrap = document.getElementById('paginationWrap');
  if (!pagWrap) {
    pagWrap = document.createElement('div');
    pagWrap.id = 'paginationWrap';
    pagWrap.className = 'pagination-bar';
    document.querySelector('.table-area')?.appendChild(pagWrap);
  }

  if (pageSize >= 9999 || totalItems <= pageSize) {
    pagWrap.style.display = 'none';
    return;
  }

  pagWrap.style.display = 'flex';
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startNum = (currentPage - 1) * pageSize + 1;
  const endNum = Math.min(totalItems, currentPage * pageSize);

  pagWrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:.4rem;font-size:.82rem;color:var(--text-secondary);">
      <span>Toplam <strong>${totalItems}</strong> rapordan <strong>${startNum} - ${endNum}</strong> arası gösteriliyor</span>
    </div>
    <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;">
      <button class="btn btn-sm" id="btnPagFirst" ${currentPage === 1 ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}>« İlk</button>
      <button class="btn btn-sm" id="btnPagPrev" ${currentPage === 1 ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}>‹ Önceki</button>
      <span style="font-weight:700;font-size:.82rem;padding:0 .3rem;">Sayfa ${currentPage} / ${totalPages}</span>
      <button class="btn btn-sm" id="btnPagNext" ${currentPage === totalPages ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}>Sonraki ›</button>
      <button class="btn btn-sm" id="btnPagLast" ${currentPage === totalPages ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}>Son »</button>
    </div>
  `;

  pagWrap.querySelector('#btnPagFirst')?.addEventListener('click', () => { currentPage = 1; renderCurrentView(); });
  pagWrap.querySelector('#btnPagPrev')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderCurrentView(); } });
  pagWrap.querySelector('#btnPagNext')?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderCurrentView(); } });
  pagWrap.querySelector('#btnPagLast')?.addEventListener('click', () => { currentPage = totalPages; renderCurrentView(); });
}

// ── Sütun Sıralama Başlıkları ───────────────────────────────
function bindTableSortHeaders() {
  document.querySelectorAll('#tableHeaderRow th.sortable').forEach(th => {
    th.onclick = () => {
      const field = th.dataset.sort;
      if (sortField === field) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else { sortField = field; sortDir = 'asc'; }
      renderTable();
    };
  });
}

// ── Satır Tıklama (Ctrl / Shift / Normal Detay Açma) ────────
function handleItemClick(e, id) {
  if (e && e.target.closest('button, input, a, .badge, .owner-chip, .tag-pill')) return;

  const sorted = sortFiles(allFiles);

  if (e.ctrlKey || e.metaKey) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    _lastSelectedRowId = id;
    renderCurrentView();
    updateBulkBar();
    return;
  }

  if (e.shiftKey && _lastSelectedRowId) {
    const idx1 = sorted.findIndex(f => f.id === _lastSelectedRowId);
    const idx2 = sorted.findIndex(f => f.id === id);
    if (idx1 !== -1 && idx2 !== -1) {
      const start = Math.min(idx1, idx2);
      const end = Math.max(idx1, idx2);
      for (let i = start; i <= end; i++) selectedIds.add(sorted[i].id);
      renderCurrentView();
      updateBulkBar();
      return;
    }
  }

  _lastSelectedRowId = id;
  openDetail(id);
}
window.handleItemClick = handleItemClick;

function openDetail(id) {
  window.location.href = 'detail.html?id=' + encodeURIComponent(id);
}
window.openDetail = openDetail;

function toggleSelect(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderCurrentView();
  updateBulkBar();
}
window.toggleSelect = toggleSelect;

function toggleFav(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  const newState = FrpStore.toggleFavorite(id);
  toast(newState ? 'Favorilere eklendi' : 'Favorilerden çıkarıldı', 'info');
  refreshAll();
}
window.toggleFav = toggleFav;

function togglePin(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  const newState = FrpStore.togglePin(id);
  toast(newState ? 'Rapor üste sabitlendi' : 'Sabitleme kaldırıldı', 'info');
  refreshAll();
}
window.togglePin = togglePin;

function copyGuidText(guid) {
  navigator.clipboard.writeText(guid).then(() => toast(`GUID kopyalandı: ${guid}`, 'success'));
}
window.copyGuidText = copyGuidText;

// ── Toplu İşlemler Çubuğu (Bulk Bar) ────────────────────────
function updateBulkBar() {
  if (!bulkBar) return;
  const count = selectedIds.size;
  if (count > 0) {
    bulkBar.classList.add('show');
    bulkBar.classList.add('visible');
    const info = document.getElementById('bulkInfo');
    if (info) info.textContent = `${count} rapor seçildi`;

    const btnCompare = document.getElementById('btnCompareSelected');
    if (btnCompare) {
      btnCompare.style.display = count >= 2 ? 'inline-flex' : 'none';
      btnCompare.textContent = count === 2 ? 'Karşılaştır (Diff)' : `Seçilen ${count} Raporu Karşılaştır`;
    }
  } else {
    bulkBar.classList.remove('show');
    bulkBar.classList.remove('visible');
  }
}
window.updateBulkBar = updateBulkBar;

// ── SAĞ TIK CONTEXT MENÜSÜ BAĞLANTISI ───────────────────────
function hideContextMenu() {
  if (ctxMenu) ctxMenu.style.display = 'none';
  contextTargetId = null;
}

function setupContextMenu() {
  if (!tableBody || !ctxMenu) return;

  tableBody.addEventListener('contextmenu', e => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();

    contextTargetId = row.dataset.id;
    const file = FrpStore.getById(contextTargetId);
    if (!file) return;

    const titleEl = document.getElementById('ctxMenuReportTitle');
    if (titleEl) titleEl.textContent = file.meta?.reportName || file.name;

    const isPublic = !!(file.isPublic || file.is_public);
    const textTogglePool = document.getElementById('ctxTextTogglePool');
    if (textTogglePool) textTogglePool.textContent = isPublic ? 'Havuzdan Kaldır' : 'Ortak Havuzda Paylaş';

    // Konumlandırma
    ctxMenu.style.display = 'flex';
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 280);
    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;
  });

  document.addEventListener('click', (e) => {
    if (ctxMenu && !ctxMenu.contains(e.target)) hideContextMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu();
  });

  // Menü içi buton aksiyonları
  ctxMenu.querySelectorAll('.ctx-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = contextTargetId;
      hideContextMenu();
      if (!id) return;

      const file = FrpStore.getById(id);
      if (!file) return;

      switch (action) {
        case 'view':
          openDetail(id);
          break;
        case 'toggle-pool':
          if (FrpStore.togglePublicPool) {
            const isPub = FrpStore.togglePublicPool(id);
            toast(isPub ? 'Rapor ortak havuza eklendi.' : 'Rapor ortak havuzdan kaldırıldı.', 'info');
            refreshAll();
          }
          break;
        case 'clone-to-personal':
          if (FrpStore.cloneToPersonal) {
            FrpStore.cloneToPersonal(id);
            toast('Rapor kişisel alanınıza kopyalandı.', 'success');
            refreshAll();
          }
          break;
        case 'rename':
          openRenameModal(id);
          break;
        case 'download':
          if (typeof downloadSingleReport === 'function') downloadSingleReport(id);
          break;
        case 'fav':
          toggleFav(null, id);
          break;
        case 'pin':
          togglePin(null, id);
          break;
        case 'category':
          openCategoryModalFor(id);
          break;
        case 'delete':
          const doSingleDelete = () => {
            FrpStore.moveToTrash(id);
            selectedIds.delete(id);
            toast('Rapor çöp kutusuna taşındı.', 'info');
            refreshAll();
          };
          if (window.showConfirmDialog) {
            window.showConfirmDialog({
              title: 'Raporu Sil',
              message: `"${file.meta?.reportName || file.name}" adlı rapor çöp kutusuna taşınacaktır.`,
              confirmText: 'Çöp Kutusuna Taşı',
              isDanger: true,
              onConfirm: doSingleDelete
            });
          } else if (confirm(`"${file.meta?.reportName || file.name}" adlı rapor çöp kutusuna taşınacaktır. Onaylıyor musunuz?`)) {
            doSingleDelete();
          }
          break;
      }
    });
  });
}

// ── Rapor Adını Düzenleme Modalı ────────────────────────────
async function openRenameModal(fileId) {
  const file = FrpStore.getById(fileId);
  if (!file) return;
  const currentName = file.meta?.reportName || file.name;

  if (window.showPromptDialog) {
    window.showPromptDialog({
      title: 'Rapor Adını Düzenle',
      message: `Orijinal Dosya: ${file.name}`,
      defaultValue: currentName,
      confirmText: 'Kaydet',
      onConfirm: (newName) => {
        if (newName && newName !== currentName) {
          FrpStore.updateMeta(fileId, { reportName: newName });
          toast(`Rapor adı "${newName}" olarak güncellendi.`, 'success');
          refreshAll();
        }
      }
    });
  }
}
window.openRenameModal = openRenameModal;

// ── Kategori Ata Modalı ─────────────────────────────────────
async function openCategoryModalFor(fileId) {
  if (typeof window.openCategoryManagerModal === 'function') {
    window.openCategoryManagerModal([fileId]);
    return;
  }

  const file = FrpStore.getById(fileId);
  if (!file) return;
  const currentCat = file.category || '';
  const cats = FrpStore.getCategories ? FrpStore.getCategories() : [];
  const catOptions = cats.map(c => `<option value="${escHtml(c)}" ${c === currentCat ? 'selected' : ''}>${escHtml(c)}</option>`).join('');

  if (typeof window.showModal === 'function') {
    await window.showModal({
      title: 'Kategori Ata',
      body: `
        <div style="font-size:.85rem;color:var(--text-secondary);margin-bottom:.8rem;">
          <strong>${escHtml(file.meta?.reportName || file.name)}</strong> için kategori seçin:
        </div>
        <select id="singleCatSelect" class="select-field" style="width:100%;font-size:.88rem;padding:.5rem .75rem;margin-bottom:.6rem;">
          <option value="">-- Kategori Seçin --</option>
          ${catOptions}
        </select>
        <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.3rem;">Veya Yeni Kategori Yazın:</div>
        <input type="text" id="singleNewCatInput" class="master-search-input" placeholder="Yeni kategori adı..." style="width:100%;font-size:.88rem;" />
      `,
      confirmText: 'Kaydet',
      cancelText: 'İptal',
      onOpen: (modalEl) => {
        modalEl.querySelector('.modal-confirm-btn')?.addEventListener('click', () => {
          const sel = modalEl.querySelector('#singleCatSelect');
          const inp = modalEl.querySelector('#singleNewCatInput');
          const finalCat = (inp && inp.value.trim()) ? inp.value.trim() : (sel ? sel.value : '');
          FrpStore.setCategory(fileId, finalCat);
          toast(`Kategori güncellendi: ${finalCat || 'Kaldırıldı'}`, 'success');
          refreshAll();
        });
      }
    });
  }
}
window.openCategoryModalFor = openCategoryModalFor;

// ── Excel / CSV Dışa Aktarma (Ctrl+E) ───────────────────────
function exportReportListExcel() {
  const sorted = sortFiles(allFiles);
  if (sorted.length === 0) {
    toast('Dışa aktarılacak rapor bulunamadı.', 'warning');
    return;
  }

  let csvContent = '\uFEFF"Rapor Adı";"Dosya Adı";"Boyut (Bayt)";"Kategori";"GUID";"Etiketler";"SQL Sayısı";"Yüklenme Tarihi"\n';
  sorted.forEach(f => {
    const rName = (f.meta?.reportName || f.name || '').replace(/"/g, '""');
    const fName = (f.name || '').replace(/"/g, '""');
    const size = Number(f.sizeBytes || f.size) || 0;
    const cat = (f.category || '').replace(/"/g, '""');
    const guid = (f.meta?.guid || '').replace(/"/g, '""');
    const tags = (f.tags || []).join(', ').replace(/"/g, '""');
    const qCount = (f.queries || []).length;
    const date = new Date(f.loadedAt).toLocaleString('tr-TR');

    csvContent += `"${rName}";"${fName}";"${size}";"${cat}";"${guid}";"${tags}";"${qCount}";"${date}"\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frpoku_rapor_listesi_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`${sorted.length} adet rapor CSV olarak dışa aktarıldı.`, 'success');
}
window.exportReportListExcel = exportReportListExcel;

// ── Mobil Çekmece (Drawer) Mantığı ──────────────────────────
function setupMobileDrawer() {
  const drawer = document.getElementById('mobileDrawer');
  const overlay = document.getElementById('mobileDrawerOverlay');
  const btnToggle = document.getElementById('btnMobileMenuToggle');
  const btnClose = document.getElementById('btnMobileDrawerClose');

  function openDrawer() {
    drawer?.classList.add('open');
    overlay?.classList.add('open');
  }

  function closeDrawer() {
    drawer?.classList.remove('open');
    overlay?.classList.remove('open');
  }

  btnToggle?.addEventListener('click', openDrawer);
  btnClose?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  const bindDrawerItem = (id, fn) => {
    document.getElementById(id)?.addEventListener('click', () => {
      closeDrawer();
      fn();
    });
  };

  bindDrawerItem('btnMobAddSingle', () => document.getElementById('fileInputSingle')?.click());
  bindDrawerItem('btnMobAddMulti', () => document.getElementById('fileInputMulti')?.click());
  bindDrawerItem('btnMobAddFolder', () => document.getElementById('fileInputFolder')?.click());
  bindDrawerItem('btnMobComplexity', () => window.openComplexityCenter?.());
  bindDrawerItem('btnMobDependencies', () => window.openDependenciesModal?.());
  bindDrawerItem('btnMobParams', () => window.openParamsModal?.());
  bindDrawerItem('btnMobSnippets', () => window.renderSnippetsModal?.());
  bindDrawerItem('btnMobTableAnalysis', () => window.openTableUsageModal?.());
  bindDrawerItem('btnMobRecent', () => window.openRecentModal?.());
  bindDrawerItem('btnMobDashboard', () => { window.location.href = 'dashboard.html'; });
  bindDrawerItem('btnMobSettings', () => window.openSettingsModal?.('appearance'));

  document.getElementById('btnMobileFab')?.addEventListener('click', () => {
    document.getElementById('fileInputMulti')?.click();
  });
}

// ── Tümünü Yenile ───────────────────────────────────────────
function refreshAll() {
  updateStats();
  applySearch();
}
window.refreshAll = refreshAll;

// ── Başlatma ve Event Listener Bağlantıları ──────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (window.FrpStoreReady) await window.FrpStoreReady;
  refreshAll();
  setupContextMenu();
  setupMobileDrawer();

  // Çalışma Alanı Değiştirici
  document.getElementById('tabWsPersonal')?.addEventListener('click', () => {
    document.getElementById('tabWsPersonal')?.classList.add('active');
    document.getElementById('tabWsPool')?.classList.remove('active');
    if (FrpStore.setActiveWorkspace) FrpStore.setActiveWorkspace('personal');
    document.getElementById('poolNotice').style.display = 'none';
    applySearch();
  });

  document.getElementById('tabWsPool')?.addEventListener('click', () => {
    document.getElementById('tabWsPool')?.classList.add('active');
    document.getElementById('tabWsPersonal')?.classList.remove('active');
    if (FrpStore.setActiveWorkspace) FrpStore.setActiveWorkspace('pool');
    document.getElementById('poolNotice').style.display = 'block';
    applySearch();
  });

  // Dosya Ekleme Butonları
  const fileInputSingle  = document.getElementById('fileInputSingle');
  const fileInputMulti   = document.getElementById('fileInputMulti');
  const fileInputFolder  = document.getElementById('fileInputFolder');

  document.getElementById('btnAddSingle')?.addEventListener('click', () => fileInputSingle?.click());
  document.getElementById('btnAddMulti')?.addEventListener('click', () => fileInputMulti?.click());
  document.getElementById('btnAddFolder')?.addEventListener('click', () => fileInputFolder?.click());

  fileInputSingle?.addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
  fileInputMulti?.addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
  fileInputFolder?.addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });

  // Toplu Eylemler Barı
  document.getElementById('btnClearSelection')?.addEventListener('click', () => {
    selectedIds.clear();
    const selAll = document.getElementById('selectAll');
    if (selAll) selAll.checked = false;
    renderCurrentView();
    updateBulkBar();
  });

  document.getElementById('btnBulkFav')?.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    if (FrpStore.setFavoriteMany) {
      FrpStore.setFavoriteMany([...selectedIds], true);
    } else if (FrpStore.toggleFavoriteMany) {
      FrpStore.toggleFavoriteMany([...selectedIds]);
    } else {
      selectedIds.forEach(id => FrpStore.toggleFavorite(id));
    }
    toast(`${selectedIds.size} rapor favorilere eklendi.`, 'success');
    refreshAll();
  });

  document.getElementById('btnBulkTag')?.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    const applyTag = (cleanTag) => {
      if (!cleanTag) return;
      selectedIds.forEach(id => {
        if (FrpStore.addTag) FrpStore.addTag(id, cleanTag);
      });
      toast(`${selectedIds.size} rapora "${cleanTag}" etiketi eklendi.`, 'success');
      refreshAll();
    };

    if (typeof window.showPromptDialog === 'function') {
      window.showPromptDialog({
        title: 'Toplu Etiket Ekle',
        message: `Seçili <strong>${selectedIds.size}</strong> rapora eklenecek etiketi girin:`,
        placeholder: 'Örn: Muhasebe, Önemli, Stok...',
        confirmText: 'Etiket Ekle',
        onConfirm: (tag) => {
          if (tag && tag.trim()) applyTag(tag.trim());
        }
      });
    } else {
      const tag = prompt('Seçili raporlara eklenecek etiketi girin:');
      if (tag && tag.trim()) applyTag(tag.trim());
    }
  });

  document.getElementById('btnBulkCategory')?.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    if (typeof window.openCategoryManagerModal === 'function') {
      window.openCategoryManagerModal([...selectedIds]);
    }
  });

  document.getElementById('btnCompareSelected')?.addEventListener('click', () => {
    if (selectedIds.size < 2) return;
    const ids = [...selectedIds].slice(0, 2).join(',');
    window.location.href = `compare.html?ids=${encodeURIComponent(ids)}`;
  });

  document.getElementById('btnDeleteBulk')?.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    const n = selectedIds.size;
    const idsToDelete = [...selectedIds];
    const performBulkDelete = () => {
      if (FrpStore.moveManyToTrash) FrpStore.moveManyToTrash(idsToDelete);
      else idsToDelete.forEach(id => FrpStore.moveToTrash(id));
      selectedIds.clear();
      toast(`${n} rapor çöp kutusuna taşındı.`, 'info');
      refreshAll();
    };

    if (window.showConfirmDialog) {
      window.showConfirmDialog({
        title: 'Toplu Silme',
        message: `${n} adet rapor çöp kutusuna taşınacaktır. İstediğiniz zaman kurtarabilirsiniz.`,
        confirmText: 'Çöp Kutusuna Taşı',
        isDanger: true,
        onConfirm: performBulkDelete
      });
    } else if (confirm(`${n} adet rapor çöp kutusuna taşınacaktır. Onaylıyor musunuz?`)) {
      performBulkDelete();
    }
  });

  document.getElementById('btnBulkSharePool')?.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    if (FrpStore.bulkToggleReportPool) {
      FrpStore.bulkToggleReportPool(ids, true);
    } else if (FrpStore.addManyToPool) {
      FrpStore.addManyToPool(ids);
    }
    toast(`${ids.length} rapor ortak havuzda paylaşıldı.`, 'success');
    refreshAll();
  });

  document.getElementById('btnBulkRemovePool')?.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    if (FrpStore.bulkToggleReportPool) {
      FrpStore.bulkToggleReportPool(ids, false);
    } else if (FrpStore.removeManyFromPool) {
      FrpStore.removeManyFromPool(ids);
    }
    toast(`${ids.length} rapor ortak havuzdan kaldırıldı.`, 'info');
    refreshAll();
  });

  // Sürükle-Bırak Olayları
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // Arama ve Regex
  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applySearch();
  });

  regexBtn?.addEventListener('click', () => {
    isRegexMode = !isRegexMode;
    regexBtn.classList.toggle('active', isRegexMode);
    applySearch();
  });

  fieldSelect?.addEventListener('change', (e) => {
    searchField = e.target.value;
    applySearch();
  });

  tagSelect?.addEventListener('change', (e) => {
    selectedTag = e.target.value;
    applySearch();
  });

  catSelect?.addEventListener('change', (e) => {
    selectedCategory = e.target.value;
    applySearch();
  });

  btnFavOnly?.addEventListener('click', () => {
    onlyFavorites = !onlyFavorites;
    btnFavOnly.classList.toggle('active', onlyFavorites);
    applySearch();
  });

  document.getElementById('btnPinnedOnly')?.addEventListener('click', () => {
    onlyPinned = !onlyPinned;
    document.getElementById('btnPinnedOnly')?.classList.toggle('active', onlyPinned);
    applySearch();
  });

  document.getElementById('btnNotesOnly')?.addEventListener('click', () => {
    onlyNotes = !onlyNotes;
    document.getElementById('btnNotesOnly')?.classList.toggle('active', onlyNotes);
    applySearch();
  });

  document.getElementById('btnResetFilters')?.addEventListener('click', () => {
    searchQuery = '';
    if (searchInput) searchInput.value = '';
    selectedTag = '';
    if (tagSelect) tagSelect.value = '';
    selectedCategory = '';
    if (catSelect) catSelect.value = '';
    onlyFavorites = false;
    btnFavOnly?.classList.remove('active');
    onlyPinned = false;
    document.getElementById('btnPinnedOnly')?.classList.remove('active');
    onlyNotes = false;
    document.getElementById('btnNotesOnly')?.classList.remove('active');
    isRegexMode = false;
    regexBtn?.classList.remove('active');
    if (regexErrMsg) regexErrMsg.style.display = 'none';
    applySearch();
  });

  // Görünüm butonları (Table / Cards / Timeline)
  document.getElementById('btnViewTable')?.addEventListener('click', () => { currentViewMode = 'table'; renderCurrentView(); });
  document.getElementById('btnViewCards')?.addEventListener('click', () => { currentViewMode = 'cards'; renderCurrentView(); });
  document.getElementById('btnViewTimeline')?.addEventListener('click', () => { currentViewMode = 'timeline'; renderCurrentView(); });

  // Topbar Analiz & Modallar
  document.getElementById('btnOpenRecentModal')?.addEventListener('click', () => window.openRecentModal?.());
  document.getElementById('btnRecentDownloadsModal')?.addEventListener('click', () => window.openDownloadHistoryModal?.());
  document.getElementById('btnComplexityCenter')?.addEventListener('click', () => window.openComplexityCenter?.());
  document.getElementById('btnDependencies')?.addEventListener('click', () => window.openDependenciesModal?.());
  document.getElementById('btnParams')?.addEventListener('click', () => window.openParamsModal?.());
  document.getElementById('btnSnippets')?.addEventListener('click', () => window.renderSnippetsModal?.());
  document.getElementById('btnTableAnalysis')?.addEventListener('click', () => window.openTableUsageModal?.());

  // Ayarlar Modalı Tetikleyici (Ctrl+,)
  document.getElementById('btnOpenSettingsModal')?.addEventListener('click', () => window.openSettingsModal?.('appearance'));
  document.getElementById('btnMenuToggle')?.addEventListener('click', () => window.openSettingsModal?.('appearance'));
  
  // Klavye Kısayolları (F6 Görünüm Değişimi, vs)
  document.addEventListener('keydown', e => {
    if (e.key === 'F6') {
      e.preventDefault();
      const modes = ['table', 'cards', 'timeline'];
      const nextIdx = (modes.indexOf(currentViewMode) + 1) % modes.length;
      currentViewMode = modes[nextIdx];
      renderCurrentView();
    }
  });
});
