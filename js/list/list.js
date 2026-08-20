// ============================================================
//  list.js — Ana Sayfa (index.html) Mantığı (Gelişmiş v3)
//  IndexedDB Senkronizasyonu, Çift Tıklama, SQL Sağlık Rozetleri,
//  Versiyon Artırma, Sorgu Kütüphanesi
// ============================================================

let allFiles        = [];
let selectedIds     = new Set();
window.selectedIds  = selectedIds;
let sortField       = 'loadedAt';
let sortDir         = 'desc';
let searchQuery     = '';
let searchField     = 'all';
let selectedTag     = '';
let onlyFavorites   = false;
let isRegexMode     = false;
let regexError      = false;

const tableBody          = document.getElementById('tableBody');
const searchInput        = document.getElementById('searchInput');
const regexBtn           = document.getElementById('regexBtn');
const fieldSelect        = document.getElementById('fieldSelect') || document.getElementById('searchFieldSelect');
const tagSelect          = document.getElementById('tagSelect');
const btnFavOnly         = document.getElementById('btnFavOnly');
const bulkBar            = document.getElementById('bulkBar');
const bulkInfo           = document.getElementById('bulkInfo') || document.getElementById('bulkCount');
const btnCompareSelected = document.getElementById('btnCompareSelected') || document.getElementById('btnBulkCompare');
const selectAllCb        = document.getElementById('selectAll');
const regexErrMsg        = document.getElementById('regexErrMsg');
const storageWarn        = document.getElementById('storageWarn');
const resultCount        = document.getElementById('resultCount');
const btnThemeToggle     = document.getElementById('btnThemeToggle');

const statTotal    = document.getElementById('statTotal');
const statFavorites= document.getElementById('statFavorites');
const statQueries  = document.getElementById('statQueries');
const statPascal   = document.getElementById('statPascal');
const statStorage  = document.getElementById('statStorage');

function toast(msg, type = 'info', duration = 3500) {
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = 'toast-item ' + type;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${escHtml(msg)}</span>`;
  stack.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(40px)'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 350); }, duration);
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Hash-based tag renklendirme ─────────────────────────────────────────
const TAG_PALETTE = [
  { bg: 'rgba(59,130,246,.12)',  color: '#3b82f6',  border: 'rgba(59,130,246,.3)'  },  // blue
  { bg: 'rgba(16,185,129,.12)', color: '#10b981',  border: 'rgba(16,185,129,.3)'  },  // green
  { bg: 'rgba(139,92,246,.12)', color: '#8b5cf6',  border: 'rgba(139,92,246,.3)'  },  // purple
  { bg: 'rgba(245,158,11,.12)', color: '#f59e0b',  border: 'rgba(245,158,11,.3)'  },  // amber
  { bg: 'rgba(236,72,153,.12)', color: '#ec4899',  border: 'rgba(236,72,153,.3)'  },  // pink
  { bg: 'rgba(6,182,212,.12)',  color: '#06b6d4',  border: 'rgba(6,182,212,.3)'   },  // cyan
  { bg: 'rgba(249,115,22,.12)', color: '#f97316',  border: 'rgba(249,115,22,.3)'  },  // orange
  { bg: 'rgba(132,204,22,.12)', color: '#84cc16',  border: 'rgba(132,204,22,.3)'  },  // lime
];

function tagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) & 0xffffffff;
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

function renderTag(tag) {
  const c = tagColor(tag);
  return `<span class="tag-pill" style="background:${c.bg};color:${c.color};border-color:${c.border};">\ud83c\udff7\ufe0f ${escHtml(tag)}</span>`;
}




function updateThemeBtn() {
  if (!btnThemeToggle) return;
  const cur = FrpStore.getTheme();
  btnThemeToggle.textContent = cur === 'dark' ? '☀️ Aydınlık Mod' : '🌙 Koyu Mod';
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

// ── TOPBAR DROPDOWN KONTROLCÜSÜ (Gecikmeli Kapanma & Tıklama Desteği) ──
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
      leaveTimeout = setTimeout(() => {
        dropdown.classList.remove('open');
      }, 350);
    });

    if (menu) {
      menu.addEventListener('mouseenter', () => {
        if (leaveTimeout) clearTimeout(leaveTimeout);
        dropdown.classList.add('open');
      });
      menu.addEventListener('mouseleave', () => {
        leaveTimeout = setTimeout(() => {
          dropdown.classList.remove('open');
        }, 350);
      });
      menu.querySelectorAll('.topbar-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          dropdown.classList.remove('open');
        });
      });
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar-dropdown')) {
      document.querySelectorAll('.topbar-dropdown.open').forEach(d => d.classList.remove('open'));
    }
  });
}

document.addEventListener('DOMContentLoaded', setupTopbarDropdowns);
setupTopbarDropdowns();
// ── Dosya Yükleme (Sürükle-Bırak & Çoklu Dosya Yükleme) ──────
async function handleFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.frp'));

  if (files.length === 0) {
    toast('Seçilen dosyalar arasında .frp uzantılı dosya bulunamadı.', 'warning');
    return;
  }

  const resultsToSave = [];
  const errorDetails = [];
  const isBulk = files.length > 1;

  if (isBulk) {
    showProgressModal('Raporlar Yükleniyor...', `${files.length} dosya işleniyor`, '🔄');
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (isBulk) {
      updateProgressModal(i + 1, files.length, file.name);
      if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
    }

    try {
      const text = await readFileAsText(file);
      const parsed = parseFrp(text);

      if (!parsed.pascalScript && (!parsed.queries || parsed.queries.length === 0)) {
        errorDetails.push({ name: file.name, error: 'Pascal veya SQL kodu bulunamadı.' });
        continue;
      }

      resultsToSave.push({ parsedData: parsed, fileName: file.name, fileSize: file.size });
    } catch (err) {
      errorDetails.push({ name: file.name, error: err.message });
    }
  }

  if (isBulk) hideProgressModal();

  let added = 0, updated = 0;
  if (resultsToSave.length > 0) {
    const res = FrpStore.addMany(resultsToSave);
    added = res.added;
    updated = res.updated;
  }

  if (added + updated > 0) {
    if (updated > 0 && added > 0) {
      toast(`✅ ${added} yeni rapor eklendi, ${updated} mevcut rapor güncellendi.`, 'success');
    } else if (updated > 0) {
      toast(`🔄 ${updated} rapor başarıyla güncellendi.`, 'success');
    } else {
      toast(`📋 ${added} rapor başarıyla yüklendi.`, 'success');
    }
  }

  if (errorDetails.length > 0) {
    if (!isBulk) {
      toast(`${errorDetails[0].name}: ${errorDetails[0].error}`, 'error');
    } else {
      showModal({
        title: '⚠️ Bazı Dosyalar Yüklenemedi',
        body: `<div style="font-size:.82rem;color:var(--red);margin-bottom:.5rem;"><strong>${errorDetails.length}</strong> dosyada hata oluştu:</div>` +
              `<div style="font-family:var(--mono);font-size:.78rem;background:var(--bg-raised);padding:.6rem;border-radius:6px;max-height:200px;overflow-y:auto;text-align:left;">` +
              errorDetails.map(e => `<strong>${escHtml(e.name)}</strong>: ${escHtml(e.error)}`).join('<br>') +
              `</div>`,
        confirmText: 'Anladım',
        cancelText: ''
      });
    }
  }

  refreshAll();
}

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





function setSort(field) {
  if (!field) return;
  if (sortField === field) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortField = field;
    sortDir = field === 'loadedAt' ? 'desc' : 'asc';
  }
  document.querySelectorAll('#tableHeaderRow th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.sort === sortField) {
      th.classList.add('sort-' + sortDir);
    }
  });
  renderTable();
}

function bindTableSortHeaders() {
  document.querySelectorAll('#tableHeaderRow th.sortable').forEach(th => {
    th.removeEventListener('click', th._sortHandler);
    th._sortHandler = () => setSort(th.dataset.sort);
    th.addEventListener('click', th._sortHandler);
  });
}

// ── SAYFALAMA (PAGINATION) BARI & KONTROLLERİ ──────────────
let currentPage = 1;

function renderPaginationControls(totalItems, pageSize) {
  let pagWrap = document.getElementById('paginationWrap');
  if (!pagWrap) {
    pagWrap = document.createElement('div');
    pagWrap.id = 'paginationWrap';
    pagWrap.className = 'pagination-bar';
    const tableArea = document.querySelector('.table-area');
    if (tableArea) tableArea.appendChild(pagWrap);
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
      
      <span style="display:inline-flex;align-items:center;gap:.3rem;font-weight:700;font-size:.82rem;padding:0 .3rem;">
        Sayfa 
        <input type="number" id="inputPagJump" min="1" max="${totalPages}" value="${currentPage}" 
               style="width:62px;padding:.22rem .4rem;text-align:center;font-weight:800;border-radius:6px;border:1.5px solid var(--accent);background:var(--bg-raised);color:var(--text-primary);font-size:.82rem;" 
               title="Sayfa numarası yazıp Enter'a basın" /> 
        / ${totalPages}
      </span>

      <button class="btn btn-sm" id="btnPagNext" ${currentPage === totalPages ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}>Sonraki ›</button>
      <button class="btn btn-sm" id="btnPagLast" ${currentPage === totalPages ? 'disabled style="opacity:.4;cursor:not-allowed;"' : ''}>Son »</button>
    </div>
  `;

  pagWrap.querySelector('#btnPagFirst')?.addEventListener('click', () => { currentPage = 1; renderCurrentView(); });
  pagWrap.querySelector('#btnPagPrev')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderCurrentView(); } });
  pagWrap.querySelector('#btnPagNext')?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderCurrentView(); } });
  pagWrap.querySelector('#btnPagLast')?.addEventListener('click', () => { currentPage = totalPages; renderCurrentView(); });

  const jumpInput = pagWrap.querySelector('#inputPagJump');
  if (jumpInput) {
    const doJump = () => {
      let target = parseInt(jumpInput.value, 10);
      if (isNaN(target)) target = 1;
      if (target < 1) target = 1;
      if (target > totalPages) target = totalPages;
      if (target !== currentPage) {
        currentPage = target;
        renderCurrentView();
      }
    };
    jumpInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doJump();
      }
    });
    jumpInput.addEventListener('change', doJump);
  }
}

const DEFAULT_COLUMN_ORDER = ['reportName', 'owner', 'fileName', 'fileSize', 'category', 'guid', 'tags', 'queries', 'date'];

const COLUMN_DEFS = {
  reportName: {
    label: 'Rapor Adı',
    sortKey: 'name',
    thClass: 'col-reportName',
    thStyle: '',
    renderTd: (file, h) => {
      const isPublic = !!(file.isPublic || file.is_public);
      return `
      <td class="col-reportName">
        <div class="file-name" data-id="${file.id}">
          📋 <span class="report-name-title" style="font-weight:700;">${escHtml(h.reportName)}</span>
          ${isPublic ? '<span class="badge badge-pool" style="font-size:.65rem;padding:.1rem .35rem;margin-left:.25rem;" title="Ortak Havuzda Paylaşıldı">🌐 Havuzda</span>' : ''}
          ${h.hasNote ? '<span class="note-icon" title="Not var">📝</span>' : ''}
        </div>
      </td>`;
    }
  },
  owner: {
    label: 'Yükleyen / Birim',
    sortKey: 'ownerName',
    thClass: 'col-owner',
    thStyle: 'min-width:135px;',
    renderTd: (file) => {
      const oName = file.ownerName || file.owner_name || (file.userId === 'usr_admin_root' ? 'Admin' : 'Sistem');
      const oDept = file.ownerDepartment || file.owner_department || '';
      return `<td class="col-owner" style="white-space:nowrap;">
        <span class="owner-chip" title="Yükleyen: ${escHtml(oName)}${oDept ? ' · ' + escHtml(oDept) : ''}">
          👤 ${escHtml(oName)}
        </span>
      </td>`;
    }
  },
  fileName: {
    label: 'Dosya Adı',
    sortKey: 'fileName',
    thClass: 'col-fileName',
    thStyle: 'max-width:240px;',
    renderTd: (file, h) => `
      <td class="col-fileName" style="font-family:var(--mono);font-size:.78rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(file.name)}">
        📄 ${escHtml(file.name)}
      </td>`
  },
  fileSize: {
    label: 'Boyut',
    sortKey: 'sizeBytes',
    thClass: 'col-fileSize',
    thStyle: 'width:95px;text-align:right;',
    renderTd: (file, h) => `
      <td class="col-fileSize" style="white-space:nowrap;color:var(--text-secondary);font-size:.82rem;font-weight:600;text-align:right;">
        ${h.size}
      </td>`
  },
  category: {
    label: 'Kategori',
    sortKey: null,
    thClass: 'col-category',
    thStyle: '',
    renderTd: (file, h) => `<td class="col-category">${h.catHtml}</td>`
  },
  guid: {
    label: 'GUID',
    sortKey: 'guid',
    thClass: 'col-guid',
    thStyle: 'min-width:280px;',
    renderTd: (file, h) => `<td class="col-guid">${h.guidColHtml}</td>`
  },
  tags: {
    label: 'Etiketler',
    sortKey: null,
    thClass: 'col-tags',
    thStyle: '',
    renderTd: (file, h) => `<td class="col-tags">${h.tagsHtml || '<span style="color:var(--text-muted);font-size:.75rem;">—</span>'}</td>`
  },
  queries: {
    label: 'SQL',
    sortKey: 'queries',
    thClass: 'col-queries',
    thStyle: 'text-align:center;width:95px;',
    renderTd: (file, h) => `
      <td class="col-queries">
        ${file.queries.length > 0
          ? `<span class="badge badge-blue">🗄️ ${file.queries.length} SQL</span>`
          : `<span class="badge badge-gray">—</span>`}
      </td>`
  },
  date: {
    label: 'Yüklenme',
    sortKey: 'loadedAt',
    thClass: 'col-date',
    thStyle: 'width:145px;',
    renderTd: (file, h) => `<td class="col-date" style="white-space:nowrap; color:var(--text-muted); font-size:.8rem;">${h.date}</td>`
  }
};

function renderTableHeader(prefs, visibleCols) {
  const headerRow = document.getElementById('tableHeaderRow');
  if (!headerRow) return;

  let currentOrder = Array.isArray(prefs.columnOrder) && prefs.columnOrder.length > 0
    ? [...prefs.columnOrder]
    : [...DEFAULT_COLUMN_ORDER];

  currentOrder = currentOrder.filter(c => c !== 'actions');
  if (!currentOrder.includes('fileName')) {
    const reportNameIdx = currentOrder.indexOf('reportName');
    if (reportNameIdx !== -1) currentOrder.splice(reportNameIdx + 1, 0, 'fileName');
    else currentOrder.unshift('fileName');
  }

  let headersHtml = `
    <th style="width:40px;"><input type="checkbox" class="row-checkbox" id="selectAll" title="Tümünü Seç/Kaldır" /></th>
    <th style="width:58px;text-align:center;">⭐ 📌</th>
  `;

  currentOrder.forEach(colKey => {
    const def = COLUMN_DEFS[colKey];
    if (!def) return;
    if (visibleCols[colKey] === false) return;

    const isSortable = !!def.sortKey;
    const sortClass = isSortable ? `sortable ${def.sortKey === sortField ? 'sort-' + sortDir : ''}` : '';
    const sortAttr = isSortable ? `data-sort="${def.sortKey}"` : '';
    const dragAttr = colKey !== 'actions' ? `draggable="true"` : '';
    const dragClass = colKey !== 'actions' ? `draggable-col` : '';
    const dragTitle = colKey !== 'actions' ? `title="Sürükleyerek sütun sırasını değiştirin"` : '';

    headersHtml += `
      <th class="${sortClass} ${dragClass} ${def.thClass}" ${sortAttr} ${dragAttr} ${dragTitle} data-col="${colKey}" style="${def.thStyle}">
        ${def.label}
      </th>
    `;
  });

  headerRow.innerHTML = headersHtml;

  // Re-bind selectAll checkbox listener
  const newSelectAllCb = document.getElementById('selectAll');
  if (newSelectAllCb) {
    newSelectAllCb.addEventListener('change', () => {
      const sorted = sortFiles(allFiles);
      if (newSelectAllCb.checked) {
        sorted.forEach(f => selectedIds.add(f.id));
      } else {
        selectedIds.clear();
      }
      renderTable();
      if (typeof updateBulkBar === 'function') updateBulkBar();
    });
  }

  bindTableSortHeaders();
  bindColumnDragAndDrop();
}

