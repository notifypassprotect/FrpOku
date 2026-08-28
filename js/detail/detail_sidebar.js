// ============================================================
//  detail_sidebar.js — Rapor Detay Sayfası Yan Menü (Sidebar) Paneli
// ============================================================

window.FrpDetailSidebar = window.FrpDetailSidebar || {};

(function () {
  'use strict';

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
    if (newDisplay !== undefined) {
      if (newDisplay) display.textContent = newDisplay;
      else display.innerHTML = '<span style="color:var(--text-muted);font-style:italic;">—</span>';
    }
    display.style.display = '';
    input.style.display = 'none';
    actions.style.display = 'none';
  }

  function bindMetaEditEvents(container, fileId) {
    if (!container) return;
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
        deactivateMetaEdit(rowEl, esc(newVal));
        if (typeof showToast === 'function') {
          showToast(`${field === 'reportName' ? 'Rapor adı' : field === 'author' ? 'Yazar' : 'Açıklama'} güncellendi.`, 'success');
        }
        if (field === 'reportName') {
          const pTitle = document.getElementById('pageTitle');
          if (pTitle) pTitle.textContent = newVal || 'Rapor Detayı';
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

  window.FrpDetailSidebar.renderSidebar = function(file) {
    const sb = document.getElementById('sidebarBody');
    if (!sb || !file) return;

    const queries = Array.isArray(file.queries) ? file.queries : [];
    const tags = Array.isArray(file.tags) ? file.tags : [];
    const meta = file.meta || {};

    const allParams = new Set();
    queries.forEach(q => {
      if (typeof extractParams === 'function') {
        extractParams(q.sql).forEach(p => allParams.add(p));
      }
    });

    const paramPillsHtml = [...allParams].map(p => `<span class="param-pill">${esc(p)}</span>`).join('');
    const tagsList = tags.map(t => `
      <span class="tag-pill">
        ${esc(t)}
        <span class="tag-pill-remove" onclick="removeTagFromDetail('${esc(t)}')">×</span>
      </span>
    `).join('');

    sb.innerHTML = `
      <div class="sidebar-section">
        <div class="sidebar-heading">Rapor Bilgileri</div>
        ${makeEditableMetaRow('Rapor Adı', 'reportName', meta.reportName || file.name, file.id)}
        ${makeEditableMetaRow('Açıklama', 'description', meta.description || '', file.id)}
        ${makeEditableMetaRow('Yazar', 'author', meta.author || '', file.id)}
        <div class="meta-row">
          <div class="meta-label">GUID</div>
          <div class="meta-value" style="font-family:var(--mono);font-size:.72rem;">${esc(meta.guid || '—')}</div>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-heading">Etiketler & Kategoriler</div>
        <div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.5rem;">${tagsList || '<span style="color:var(--text-muted);font-size:.75rem;">Etiket yok</span>'}</div>
        <div class="meta-row">
          <div class="meta-label">Kategori</div>
          <div class="meta-value">${esc(file.category || 'Belirtilmemiş')}</div>
        </div>
      </div>

      ${allParams.size > 0 ? `
        <div class="sidebar-section">
          <div class="sidebar-heading">SQL Parametreleri (${allParams.size})</div>
          <div style="display:flex;flex-wrap:wrap;gap:.3rem;">${paramPillsHtml}</div>
        </div>
      ` : ''}
    `;

    bindMetaEditEvents(sb, file.id);
  };
})();
