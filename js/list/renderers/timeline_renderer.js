// ============================================================
//  timeline_renderer.js — Rapor Listesi Zaman Tüneli Görünümü (Timeline Mode)
// ============================================================

window.FrpListRenderers = window.FrpListRenderers || {};

window.FrpListRenderers.renderTimeline = function(files, container) {
  if (!container) return;

  const escHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  if (files.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--text-muted);">Sonuç bulunamadı.</div>`;
    return;
  }

  // Yüklenme tarihine göre grupla (Yıl-Ay)
  const groups = {};
  files.forEach(file => {
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
          const reportName = file.meta?.reportName || file.name;
          const timeStr = new Date(file.loadedAt).toLocaleDateString('tr-TR');
          const guidVal = (file.meta && file.meta.guid) ? file.meta.guid : '—';
          const oName = file.ownerName || file.owner_name || (file.userId === 'usr_admin_root' ? 'Admin' : 'Sistem');
          const oDept = file.ownerDepartment || file.owner_department || '';
          const ownerChip = `<span class="owner-chip" style="font-size:.7rem;padding:.1rem .45rem;" title="Yükleyen: ${escHtml(oName)}${oDept ? ' · ' + escHtml(oDept) : ''}">👤 ${escHtml(oName)}</span>`;
          const isPublic = !!(file.isPublic || file.is_public);
          const poolBadge = isPublic ? `<span class="badge badge-pool" style="font-size:.68rem;padding:.1rem .35rem;" title="Ortak Havuzda Paylaşıldı">🌐 Havuzda</span>` : '';

          return `
            <div class="timeline-item" onclick="openDetail('${file.id}')" style="cursor:pointer;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:.4rem;">
                  <strong style="font-size:.9rem;color:var(--text-primary);">📋 ${escHtml(reportName)}</strong>
                  ${poolBadge}
                </div>
                <span style="font-size:.75rem;color:var(--text-muted);">${timeStr}</span>
              </div>
              <div style="font-size:.76rem;color:var(--text-muted);margin-top:.35rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
                ${ownerChip}
                <span>Dosya: <code style="font-family:var(--font);font-size:.76rem;">${escHtml(file.name)}</code></span>
                <span class="badge badge-gray" style="font-family:var(--mono);font-size:.7rem;">🔑 GUID: ${escHtml(guidVal)}</span>
                <span class="badge badge-blue" style="font-size:.7rem;">🗄️ ${(file.queries || []).length} SQL</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `).join('');
};