function bindColumnDragAndDrop() {
  const headers = document.querySelectorAll('#tableHeaderRow th.draggable-col');
  let draggedCol = null;

  headers.forEach(th => {
    th.addEventListener('dragstart', e => {
      window._isDraggingColumn = true;
      draggedCol = th.dataset.col;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedCol);
      th.classList.add('dragging-col');
    });

    th.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = th.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (e.clientX < midpoint) {
        th.classList.add('drag-over-left');
        th.classList.remove('drag-over-right');
      } else {
        th.classList.add('drag-over-right');
        th.classList.remove('drag-over-left');
      }
    });

    th.addEventListener('dragleave', () => {
      th.classList.remove('drag-over-left', 'drag-over-right');
    });

    th.addEventListener('drop', e => {
      e.preventDefault();
      th.classList.remove('drag-over-left', 'drag-over-right');
      const targetCol = th.dataset.col;
      if (!draggedCol || draggedCol === targetCol) {
        window._isDraggingColumn = false;
        return;
      }

      const prefs = FrpStore.getPreferences();
      const order = [...(prefs.columnOrder || DEFAULT_COLUMN_ORDER)];
      const fromIdx = order.indexOf(draggedCol);
      const toIdx = order.indexOf(targetCol);
      if (fromIdx >= 0 && toIdx >= 0) {
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, draggedCol);
        FrpStore.setPreferences({ columnOrder: order });
        toast(`Sütun sırası güncellendi 🔀`, 'info', 1500);
        renderTable();
      }
      window._isDraggingColumn = false;
    });

    th.addEventListener('dragend', () => {
      headers.forEach(h => h.classList.remove('dragging-col', 'drag-over-left', 'drag-over-right'));
      draggedCol = null;
      window._isDraggingColumn = false;
    });
  });
}

// ── Render Tablo (Sayfalama, Sütun Sıralama ve Sürükle-Bırak) ──
function renderTable() {
  const sorted = sortFiles(allFiles);
  resultCount.textContent = sorted.length + ' sonuç';

  const prefs = FrpStore.getPreferences();
  const pageSize = prefs.pageSize || 50;
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * pageSize;
  const pagedFiles = pageSize >= 9999 ? sorted : sorted.slice(startIndex, startIndex + pageSize);

  renderPaginationControls(totalItems, pageSize);

  const visibleCols = prefs.visibleColumns || {
    reportName: true,
    fileName: true,
    fileSize: true,
    category: true,
    guid: true,
    tags: true,
    queries: false,
    date: true
  };

  renderTableHeader(prefs, visibleCols);

  // Geçersiz / silinmiş id'leri selectedIds kümesinden temizle
  const validMap = new Set(FrpStore.getAll().map(f => f.id));
  for (const id of selectedIds) {
    if (!validMap.has(id)) selectedIds.delete(id);
  }

  const curSelectAll = document.getElementById('selectAll');
  const allSelected = pagedFiles.length > 0 && pagedFiles.every(f => selectedIds.has(f.id));
  if (curSelectAll) curSelectAll.checked = allSelected;

  if (sorted.length === 0) {
    if (!isStoreLoaded && FrpStore.getAll().length === 0) {
      tableBody.innerHTML = `
        <tr><td colspan="10" style="text-align:center;padding:3.5rem 1rem;color:var(--text-muted);">
          <div style="display:inline-flex;flex-direction:column;align-items:center;gap:.75rem;">
            <div style="width:32px;height:32px;border:3px solid var(--border-light);border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite;"></div>
            <div style="font-weight:700;font-size:.9rem;color:var(--text-primary);">Raporlar yükleniyor...</div>
          </div>
        </td></tr>`;
      return;
    }
    tableBody.innerHTML = `
      <tr><td colspan="10">
        <div class="empty-state">
          <div class="empty-icon">${searchQuery || selectedTag || onlyFavorites || onlyPinned || onlyNotes ? '🔍' : '📂'}</div>
          <div class="empty-title">${searchQuery || selectedTag || onlyFavorites || onlyPinned || onlyNotes ? 'Sonuç bulunamadı' : 'Henüz rapor yüklenmedi'}</div>
          <div class="empty-sub">${searchQuery || selectedTag || onlyFavorites || onlyPinned || onlyNotes ? 'Arama veya filtre kriterlerini değiştirin.' : 'Rapor eklemek için yukarıdaki butonları kullanın.'}</div>
        </div>
      </td></tr>`;
    toggleUploadMini(FrpStore.getAll().length === 0);
    return;
  }

  toggleUploadMini(false);

  let currentOrder = Array.isArray(prefs.columnOrder) && prefs.columnOrder.length > 0
    ? [...prefs.columnOrder]
    : [...DEFAULT_COLUMN_ORDER];

  currentOrder = currentOrder.filter(c => c !== 'actions');
  if (!currentOrder.includes('fileName')) {
    const reportNameIdx = currentOrder.indexOf('reportName');
    if (reportNameIdx !== -1) currentOrder.splice(reportNameIdx + 1, 0, 'fileName');
    else currentOrder.unshift('fileName');
  }

  tableBody.innerHTML = pagedFiles.map(file => {
    const isSelected = selectedIds.has(file.id);
    const loadedDateObj = new Date(file.loadedAt);
    const date = loadedDateObj.toLocaleDateString('tr-TR') + ' ' + loadedDateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    const size = file.sizeBytes > 1024 ? Math.round(file.sizeBytes / 1024) + ' KB' : file.sizeBytes + ' B';
    const reportName = file.meta?.reportName || file.name;
    const hasNote = file.userNote && file.userNote.trim();

    const tagsHtml = (file.tags || []).map(t => renderTag(t)).join(' ');
    
    const guidVal = (file.meta && file.meta.guid) ? file.meta.guid : '';
    const guidColHtml = guidVal
      ? `<span class="badge badge-gray" onclick="event.stopPropagation();copyGuidText('${escHtml(guidVal)}')" title="Tıklayınca GUID kopyalar: ${escHtml(guidVal)}" style="cursor:pointer;font-family:var(--mono);font-size:.72rem;white-space:nowrap;letter-spacing:-0.2px;">🔑 ${escHtml(guidVal)}</span>`
      : `<span style="color:var(--text-muted);font-size:.75rem;">—</span>`;

    const catHtml = file.category
      ? `<span class="badge badge-purple" onclick="event.stopPropagation();openCategoryModalFor('${file.id}')" style="cursor:pointer;" title="Kategori: ${escHtml(file.category)}">🏷️ ${escHtml(file.category)}</span>`
      : `<button class="btn btn-sm" onclick="event.stopPropagation();openCategoryModalFor('${file.id}')" style="padding:1px 6px;font-size:.72rem;border-radius:5px;opacity:.7;" title="Kategori Ata">+ Kategori</button>`;

    const helperData = { reportName, size, date, hasNote, tagsHtml, guidColHtml, catHtml };

    let colsHtml = '';
    currentOrder.forEach(colKey => {
      if (visibleCols[colKey] === false) return;
      const def = COLUMN_DEFS[colKey];
      if (def) {
        colsHtml += def.renderTd(file, helperData);
      }
    });

    return `<tr class="${isSelected ? 'selected' : ''} ${file.isPinned ? 'pinned-row' : ''}" data-id="${file.id}" title="Sağ tıklayarak menüyü açabilirsiniz">
      <td><input type="checkbox" class="row-checkbox" data-id="${file.id}" ${isSelected ? 'checked' : ''} onchange="toggleSelect(event, '${file.id}')" onclick="event.stopPropagation();" /></td>
      <td style="white-space:nowrap;text-align:center;">
        <button class="star-btn ${file.isFavorite ? 'active' : ''}" onclick="toggleFav(event, '${file.id}')" title="Favorilere Ekle/Çıkar">★</button>
        <button class="pin-btn ${file.isPinned ? 'active' : ''}" onclick="togglePin(event, '${file.id}')" title="Üste Sabitle/Kaldır" style="background:none;border:none;cursor:pointer;font-size:.95rem;padding:0 .15rem;opacity:${file.isPinned ? '1' : '0.35'};">📌</button>
      </td>
      ${colsHtml}
    </tr>`;
  }).join('');

  if (typeof updateBulkBar === 'function') updateBulkBar();
}

function toggleUploadMini(show) {
  // Mini dropzone banner removed per UI design
}

function copyGuidText(guid) {
  navigator.clipboard.writeText(guid).then(() => {
    toast(`GUID kopyalandı: ${guid} 📋`, 'success');
  });
}
window.copyGuidText = copyGuidText;

function toggleFav(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  const newState = FrpStore.toggleFavorite(id);
  toast(newState ? 'Favorilere eklendi ⭐' : 'Favorilerden çıkarıldı', 'info');
  refreshAll();
}

function togglePin(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  const newState = FrpStore.togglePin(id);
  toast(newState ? 'Rapor üste sabitlendi 📌' : 'Sabitleme kaldırıldı', 'info');
  refreshAll();
}
window.toggleFav = toggleFav;
window.togglePin = togglePin;

// ── Rapor Adını Düzenleme Modalı ───────────────────────────
async function openRenameModal(fileId) {
  const file = FrpStore.getById(fileId);
  if (!file) return;
  const currentName = file.meta?.reportName || file.name;
  
  const body = `
    <div style="display:flex;flex-direction:column;gap:.85rem;">
      <label style="font-size:.84rem;font-weight:700;color:var(--text-primary);">Rapor Adı:</label>
      <input type="text" id="modalRenameInput" class="master-search-input" value="${escHtml(currentName)}" style="width:100%;font-size:.92rem;padding:.6rem .85rem;box-sizing:border-box;border-radius:10px;border:1.5px solid var(--accent);background:var(--bg-surface);color:var(--text-primary);" />
      <div style="font-size:.76rem;color:var(--text-muted);background:var(--bg-raised);padding:.5rem .75rem;border-radius:8px;border:1px solid var(--border-light);">
        📁 Orijinal Dosya: <code>${escHtml(file.name)}</code>
      </div>
    </div>
  `;

  let confirmed = false;
  let newName = currentName;

  await showModal({
    title: '✏️ Rapor Adını Düzenle',
    body,
    confirmText: '💾 Kaydet',
    cancelText: '✕ İptal',
    maxWidth: '480px',
    onOpen: (modalEl) => {
      const inp = modalEl.querySelector('#modalRenameInput');
      if (inp) {
        inp.focus();
        inp.select();
        inp.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            modalEl.querySelector('.modal-confirm-btn')?.click();
          }
        });
      }
      modalEl.querySelector('.modal-confirm-btn')?.addEventListener('click', () => {
        confirmed = true;
        newName = (inp?.value || '').trim();
      });
    }
  });

  if (confirmed && newName && newName !== currentName) {
    FrpStore.updateMeta(fileId, { reportName: newName });
    toast(`Rapor adı "${newName}" olarak güncellendi. ✏️`, 'success');
    refreshAll();
  }
}
window.openRenameModal = openRenameModal;

// ── Tablo Satırına Tıklama ile Detay Açma ───────────────────
tableBody.addEventListener('click', e => {
  const row = e.target.closest('tr[data-id]');
  if (!row) return;

  const checkbox = e.target.closest('.row-checkbox');
  const star = e.target.closest('.star-btn');
  const pin = e.target.closest('.pin-btn');
  const badge = e.target.closest('.badge, .btn-sm');

  if (checkbox || star || pin || badge) return;

  const id = row.dataset.id;
  openDetail(id);
});

// ── SAĞ TIK CONTEXT MENU (Görüntüle, Adını Düzenle, İndir, Sil) ───────
let contextTargetId = null;
const ctxMenu = document.getElementById('tableContextMenu');

function hideContextMenu() {
  if (ctxMenu) ctxMenu.style.display = 'none';
  contextTargetId = null;
}

if (tableBody && ctxMenu) {
  tableBody.addEventListener('contextmenu', e => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();

    contextTargetId = row.dataset.id;
    const file = FrpStore.getById(contextTargetId);
    if (!file) return;

    const titleEl = document.getElementById('ctxMenuReportTitle');
    if (titleEl) titleEl.textContent = `📋 ${file.meta?.reportName || file.name}`;

    const curWs = FrpStore.getActiveWorkspace ? FrpStore.getActiveWorkspace() : 'personal';
    const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
    const isOwnerOrAdmin = !curUser || curUser.role === 'admin' || file.userId === curUser.id;
    const isPublic = !!(file.isPublic || file.is_public);

    const btnTogglePool = document.getElementById('ctxBtnTogglePool');
    const textTogglePool = document.getElementById('ctxTextTogglePool');
    const btnClonePersonal = document.getElementById('ctxBtnClonePersonal');
    const btnDelete = document.getElementById('ctxBtnDelete');
    const btnRename = ctxMenu.querySelector('[data-action="rename"]');

    if (btnTogglePool && textTogglePool) {
      if (isPublic) {
        textTogglePool.textContent = '🔒 Havuzdan Kaldır (Özele Al)';
        btnTogglePool.style.display = isOwnerOrAdmin ? 'flex' : 'none';
      } else {
        textTogglePool.textContent = '🌐 Ortak Havuzda Paylaş';
        btnTogglePool.style.display = 'flex';
      }
    }

    if (btnClonePersonal) {
      btnClonePersonal.style.display = curWs === 'pool' ? 'flex' : 'none';
    }

    if (btnDelete) {
      btnDelete.style.display = (curWs === 'personal' || isOwnerOrAdmin) ? 'flex' : 'none';
    }

    if (btnRename) {
      btnRename.style.display = (curWs === 'personal' || isOwnerOrAdmin) ? 'flex' : 'none';
    }

    ctxMenu.style.display = 'flex';

    // Ekran dışına taşmayı önleme
    const menuW = 230;
    const menuH = 280;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 10;
    if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 10;

    ctxMenu.style.left = `${Math.max(10, x)}px`;
    ctxMenu.style.top = `${Math.max(10, y)}px`;
  });

  document.addEventListener('click', e => {
    if (!ctxMenu.contains(e.target)) hideContextMenu();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideContextMenu();
  });

  ctxMenu.querySelectorAll('.ctx-item').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const fileId = contextTargetId;
      hideContextMenu();
      if (!fileId) return;

      const file = FrpStore.getById(fileId);
      const reportName = file?.meta?.reportName || file?.name || '';

      switch (action) {
        case 'view':
          openDetail(fileId);
          break;
        case 'toggle-pool': {
          const isPublic = !!(file?.isPublic || file?.is_public);
          const newState = FrpStore.toggleReportPool(fileId, !isPublic);
          toast(newState ? 'Rapor Ortak Havuzda Paylaşıldı! 🌐' : 'Rapor havuzdan kaldırıldı ve gizlendi 🔒', 'success');
          refreshAll();
          break;
        }
        case 'clone-to-personal': {
          const cloned = FrpStore.cloneReportToPersonal(fileId);
          if (cloned) {
            toast(`"${cloned.name}" kişisel raporlarınıza kopyalandı! 📋`, 'success');
            refreshAll();
          }
          break;
        }
        case 'rename':
          openRenameModal(fileId);
          break;
        case 'download':
          downloadSingleReport(fileId);
          break;
        case 'delete':
          deleteSingle(fileId, reportName);
          break;
        case 'fav':
          toggleFav(null, fileId);
          break;
        case 'pin':
          togglePin(null, fileId);
          break;
        case 'category':
          if (typeof openCategoryModalFor === 'function') openCategoryModalFor(fileId);
          break;
      }
    });
  });
}

selectAllCb.addEventListener('change', () => {
  if (selectAllCb.checked) {
    sortFiles(allFiles).forEach(f => selectedIds.add(f.id));
  } else {
    selectedIds.clear();
  }
  renderTable();
  if (typeof updateBulkBar === 'function') updateBulkBar();
});

