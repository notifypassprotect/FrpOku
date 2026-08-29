// ── KATEGORİ ATAMA MODALI (YALNIZCA ATAMA YAPAR) ───────────
function openCategoryManagerModal(targetFileIds = null) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '99999';

  function renderModalContent() {
    const catObjects = FrpStore.getCategoryObjects();
    const files = FrpStore.getAll();
    const isTargeting = Array.isArray(targetFileIds) && targetFileIds.length > 0;
    const targetCount = isTargeting ? targetFileIds.length : 0;

    overlay.innerHTML = `
      <div class="modal" style="max-width:500px;border-radius:16px;">
        <div class="modal-title">Rapor Kategori Atama</div>
        <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:1.2rem;">
          ${isTargeting ? `Seçili <strong>${targetCount}</strong> adet rapor için kategori belirleyin.` : 'Raporunuza kategori atayarak listeyi organize edin.'}
        </div>

        <div style="display:flex;flex-direction:column;gap:.85rem;margin-bottom:1.2rem;">
          ${!isTargeting ? `
            <div>
              <label style="font-size:.78rem;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:.3rem;">Rapor Seçin:</label>
              <select id="catSelectReport" class="master-search-input" style="width:100%;">
                <option value="">-- Rapor Seçin --</option>
                ${files.map(f => `<option value="${f.id}">${escHtml(f.meta?.reportName || f.name)}</option>`).join('')}
              </select>
            </div>
          ` : ''}

          <div>
            <label style="font-size:.78rem;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:.3rem;">Atanacak Kategori:</label>
            <select id="catSelectCategory" class="master-search-input" style="width:100%;font-weight:700;">
              <option value="">(Kategorisiz Yap / Temizle)</option>
              ${catObjects.map(c => `<option value="${escHtml(c.name)}">${escHtml(c.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="font-size:.74rem;color:var(--text-muted);background:var(--bg-raised);padding:.55rem .75rem;border-radius:8px;border:1px solid var(--border-light);margin-bottom:1.2rem;">
          Yeni kategori oluşturmak veya düzenlemek için üst menüdeki <strong>Ayarlar > Kategoriler & Etiketler</strong> sekmesini kullanabilirsiniz.
        </div>

        <div class="modal-actions" style="display:flex;align-items:center;justify-content:flex-end;gap:.6rem;">
          <button class="btn btn-sm btn-ghost" id="btnCloseCatModal">İptal</button>
          <button class="btn btn-sm btn-primary" id="btnAssignCatSubmit" style="font-weight:800;padding:.45rem 1.25rem;">Kategoriye Ata</button>
        </div>
      </div>
    `;

    overlay.querySelector('#btnAssignCatSubmit')?.addEventListener('click', () => {
      const selectedCat = overlay.querySelector('#catSelectCategory').value;
      if (isTargeting) {
        let count = 0;
        targetFileIds.forEach(id => {
          if (FrpStore.setCategory(id, selectedCat)) count++;
        });
        toast(`${count} rapora kategori atandı`, 'success');
      } else {
        const fileId = overlay.querySelector('#catSelectReport')?.value;
        if (!fileId) {
          toast('Lütfen bir rapor seçin.', 'warning');
          return;
        }
        FrpStore.setCategory(fileId, selectedCat);
        toast('Kategori başarıyla atandı', 'success');
      }
      if (typeof window.refreshAll === 'function') window.refreshAll();
      overlay.remove();
    });

    overlay.querySelector('#btnCloseCatModal')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  }

  renderModalContent();
  document.body.appendChild(overlay);
}

function openCategoryModalFor(fileId) {
  openCategoryManagerModal([fileId]);
}

window.openCategoryManagerModal = openCategoryManagerModal;
window.openCategoryModalFor = openCategoryModalFor;

document.getElementById('btnManageCategories')?.addEventListener('click', () => openCategoryManagerModal());
document.getElementById('btnBulkCategory')?.addEventListener('click', () => {
  const currentSelected = window.selectedIds || (typeof selectedIds !== 'undefined' ? selectedIds : new Set());
  const ids = [...currentSelected];
  if (ids.length === 0) {
    if (typeof toast === 'function') toast('Lütfen kategori atanacak raporları seçin.', 'warning');
    else if (window.toast) window.toast('Lütfen kategori atanacak raporları seçin.', 'warning');
    return;
  }
  openCategoryManagerModal(ids);
});

function bindInlineNameEdit() {
  // Inline name editing replaced by Right-Click -> "Adını Düzenle" modal per user request
}