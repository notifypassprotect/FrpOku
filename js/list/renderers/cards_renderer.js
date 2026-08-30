// ============================================================
//  cards_renderer.js — Rapor Listesi Kart Görünümü (Grid Mode)
// ============================================================

window.FrpListRenderers = window.FrpListRenderers || {};

window.FrpListRenderers.renderCards = function(files, container) {
  if (!container) return;

  const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  if (files.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:4rem 1rem;color:var(--text-muted);">
        <div style="font-size:1.1rem;font-weight:700;color:var(--text-primary);">Rapor Bulunamadı</div>
        <div style="font-size:.85rem;margin-top:.3rem;">Filtrelerinizi temizleyerek tekrar deneyin.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = files.map(file => {
    const encodedId = encodeInlineArg(file.id);
    const reportName = file.meta?.reportName || file.name;
    const date = new Date(file.loadedAt).toLocaleDateString('tr-TR');
    const size = typeof formatBytes === 'function' ? formatBytes(file.size) : (file.size || '');
    const guidBadge = (file.meta && file.meta.guid)
      ? `<span class="badge badge-gray" style="font-family:var(--mono);font-size:.7rem;" title="GUID: ${escHtml(file.meta.guid)}">${escHtml(file.meta.guid.slice(0, 8))}...</span>`
      : '';

    const oName = file.ownerName || file.owner_name || (file.userId === 'usr_admin_root' ? 'Admin' : 'Sistem');
    const oDept = file.ownerDepartment || file.owner_department || '';
    const ownerChip = `<span class="owner-chip" style="font-size:.72rem;padding:.15rem .5rem;" title="Yükleyen: ${escHtml(oName)}${oDept ? ' · ' + escHtml(oDept) : ''}">${escHtml(oName)}</span>`;

    const isPublic = !!(file.isPublic || file.is_public);
    const poolBadge = isPublic ? `<span class="badge badge-pool" style="font-size:.7rem;padding:.12rem .4rem;" title="Ortak Havuzda Paylaşıldı">Havuzda</span>` : '';

    return `
      <div class="report-card ${file.isPinned ? 'pinned' : ''}" style="background:var(--bg-surface);border:1.5px solid var(--border-light);border-radius:14px;padding:1.1rem;display:flex;flex-direction:column;gap:.75rem;cursor:pointer;transition:transform .18s ease, box-shadow .18s ease;box-shadow:0 4px 14px rgba(0,0,0,.04);box-sizing:border-box;max-width:100%;overflow:hidden;" onclick="openDetail(decodeURIComponent('${encodedId}'))">
        <div class="card-top" style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;">
          <div style="min-width:0;flex:1;overflow:hidden;">
            <div class="card-title" style="font-weight:var(--heading-weight, 800);font-size:.92rem;color:var(--text-primary);line-height:1.35;word-break:break-word;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;">
              <span>${escHtml(reportName)}</span>
              ${poolBadge}
            </div>
            <div style="font-size:.74rem;color:var(--text-muted);font-family:var(--font);margin-top:.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;" title="${escHtml(file.name)} · ${size}">
              ${escHtml(file.name)} · <strong>${size}</strong>
            </div>
          </div>
          <div class="card-actions" onclick="event.stopPropagation();" style="display:flex;align-items:center;gap:.25rem;flex-shrink:0;">
            <button class="pin-btn ${file.isPinned ? 'active' : ''}" onclick="togglePin(event, decodeURIComponent('${encodedId}'))" title="Üste Sabitle" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;padding:3px;opacity:${file.isPinned ? '1' : '0.35'};color:${file.isPinned ? 'var(--accent)' : 'inherit'};">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${file.isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M9 2h6l1 7h-8z"/></svg>
            </button>
            <button class="star-btn ${file.isFavorite ? 'active' : ''}" onclick="toggleFav(event, decodeURIComponent('${encodedId}'))" title="Favori" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;padding:3px;color:${file.isFavorite ? '#f59e0b' : 'inherit'};opacity:${file.isFavorite ? '1' : '0.4'};">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${file.isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
          </div>
        </div>

        <div class="card-body" style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;overflow:hidden;">
          ${ownerChip}
          <span class="badge badge-blue">${(file.queries || []).length} SQL</span>
          ${file.pascalScript ? '<span class="badge badge-purple">Pascal</span>' : ''}
          ${file.category ? `<span class="badge badge-purple" onclick="event.stopPropagation();openCategoryModalFor(decodeURIComponent('${encodedId}'))" style="cursor:pointer;" title="Kategori: ${escHtml(file.category)}">${escHtml(file.category)}</span>` : `<button class="btn btn-sm" onclick="event.stopPropagation();openCategoryModalFor(decodeURIComponent('${encodedId}'))" style="font-size:.7rem;padding:1px 6px;border-radius:5px;opacity:.7;">+ Kategori</button>`}
        </div>

        <div class="card-footer" style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border-light);padding-top:.6rem;font-size:.74rem;color:var(--text-muted);gap:.5rem;overflow:hidden;">
          ${guidBadge || '<span style="font-size:.72rem;">—</span>'}
          <span style="white-space:nowrap;flex-shrink:0;">${date}</span>
        </div>
      </div>
    `;
  }).join('');
};