function toggleSelect(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderTable();
  if (typeof updateBulkBar === 'function') updateBulkBar();
}

btnCompareSelected.addEventListener('click', () => {
  const ids = [...selectedIds];
  if (ids.length < 2) {
    toast('Karşılaştırmak için lütfen en az 2 rapor seçin.', 'warning');
    return;
  }
  if (ids.length > 3) {
    toast('Aynı anda en fazla 3 rapor karşılaştırılabilir.', 'warning');
    return;
  }
  const qp = [`file1=${encodeURIComponent(ids[0])}`, `file2=${encodeURIComponent(ids[1])}`];
  if (ids.length === 3) qp.push(`file3=${encodeURIComponent(ids[2])}`);
  window.location.href = `compare.html?${qp.join('&')}`;
});

async function deleteSingle(id, name) {
  const ok = await showModal({
    title: '🗑️ Raporu Çöp Kutusuna Taşı',
    body: `<strong>${name}</strong> adlı rapor Çöp Kutusu'na taşınacaktır.<br><small style="color:var(--text-muted);">İstediğiniz zaman Ayarlar &gt; Çöp Kutusu menüsünden geri kurtarabilirsiniz.</small>`,
    confirmText: 'Çöp Kutusuna Taşı',
    danger: true
  });
  if (!ok) return;
  FrpStore.moveToTrash(id);
  selectedIds.delete(id);
  if (selectAllCb) selectAllCb.checked = false;
  if (typeof updateBulkBar === 'function') updateBulkBar();
  toast('Rapor Çöp Kutusu\'na taşındı 🗑️ (Ayarlar\'dan geri alabilirsiniz)', 'info');
  refreshAll();
}

async function deleteBulk() {
  const ids = [...selectedIds];
  const n = ids.length;
  const ok = await showModal({
    title: '🗑️ Toplu Çöp Kutusuna Taşı',
    body: `<strong>${n} rapor</strong> Çöp Kutusu'na taşınacaktır.<br><small style="color:var(--text-muted);">İstediğiniz zaman Ayarlar &gt; Çöp Kutusu menüsünden geri kurtarabilirsiniz.</small>`,
    confirmText: `${n} Raporu Çöp Kutusuna Taşı`,
    danger: true
  });
  if (!ok) return;
  FrpStore.moveManyToTrash(ids);
  selectedIds.clear();
  if (selectAllCb) selectAllCb.checked = false;
  if (typeof updateBulkBar === 'function') updateBulkBar();
  toast(`${n} rapor Çöp Kutusu\'na taşındı 🗑️`, 'info');
  refreshAll();
}

async function deleteAllData() {
  const count = FrpStore.getAll().length;
  if (count === 0) {
    toast('Silinecek rapor bulunamadı.', 'info');
    return;
  }

  const ok = await showModal({
    title: '⚠️ Tüm Verileri Sıfırla / Temizle',
    body: `Sistemdeki tüm <strong>${count} rapor</strong>, kaydedilmiş sorgular, etiketler ve kategoriler tamamen silinecektir.<br><br><span style="color:var(--red);font-weight:700;">Bu işlem geri alınamaz!</span> Devam etmek istiyor musunuz?`,
    confirmText: 'Evet, Tüm Verileri Sıfırla',
    danger: true
  });
  if (!ok) return;

  FrpStore.deleteAll();
  selectedIds.clear();
  if (selectAllCb) selectAllCb.checked = false;
  if (typeof updateBulkBar === 'function') updateBulkBar();
  toast('Tüm veriler başarıyla temizlendi! 🧹', 'success');
  refreshAll();
}

// ── Toplu İşlem Butonları (Favori, Etiket, Kategori, Çöp Kutusu, Seçimi Temizle) ──
document.getElementById('btnBulkFav')?.addEventListener('click', () => {
  const ids = Array.from(selectedIds);
  if (ids.length === 0) return;
  let count = 0;
  ids.forEach(id => {
    const f = FrpStore.getById(id);
    if (f) {
      FrpStore.toggleFavorite(id);
      count++;
    }
  });
  toast(`${count} raporun favori durumu güncellendi ⭐`, 'success');
  refreshAll();
});

document.getElementById('btnBulkTag')?.addEventListener('click', async () => {
  const ids = Array.from(selectedIds);
  if (ids.length === 0) return;
  const existingTags = FrpStore.getAllTags ? FrpStore.getAllTags() : [];
  const datalistOptions = existingTags.map(t => `<option value="${escHtml(t)}">`).join('');

  let enteredTag = '';
  const ok = await showModal({
    title: `🏷️ ${ids.length} Rapora Etiket Ekle`,
    body: `
      <div style="font-size:.85rem;color:var(--text-secondary);margin-bottom:.8rem;">
        Seçilen <strong>${ids.length} rapora</strong> eklenecek etiketi yazın veya listeden seçin:
      </div>
      <input type="text" id="bulkTagInput" class="master-search-input" list="bulkTagsList" placeholder="Örn: Finans, Acil, 2026..." style="width:100%;font-size:.9rem;" />
      <datalist id="bulkTagsList">${datalistOptions}</datalist>
    `,
    confirmText: '🏷️ Etiketi Ekle',
    cancelText: 'İptal',
    onOpen: (modalEl) => {
      const inp = modalEl.querySelector('#bulkTagInput');
      if (inp) {
        setTimeout(() => inp.focus(), 60);
        inp.addEventListener('input', () => { enteredTag = inp.value.trim(); });
      }
    }
  });
  if (!ok) return;
  const inputEl = document.getElementById('bulkTagInput');
  const tag = (inputEl ? inputEl.value.trim() : enteredTag);
  if (!tag) {
    toast('Lütfen geçerli bir etiket girin.', 'warning');
    return;
  }
  ids.forEach(id => FrpStore.addTag(id, tag));
  toast(`${ids.length} rapora '${tag}' etiketi eklendi 🏷️`, 'success');
  refreshAll();
});

document.getElementById('btnBulkCategory')?.addEventListener('click', async () => {
  const ids = Array.from(selectedIds);
  if (ids.length === 0) return;
  const cats = FrpStore.getCategories ? FrpStore.getCategories() : [];
  const catOptions = cats.map(c => `<option value="${escHtml(c)}">📁 ${escHtml(c)}</option>`).join('');

  const ok = await showModal({
    title: `📁 ${ids.length} Rapora Kategori Ata`,
    body: `
      <div style="font-size:.85rem;color:var(--text-secondary);margin-bottom:.8rem;">
        Seçilen <strong>${ids.length} rapora</strong> atanacak kategoriyi seçin:
      </div>
      <select id="bulkCategorySelect" class="select-field" style="width:100%;font-size:.88rem;padding:.5rem .75rem;margin-bottom:.6rem;">
        <option value="">-- Kategori Seçin --</option>
        ${catOptions}
      </select>
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.3rem;">Veya Yeni Kategori Yazın:</div>
      <input type="text" id="bulkNewCategoryInput" class="master-search-input" placeholder="Yeni kategori adı..." style="width:100%;font-size:.88rem;" />
    `,
    confirmText: '📁 Kategoriyi Kaydet',
    cancelText: 'İptal'
  });
  if (!ok) return;
  const sel = document.getElementById('bulkCategorySelect');
  const inp = document.getElementById('bulkNewCategoryInput');
  const finalCat = (inp && inp.value.trim()) ? inp.value.trim() : (sel ? sel.value : '');
  if (!finalCat) {
    toast('Lütfen bir kategori seçin veya yazın.', 'warning');
    return;
  }
  ids.forEach(id => FrpStore.setCategory(id, finalCat));
  toast(`${ids.length} raporun kategorisi '${finalCat}' olarak güncellendi 📁`, 'success');
  refreshAll();
});

document.getElementById('btnDeleteBulk')?.addEventListener('click', deleteBulk);
document.getElementById('btnDeleteAllData')?.addEventListener('click', deleteAllData);
document.getElementById('btnClearSelection')?.addEventListener('click', () => {
  selectedIds.clear();
  if (selectAllCb) selectAllCb.checked = false;
  if (typeof updateBulkBar === 'function') updateBulkBar();
  renderTable();
});


// ── Tablo Analizi Modalı ──────────────────────────────────
document.getElementById('btnTableAnalysis')?.addEventListener('click', async () => {
  const tableData = FrpStore.getTableUsage();
  if (tableData.length === 0) {
    toast('Tablo analizi için SQL sorgusu içeren rapor bulunamadı.', 'warning');
    return;
  }

  const listHtml = tableData.map(item => `
    <div class="table-usage-item" onclick="filterByTable('${escHtml(item.tableName)}')">
      <span class="table-name">🗄️ ${escHtml(item.tableName)}</span>
      <span class="table-count">${item.count} rapor</span>
    </div>
  `).join('');

  const body = `
    <div style="font-size:.85rem;color:var(--text-muted);margin-bottom:.5rem;">
      SQL sorgularında tespit edilen veritabanı tabloları. Filtrelemek için tabloya tıklayın:
    </div>
    <div class="table-usage-list">${listHtml}</div>
  `;

  await showModal({
    title: '📊 Veritabanı Tablo Analizi',
    body,
    confirmText: 'Kapat',
    cancelText: ''
  });
});

function filterByTable(tableName) {
  searchInput.value = tableName;
  searchQuery = tableName;
  searchField = 'sql';
  fieldSelect.value = 'sql';
  applySearch();
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) overlay.remove();
}

// ── Mükerrer Sorgu Bul ─────────────────────────────────────
document.getElementById('btnFindDuplicates')?.addEventListener('click', async () => {
  const dupes = FrpStore.findDuplicateQueries();
  if (dupes.length === 0) {
    toast('Raporlar arasında birebir aynı mükerrer SQL sorgusu bulunamadı.', 'success');
    return;
  }

  const listHtml = dupes.map(d => `
    <div class="table-usage-item" style="flex-direction:column;align-items:flex-start;gap:.3rem;">
      <div style="font-size:.8rem;font-weight:700;color:var(--orange);">
        🔁 Sorgu: ${escHtml(d.query1.queryName)}
      </div>
      <div style="font-size:.78rem;color:var(--text-secondary);">
        📍 1. Rapor: <strong>${escHtml(d.query1.fileName)}</strong><br>
        📍 2. Rapor: <strong>${escHtml(d.query2.fileName)}</strong>
      </div>
      <button class="btn btn-sm" style="margin-top:.2rem;" onclick="openCompareFiles('${d.query1.fileId}', '${d.query2.fileId}')">🔀 Karşılaştır</button>
    </div>
  `).join('');

  await showModal({
    title: '🔍 Mükerrer SQL Sorguları Tespiti',
    body: `<div style="font-size:.82rem;color:var(--text-muted);margin-bottom:.5rem;">Bulunan aynı SQL sorguları:</div><div class="table-usage-list">${listHtml}</div>`,
    confirmText: 'Kapat',
    cancelText: ''
  });
});

function openCompareFiles(id1, id2) {
  window.location.href = `compare.html?file1=${encodeURIComponent(id1)}&file2=${encodeURIComponent(id2)}`;
}

// ── Sorgu Kütüphanesi Modalı ──────────────────────────────
// (Ortak js/shared/snippet_modal.js modülü tarafından yönetilmektedir)

// ── Navigasyon ─────────────────────────────────────────────
function openDetail(id) {
  window.location.href = 'detail.html?id=' + encodeURIComponent(id);
}
// ── Dosya Ekleme ───────────────────────────────────────────
const fileInputSingle  = document.getElementById('fileInputSingle');
const fileInputMulti   = document.getElementById('fileInputMulti');
const fileInputFolder  = document.getElementById('fileInputFolder');

const btnAddSingle = document.getElementById('btnAddSingle');
const btnAddMulti  = document.getElementById('btnAddMulti');
const btnAddFolder = document.getElementById('btnAddFolder');

if (btnAddSingle) btnAddSingle.addEventListener('click', () => fileInputSingle?.click());
if (btnAddMulti)  btnAddMulti.addEventListener('click',  () => fileInputMulti?.click());
if (btnAddFolder) btnAddFolder.addEventListener('click', () => fileInputFolder?.click());

if (fileInputSingle) fileInputSingle.addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
if (fileInputMulti)  fileInputMulti.addEventListener('change',  e => { handleFiles(e.target.files); e.target.value = ''; });
if (fileInputFolder) fileInputFolder.addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });

const uploadMini = document.getElementById('uploadMini');
if (uploadMini) {
  uploadMini.addEventListener('click', () => fileInputMulti?.click());
  uploadMini.addEventListener('dragover', e => { e.preventDefault(); uploadMini.classList.add('drag'); });
  uploadMini.addEventListener('dragleave', () => uploadMini.classList.remove('drag'));
  uploadMini.addEventListener('drop', e => { e.preventDefault(); uploadMini.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
}

document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });


// ── YENİ ÖZELLİKLER HAFISA DEĞİŞKENLERİ ──────────────────
let isStoreLoaded   = false;
let currentViewMode = 'table'; // 'table' | 'cards' | 'timeline'
let onlyPinned      = false;
let onlyNotes       = false;
let selectedCategory = '';

