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
    const sizeValue = file.sizeBytes ?? file.size ?? 0;
    const size = window.FrpFileSafety ? window.FrpFileSafety.formatBytes(sizeValue) : `${Number(sizeValue) || 0} B`;
    const guidBadge = (file.meta && file.meta.guid)
      ? `<span class="badge badge-gray" style="font-family:var(--mono);font-size:.7rem;" title="GUID: ${escHtml(file.meta.guid)}">${escHtml(file.meta.guid.slice(0, 8))}...</span>`
      : '';

    const oName = file.ownerName || file.owner_name || (file.userId === 'usr_admin_root' ? 'Admin' : 'Sistem');
    const oDept = file.ownerDepartment || file.owner_department || '';
    const ownerChip = `<span class="owner-chip" style="font-size:.72rem;padding:.15rem .5rem;" title="Yükleyen: ${escHtml(oName)}${oDept ? ' · ' + escHtml(oDept) : ''}">${escHtml(oName)}</span>`;

    const isPublic = !!(file.isPublic || file.is_public);
    const poolBadge = isPublic ? `<span class="badge badge-pool" style="font-size:.7rem;padding:.12rem .4rem;" title="Ortak Havuzda Paylaşıldı">Havuzda</span>` : '';

    const lockInfo = window.activeReportLocks ? window.activeReportLocks[file.id] : null;
    const currentUserId = String(window.FrpAuth?.getUser?.()?.id || '');
    const isLockedByOther = lockInfo && String(lockInfo.userId) !== currentUserId;
    const lockBadge = isLockedByOther ? `
      <span class="report-lock-badge" title="${escHtml(lockInfo.userName || 'Kullanıcı')} şu anda bu raporu düzenliyor">
        <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        ${escHtml(lockInfo.userName || 'Biri')} düzenliyor
      </span>
    ` : '';

    return `
      <div class="report-card ${file.isPinned ? 'pinned' : ''} ${window.selectedIds?.has(file.id) ? 'selected' : ''}" data-list-action="open-detail" data-id="${encodedId}" style="background:var(--bg-surface);border:1.5px solid var(--border-light);border-radius:14px;padding:1.1rem;display:flex;flex-direction:column;gap:.75rem;cursor:pointer;transition:transform .18s ease, box-shadow .18s ease;box-shadow:0 4px 14px rgba(0,0,0,.04);box-sizing:border-box;max-width:100%;overflow:hidden;">
        <div class="card-mobile-actions" data-list-action="stop">
          <label class="card-select-label"><input type="checkbox" class="row-checkbox" data-list-change="select" data-id="${encodedId}" ${window.selectedIds?.has(file.id) ? 'checked' : ''} /> Seç</label>
          <button type="button" class="btn btn-sm" data-list-action="open-actions" data-id="${encodedId}" aria-label="${escHtml(reportName)} işlemleri">İşlemler ···</button>
        </div>
        <div class="card-top" style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;">
          <div style="min-width:0;flex:1;overflow:hidden;">
            <div class="card-title" style="font-weight:var(--heading-weight, 800);font-size:.92rem;color:var(--text-primary);line-height:1.35;word-break:break-word;display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;">
              <button type="button" class="report-title-action" data-list-action="open-detail" data-id="${encodedId}" aria-label="${escHtml(reportName)} raporunu aç">${escHtml(reportName)}</button>
              ${poolBadge}
              ${lockBadge}
            </div>
            <div style="font-size:.74rem;color:var(--text-muted);font-family:var(--font);margin-top:.25rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;" title="${escHtml(file.name)} · ${size}">
              ${escHtml(file.name)} · <strong>${size}</strong>
            </div>
          </div>
          <div class="card-actions" data-list-action="stop" style="display:flex;align-items:center;gap:.25rem;flex-shrink:0;">
            <button class="pin-btn ${file.isPinned ? 'active' : ''}" data-list-action="toggle-pin" data-id="${encodedId}" title="Üste Sabitle" aria-label="${escHtml(reportName)} raporunu sabitle" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px;opacity:${file.isPinned ? '1' : '0.35'};color:${file.isPinned ? 'var(--accent)' : 'inherit'};">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${file.isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5M9 2h6l1 7h-8z"/></svg>
            </button>
            <button class="star-btn ${file.isFavorite ? 'active' : ''}" data-list-action="toggle-fav" data-id="${encodedId}" title="Favori" aria-label="${escHtml(reportName)} favorisini değiştir" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;min-width:32px;min-height:32px;color:${file.isFavorite ? '#f59e0b' : 'inherit'};opacity:${file.isFavorite ? '1' : '0.4'};">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="${file.isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
          </div>
        </div>

        <div class="card-body" style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;overflow:hidden;">
          ${ownerChip}
          <span class="badge badge-blue">${(Array.isArray(file.queries) && file.queries.length > 0 ? file.queries.length : (Number(file.stats?.sqlCount || file.sql_count || file.sqlCount || 0) || 0))} SQL</span>
          ${file.pascalScript ? '<span class="badge badge-purple">Pascal</span>' : ''}
          ${file.category ? `<span class="badge badge-purple" data-list-action="category" data-id="${encodedId}" style="cursor:pointer;" title="Kategori: ${escHtml(file.category)}">${escHtml(file.category)}</span>` : `<button class="btn btn-sm" data-list-action="category" data-id="${encodedId}" style="font-size:.7rem;padding:1px 6px;border-radius:5px;opacity:.7;">+ Kategori</button>`}
        </div>

        <div class="card-footer" style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border-light);padding-top:.6rem;font-size:.74rem;color:var(--text-muted);gap:.5rem;overflow:hidden;">
          ${guidBadge || '<span style="font-size:.72rem;">—</span>'}
          <span style="white-space:nowrap;flex-shrink:0;">${date}</span>
        </div>
      </div>
    `;
  }).join('');
};

window.FrpListRenderers.renderSkeletonCards = function(container, count = 6) {
  if (!container) return;
  const items = Array.from({ length: count });
  container.innerHTML = items.map(() => `
    <div class="skeleton-card" aria-hidden="true" style="background:var(--bg-surface);border:1.5px solid var(--border-light);border-radius:14px;padding:1.15rem;display:flex;flex-direction:column;gap:.85rem;box-shadow:0 4px 14px rgba(0,0,0,.03);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;">
        <div class="frp-skeleton-pulse skeleton-line" style="width:58%;height:18px;border-radius:6px;"></div>
        <div class="frp-skeleton-pulse" style="width:48px;height:18px;border-radius:999px;"></div>
      </div>
      <div class="frp-skeleton-pulse skeleton-line" style="width:36%;height:11px;border-radius:5px;"></div>
      <div style="display:flex;gap:.45rem;align-items:center;margin-top:.2rem;">
        <div class="frp-skeleton-pulse" style="width:72px;height:24px;border-radius:999px;"></div>
        <div class="frp-skeleton-pulse" style="width:58px;height:24px;border-radius:999px;"></div>
        <div class="frp-skeleton-pulse" style="width:64px;height:24px;border-radius:999px;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:.7rem;border-top:1px solid var(--border-light);">
        <div class="frp-skeleton-pulse skeleton-line" style="width:28%;height:10px;border-radius:4px;"></div>
        <div class="frp-skeleton-pulse skeleton-line" style="width:52px;height:10px;border-radius:4px;"></div>
      </div>
    </div>
  `).join('');
};

