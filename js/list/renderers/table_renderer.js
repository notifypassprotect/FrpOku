// ============================================================
//  table_renderer.js — Rapor Listesi Tablo Görünümü & Sütun Motoru
// ============================================================

window.FrpListRenderers = window.FrpListRenderers || {};

(function () {
  'use strict';

  const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const DEFAULT_COLUMN_ORDER = [
    'reportName',
    'fileName',
    'fileSize',
    'category',
    'guid',
    'tags',
    'queries',
    'date',
    'lastModified'
  ];

  const COLUMN_DEFS = {
    reportName: {
      key: 'reportName',
      title: 'Rapor Başlığı',
      sortField: 'name',
      renderTd: (file, { reportName, hasNote }) => {
        const isPublic = !!(file.isPublic || file.is_public);
        const poolBadge = isPublic ? `<span class="badge badge-pool" style="font-size:.68rem;padding:1px 5px;" title="Ortak Havuzda Paylaşıldı">🌐 Havuzda</span>` : '';
        const oName = file.ownerName || file.owner_name || (file.userId === 'usr_admin_root' ? 'Admin' : 'Sistem');
        const oDept = file.ownerDepartment || file.owner_department || '';
        const ownerChip = `<span class="owner-chip" style="font-size:.7rem;padding:.1rem .45rem;" title="Yükleyen: ${escHtml(oName)}${oDept ? ' · ' + escHtml(oDept) : ''}">👤 ${escHtml(oName)}</span>`;

        return `
          <td class="col-report-name" style="cursor:pointer;max-width:320px;">
            <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;">
              <span class="report-title-text" style="font-weight:700;color:var(--text-primary);font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(reportName)}">${escHtml(reportName)}</span>
              ${poolBadge}
              ${ownerChip}
              ${hasNote ? `<span title="Not mevcut" style="font-size:.75rem;cursor:help;">📝</span>` : ''}
            </div>
          </td>
        `;
      }
    },
    fileName: {
      key: 'fileName',
      title: 'Dosya Adı (.frp)',
      sortField: 'fileName',
      renderTd: (file) => `
        <td class="col-file-name" style="color:var(--text-secondary);font-size:.8rem;font-family:var(--font);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(file.name)}">
          ${escHtml(file.name)}
        </td>
      `
    },
    fileSize: {
      key: 'fileSize',
      title: 'Boyut',
      sortField: 'sizeBytes',
      renderTd: (file, { size }) => `
        <td class="col-file-size" style="white-space:nowrap;font-size:.76rem;color:var(--text-muted);font-family:var(--mono);">
          ${size}
        </td>
      `
    },
    category: {
      key: 'category',
      title: 'Kategori',
      sortField: null,
      renderTd: (file, { catHtml }) => `<td class="col-category" style="white-space:nowrap;">${catHtml}</td>`
    },
    guid: {
      key: 'guid',
      title: 'GUID',
      sortField: 'guid',
      renderTd: (file, { guidColHtml }) => `<td class="col-guid" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${guidColHtml}</td>`
    },
    tags: {
      key: 'tags',
      title: 'Etiketler',
      sortField: null,
      renderTd: (file, { tagsHtml }) => `<td class="col-tags" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tagsHtml || '<span style="color:var(--text-muted);font-size:.75rem;">—</span>'}</td>`
    },
    queries: {
      key: 'queries',
      title: 'SQL',
      sortField: 'queries',
      renderTd: (file) => {
        const qCount = (file.queries || []).length;
        return `
          <td class="col-queries" style="white-space:nowrap;">
            <span class="badge ${qCount > 0 ? 'badge-blue' : 'badge-gray'}" style="font-size:.72rem;">${qCount} SQL</span>
          </td>
        `;
      }
    },
    date: {
      key: 'date',
      title: 'Yüklenme Tarihi',
      sortField: 'loadedAt',
      renderTd: (file, { date }) => `
        <td class="col-date" style="white-space:nowrap;font-size:.76rem;color:var(--text-muted);font-family:var(--mono);">
          ${date}
        </td>
      `
    },
    lastModified: {
      key: 'lastModified',
      title: 'Son Değişiklik',
      sortField: 'lastModified',
      renderTd: (file) => {
        const dObj = file.lastModified ? new Date(file.lastModified) : (file.loadedAt ? new Date(file.loadedAt) : null);
        const str = dObj ? dObj.toLocaleDateString('tr-TR') + ' ' + dObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—';
        return `
          <td class="col-last-modified" style="white-space:nowrap;font-size:.76rem;color:var(--text-muted);font-family:var(--mono);">
            ${str}
          </td>
        `;
      }
    }
  };

  window.FrpListRenderers.COLUMN_DEFS = COLUMN_DEFS;
  window.FrpListRenderers.DEFAULT_COLUMN_ORDER = DEFAULT_COLUMN_ORDER;

  window.FrpListRenderers.renderTableHeader = function(prefs, visibleCols, sortField, sortDir) {
    const tableHeaderRow = document.getElementById('tableHeaderRow');
    if (!tableHeaderRow) return;

    let currentOrder = Array.isArray(prefs.columnOrder) && prefs.columnOrder.length > 0
      ? [...prefs.columnOrder]
      : [...DEFAULT_COLUMN_ORDER];

    currentOrder = currentOrder.filter(c => c !== 'actions');
    if (!currentOrder.includes('fileName')) {
      const idx = currentOrder.indexOf('reportName');
      if (idx !== -1) currentOrder.splice(idx + 1, 0, 'fileName');
      else currentOrder.unshift('fileName');
    }
    if (!currentOrder.includes('lastModified')) {
      currentOrder.push('lastModified');
    }

    let thsHtml = `
      <th style="width:36px;text-align:center;padding:0 .5rem;">
        <input type="checkbox" id="selectAll" style="cursor:pointer;" title="Tümünü Seç / Kaldır" />
      </th>
      <th style="width:58px;text-align:center;padding:0 .3rem;">★</th>
    `;

    currentOrder.forEach(colKey => {
      if (visibleCols[colKey] === false) return;
      const def = COLUMN_DEFS[colKey];
      if (!def) return;

      const isSorted = def.sortField && sortField === def.sortField;
      const arrow = isSorted ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';
      const sortAttr = def.sortField ? `data-sort="${def.sortField}" class="sortable draggable-col ${isSorted ? 'sorted' : ''}"` : 'class="draggable-col"';

      thsHtml += `
        <th ${sortAttr} data-col="${colKey}" draggable="true" title="Sıralamak için tıklayın, yer değiştirmek için sürükleyin">
          <div style="display:flex;align-items:center;gap:.3rem;">
            <span>${def.title}</span>
            <span class="sort-arrow" style="font-size:.7rem;color:var(--accent);">${arrow}</span>
          </div>
        </th>
      `;
    });

    tableHeaderRow.innerHTML = thsHtml;
  };
})();