// ── SABİTLEME (PIN) TOGGLE ────────────────────────────────
// ── SIRALAMA (Pin önce, sonra favori, sonra alan sıralaması) ──────────────
function sortFiles(files) {
  return [...files].sort((a, b) => {
    // Önce sabitlenmişler
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    // Sonra favoriler
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
      case 'author':
        va = (a.meta?.author || '').toLowerCase();
        vb = (b.meta?.author || '').toLowerCase();
        break;
      case 'queries':
        va = (a.queries || []).length;
        vb = (b.queries || []).length;
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

// ── UYGULANAN FİLTRE & ARAMA ──────────────────────────────
function applySearch() {
  currentPage = 1;
  regexError = false;
  if (regexErrMsg) regexErrMsg.classList.remove('show');
  const sw = document.getElementById('searchWrap');
  if (sw) sw.classList.remove('error');
  if (regexBtn) regexBtn.classList.remove('error');

  const btnResetFilters = document.getElementById('btnResetFilters');
  if (btnResetFilters) {
    const hasActiveFilter = !!searchQuery || !!selectedTag || !!selectedCategory || onlyFavorites || onlyPinned || onlyNotes;
    btnResetFilters.style.display = hasActiveFilter ? 'inline-flex' : 'none';
  }

  try {
    const curWs = FrpStore.getActiveWorkspace ? FrpStore.getActiveWorkspace() : 'personal';
    let baseList = curWs === 'pool'
      ? (FrpStore.getPoolReports ? FrpStore.getPoolReports() : [])
      : (FrpStore.getMyReports ? FrpStore.getMyReports() : FrpStore.getAll());

    let files = baseList.filter(file => {
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

    allFiles = files;
  } catch (err) {
    regexError = true;
    if (regexErrMsg) { regexErrMsg.textContent = '⚠️ ' + err.message; regexErrMsg.classList.add('show'); }
    if (sw) sw.classList.add('error');
    if (regexBtn) regexBtn.classList.add('error');
    allFiles = [];
  }

  renderCurrentView();
}

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
    if (tableEl) tableEl.style.display = 'table';
    renderTable();
  }
}

// ── KART GÖRÜNÜMÜ RENDER (TAŞMASIZ & ZENGİNLEŞTİRİLMİŞ) ───
function renderCards(container) {
  const sorted = sortFiles(allFiles);
  resultCount.textContent = sorted.length + ' sonuç';

  const prefs = FrpStore.getPreferences();
  const pageSize = prefs.pageSize || 50;
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * pageSize;
  const pagedFiles = pageSize >= 9999 ? sorted : sorted.slice(startIndex, startIndex + pageSize);

  renderPaginationControls(totalItems, pageSize);

  if (sorted.length === 0) {
    container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);font-size:.9rem;">Sonuç bulunamadı.</div>`;
    return;
  }

  container.style.display = 'grid';
  container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
  container.style.gap = '1.1rem';
  container.style.padding = '1rem 0';
  container.style.boxSizing = 'border-box';
  container.style.width = '100%';

  container.innerHTML = pagedFiles.map(file => {
    const reportName = file.meta.reportName || file.name;
    const date = new Date(file.loadedAt).toLocaleDateString('tr-TR');
    const size = file.sizeBytes > 1024 ? Math.round(file.sizeBytes / 1024) + ' KB' : file.sizeBytes + ' B';
    const guidVal = (file.meta && file.meta.guid) ? file.meta.guid : '';
    const guidBadge = guidVal
      ? `<span class="badge badge-gray" onclick="event.stopPropagation();copyGuidText('${escHtml(guidVal)}')" title="Tıklayınca GUID kopyalar: ${escHtml(guidVal)}" style="cursor:pointer;font-family:var(--mono);font-size:.68rem;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle;">🔑 ${escHtml(guidVal)}</span>`
      : '';

    return `
      <div class="report-card ${file.isPinned ? 'pinned' : ''}" style="background:var(--bg-surface);border:1.5px solid var(--border-light);border-radius:14px;padding:1.1rem;display:flex;flex-direction:column;gap:.75rem;cursor:pointer;transition:transform .18s ease, box-shadow .18s ease;box-shadow:0 4px 14px rgba(0,0,0,.04);box-sizing:border-box;max-width:100%;overflow:hidden;" onclick="openDetail('${file.id}')">
        <div class="card-top" style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;">
          <div style="min-width:0;flex:1;overflow:hidden;">
            <div class="card-title" style="font-weight:800;font-size:.92rem;color:var(--text-primary);line-height:1.35;word-break:break-word;">📋 ${escHtml(reportName)}</div>
            <div style="font-size:.73rem;color:var(--text-muted);font-family:var(--mono);margin-top:.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;" title="${escHtml(file.name)} · ${size}">
              ${escHtml(file.name)} · <strong>${size}</strong>
            </div>
          </div>
          <div class="card-actions" onclick="event.stopPropagation();" style="display:flex;align-items:center;gap:.25rem;flex-shrink:0;">
            <button class="pin-btn ${file.isPinned ? 'active' : ''}" onclick="togglePin(event, '${file.id}')" title="Üste Sabitle" style="background:none;border:none;cursor:pointer;font-size:1rem;opacity:${file.isPinned ? '1' : '0.35'};">📌</button>
            <button class="star-btn ${file.isFavorite ? 'active' : ''}" onclick="toggleFav(event, '${file.id}')" title="Favori">★</button>
          </div>
        </div>

        <div class="card-body" style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;overflow:hidden;">
          <span class="badge badge-blue">🗄️ ${file.queries.length} SQL</span>
          ${file.pascalScript ? '<span class="badge badge-purple">✓ Pascal</span>' : ''}
          ${file.category ? `<span class="badge badge-purple" onclick="event.stopPropagation();openCategoryModalFor('${file.id}')" style="cursor:pointer;" title="Kategori: ${escHtml(file.category)}">🏷️ ${escHtml(file.category)}</span>` : `<button class="btn btn-sm" onclick="event.stopPropagation();openCategoryModalFor('${file.id}')" style="font-size:.7rem;padding:1px 6px;border-radius:5px;opacity:.7;">+ Kategori</button>`}
        </div>

        <div class="card-footer" style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border-light);padding-top:.6rem;font-size:.74rem;color:var(--text-muted);gap:.5rem;overflow:hidden;">
          ${guidBadge || '<span style="font-size:.72rem;">—</span>'}
          <span style="white-space:nowrap;flex-shrink:0;">📅 ${date}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── TIMELINE GÖRÜNÜMÜ RENDER ──────────────────────────────
function renderTimeline(container) {
  const sorted = sortFiles(allFiles);
  resultCount.textContent = sorted.length + ' sonuç';

  if (sorted.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);">Sonuç bulunamadı.</div>`;
    return;
  }

  // Yüklenme tarihine göre grupla (Yıl-Ay)
  const groups = {};
  sorted.forEach(file => {
    const d = new Date(file.loadedAt);
    const key = d.toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(file);
  });

  container.innerHTML = Object.entries(groups).map(([groupTitle, items]) => `
    <div class="timeline-group">
      <div class="timeline-group-header">📅 ${groupTitle} (${items.length} rapor)</div>
      <div class="timeline-items">
        ${items.map(file => {
          const reportName = file.meta.reportName || file.name;
          const timeStr = new Date(file.loadedAt).toLocaleDateString('tr-TR');
          const guidVal = (file.meta && file.meta.guid) ? file.meta.guid : '—';
          return `
            <div class="timeline-item" onclick="openDetail('${file.id}')" style="cursor:pointer;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-size:.9rem;color:var(--text-primary);">📋 ${escHtml(reportName)}</strong>
                <span style="font-size:.75rem;color:var(--text-muted);">${timeStr}</span>
              </div>
              <div style="font-size:.76rem;color:var(--text-muted);margin-top:.25rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                <span>Dosya: <code>${escHtml(file.name)}</code></span>
                <span class="badge badge-gray" style="font-family:var(--mono);font-size:.7rem;">🔑 GUID: ${escHtml(guidVal)}</span>
                <span class="badge badge-blue" style="font-size:.7rem;">🗄️ ${file.queries.length} SQL</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
}

// ── PARAMETRE YÖNETİM PANELİ MODALI (Master-Detail Geniş Konsol) ─────────────────────────
document.getElementById('btnParams')?.addEventListener('click', async () => {
  const usage = FrpStore.getParameterUsage();
  if (usage.length === 0) {
    toast('Raporlarda henüz SQL parametresi bulunamadı.', 'warning');
    return;
  }

  // Rapor bazında grupla
  usage.forEach(u => {
    const reportsMap = new Map();
    u.usages.forEach(us => {
      if (!reportsMap.has(us.fileId)) {
        reportsMap.set(us.fileId, {
          fileId: us.fileId,
          fileName: us.fileName,
          reportName: us.reportName,
          queries: []
        });
      }
      reportsMap.get(us.fileId).queries.push(us.queryName);
    });
    u.reportCount = reportsMap.size;
    u.groupedReports = Array.from(reportsMap.values());
  });

  const bodyHtml = `
    <div class="modal-master-detail">
      <!-- SOL: Master Parametre Listesi -->
      <div class="master-pane">
        <div class="master-search-wrap">
          <input type="text" id="paramMasterSearch" class="master-search-input" placeholder="🔍 Parametre ara... (:t1, :tarih)" autocomplete="off" />
          <div style="font-size:.72rem;color:var(--text-muted);display:flex;justify-content:space-between;">
            <span>Toplam: <strong>${usage.length}</strong> parametre</span>
            <span id="paramFilterCount"></span>
          </div>
        </div>
        <div class="master-list" id="paramMasterList">
          ${usage.map((u, i) => `
            <div class="master-item ${i === 0 ? 'active' : ''}" data-idx="${i}">
              <div style="min-width:0;flex:1;">
                <div class="table-name" style="color:var(--orange);font-family:var(--mono);font-size:.82rem;font-weight:700;overflow:hidden;text-overflow:ellipsis;">
                  ⚙️ ${escHtml(u.param)}
                </div>
                <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem;">
                  ${u.reportCount} rapor
                </div>
              </div>
              <span class="badge badge-blue" style="font-size:.7rem;padding:.15rem .45rem;">${u.count} yer</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- SAĞ: Seçili Parametre Detayı -->
      <div class="detail-pane">
        <div class="detail-header" id="paramDetailHeader"></div>
        <div style="margin-bottom:.65rem;">
          <input type="text" id="paramDetailReportSearch" class="master-search-input" placeholder="🔍 Bu parametrenin geçtiği raporlarda ara..." autocomplete="off" />
        </div>
        <div class="detail-body" id="paramDetailBody"></div>
      </div>
    </div>
  `;

  await showModal({
    title: `⚙️ Tüm SQL Parametreleri Paneli (${usage.length} Parametre)`,
    body: bodyHtml,
    confirmText: 'Kapat',
    cancelText: '',
    maxWidth: '1150px',
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
            <div style="display:flex;align-items:center;gap:.6rem;">
              <span style="font-size:1.15rem;font-weight:800;color:var(--orange);font-family:var(--mono);">⚙️ ${escHtml(item.param)}</span>
              <span class="badge badge-blue">${item.count} toplam sorgu</span>
              <span class="badge badge-purple">${item.reportCount} benzersiz rapor</span>
            </div>
            <div style="font-size:.74rem;color:var(--text-muted);margin-top:.2rem;">
              Bu parametrenin kullanıldığı tüm raporlar ve bağlı sorgular aşağıda listelenmiştir.
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:.4rem;">
            <button class="btn btn-sm" id="btnCopyParamReports" title="Rapor isimlerini panoya kopyala">📋 Raporları Kopyala</button>
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
                  📋 ${escHtml(r.reportName)}
                </div>
                <div style="font-size:.72rem;color:var(--text-muted);font-family:var(--mono);">
                  ${escHtml(r.fileName)}
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-primary" style="padding:.2rem .65rem;font-size:.74rem;white-space:nowrap;" onclick="window.openDetail('${r.fileId}')">Detayda Aç →</button>
            </div>
            <div style="margin-top:.4rem;padding-top:.35rem;border-top:1px dashed var(--border-light);">
              <span style="font-size:.72rem;color:var(--text-muted);font-weight:600;">Kullanan Sorgular:</span>
              <div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.2rem;">
                ${r.queries.map(qn => `<span class="query-chip">⚡ ${escHtml(qn)}</span>`).join('')}
              </div>
            </div>
          </div>
        `).join('');

        // Detay Aksiyon Dinleyicileri
        overlay.querySelector('#btnCopyParamReports')?.addEventListener('click', () => {
          const text = item.groupedReports.map(r => `${r.reportName} (${r.fileName}) [${r.queries.join(', ')}]`).join('\n');
          navigator.clipboard.writeText(text).then(() => toast('Rapor listesi panoya kopyalandı! 📋', 'success'));
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
        if (filterCountEl) {
          filterCountEl.textContent = q ? `${visibleCount} bulundu` : '';
        }
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
});

// ── BAĞIMLILIK HARİTASI MODALI (Master-Detail Geniş Konsol) ─────────────────────────────
document.getElementById('btnDependencies')?.addEventListener('click', async () => {
  const deps = FrpStore.getDependencyMap();
  if (deps.length === 0) {
    toast('Bağımlılık analizi için tablo verisi bulunamadı.', 'warning');
    return;
  }

  // Rapor bazında grupla
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
      <!-- SOL: Master Tablo Listesi -->
      <div class="master-pane">
        <div class="master-search-wrap">
          <input type="text" id="tableMasterSearch" class="master-search-input" placeholder="🔍 Tablo ara... (BIRIM, HASTA)" autocomplete="off" />
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
                  🗄️ ${escHtml(d.table)}
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

      <!-- SAĞ: Seçili Tablo Bağımlılık Detayı -->
      <div class="detail-pane">
        <div class="detail-header" id="tableDetailHeader"></div>
        <div style="margin-bottom:.65rem;">
          <input type="text" id="tableDetailReportSearch" class="master-search-input" placeholder="🔍 Bu tabloya bağımlı raporlarda ara..." autocomplete="off" />
        </div>
        <div class="detail-body" id="tableDetailBody"></div>
      </div>
    </div>
  `;

  await showModal({
    title: `🕸️ Veritabanı Tablo Bağımlılık Haritası (${deps.length} Tablo)`,
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

        const impactLevel = item.reportCount > 50 ? '🚨 Yüksek Etki Riski' : (item.reportCount > 10 ? '⚠️ Orta Etki' : 'ℹ️ Düşük Etki');
        const impactColor = item.reportCount > 50 ? 'var(--red)' : (item.reportCount > 10 ? 'var(--orange)' : 'var(--green)');

        headerEl.innerHTML = `
          <div>
            <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
              <span style="font-size:1.15rem;font-weight:800;color:var(--accent);">🗄️ ${escHtml(item.table)}</span>
              <span class="badge badge-purple">${item.reportCount} bağımlı rapor</span>
              <span class="badge badge-blue">${item.count} sorgu</span>
              <span style="font-size:.74rem;font-weight:700;color:${impactColor};background:var(--bg-raised);padding:.2rem .5rem;border-radius:6px;border:1px solid var(--border);">${impactLevel}</span>
            </div>
            <div style="font-size:.74rem;color:var(--text-muted);margin-top:.2rem;">
              Bu tabloda yapılacak kolon/şema değişikliklerinden etkilenecek raporlar aşağıda listelenmiştir.
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:.4rem;">
            <button class="btn btn-sm" id="btnFilterInList" title="Ana listede bu tabloyu filtrele">🔍 Listede Filtrele</button>
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
                  📋 ${escHtml(r.reportName)}
                </div>
                <div style="font-size:.72rem;color:var(--text-muted);font-family:var(--mono);">
                  ${escHtml(r.fileName)}
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-primary" style="padding:.2rem .65rem;font-size:.74rem;white-space:nowrap;" onclick="window.openDetail('${r.fileId}')">Detayda Aç →</button>
            </div>
            <div style="margin-top:.4rem;padding-top:.35rem;border-top:1px dashed var(--border-light);">
              <span style="font-size:.72rem;color:var(--text-muted);font-weight:600;">Bağlı SQL Sorguları:</span>
              <div style="display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.2rem;">
                ${r.queries.map(qn => `<span class="query-chip">⚡ ${escHtml(qn)}</span>`).join('')}
              </div>
            </div>
          </div>
        `).join('');

        // Detay Aksiyon Dinleyicileri
        overlay.querySelector('#btnFilterInList')?.addEventListener('click', () => {
          overlay.remove();
          filterByTable(item.table);
        });
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
        if (filterCountEl) {
          filterCountEl.textContent = q ? `${visibleCount} bulundu` : '';
        }
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
});

// ── GENEL SQL KARMAŞIKLIK VE STATİK ANALİZ MERKEZİ MODALI ──────────────
const btnComplexityCenter = document.getElementById('btnComplexityCenter');
btnComplexityCenter?.addEventListener('click', async () => {
  const files = FrpStore.getAll();
  if (files.length === 0) {
    toast('Henüz analiz edilecek bir rapor yüklenmedi.', 'info');
    return;
  }

  const isLarge = files.length > 25;
  if (isLarge) {
    showProgressModal('🧠 SQL Karmaşıklık & Anti-Pattern Analizi', `${files.length} rapor taranıyor...`, '🧠');
    updateProgressModal(1, files.length, 'Analiz motoru başlatılıyor...');
    await new Promise(r => setTimeout(r, 30));
  }

  // 1. Tüm raporları ve sorguları detaylı analiz et
  const reportAnalyses = [];
  const queryAnalyses  = [];

  const categoryCounts = {
    all: 0,
    index: 0,
    join: 0,
    subquery: 0,
    null_trap: 0,
    memory: 0
  };

  const chunkSize = Math.max(25, Math.floor(files.length / 15));

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const reportName = (file.meta && file.meta.reportName) || file.name;
    const queries = Array.isArray(file.queries) ? file.queries : [];
    if (queries.length > 0) {
      const repQueries = [];
      const repCategories = new Set();

      queries.forEach((q, qIdx) => {
        const sql = q.sql || '';
        if (!sql.trim()) return;
        const comp = FrpStore.getSqlComplexity(sql);

        comp.warnings.forEach(w => {
          const cat = w.category || 'other';
          if (categoryCounts[cat] !== undefined) categoryCounts[cat]++;
          repCategories.add(cat);
        });

        const dangerCount = comp.warnings.filter(w => w.type === 'danger').length;
        const warningCount = comp.warnings.length;
        const isCritical = dangerCount > 0;
        const isMedium = dangerCount === 0 && warningCount > 0;
        const isClean = warningCount === 0;

        const qItem = {
          fileId: file.id,
          fileName: file.name,
          reportName,
          queryName: q.name || `Sorgu ${qIdx + 1}`,
          queryIndex: qIdx,
          sql,
          comp,
          dangerCount,
          warningCount,
          isCritical,
          isMedium,
          isClean
        };

        repQueries.push(qItem);
        queryAnalyses.push(qItem);
      });

      if (repQueries.length > 0) {
        const totalDanger = repQueries.reduce((acc, q) => acc + q.dangerCount, 0);
        const totalWarnings = repQueries.reduce((acc, q) => acc + q.warningCount, 0);
        const critQueriesCount = repQueries.filter(q => q.isCritical).length;
        const medQueriesCount  = repQueries.filter(q => q.isMedium).length;
        const clnQueriesCount  = repQueries.filter(q => q.isClean).length;

        const isCritical = totalDanger > 0;
        const isMedium = totalDanger === 0 && totalWarnings > 0;
        const isClean = totalWarnings === 0;

        let statusColor = '#10b981';
        let statusText = 'Sorunsuz / Temiz';
        let statusIcon = '✅';
        if (isCritical) {
          statusColor = '#ef4444';
          statusText = `${totalWarnings} Risk Var`;
          statusIcon = '🚨';
        } else if (isMedium) {
          statusColor = '#f59e0b';
          statusText = `${totalWarnings} İyileştirme`;
          statusIcon = '⚠️';
        }

        reportAnalyses.push({
          fileId: file.id,
          fileName: file.name,
          reportName,
          queries: repQueries,
          queryCount: repQueries.length,
          totalDanger,
          totalWarnings,
          critQueriesCount,
          medQueriesCount,
          clnQueriesCount,
          isCritical,
          isMedium,
          isClean,
          statusColor,
          statusText,
          statusIcon,
          categories: Array.from(repCategories)
        });
      }
    }

    if (isLarge && (i % chunkSize === 0 || i === files.length - 1)) {
      updateProgressModal(i + 1, files.length, file.name);
      await new Promise(r => setTimeout(r, 0));
    }
  }

  if (isLarge) hideProgressModal();

  categoryCounts.all = queryAnalyses.length;

  if (reportAnalyses.length === 0) {
    toast('Yüklenen raporlarda analiz edilecek SQL sorgusu bulunamadı.', 'warning');
    return;
  }

  let currentViewMode = 'report'; // 'report' | 'query'
  let activeReportIdx = 0;
  let activeQueryIdx  = 0;
  let activeGradeFilter = 'all'; // 'all' | 'critical' | 'medium' | 'simple'
  let activeCategoryFilter = 'all'; // 'all' | 'index' | 'join' | 'subquery' | 'null_trap' | 'memory'
  let activeSearchText = '';
  let activeSortMode = 'risk_desc'; // 'risk_desc' | 'risk_asc' | 'name_asc' | 'query_count'

  function sortData() {
    if (activeSortMode === 'risk_desc') {
      reportAnalyses.sort((a, b) => b.totalDanger - a.totalDanger || b.totalWarnings - a.totalWarnings || a.reportName.localeCompare(b.reportName));
      queryAnalyses.sort((a, b) => b.dangerCount - a.dangerCount || b.warningCount - a.warningCount || b.comp.score - a.comp.score);
    } else if (activeSortMode === 'risk_asc') {
      reportAnalyses.sort((a, b) => a.totalWarnings - b.totalWarnings || a.totalDanger - b.totalDanger || a.reportName.localeCompare(b.reportName));
      queryAnalyses.sort((a, b) => a.warningCount - b.warningCount || a.dangerCount - b.dangerCount || a.comp.score - b.comp.score);
    } else if (activeSortMode === 'name_asc') {
      reportAnalyses.sort((a, b) => a.reportName.localeCompare(b.reportName));
      queryAnalyses.sort((a, b) => a.reportName.localeCompare(b.reportName) || a.queryName.localeCompare(b.queryName));
    } else if (activeSortMode === 'query_count') {
      reportAnalyses.sort((a, b) => b.queryCount - a.queryCount || b.totalWarnings - a.totalWarnings);
      queryAnalyses.sort((a, b) => b.comp.details.totalJoins - a.comp.details.totalJoins);
    }
  }

  sortData();

  const criticalReportCount = reportAnalyses.filter(r => r.isCritical).length;
  const mediumReportCount   = reportAnalyses.filter(r => r.isMedium).length;
  const simpleReportCount   = reportAnalyses.filter(r => r.isClean).length;

  const bodyHtml = `
    <div style="display:flex;flex-direction:column;gap:1rem;">
      
      <!-- Üst Araç Çubuğu: Görünüm Modu, Seviye & Kategori Filtreleri -->
      <div style="display:flex;flex-direction:column;gap:.75rem;padding:1rem 1.3rem;background:var(--bg-raised);border-radius:14px;border:1px solid var(--border-light);">
        
        <!-- Üst Satır: Görünüm Geçişi & Seviye Rozetleri -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:1.25rem;flex-wrap:wrap;">
          
          <!-- Görünüm Seçici (Rapor Bazlı vs. Tekil Sorgu) -->
          <div style="display:flex;align-items:center;gap:.5rem;background:var(--bg-surface);padding:.25rem;border-radius:10px;border:1px solid var(--border);">
            <button type="button" class="btn btn-sm ${currentViewMode === 'report' ? 'btn-primary' : 'btn-ghost'}" id="btnToggleReportView" style="font-size:.82rem;padding:.35rem .95rem;font-weight:700;">
              📋 Rapor Bazlı (${reportAnalyses.length})
            </button>
            <button type="button" class="btn btn-sm ${currentViewMode === 'query' ? 'btn-primary' : 'btn-ghost'}" id="btnToggleQueryView" style="font-size:.82rem;padding:.35rem .95rem;font-weight:700;">
              🗄️ Tekil Sorgular (${queryAnalyses.length})
            </button>
          </div>

          <!-- Seviye Filtreleri -->
          <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
            <button type="button" class="btn btn-sm btn-filter-pill active" data-filter="all" id="btnFilterAll" style="padding:.3rem .85rem;">Tümü (${reportAnalyses.length})</button>
            <button type="button" class="btn btn-sm btn-filter-pill" data-filter="critical" id="btnFilterCritical" style="color:#ef4444;padding:.3rem .85rem;">🚨 Riskli Raporlar (${criticalReportCount})</button>
            <button type="button" class="btn btn-sm btn-filter-pill" data-filter="medium" id="btnFilterMedium" style="color:#f59e0b;padding:.3rem .85rem;">⚠️ İyileştirilebilir (${mediumReportCount})</button>
            <button type="button" class="btn btn-sm btn-filter-pill" data-filter="simple" id="btnFilterSimple" style="color:#10b981;padding:.3rem .85rem;">✅ Sorunsuz / Temiz (${simpleReportCount})</button>
          </div>
        </div>

        <!-- Alt Satır: Sorun / Anti-Pattern Kategori Filtreleri (Chips) -->
        <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;border-top:1px solid var(--border-light);padding-top:.7rem;font-size:.8rem;">
          <span style="font-weight:700;color:var(--text-muted);margin-right:.3rem;">🔍 Sorun Tipi:</span>
          <button type="button" class="badge-chip active" data-cat="all" style="padding:.28rem .75rem;">Tüm Sorunlar</button>
          <button type="button" class="badge-chip" data-cat="index" style="padding:.28rem .75rem;">🚨 İndeks İptali (${categoryCounts.index})</button>
          <button type="button" class="badge-chip" data-cat="join" style="padding:.28rem .75rem;">🚨 Kukla/ON 1=1 (${categoryCounts.join})</button>
          <button type="button" class="badge-chip" data-cat="subquery" style="padding:.28rem .75rem;">⚠️ N+1 Skalar (${categoryCounts.subquery})</button>
          <button type="button" class="badge-chip" data-cat="null_trap" style="padding:.28rem .75rem;">⚠️ NOT IN (${categoryCounts.null_trap})</button>
          <button type="button" class="badge-chip" data-cat="memory" style="padding:.28rem .75rem;">⚠️ UNION / SELECT * (${categoryCounts.memory})</button>
        </div>

      </div>

      <!-- Master - Detail Düzeni (Genişletilmiş Konsol) -->
      <div class="modal-master-detail" style="height:74vh;min-height:580px;max-height:85vh;">
        
        <!-- SOL: Liste Paneli (Master) -->
        <div class="master-pane" style="width:420px;min-width:370px;">
          <div class="master-search-wrap">
            <div style="display:flex;gap:.45rem;align-items:center;">
              <input type="text" id="compMasterSearch" class="master-search-input" style="flex:1;" placeholder="🔍 Rapor veya sorgu ara..." autocomplete="off" />
              <select id="compSortSelect" style="padding:.45rem .65rem;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.78rem;outline:none;cursor:pointer;font-weight:600;">
                <option value="risk_desc">🔥 En Riskli</option>
                <option value="risk_asc">✅ En Temiz</option>
                <option value="name_asc">🔤 İsim (A-Z)</option>
                <option value="query_count">🗄️ Çok Sorgu</option>
              </select>
            </div>
            <div style="font-size:.74rem;color:var(--text-muted);display:flex;justify-content:space-between;margin-top:.1rem;">
              <span id="compListCountText"></span>
              <span id="compFilterStatusText" style="color:var(--accent-bright);font-weight:600;"></span>
            </div>
          </div>
          <div class="master-list" id="compMasterList"></div>
        </div>

        <!-- SAĞ: Detay Paneli (Detail) -->
        <div class="detail-pane" style="flex:1;overflow-y:auto;padding:1.1rem 1.3rem;">
          <div class="detail-header" id="compDetailHeader" style="border-bottom:1px solid var(--border-light);padding-bottom:1rem;"></div>
          <div class="detail-body" id="compDetailBody" style="display:flex;flex-direction:column;gap:1.15rem;padding-top:.85rem;"></div>
        </div>

      </div>

    </div>
  `;

  await showModal({
    title: `🧠 Zeki SQL Karmaşıklık & Anti-Pattern Analiz Merkezi (${reportAnalyses.length} Rapor · ${queryAnalyses.length} Sorgu)`,
    body: bodyHtml,
    confirmText: 'Kapat',
    cancelText: '',
    maxWidth: '96vw',
    onOpen: (overlay) => {
      const masterListEl     = overlay.querySelector('#compMasterList');
      const masterSearchEl   = overlay.querySelector('#compMasterSearch');
      const sortSelectEl     = overlay.querySelector('#compSortSelect');
      const countTextEl      = overlay.querySelector('#compListCountText');
      const filterStatusEl   = overlay.querySelector('#compFilterStatusText');
      const headerEl         = overlay.querySelector('#compDetailHeader');
      const bodyEl           = overlay.querySelector('#compDetailBody');
      const filterPills      = overlay.querySelectorAll('.btn-filter-pill');
      const categoryChips    = overlay.querySelectorAll('.badge-chip');
      const btnToggleReport  = overlay.querySelector('#btnToggleReportView');
      const btnToggleQuery   = overlay.querySelector('#btnToggleQueryView');

      function updateMasterList() {
        const q = (activeSearchText || '').toLowerCase().trim();
        masterListEl.innerHTML = '';
        let visibleCount = 0;
        let firstVisibleIdx = -1;

        if (currentViewMode === 'report') {
          // RAPOR BAZLI LİSTELEME
          reportAnalyses.forEach((rep, idx) => {
            let gradeMatch = true;
            if (activeGradeFilter === 'critical') gradeMatch = rep.isCritical;
            else if (activeGradeFilter === 'medium') gradeMatch = rep.isMedium;
            else if (activeGradeFilter === 'simple') gradeMatch = rep.isClean;

            let catMatch = true;
            if (activeCategoryFilter !== 'all') {
              catMatch = rep.categories.includes(activeCategoryFilter);
            }

            let textMatch = true;
            if (q) {
              const inRepName = rep.reportName.toLowerCase().includes(q);
              const inFileName = rep.fileName.toLowerCase().includes(q);
              const inQueries = rep.queries.some(qi =>
                qi.queryName.toLowerCase().includes(q) ||
                qi.sql.toLowerCase().includes(q) ||
                qi.comp.warnings.some(w => w.title.toLowerCase().includes(q) || w.text.toLowerCase().includes(q)) ||
                qi.comp.recommendations.some(r => (r.title || '').toLowerCase().includes(q))
              );
              textMatch = inRepName || inFileName || inQueries;
            }

            const isVisible = gradeMatch && catMatch && textMatch;
            if (isVisible) {
              visibleCount++;
              if (firstVisibleIdx === -1) firstVisibleIdx = idx;

              const isSelected = idx === activeReportIdx;
              const itemDiv = document.createElement('div');
              itemDiv.className = `master-item ${isSelected ? 'active' : ''}`;
              itemDiv.dataset.idx = idx;
              itemDiv.innerHTML = `
                <div style="min-width:0;flex:1;">
                  <div style="font-weight:700;font-size:.84rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    📋 ${escHtml(rep.reportName)}
                  </div>
                  <div style="font-size:.72rem;color:var(--text-muted);font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:.15rem;">
                    ${escHtml(rep.fileName)}
                  </div>
                  <div style="font-size:.7rem;color:var(--text-secondary);margin-top:.3rem;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;">
                    <span class="badge" style="background:var(--bg-raised);font-size:.68rem;">${rep.queryCount} sorgu</span>
                    <span class="badge" style="background:${rep.statusColor}18;color:${rep.statusColor};font-weight:700;border:1px solid ${rep.statusColor}40;">
                      ${rep.statusText}
                    </span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:${rep.statusColor};color:#fff;font-size:.95rem;box-shadow:0 3px 8px ${rep.statusColor}40;flex-shrink:0;">
                  ${rep.statusIcon}
                </div>
              `;
              masterListEl.appendChild(itemDiv);
            }
          });

          countTextEl.innerHTML = `Gösterilen: <strong>${visibleCount}</strong> rapor`;
          if (firstVisibleIdx !== -1 && (!reportAnalyses[activeReportIdx] || masterListEl.querySelector(`.master-item[data-idx="${activeReportIdx}"]`) === null)) {
            activeReportIdx = firstVisibleIdx;
            const newActiveEl = masterListEl.querySelector(`.master-item[data-idx="${firstVisibleIdx}"]`);
            if (newActiveEl) newActiveEl.classList.add('active');
          }
          renderReportDetail();

        } else {
          // TEKİL SORGU LİSTELEME
          queryAnalyses.forEach((qItem, idx) => {
            let gradeMatch = true;
            if (activeGradeFilter === 'critical') gradeMatch = qItem.isCritical;
            else if (activeGradeFilter === 'medium') gradeMatch = qItem.isMedium;
            else if (activeGradeFilter === 'simple') gradeMatch = qItem.isClean;

            let catMatch = true;
            if (activeCategoryFilter !== 'all') {
              catMatch = qItem.comp.warnings.some(w => w.category === activeCategoryFilter);
            }

            let textMatch = true;
            if (q) {
              textMatch = qItem.queryName.toLowerCase().includes(q) ||
                          qItem.reportName.toLowerCase().includes(q) ||
                          qItem.fileName.toLowerCase().includes(q) ||
                          qItem.sql.toLowerCase().includes(q) ||
                          qItem.comp.warnings.some(w => w.title.toLowerCase().includes(q) || w.text.toLowerCase().includes(q)) ||
                          qItem.comp.recommendations.some(r => (r.title || '').toLowerCase().includes(q));
            }

            const isVisible = gradeMatch && catMatch && textMatch;
            if (isVisible) {
              visibleCount++;
              if (firstVisibleIdx === -1) firstVisibleIdx = idx;

              const isSelected = idx === activeQueryIdx;
              const itemDiv = document.createElement('div');
              itemDiv.className = `master-item ${isSelected ? 'active' : ''}`;
              itemDiv.dataset.idx = idx;

              let qStatusColor = '#10b981';
              let qStatusText = '✅ Temiz';
              let qStatusIcon = '✅';
              if (qItem.isCritical) {
                qStatusColor = '#ef4444';
                qStatusText = `🚨 ${qItem.warningCount} Risk`;
                qStatusIcon = '🚨';
              } else if (qItem.isMedium) {
                qStatusColor = '#f59e0b';
                qStatusText = `⚠️ ${qItem.warningCount} İyileştirme`;
                qStatusIcon = '⚠️';
              }

              itemDiv.innerHTML = `
                <div style="min-width:0;flex:1;">
                  <div style="font-weight:700;font-size:.82rem;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    🗄️ ${escHtml(qItem.queryName)}
                  </div>
                  <div style="font-size:.73rem;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:.15rem;">
                    📋 ${escHtml(qItem.reportName)}
                  </div>
                  <div style="font-size:.7rem;color:var(--text-secondary);margin-top:.25rem;display:flex;align-items:center;gap:.35rem;">
                    <span class="badge" style="background:${qStatusColor}18;color:${qStatusColor};font-weight:700;border:1px solid ${qStatusColor}40;">
                      ${qStatusText}
                    </span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:${qStatusColor};color:#fff;font-size:.9rem;box-shadow:0 3px 8px ${qStatusColor}40;flex-shrink:0;">
                  ${qStatusIcon}
                </div>
              `;
              masterListEl.appendChild(itemDiv);
            }
          });

          countTextEl.innerHTML = `Gösterilen: <strong>${visibleCount}</strong> sorgu`;
          if (firstVisibleIdx !== -1 && (!queryAnalyses[activeQueryIdx] || masterListEl.querySelector(`.master-item[data-idx="${activeQueryIdx}"]`) === null)) {
            activeQueryIdx = firstVisibleIdx;
            const newActiveEl = masterListEl.querySelector(`.master-item[data-idx="${firstVisibleIdx}"]`);
            if (newActiveEl) newActiveEl.classList.add('active');
          }
          renderSingleQueryDetail();
        }

        if (visibleCount === 0) {
          masterListEl.innerHTML = '<div style="padding:2.5rem 1rem;text-align:center;color:var(--text-muted);font-size:.82rem;">Arama kriterlerine uygun kayıt bulunamadı.</div>';
          headerEl.innerHTML = '';
          bodyEl.innerHTML = '<div style="padding:3rem;text-align:center;color:var(--text-muted);">Eşleşen kayıt bulunamadı.</div>';
        }
      }

      let activeRepQueryIdx = 0;

      function renderReportDetail() {
        const rep = reportAnalyses[activeReportIdx];
        if (!rep) return;

        // Varsayılan olarak uyarısı olan ilk sorguyu veya 0. sorguyu seç
        if (activeRepQueryIdx >= rep.queries.length) activeRepQueryIdx = 0;

        const breakdownBadges = `
          ${rep.critQueriesCount > 0 ? `<span style="padding:.2rem .55rem;border-radius:15px;background:rgba(239,68,68,.15);color:#ef4444;font-size:.74rem;font-weight:700;">🚨 ${rep.critQueriesCount} Riskli Sorgu</span>` : ''}
          ${rep.medQueriesCount > 0 ? `<span style="padding:.2rem .55rem;border-radius:15px;background:rgba(245,158,11,.15);color:#f59e0b;font-size:.74rem;font-weight:700;">⚠️ ${rep.medQueriesCount} İyileştirilebilir</span>` : ''}
          ${rep.clnQueriesCount > 0 ? `<span style="padding:.2rem .55rem;border-radius:15px;background:rgba(16,185,129,.15);color:#10b981;font-size:.74rem;font-weight:700;">✅ ${rep.clnQueriesCount} Temiz Sorgu</span>` : ''}
        `;

        headerEl.innerHTML = `
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <div>
              <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                <span style="font-size:1.25rem;font-weight:800;color:var(--text-primary);">📋 ${escHtml(rep.reportName)}</span>
                <span style="font-size:.76rem;padding:.2rem .65rem;border-radius:20px;background:${rep.statusColor}20;color:${rep.statusColor};font-weight:700;border:1px solid ${rep.statusColor}40;">
                  ${rep.statusText}
                </span>
                <span class="badge badge-purple">${rep.queryCount} SQL Sorgusu</span>
                ${breakdownBadges}
              </div>
              <div style="font-size:.76rem;color:var(--text-muted);margin-top:.25rem;font-family:var(--mono);">
                Dosya: ${escHtml(rep.fileName)} · Toplam Tespit Edilen Risk: <strong>${rep.totalWarnings}</strong>
              </div>
            </div>
            <div>
              <button class="btn btn-sm btn-primary" id="btnOpenReportDetail" style="font-weight:700;padding:.35rem .9rem;">
                🔍 Raporu Detayda Aç & Düzenle ➔
              </button>
            </div>
          </div>
        `;

        const qi = rep.queries[activeRepQueryIdx] || rep.queries[0];
        const comp = qi.comp;
        const d = comp.details || {};

        // Sorgu Seçici Sekmeler (Eğer raporda birden fazla sorgu varsa)
        const queryTabsHtml = rep.queries.length > 1 ? `
          <div style="display:flex;gap:.6rem;overflow-x:auto;padding:.4rem .2rem .75rem;border-bottom:1px solid var(--border-light);margin-bottom:.85rem;min-height:50px;align-items:center;">
            ${rep.queries.map((q, qIndex) => {
              const isActive = qIndex === activeRepQueryIdx;
              const hasRisk = q.warningCount > 0;
              return `
                <button type="button" class="query-tab-pill ${isActive ? 'active' : ''}" data-qidx="${qIndex}">
                  <span>🗄️ ${escHtml(q.queryName)}</span>
                  ${hasRisk 
                    ? `<span style="background:rgba(239,68,68,.22);color:#ef4444;font-size:.72rem;padding:.12rem .45rem;border-radius:10px;font-weight:700;">⚠️ ${q.warningCount} Risk</span>` 
                    : `<span style="background:rgba(16,185,129,.22);color:#10b981;font-size:.72rem;padding:.12rem .45rem;border-radius:10px;font-weight:700;">✅ Temiz</span>`}
                </button>
              `;
            }).join('')}
          </div>
        ` : '';

        // Anti-Pattern Uyarı & Çözüm Kartları
        let issuesListHtml = '';
        if (comp.warnings && comp.warnings.length > 0) {
          issuesListHtml = comp.warnings.map((w, wIdx) => {
            const rec = comp.recommendations.find(r => r.category === w.category) || comp.recommendations[wIdx] || {};
            return `
              <div style="background:var(--bg-surface);border:1px solid ${w.type === 'danger' ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.3)'};border-radius:10px;padding:.85rem 1rem;display:flex;flex-direction:column;gap:.6rem;">
                
                <!-- Başlık ve Kategori -->
                <div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap;">
                  <div style="font-weight:800;font-size:.85rem;color:${w.type === 'danger' ? '#ef4444' : '#f59e0b'};display:flex;align-items:center;gap:.4rem;">
                    ${w.type === 'danger' ? '🚨' : '⚠️'} ${escHtml(w.title)}
                  </div>
                  ${w.categoryLabel ? `<span class="badge" style="font-size:.68rem;">${escHtml(w.categoryLabel)}</span>` : ''}
                </div>

                <!-- Problem ve Neden Kötü Açıklaması -->
                <div style="font-size:.78rem;color:var(--text-secondary);line-height:1.45;background:rgba(0,0,0,.08);padding:.5rem .75rem;border-radius:6px;">
                  <strong style="color:var(--text-primary);">❌ Neden Kötü?:</strong> ${escHtml(w.text)}
                </div>

                <!-- DBA Çözüm Önerisi -->
                ${rec.desc ? `
                  <div style="font-size:.78rem;color:var(--text-primary);line-height:1.45;">
                    <strong style="color:var(--green);">💡 Çözüm:</strong> ${escHtml(rec.desc)}
                  </div>
                ` : ''}

                <!-- Kod Karşılaştırması -->
                ${(rec.before || rec.after) ? `
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-top:.2rem;">
                    <div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:6px;padding:.5rem .65rem;">
                      <div style="font-size:.68rem;font-weight:700;color:var(--red);margin-bottom:.25rem;display:flex;align-items:center;justify-content:space-between;">
                        <span>❌ Mevcut / Riskli Kod:</span>
                        <button type="button" class="btn-copy-code" data-code="${encodeURIComponent(rec.before || '')}" style="background:none;border:none;cursor:pointer;font-size:.75rem;color:var(--text-muted);" title="Kodu Kopyala">📋</button>
                      </div>
                      <pre style="margin:0;font-size:.72rem;font-family:var(--mono);color:var(--text-primary);white-space:pre-wrap;word-break:break-all;"><code>${escHtml(rec.before || '')}</code></pre>
                    </div>
                    <div style="background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:6px;padding:.5rem .65rem;">
                      <div style="font-size:.68rem;font-weight:700;color:var(--green);margin-bottom:.25rem;display:flex;align-items:center;justify-content:space-between;">
                        <span>✅ Önerilen Optimize Kod:</span>
                        <button type="button" class="btn-copy-code" data-code="${encodeURIComponent(rec.after || '')}" style="background:none;border:none;cursor:pointer;font-size:.75rem;color:var(--text-muted);" title="Kodu Kopyala">📋</button>
                      </div>
                      <pre style="margin:0;font-size:.72rem;font-family:var(--mono);color:var(--text-primary);white-space:pre-wrap;word-break:break-all;"><code>${escHtml(rec.after || '')}</code></pre>
                    </div>
                  </div>
                ` : ''}

              </div>
            `;
          }).join('');
        } else {
          issuesListHtml = `
            <div style="background:rgba(16,185,129,.06);border:1.5px solid rgba(16,185,129,.35);border-radius:12px;padding:2.5rem 1.5rem;text-align:center;">
              <div style="font-size:2.8rem;margin-bottom:.5rem;">🎉</div>
              <div style="font-size:1.1rem;font-weight:800;color:#10b981;margin-bottom:.3rem;">Harika! Bu Sorguda Hiçbir Risk Tespit Edilmedi</div>
              <div style="font-size:.82rem;color:var(--text-secondary);max-width:560px;margin:0 auto;line-height:1.5;">
                Bu SQL sorgusunda indeks iptali, N+1 döngüsü, kukla JOIN veya gereksiz bellek tüketen anti-pattern bulunmamaktadır. Oracle veritabanında standartlara tam uygundur.
              </div>
            </div>
          `;
        }

        bodyEl.innerHTML = `
          ${queryTabsHtml}

          <!-- Seçili Sorgu Kartı -->
          <div style="display:flex;flex-direction:column;gap:.75rem;background:var(--bg-raised);border-radius:12px;padding:1rem 1.15rem;border:1px solid var(--border-light);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                <span style="font-size:1.05rem;font-weight:800;color:var(--accent);">🗄️ ${escHtml(qi.queryName)}</span>
                <span class="badge" style="background:${qi.isClean ? 'rgba(16,185,129,.15)' : (qi.isCritical ? 'rgba(239,68,68,.15)' : 'rgba(245,158,11,.15)')};color:${qi.isClean ? '#10b981' : (qi.isCritical ? '#ef4444' : '#f59e0b')};font-weight:700;">
                  ${qi.isClean ? '✅ Sorunsuz / Temiz' : (qi.isCritical ? `🚨 ${qi.warningCount} Risk Var` : `⚠️ ${qi.warningCount} İyileştirme`)}
                </span>
              </div>
              <div>
                <button type="button" class="btn btn-sm btn-ghost btn-copy-code" data-code="${encodeURIComponent(qi.sql)}" style="font-size:.76rem;padding:.25rem .65rem;">
                  📋 SQL Kopyala
                </button>
              </div>
            </div>

            <!-- Sayısal Özellikler -->
            <div style="display:flex;align-items:center;gap:.75rem;font-size:.74rem;color:var(--text-muted);flex-wrap:wrap;border-top:1px solid var(--border-light);padding-top:.5rem;">
              <span><strong>${d.totalJoins || 0}</strong> JOIN</span>
              <span><strong>${d.subqCount || 0}</strong> Subquery</span>
              <span><strong>${d.lines || 0}</strong> satır</span>
              <span><strong>${d.paramCount || 0}</strong> parametre</span>
              <span><strong>${d.caseCount || 0}</strong> CASE</span>
              <span><strong>${d.unionCount || 0}</strong> UNION</span>
            </div>
          </div>

          <!-- Sorunlar ve Çözümler -->
          <div style="display:flex;flex-direction:column;gap:.75rem;">
            <div style="font-size:.82rem;font-weight:700;color:var(--text-primary);display:flex;align-items:center;justify-content:space-between;">
              <span>🔍 Tespit Edilen Riskler & DBA Çözüm Önerileri</span>
              <span style="font-size:.72rem;color:var(--text-muted);font-weight:normal;">(${comp.warnings.length} tespit)</span>
            </div>
            ${issuesListHtml}
          </div>

          <!-- Katlanabilir Tam SQL Kodu (details) -->
          <details style="background:var(--bg-raised);border:1px solid var(--border-light);border-radius:10px;padding:.6rem .85rem;">
            <summary style="font-size:.78rem;font-weight:700;color:var(--accent);cursor:pointer;user-select:none;">
              👁️ Tam SQL Kodunu İncele (Genişlet / Daralt)
            </summary>
            <div style="margin-top:.6rem;">
              <pre style="margin:0;max-height:260px;overflow-y:auto;font-family:var(--mono);font-size:.72rem;background:var(--bg-surface);padding:.6rem;border-radius:6px;border:1px solid var(--border);color:var(--text-primary);line-height:1.4;"><code>${escHtml(qi.sql)}</code></pre>
            </div>
          </details>
        `;

        // Sekme Değiştirme Olayları
        bodyEl.querySelectorAll('.query-tab-pill').forEach(pill => {
          pill.addEventListener('click', () => {
            activeRepQueryIdx = parseInt(pill.dataset.qidx, 10);
            renderReportDetail();
          });
        });

        // Kod Kopyalama Olayları
        bodyEl.querySelectorAll('.btn-copy-code').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const code = decodeURIComponent(btn.dataset.code || '');
            if (code) {
              navigator.clipboard.writeText(code).then(() => toast('Kod kopyalandı!', 'success'));
            }
          });
        });

        // Detaya Git Butonu
        const btnOpenDetail = headerEl.querySelector('#btnOpenReportDetail');
        if (btnOpenDetail) {
          btnOpenDetail.addEventListener('click', () => {
            window.location.href = `detail.html?id=${encodeURIComponent(rep.fileId)}&query=${activeRepQueryIdx}`;
          });
        }
      }

      function renderSingleQueryDetail() {
        const qi = queryAnalyses[activeQueryIdx];
        if (!qi) return;

        const comp = qi.comp;
        const d = comp.details || {};

        let qStatusColor = '#10b981';
        let qStatusText = '✅ Sorunsuz / Temiz';
        if (qi.isCritical) {
          qStatusColor = '#ef4444';
          qStatusText = `🚨 ${qi.warningCount} Risk Tespit Edildi`;
        } else if (qi.isMedium) {
          qStatusColor = '#f59e0b';
          qStatusText = `⚠️ ${qi.warningCount} İyileştirme Tavsiyesi`;
        }

        headerEl.innerHTML = `
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <div>
              <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                <span style="font-size:1.25rem;font-weight:800;color:var(--accent);">🗄️ ${escHtml(qi.queryName)}</span>
                <span style="font-size:.76rem;padding:.2rem .65rem;border-radius:20px;background:${qStatusColor}20;color:${qStatusColor};font-weight:700;border:1px solid ${qStatusColor}40;">
                  ${qStatusText}
                </span>
              </div>
              <div style="font-size:.76rem;color:var(--text-muted);margin-top:.25rem;font-family:var(--mono);">
                Rapor: <strong>${escHtml(qi.reportName)}</strong> (${escHtml(qi.fileName)})
              </div>
            </div>
            <div>
              <button class="btn btn-sm btn-primary" id="btnOpenQueryDetail" style="font-weight:700;padding:.35rem .9rem;">
                🔍 Raporu Aç & Düzenle ➔
              </button>
            </div>
          </div>
        `;

        let issuesListHtml = '';
        if (comp.warnings && comp.warnings.length > 0) {
          issuesListHtml = comp.warnings.map((w, wIdx) => {
            const rec = comp.recommendations.find(r => r.category === w.category) || comp.recommendations[wIdx] || {};
            return `
              <div style="background:var(--bg-surface);border:1px solid ${w.type === 'danger' ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.3)'};border-radius:10px;padding:.85rem 1rem;display:flex;flex-direction:column;gap:.6rem;">
                
                <div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap;">
                  <div style="font-weight:800;font-size:.85rem;color:${w.type === 'danger' ? '#ef4444' : '#f59e0b'};display:flex;align-items:center;gap:.4rem;">
                    ${w.type === 'danger' ? '🚨' : '⚠️'} ${escHtml(w.title)}
                  </div>
                  ${w.categoryLabel ? `<span class="badge" style="font-size:.68rem;">${escHtml(w.categoryLabel)}</span>` : ''}
                </div>

                <div style="font-size:.78rem;color:var(--text-secondary);line-height:1.45;background:rgba(0,0,0,.08);padding:.5rem .75rem;border-radius:6px;">
                  <strong style="color:var(--text-primary);">❌ Neden Kötü?:</strong> ${escHtml(w.text)}
                </div>

                ${rec.desc ? `
                  <div style="font-size:.78rem;color:var(--text-primary);line-height:1.45;">
                    <strong style="color:var(--green);">💡 Çözüm:</strong> ${escHtml(rec.desc)}
                  </div>
                ` : ''}

                ${(rec.before || rec.after) ? `
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-top:.2rem;">
                    <div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:6px;padding:.5rem .65rem;">
                      <div style="font-size:.68rem;font-weight:700;color:var(--red);margin-bottom:.25rem;display:flex;align-items:center;justify-content:space-between;">
                        <span>❌ Mevcut / Riskli Kod:</span>
                        <button type="button" class="btn-copy-code" data-code="${encodeURIComponent(rec.before || '')}" style="background:none;border:none;cursor:pointer;font-size:.75rem;color:var(--text-muted);" title="Kodu Kopyala">📋</button>
                      </div>
                      <pre style="margin:0;font-size:.72rem;font-family:var(--mono);color:var(--text-primary);white-space:pre-wrap;word-break:break-all;"><code>${escHtml(rec.before || '')}</code></pre>
                    </div>
                    <div style="background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:6px;padding:.5rem .65rem;">
                      <div style="font-size:.68rem;font-weight:700;color:var(--green);margin-bottom:.25rem;display:flex;align-items:center;justify-content:space-between;">
                        <span>✅ Önerilen Optimize Kod:</span>
                        <button type="button" class="btn-copy-code" data-code="${encodeURIComponent(rec.after || '')}" style="background:none;border:none;cursor:pointer;font-size:.75rem;color:var(--text-muted);" title="Kodu Kopyala">📋</button>
                      </div>
                      <pre style="margin:0;font-size:.72rem;font-family:var(--mono);color:var(--text-primary);white-space:pre-wrap;word-break:break-all;"><code>${escHtml(rec.after || '')}</code></pre>
                    </div>
                  </div>
                ` : ''}

              </div>
            `;
          }).join('');
        } else {
          issuesListHtml = `
            <div style="background:rgba(16,185,129,.06);border:1.5px solid rgba(16,185,129,.35);border-radius:12px;padding:2.5rem 1.5rem;text-align:center;">
              <div style="font-size:2.8rem;margin-bottom:.5rem;">🎉</div>
              <div style="font-size:1.1rem;font-weight:800;color:#10b981;margin-bottom:.3rem;">Harika! Bu Sorguda Hiçbir Risk Tespit Edilmedi</div>
              <div style="font-size:.82rem;color:var(--text-secondary);max-width:560px;margin:0 auto;line-height:1.5;">
                Bu SQL sorgusunda indeks iptali, N+1 döngüsü, kukla JOIN veya gereksiz bellek tüketen anti-pattern bulunmamaktadır. Oracle veritabanında standartlara tam uygundur.
              </div>
            </div>
          `;
        }

        bodyEl.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:.75rem;background:var(--bg-raised);border-radius:12px;padding:1rem 1.15rem;border:1px solid var(--border-light);">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                <span style="font-size:1.05rem;font-weight:800;color:var(--accent);">🗄️ ${escHtml(qi.queryName)}</span>
                <span class="badge" style="background:${qi.isClean ? 'rgba(16,185,129,.15)' : (qi.isCritical ? 'rgba(239,68,68,.15)' : 'rgba(245,158,11,.15)')};color:${qi.isClean ? '#10b981' : (qi.isCritical ? '#ef4444' : '#f59e0b')};font-weight:700;">
                  ${qi.isClean ? '✅ Sorunsuz / Temiz' : (qi.isCritical ? `🚨 ${qi.warningCount} Risk Var` : `⚠️ ${qi.warningCount} İyileştirme`)}
                </span>
              </div>
              <div>
                <button type="button" class="btn btn-sm btn-ghost btn-copy-code" data-code="${encodeURIComponent(qi.sql)}" style="font-size:.76rem;padding:.25rem .65rem;">
                  📋 SQL Kopyala
                </button>
              </div>
            </div>

            <div style="display:flex;align-items:center;gap:.75rem;font-size:.74rem;color:var(--text-muted);flex-wrap:wrap;border-top:1px solid var(--border-light);padding-top:.5rem;">
              <span><strong>${d.totalJoins || 0}</strong> JOIN</span>
              <span><strong>${d.subqCount || 0}</strong> Subquery</span>
              <span><strong>${d.lines || 0}</strong> satır</span>
              <span><strong>${d.paramCount || 0}</strong> parametre</span>
              <span><strong>${d.caseCount || 0}</strong> CASE</span>
              <span><strong>${d.unionCount || 0}</strong> UNION</span>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:.75rem;">
            <div style="font-size:.82rem;font-weight:700;color:var(--text-primary);display:flex;align-items:center;justify-content:space-between;">
              <span>🔍 Tespit Edilen Riskler & DBA Çözüm Önerileri</span>
              <span style="font-size:.72rem;color:var(--text-muted);font-weight:normal;">(${comp.warnings.length} tespit)</span>
            </div>
            ${issuesListHtml}
          </div>

          <details style="background:var(--bg-raised);border:1px solid var(--border-light);border-radius:10px;padding:.6rem .85rem;">
            <summary style="font-size:.78rem;font-weight:700;color:var(--accent);cursor:pointer;user-select:none;">
              👁️ Tam SQL Kodunu İncele (Genişlet / Daralt)
            </summary>
            <div style="margin-top:.6rem;">
              <pre style="margin:0;max-height:260px;overflow-y:auto;font-family:var(--mono);font-size:.72rem;background:var(--bg-surface);padding:.6rem;border-radius:6px;border:1px solid var(--border);color:var(--text-primary);line-height:1.4;"><code>${escHtml(qi.sql)}</code></pre>
            </div>
          </details>
        `;

        bodyEl.querySelectorAll('.btn-copy-code').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const code = decodeURIComponent(btn.dataset.code || '');
            if (code) {
              navigator.clipboard.writeText(code).then(() => toast('Kod kopyalandı!', 'success'));
            }
          });
        });

        const btnOpenDetail = headerEl.querySelector('#btnOpenQueryDetail');
        if (btnOpenDetail) {
          btnOpenDetail.addEventListener('click', () => {
            window.location.href = `detail.html?id=${encodeURIComponent(qi.fileId)}&query=${qi.queryIndex}`;
          });
        }
      }

      // Event Dinleyicileri
      masterListEl.addEventListener('click', e => {
        const itemEl = e.target.closest('.master-item');
        if (!itemEl) return;
        masterListEl.querySelectorAll('.master-item').forEach(el => el.classList.remove('active'));
        itemEl.classList.add('active');
        const idx = parseInt(itemEl.dataset.idx, 10);
        if (currentViewMode === 'report') {
          activeReportIdx = idx;
          renderReportDetail();
        } else {
          activeQueryIdx = idx;
          renderSingleQueryDetail();
        }
      });

      masterSearchEl.addEventListener('input', () => {
        activeSearchText = masterSearchEl.value;
        updateMasterList();
      });

      if (sortSelectEl) {
        sortSelectEl.addEventListener('change', () => {
          activeSortMode = sortSelectEl.value;
          sortData();
          updateMasterList();
        });
      }

      btnToggleReport.addEventListener('click', () => {
        currentViewMode = 'report';
        btnToggleReport.className = 'btn btn-sm btn-primary';
        btnToggleQuery.className = 'btn btn-sm btn-ghost';
        updateMasterList();
      });

      btnToggleQuery.addEventListener('click', () => {
        currentViewMode = 'query';
        btnToggleQuery.className = 'btn btn-sm btn-primary';
        btnToggleReport.className = 'btn btn-sm btn-ghost';
        updateMasterList();
      });

      filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
          filterPills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          activeGradeFilter = pill.dataset.filter;
          updateMasterList();
        });
      });

      categoryChips.forEach(chip => {
        chip.addEventListener('click', () => {
          categoryChips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          activeCategoryFilter = chip.dataset.cat;
          updateMasterList();
        });
      });

      // İlk Başlatma
      updateMasterList();
    }
  });
});

