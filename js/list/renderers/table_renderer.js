// ============================================================
//  table_renderer.js — Rapor Listesi Tablo Görünümü & Sütun Motoru
// ============================================================

window.FrpListRenderers = window.FrpListRenderers || {};

(function () {
  'use strict';

  const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
    return `<span class="tag-pill" style="background:${c.bg};color:${c.color};border:1px solid ${c.border};padding:.12rem .45rem;border-radius:6px;font-size:.72rem;font-weight:600;display:inline-flex;align-items:center;white-space:nowrap;">${escHtml(tag)}</span>`;
  }
  window.renderTag = renderTag;

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
        const poolBadge = isPublic ? `<span class="badge badge-pool" style="font-size:.68rem;padding:1px 6px;border-radius:10px;margin-left:.25rem;" title="Ortak Havuzda Paylaşıldı">Havuzda</span>` : '';
        const oName = file.ownerName || file.owner_name || (file.userId === 'usr_admin_root' ? 'Admin' : 'Sistem');
        const oDept = file.ownerDepartment || file.owner_department || '';
        const ownerChip = `<span class="owner-chip" style="font-size:.72rem;padding:.12rem .5rem;border-radius:6px;margin-left:.35rem;" title="Yükleyen: ${escHtml(oName)}${oDept ? ' · ' + escHtml(oDept) : ''}">${escHtml(oName)}</span>`;

        return `
          <td class="col-reportName" style="cursor:pointer;max-width:320px;">
            <div class="file-name" style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap;">
              <span class="report-name-title" style="font-weight:var(--report-title-weight, 700);font-size:.88rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(reportName)}">${escHtml(reportName)}</span>
              ${poolBadge}
              ${ownerChip}
              ${hasNote ? `<span title="Not mevcut" style="font-size:.72rem;color:var(--accent);font-weight:var(--bold-weight, 700);">[Not]</span>` : ''}
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
        <td class="col-fileName" style="color:var(--text-secondary);font-size:.8rem;font-family:var(--font);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(file.name)}">
          ${escHtml(file.name)}
        </td>
      `
    },
    fileSize: {
      key: 'fileSize',
      title: 'Boyut',
      sortField: 'sizeBytes',
      renderTd: (file, { size }) => {
        const numBytes = Number(file.sizeBytes || file.size) || 0;
        const displaySize = size || (numBytes > 1024 ? (numBytes > 1048576 ? (numBytes / 1048576).toFixed(1) + ' MB' : Math.round(numBytes / 1024) + ' KB') : (numBytes > 0 ? numBytes + ' B' : '—'));
        return `
          <td class="col-fileSize" style="white-space:nowrap;font-size:.76rem;color:var(--text-muted);font-family:var(--mono);text-align:left;">
            ${displaySize}
          </td>
        `;
      }
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
      renderTd: (file, { guidColHtml }) => `<td class="col-guid" style="white-space:nowrap;">${guidColHtml}</td>`
    },
    tags: {
      key: 'tags',
      title: 'Etiketler',
      sortField: null,
      renderTd: (file, { tagsHtml }) => `<td class="col-tags" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tagsHtml || '<span style="color:var(--text-muted);font-size:.75rem;">—</span>'}</td>`
    },
    queries: {
      key: 'queries',
      title: 'SQL',
      sortField: 'queries',
      renderTd: (file) => {
        const qCount = (file.queries || []).length;
        return `
          <td class="col-queries" style="white-space:nowrap;text-align:center;">
            <span class="badge ${qCount > 0 ? 'badge-blue' : 'badge-gray'}" style="font-size:.72rem;padding:.18rem .45rem;">${qCount} SQL</span>
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
        const rawDate = file.updatedAt || file.lastModified || file.loadedAt;
        const dObj = rawDate ? new Date(rawDate) : null;
        const isValid = dObj && !isNaN(dObj.getTime());
        const str = isValid ? dObj.toLocaleDateString('tr-TR') + ' ' + dObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—';
        return `
          <td class="col-lastModified" style="white-space:nowrap;font-size:.76rem;color:var(--text-muted);font-family:var(--mono);">
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
