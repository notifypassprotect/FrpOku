// ============================================================
//  list.js — Ana Sayfa (index.html) Orkestratörü (Modüler v5)
//  Delegasyon Modülleri:
//  - js/list/renderers/table_renderer.js
//  - js/list/renderers/cards_renderer.js
//  - js/list/renderers/timeline_renderer.js
//  - js/list/list_modals.js
//  - js/list/list_actions.js
//  - js/list/list_ui_helpers.js
// ============================================================

let allFiles        = [];
let selectedIds     = new Set();
window.selectedIds  = selectedIds;
let sortField       = 'loadedAt';
let sortDir         = 'desc';
let searchQuery     = '';
let searchField     = 'all';
let selectedTag     = '';
let selectedCategory = '';
let onlyFavorites   = false;
let onlyPinned      = false;
let onlyNotes       = false;
let isStoreLoaded   = false;
let currentPage     = 1;
let currentViewMode = 'table';
let _lastSelectedRowId = null;

const tableBody          = document.getElementById('tableBody');
const searchInput        = document.getElementById('searchInput');
const fieldSelect        = document.getElementById('fieldSelect') || document.getElementById('searchFieldSelect');
const tagSelect          = document.getElementById('tagSelect');
const btnFavOnly         = document.getElementById('btnFavOnly');
const bulkBar            = document.getElementById('bulkBar');
const resultCount        = document.getElementById('resultCount');
const btnThemeToggle     = document.getElementById('btnThemeToggle');
const selectAllCb        = document.getElementById('selectAll');

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
window.escHtml = escHtml;

function toast(msg, type = 'info', duration = 3500) {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'toast-item ' + type;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escHtml(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 350); }, duration);
}
window.toast = toast;

// ── Tema Yönetimi ───────────────────────────────────────────
function updateThemeBtn() {
  if (!btnThemeToggle) return;
  const cur = FrpStore.getTheme();
  btnThemeToggle.textContent = cur === 'dark' ? '☀️ Aydınlık Mod' : '🌙 Koyu Mod';
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

// ── Sıralama Mantığı (Pin önce, sonra Favori, sonra Alan) ────
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
        va = Number(a.sizeBytes) || 0;
        vb = Number(b.sizeBytes) || 0;
        break;
      case 'guid':
        va = (a.meta?.guid || '').toLowerCase();
        vb = (b.meta?.guid || '').toLowerCase();
        break;
      case 'category':
        va = (a.category || '').toLowerCase();
        vb = (b.category || '').toLowerCase();
        break;
      case 'ownerName':
        va = (a.ownerName || a.owner_name || '').toLowerCase();
        vb = (b.ownerName || b.owner_name || '').toLowerCase();
        break;
      case 'queries':
        va = (a.queries || []).length;
        vb = (b.queries || []).length;
        break;
      case 'lastModified':
        va = new Date(a.updatedAt || a.loadedAt).getTime() || 0;
        vb = new Date(b.updatedAt || b.loadedAt).getTime() || 0;
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
    const q = searchQuery.toLowerCase();
    const name = (file.meta?.reportName || file.name || '').toLowerCase();
    const fileName = (file.name || '').toLowerCase();
    const guid = (file.meta?.guid || '').toLowerCase();
    const owner = (file.ownerName || file.owner_name || '').toLowerCase();
    const sql = (file.queries || []).map(x => x.sql || '').join(' ').toLowerCase();

    if (searchField === 'name') return name.includes(q);
    if (searchField === 'guid') return guid.includes(q);
    if (searchField === 'sql') return sql.includes(q);
    if (searchField === 'author' || searchField === 'owner') return owner.includes(q);
    return name.includes(q) || fileName.includes(q) || guid.includes(q) || owner.includes(q) || sql.includes(q);
  });

  renderCurrentView();
}
window.applySearch = applySearch;