// ── KLAVYE KISAYOLLARI MODALI (`?` tuşu) ───────────────────
document.addEventListener('keydown', e => {
  // Inputlarda yazarken tetiklenmesin
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (e.key === '?') {
    e.preventDefault();
    showShortcutsModal();
  }
});

async function showShortcutsModal() {
  await showModal({
    title: '⌨️ Klavye Kısayolları Rehberi',
    body: `
      <table class="dash-tbl" style="font-size:.82rem;">
        <tbody>
          <tr><td><kbd class="badge">Ctrl + F</kbd></td><td>Arama kutusuna odaklan</td></tr>
          <tr><td><kbd class="badge">Ctrl + K</kbd></td><td>Komut paletini aç</td></tr>
          <tr><td><kbd class="badge">?</kbd></td><td>Bu kısayol menüsünü aç</td></tr>
          <tr><td><kbd class="badge">Double Click</kbd></td><td>Rapor adına çift tık: inline ad düzenleme</td></tr>
          <tr><td><kbd class="badge">Esc</kbd></td><td>Açık modalları kapat</td></tr>
          <tr><td><kbd class="badge">Enter</kbd></td><td>Inline düzenlemeyi kaydet</td></tr>
        </tbody>
      </table>
    `,
    confirmText: 'Anladım',
    cancelText: ''
  });
}

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    const targetTag = e.target && e.target.tagName ? e.target.tagName : '';
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag)) {
      e.preventDefault();
      searchInput?.focus();
      searchInput?.select();
    }
  }
});

// ── GÖRÜNÜM MODU BUTONLARI BIND ───────────────────────────
function setViewMode(mode) {
  currentViewMode = mode;
  document.querySelectorAll('#viewModeToggle .view-btn, .view-switch .btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === mode || (b.id === 'btnViewTable' && mode === 'table') || (b.id === 'btnViewCards' && mode === 'cards') || (b.id === 'btnViewTimeline' && mode === 'timeline'));
  });
  renderCurrentView();
}

document.querySelectorAll('#viewModeToggle .view-btn').forEach(btn => {
  btn.addEventListener('click', () => setViewMode(btn.dataset.view));
});

const btnVTable = document.getElementById('btnViewTable');
const btnVCards = document.getElementById('btnViewCards');
const btnVTime  = document.getElementById('btnViewTimeline');
if (btnVTable) btnVTable.addEventListener('click', () => setViewMode('table'));
if (btnVCards) btnVCards.addEventListener('click', () => setViewMode('cards'));
if (btnVTime)  btnVTime.addEventListener('click', () => setViewMode('timeline'));

const btnPinnedOnly = document.getElementById('btnPinnedOnly');
if (btnPinnedOnly) {
  btnPinnedOnly.addEventListener('click', () => {
    onlyPinned = !onlyPinned;
    btnPinnedOnly.classList.toggle('active', onlyPinned);
    btnPinnedOnly.style.background = onlyPinned ? 'var(--accent-light)' : '';
    btnPinnedOnly.style.borderColor = onlyPinned ? 'var(--accent)' : '';
    applySearch();
  });
}