// ── Görünüm Değiştirici & Render ────────────────────────────
function renderCurrentView() {
  const tableEl = document.getElementById('reportTable');
  let cardsEl   = document.getElementById('cardsView');
  let timelineEl= document.getElementById('timelineView');

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
  if (curSelectAll) curSelectAll.checked = pagedFiles.length > 0 && pagedFiles.every(f => selectedIds.has(f.id));

  if (!tableBody) return;

  if (sorted.length === 0) {
    tableBody.innerHTML = `
      <tr><td colspan="10">
        <div class="empty-state">
          <div class="empty-icon">${searchQuery || selectedTag || onlyFavorites || onlyPinned || onlyNotes ? '🔍' : '📂'}</div>
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
    const size = typeof formatBytes === 'function' ? formatBytes(file.sizeBytes || file.size) : (file.size || '');
    const reportName = file.meta?.reportName || file.name;
    const hasNote = !!(file.userNote && file.userNote.trim());
    const tagsHtml = (file.tags || []).map(t => `<span class="tag-pill">🏷️ ${escHtml(t)}</span>`).join(' ');
    const guidVal = (file.meta && file.meta.guid) ? file.meta.guid : '';
    const guidColHtml = guidVal
      ? `<span class="badge badge-gray" onclick="event.stopPropagation();copyGuidText('${escHtml(guidVal)}')" title="Tıklayınca GUID kopyalar" style="cursor:pointer;font-family:var(--mono);font-size:.72rem;">🔑 ${escHtml(guidVal)}</span>`
      : `<span style="color:var(--text-muted);font-size:.75rem;">—</span>`;
    const catHtml = file.category
      ? `<span class="badge badge-purple" onclick="event.stopPropagation();openCategoryModalFor('${file.id}')" style="cursor:pointer;">🏷️ ${escHtml(file.category)}</span>`
      : `<button class="btn btn-sm" onclick="event.stopPropagation();openCategoryModalFor('${file.id}')" style="padding:1px 6px;font-size:.72rem;">+ Kategori</button>`;

    const helperData = { reportName, size, date, hasNote, tagsHtml, guidColHtml, catHtml };
    let colsHtml = '';
    currentOrder.forEach(colKey => {
      if (visibleCols[colKey] === false) return;
      const def = window.FrpListRenderers?.COLUMN_DEFS[colKey];
      if (def) colsHtml += def.renderTd(file, helperData);
    });

    return `
      <tr class="${isSelected ? 'selected' : ''} ${file.isPinned ? 'pinned-row' : ''}" data-id="${file.id}">
        <td><input type="checkbox" class="row-checkbox" data-id="${file.id}" ${isSelected ? 'checked' : ''} onchange="toggleSelect(event, '${file.id}')" onclick="event.stopPropagation();" /></td>
        <td style="white-space:nowrap;text-align:center;">
          <button class="star-btn ${file.isFavorite ? 'active' : ''}" onclick="toggleFav(event, '${file.id}')" title="Favori">★</button>
          <button class="pin-btn ${file.isPinned ? 'active' : ''}" onclick="togglePin(event, '${file.id}')" title="Üste Sabitle" style="background:none;border:none;cursor:pointer;font-size:.95rem;padding:0 .15rem;opacity:${file.isPinned ? '1' : '0.35'};">📌</button>
        </td>
        ${colsHtml}
      </tr>
    `;
  }).join('');

  if (typeof updateBulkBar === 'function') updateBulkBar();
  bindTableSortHeaders();
}
window.renderTable = renderTable;

// ── Kartlar ve Zaman Tüneli Render Delegasyonları ───────────
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

// ── Satır Etkileşimleri & Detaya Gitme ───────────────────────
function openDetail(id) {
  window.location.href = 'detail.html?id=' + encodeURIComponent(id);
}
window.openDetail = openDetail;

function toggleSelect(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderCurrentView();
}
window.toggleSelect = toggleSelect;

function toggleFav(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  const newState = FrpStore.toggleFavorite(id);
  toast(newState ? 'Favorilere eklendi ⭐' : 'Favorilerden çıkarıldı', 'info');
  refreshAll();
}
window.toggleFav = toggleFav;

function togglePin(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  const newState = FrpStore.togglePin(id);
  toast(newState ? 'Rapor üste sabitlendi 📌' : 'Sabitleme kaldırıldı', 'info');
  refreshAll();
}
window.togglePin = togglePin;

function copyGuidText(guid) {
  navigator.clipboard.writeText(guid).then(() => toast(`GUID kopyalandı: ${guid} 📋`, 'success'));
}
window.copyGuidText = copyGuidText;

// ── Tümünü Yenile ───────────────────────────────────────────
function refreshAll() {
  applySearch();
  if (typeof updateStats === 'function') updateStats();
  if (typeof updateTagList === 'function') updateTagList();
}
window.refreshAll = refreshAll;

// ── Başlatma ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (window.FrpStoreReady) await window.FrpStoreReady;
  refreshAll();

  // Arama inputu
  searchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applySearch();
  });

  // Filtre seçimleri
  fieldSelect?.addEventListener('change', (e) => {
    searchField = e.target.value;
    applySearch();
  });

  tagSelect?.addEventListener('change', (e) => {
    selectedTag = e.target.value;
    applySearch();
  });

  btnFavOnly?.addEventListener('click', () => {
    onlyFavorites = !onlyFavorites;
    btnFavOnly.classList.toggle('active', onlyFavorites);
    applySearch();
  });

  // Görünüm butonları (Table / Cards / Timeline)
  document.getElementById('btnViewTable')?.addEventListener('click', () => { currentViewMode = 'table'; renderCurrentView(); });
  document.getElementById('btnViewCards')?.addEventListener('click', () => { currentViewMode = 'cards'; renderCurrentView(); });
  document.getElementById('btnViewTimeline')?.addEventListener('click', () => { currentViewMode = 'timeline'; renderCurrentView(); });

  // Parametre ve Bağımlılık Butonları
  document.getElementById('btnParams')?.addEventListener('click', () => window.FrpListModals?.openParamsModal());
  document.getElementById('btnDependencies')?.addEventListener('click', () => window.FrpListModals?.openDependenciesModal());

  // Ayarlar Modalı Tetikleyici (Ctrl+,)
  document.getElementById('btnOpenSettingsModal')?.addEventListener('click', () => window.openSettingsModal?.('appearance'));
});