const catSelect = document.getElementById('catSelect');
if (catSelect) {
  catSelect.addEventListener('change', () => {
    selectedCategory = catSelect.value;
    applySearch();
  });
}

function updateStats() {
  const s = FrpStore.getStats();
  if (statTotal)     statTotal.textContent     = s.total;
  if (statFavorites) statFavorites.textContent = s.favorites;
  if (statQueries)   statQueries.textContent   = s.queries;
  if (statPascal)    statPascal.textContent    = s.pascal;
  if (statStorage)   statStorage.textContent   = s.storageFormatted;

  const myReports = FrpStore.getMyReports ? FrpStore.getMyReports() : [];
  const poolReports = FrpStore.getPoolReports ? FrpStore.getPoolReports() : [];
  const badgeMy = document.getElementById('badgeMyCount');
  const badgePool = document.getElementById('badgePoolCount');
  if (badgeMy) badgeMy.textContent = myReports.length;
  if (badgePool) badgePool.textContent = poolReports.length;

  if (storageWarn) {
    storageWarn.classList.toggle('show', FrpStore.isStorageNearFull());
  }
}

// ── TOPLU İŞLEM ÇUBUĞU (BULK BAR) GÜNCELLEMESİ ──────────────
function updateBulkBar() {
  const count = selectedIds.size;
  if (!bulkBar) return;
  if (count > 0) {
    bulkBar.classList.add('show');
    if (bulkInfo) bulkInfo.textContent = `${count} rapor seçildi`;
  } else {
    bulkBar.classList.remove('show');
  }

  const curWs = FrpStore.getActiveWorkspace ? FrpStore.getActiveWorkspace() : 'personal';
  const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
  const isAdmin = curUser && curUser.role === 'admin';

  const btnBulkShare = document.getElementById('btnBulkSharePool');
  const btnBulkRemove = document.getElementById('btnBulkRemovePool');
  const btnDeleteBulk = document.getElementById('btnDeleteBulk');
  const btnCompare = document.getElementById('btnCompareSelected') || document.getElementById('btnBulkCompare');

  if (btnBulkShare) btnBulkShare.style.display = curWs === 'personal' ? 'inline-flex' : 'none';
  if (btnBulkRemove) btnBulkRemove.style.display = (curWs === 'pool' && (isAdmin || true)) ? 'inline-flex' : 'none';
  if (btnDeleteBulk) btnDeleteBulk.style.display = (curWs === 'personal' || isAdmin) ? 'inline-flex' : 'none';

  // 🔀 Karşılaştırma Butonu (2 veya 3 rapor seçildiğinde aktifleşir)
  if (btnCompare) {
    btnCompare.style.display = (count >= 2 && count <= 3) ? 'inline-flex' : 'none';
    btnCompare.textContent = count === 3 ? '🔀 3 Raporu Karşılaştır' : '🔀 Karşılaştır (2 Rapor)';
  }
}
window.updateBulkBar = updateBulkBar;

// ── ÇALIŞMA ALANI / HAVUZ GEÇİŞİ BIND ───────────────────────
function setupWorkspaceSwitcher() {
  const tabWsPersonal = document.getElementById('tabWsPersonal');
  const tabWsPool = document.getElementById('tabWsPool');
  const poolNotice = document.getElementById('poolNotice');

  if (tabWsPersonal && tabWsPool) {
    const curWs = FrpStore.getActiveWorkspace ? FrpStore.getActiveWorkspace() : 'personal';
    tabWsPersonal.classList.toggle('active', curWs === 'personal');
    tabWsPool.classList.toggle('active', curWs === 'pool');
    tabWsPool.classList.toggle('pool-active', curWs === 'pool');
    if (poolNotice) poolNotice.style.display = curWs === 'pool' ? 'block' : 'none';

    tabWsPersonal.onclick = () => {
      FrpStore.setActiveWorkspace('personal');
      tabWsPersonal.classList.add('active');
      tabWsPool.classList.remove('active', 'pool-active');
      if (poolNotice) poolNotice.style.display = 'none';
      selectedIds.clear();
      refreshAll();
    };

    tabWsPool.onclick = () => {
      FrpStore.setActiveWorkspace('pool');
      tabWsPool.classList.add('active', 'pool-active');
      tabWsPersonal.classList.remove('active');
      if (poolNotice) poolNotice.style.display = 'block';
      selectedIds.clear();
      refreshAll();
    };
  }

  // Toplu havuz butonları
  document.getElementById('btnBulkSharePool')?.addEventListener('click', () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const count = FrpStore.bulkToggleReportPool(ids, true);
    toast(`${count} adet rapor Ortak Havuzda Paylaşıldı! 🌐`, 'success');
    selectedIds.clear();
    refreshAll();
  });

  document.getElementById('btnBulkRemovePool')?.addEventListener('click', () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const count = FrpStore.bulkToggleReportPool(ids, false);
    toast(`${count} adet rapor havuzdan kaldırıldı 🔒`, 'info');
    selectedIds.clear();
    refreshAll();
  });
}
setupWorkspaceSwitcher();

function updateCategorySelect() {
  if (!catSelect) return;
  const cats = FrpStore.getCategories();
  const cur  = catSelect.value;
  catSelect.innerHTML = '<option value="">Tüm Kategoriler</option>' +
    cats.map(c => `<option value="${escHtml(c)}" ${c === cur ? 'selected' : ''}>📁 ${escHtml(c)}</option>`).join('');
}
window.updateCategorySelect = updateCategorySelect;
window.updateCategoryDropdowns = updateCategorySelect;

function updateTagSelect() {
  if (tagSelect) {
    const tags = FrpStore.getAllTags();
    const cur  = tagSelect.value;
    tagSelect.innerHTML = '<option value="">Tüm Etiketler</option>' +
      tags.map(t => `<option value="${escHtml(t)}" ${t === cur ? 'selected' : ''}>🏷️ ${escHtml(t)}</option>`).join('');
  }
}

// ── Ctrl + E ile Tüm Rapor Listesini Excel (CSV) Formatında İndir ──
function exportReportListExcel() {
  const files = FrpStore.getAll();
  if (files.length === 0) {
    toast('Dışa aktarılacak rapor bulunmuyor.', 'warning');
    return;
  }

  const csvEsc = s => '"' + String(s ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';

  const headers = [
    'Rapor Adı',
    'Dosya Adı',
    'GUID',
    'Kategori',
    'Boyut (KB)',
    'SQL Sorgu Sayısı',
    'PascalScript Satır Sayısı',
    'Etiketler',
    'Kullanıcı Notu',
    'Yüklenme Tarihi'
  ];

  const rows = [headers];

  files.forEach(f => {
    const sizeKb = f.sizeBytes ? (f.sizeBytes / 1024).toFixed(1) : '0';
    const qCount = Array.isArray(f.queries) ? f.queries.length : 0;
    const psLines = f.pascalScript ? f.pascalScript.split('\n').length : 0;
    const tags = Array.isArray(f.tags) ? f.tags.join(', ') : '';
    const dateStr = f.loadedAt ? new Date(f.loadedAt).toLocaleString('tr-TR') : '';

    rows.push([
      f.meta?.reportName || f.name,
      f.name,
      f.meta?.guid || '',
      f.category || '',
      sizeKb,
      qCount,
      psLines,
      tags,
      f.userNote || '',
      dateStr
    ]);
  });

  const csvContent = '\uFEFF' + rows.map(r => r.map(csvEsc).join(';')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateTag = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `FrpOku_Rapor_Listesi_${dateTag}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast(`📊 ${files.length} rapor Excel (CSV) dosyası olarak indirildi! (Ctrl+E)`, 'success');
}
window.exportReportListExcel = exportReportListExcel;

function bindSearchControls() {
  if (searchInput) {
    let searchDebounceTimer = null;
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        applySearch();
      }, 100);
    });
  }

  if (fieldSelect) {
    fieldSelect.addEventListener('change', () => {
      searchField = fieldSelect.value;
      applySearch();
    });
  }

  if (tagSelect) {
    tagSelect.addEventListener('change', () => {
      selectedTag = tagSelect.value;
      applySearch();
      updateTagSelect();
    });
  }

  if (regexBtn) {
    regexBtn.addEventListener('click', () => {
      isRegexMode = !isRegexMode;
      regexBtn.classList.toggle('active', isRegexMode);
      regexBtn.textContent = isRegexMode ? '.* Regex (AÇIK)' : '.* Regex';
      if (isRegexMode) {
        toast('🔍 Regex Modu AÇIK! Joker karakterler: .* (herhangi karakter), ^ (başlangıç), $ (bitiş), | (veya)', 'info', 5000);
      } else {
        toast('Normal arama moduna dönüldü.', 'info', 2000);
      }
      applySearch();
    });
  }

  if (btnFavOnly) {
    btnFavOnly.addEventListener('click', () => {
      onlyFavorites = !onlyFavorites;
      btnFavOnly.classList.toggle('active', onlyFavorites);
      applySearch();
    });
  }

  const btnNotesOnly = document.getElementById('btnNotesOnly');
  if (btnNotesOnly) {
    btnNotesOnly.addEventListener('click', () => {
      onlyNotes = !onlyNotes;
      btnNotesOnly.classList.toggle('active', onlyNotes);
      applySearch();
    });
  }

  const btnResetFilters = document.getElementById('btnResetFilters');
  if (btnResetFilters) {
    btnResetFilters.addEventListener('click', () => {
      const searchInput = document.getElementById('searchInput');
      const tagSelect = document.getElementById('tagSelect');
      const catSelect = document.getElementById('catSelect');
      if (searchInput) searchInput.value = '';
      if (tagSelect) tagSelect.value = '';
      if (catSelect) catSelect.value = '';
      searchQuery = '';
      selectedTag = '';
      selectedCategory = '';
      onlyFavorites = false;
      onlyPinned = false;
      onlyNotes = false;
      isRegexMode = false;
      if (btnFavOnly) btnFavOnly.classList.remove('active');
      if (btnPinnedOnly) btnPinnedOnly.classList.remove('active');
      if (btnNotesOnly) btnNotesOnly.classList.remove('active');
      if (regexBtn) {
        regexBtn.classList.remove('active');
        regexBtn.textContent = '.* Regex';
      }
      applySearch();
      updateTagSelect();
      toast('Filtreler temizlendi. 🧹', 'info');
    });
  }
}

// ── STATS & REFRESH GÜNCELLEMESİ ──────────────────────────
function refreshAll() {
  const validIds = new Set(FrpStore.getAll().map(f => f.id));
  for (const id of selectedIds) {
    if (!validIds.has(id)) selectedIds.delete(id);
  }
  if (typeof updateBulkBar === 'function') updateBulkBar();

  bindTableSortHeaders();
  updateStats();
  updateTagSelect();
  updateCategorySelect();
  applySearch();
  toggleUploadMini(FrpStore.getAll().length === 0 && !searchQuery);
}

window.togglePin      = togglePin;
window.setViewMode    = setViewMode;
window.refreshAll     = refreshAll;
window.showShortcutsModal = showShortcutsModal;

bindSearchControls();
refreshAll();

if (window.FrpStoreReady) {
  window.FrpStoreReady.then(() => {
    isStoreLoaded = true;
    refreshAll();
  });
} else {
  isStoreLoaded = true;
}

// ── URL Parametresi Destekli Başlangıç Filtresi (dashboard'dan geliş) ────────
(function checkUrlFilter() {
  const params = new URLSearchParams(window.location.search);
  const filterSql = params.get('filter_sql');
  if (filterSql && searchInput) {
    searchInput.value = filterSql;
    searchQuery = filterSql;
    searchField = 'sql';
    if (fieldSelect) fieldSelect.value = 'sql';
    applySearch();
    // URL'yi temizle (history.replaceState ile)
    try { history.replaceState(null, '', window.location.pathname); } catch(e) {}
    // Kullanıcıya bildir
    toast(`“${filterSql}” tablosu için SQL filtresi uygulandı 🔍`, 'info');
  }
})();



// ── Drag & Drop Tam Sayfa Overlay ──────────────────────────────────
(function setupDragOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'dragOverlay';
  overlay.style.cssText = [
    'display:none;position:fixed;inset:0;z-index:9998;',
    'background:rgba(37,99,235,.12);backdrop-filter:blur(2px);',
    'border:3px dashed var(--accent-bright);border-radius:16px;',
    'display:none;align-items:center;justify-content:center;',
    'flex-direction:column;gap:1rem;pointer-events:none;'
  ].join('');
  overlay.innerHTML = '<div style="font-size:4rem">⎬</div><div style="font-size:1.2rem;font-weight:700;color:var(--accent-bright);">Dosyaları Bırakın</div><div style="font-size:.85rem;color:var(--text-secondary);">.frp uzantılı dosyalar yüklenecek</div>';
  document.body.appendChild(overlay);

  let dragCounter = 0;
  document.addEventListener('dragenter', e => {
    if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
      dragCounter++;
      overlay.style.display = 'flex';
    }
  });
  document.addEventListener('dragleave', () => {
    dragCounter--;
    if (dragCounter <= 0) { dragCounter = 0; overlay.style.display = 'none'; }
  });
  document.addEventListener('drop', () => { dragCounter = 0; overlay.style.display = 'none'; });
})();

// ── Son Açılan Raporlar Menüsü (Genişletilmiş & Aranabilir) ─────────────────────────────────────
(function setupRecentReportsDropdown() {
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight) return;

  function formatRecentTime(ts) {
    if (!ts) return { relStr: '—', fullDateStr: '—' };
    const now = Date.now();
    const diff = Math.max(0, now - ts);
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(sec / 60);
    const hour = Math.floor(min / 60);
    const day = Math.floor(hour / 24);

    const fullDateStr = new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    let relStr = '';
    if (sec < 60) relStr = 'Az önce';
    else if (min < 60) relStr = `${min} dakika önce`;
    else if (hour < 24) relStr = `${hour} saat önce`;
    else if (day === 1) relStr = `Dün ${new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    else relStr = fullDateStr;

    return { relStr, fullDateStr };
  }

  async function openRecentModal() {
    let recents = FrpStore.getRecent();
    if (recents.length === 0) {
      toast('Henüz görüntülenmiş rapor geçmişi yok.', 'info');
      return;
    }

    const bodyHtml = `
      <div style="display:flex;flex-direction:column;gap:.85rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap;">
          <input type="text" id="recentSearchInput" class="master-search-input" style="flex:1;min-width:240px;" placeholder="🔍 Son açılanlarda ara... (Rapor, dosya adı veya GUID)" autocomplete="off" />
          <button class="btn btn-sm btn-danger" id="btnClearRecentHistory">🗑️ Geçmişi Temizle</button>
        </div>
        <div id="recentListContainer" style="max-height:520px;overflow-y:auto;padding-right:.3rem;display:flex;flex-direction:column;gap:.5rem;"></div>
      </div>
    `;

    await showModal({
      title: `🕒 Son Açılan Raporlar (${recents.length})`,
      body: bodyHtml,
      confirmText: 'Kapat',
      cancelText: '',
      maxWidth: '980px',
      onOpen: (overlay) => {
        const listContainer = overlay.querySelector('#recentListContainer');
        const searchInput = overlay.querySelector('#recentSearchInput');
        const clearBtn = overlay.querySelector('#btnClearRecentHistory');

        function renderRecentList() {
          const q = (searchInput?.value || '').toLowerCase().trim();
          const filtered = recents.filter(r => {
            if (!q) return true;
            const rName = (r.meta?.reportName || r.name || '').toLowerCase();
            const fName = (r.name || '').toLowerCase();
            const cat = (r.category || '').toLowerCase();
            const guid = (r.meta?.guid || '').toLowerCase();
            return rName.includes(q) || fName.includes(q) || cat.includes(q) || guid.includes(q);
          });

          if (filtered.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);font-size:.85rem;">Eşleşen rapor bulunamadı.</div>`;
            return;
          }

          listContainer.innerHTML = filtered.map(r => {
            const timeInfo = formatRecentTime(r.recentTs);
            const queryCount = (r.queries || []).length;
            const guidVal = (r.meta && r.meta.guid) ? r.meta.guid : '';
            return `
              <div class="recent-modal-card" style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.85rem 1.1rem;border:1px solid var(--border-light);background:var(--bg-surface);border-radius:12px;transition:all .18s ease;box-shadow:0 2px 8px rgba(0,0,0,.03);">
                <div style="min-width:0;flex:1;cursor:pointer;" onclick="window.openDetail('${r.id}')">
                  <div style="font-weight:800;font-size:.92rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    📋 ${escHtml(r.meta?.reportName || r.name)}
                  </div>
                  <div style="font-size:.74rem;color:var(--text-muted);margin-top:.3rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;">
                    <span style="font-family:var(--mono);">${escHtml(r.name)}</span>
                    ${guidVal ? `<span class="badge badge-gray" style="font-family:var(--mono);font-size:.68rem;">🔑 ${escHtml(guidVal)}</span>` : ''}
                    ${r.category ? `<span class="badge badge-blue" style="font-size:.68rem;">📁 ${escHtml(r.category)}</span>` : ''}
                    <span class="badge badge-purple" style="font-size:.68rem;">${queryCount} SQL</span>
                    <span style="color:var(--border);">•</span>
                    <span title="${escHtml(timeInfo.fullDateStr)}" style="color:var(--accent-bright);font-weight:600;display:inline-flex;align-items:center;gap:.25rem;">
                      🕒 ${escHtml(timeInfo.relStr)}
                    </span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:.4rem;">
                  <button type="button" class="btn btn-sm btn-primary" style="padding:.35rem .85rem;font-size:.78rem;font-weight:700;white-space:nowrap;" onclick="window.openDetail('${r.id}')">Aç →</button>
                  <button type="button" class="btn btn-sm" title="Bu kaydı geçmişten kaldır" style="padding:.35rem .55rem;font-size:.76rem;color:var(--red);" data-remove-id="${r.id}">✕</button>
                </div>
              </div>
            `;
          }).join('');

          listContainer.querySelectorAll('[data-remove-id]').forEach(rmBtn => {
            rmBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const rmId = rmBtn.getAttribute('data-remove-id');
              FrpStore.removeRecent(rmId);
              recents = FrpStore.getRecent();
              renderRecentList();
              toast('Kayıt geçmişten silindi.', 'info');
            });
          });
        }

        searchInput?.addEventListener('input', renderRecentList);

        clearBtn?.addEventListener('click', () => {
          FrpStore.clearRecent();
          recents = [];
          renderRecentList();
          toast('Son açılanlar geçmişi tamamen temizlendi. 🧹', 'info');
        });

        renderRecentList();
      }
    });
  }

  const topRecentBtn = document.getElementById('btnOpenRecentModal');
  if (topRecentBtn) {
    topRecentBtn.addEventListener('click', openRecentModal);
  }
  window.openRecentReportsModal = openRecentModal;
})();

// ── Kullanıcı Rozeti & Sync Durumu (Topbar) ────────────────────────
(function setupUserTopbarBadge() {
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight) return;

  // (Kullanıcı rozeti FrpAuth modülü tarafından dinamik ve tekil olarak yönetilmektedir)
  window._frpSyncCallback = function(status) {
    if (window.FrpAuth && typeof window.FrpAuth.updateNavbarUserBadge === 'function') {
      window.FrpAuth.updateNavbarUserBadge();
    }
  };

  window._refreshUserTopbarBadge = function() {
    renderBadgeText(true);
  };
})();

// ── SÜRÜKLE-BIRAK DOSYA YÜKLEME ENTEGRASYONU ───────────────────────
(function setupDragAndDrop() {
  const overlay = document.getElementById('dragOverlay');
  if (!overlay) return;

  let dragCounter = 0;

  function isFileDrag(e) {
    if (window._isDraggingColumn) return false;
    if (!e.dataTransfer) return false;
    const types = e.dataTransfer.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  }

  window.addEventListener('dragenter', e => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      overlay.classList.add('active');
    }
  });

  window.addEventListener('dragover', e => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
  });

  window.addEventListener('dragleave', e => {
    if (window._isDraggingColumn) return;
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      overlay.classList.remove('active');
    }
  });

  window.addEventListener('drop', e => {
    if (window._isDraggingColumn) return;
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.remove('active');

    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });
})();

// ── AYARLAR MODALI TETİKLEYİCİSİ & KISAYOL (Ctrl+,) ────────
document.getElementById('btnOpenSettingsModal')?.addEventListener('click', () => {
  if (typeof window.openSettingsModal === 'function') {
    window.openSettingsModal('appearance');
  }
});

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault();
    if (typeof window.openSettingsModal === 'function') {
      window.openSettingsModal('appearance');
    }
  }
});

