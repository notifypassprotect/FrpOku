// ============================================================
//  trash_tab.js — Çöp Kutusu, Geri Yükleme & Kalıcı Silme
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.trash = {
  selectedTrashIds: new Set(),

  render({ escHtml }) {
    const trashItems = FrpStore.getTrash() || [];

    const trashRowsHtml = trashItems.map(item => {
      const isSelected = this.selectedTrashIds.has(item.id);
      const repName = item.meta?.reportName || item.name;
      const delTime = item.deletedAt ? new Date(item.deletedAt).toLocaleString('tr-TR') : 'Bilinmiyor';

      return `
        <div class="trash-item-row" data-id="${item.id}" data-search="${escHtml((repName + ' ' + item.name).toLowerCase())}" style="display:flex;align-items:center;justify-content:space-between;padding:.65rem .85rem;background:var(--bg-surface);border:1px solid var(--border-light);border-radius:10px;gap:.75rem;transition:background .15s;">
          <div style="display:flex;align-items:center;gap:.65rem;min-width:0;flex:1;">
            <input type="checkbox" class="trash-item-cb" data-id="${item.id}" ${isSelected ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;" />
            <div style="min-width:0;flex:1;">
              <div style="font-weight:700;font-size:.85rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(repName)}</div>
              <div style="font-size:.72rem;color:var(--text-muted);margin-top:.15rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
                <span>${escHtml(item.name)}</span>
                <span>Silinme: ${delTime}</span>
              </div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:.35rem;flex-shrink:0;">
            <button type="button" class="btn btn-sm btn-ghost btn-restore-item" data-id="${item.id}" style="color:var(--green);font-weight:700;padding:.3rem .6rem;" title="Geri Yükle">
              Kurtar
            </button>
            <button type="button" class="btn btn-sm btn-ghost btn-purge-item" data-id="${item.id}" style="color:var(--red);font-weight:700;padding:.3rem .6rem;" title="Kalıcı Olarak Sil">
              Sil
            </button>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="display:flex;flex-direction:column;gap:1rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">Çöp Kutusu (${trashItems.length})</div>
            <div style="font-size:.78rem;color:var(--green);margin-top:.2rem;font-weight:700;">
              Geri yükleme ve silme işlemleri anında uygulanır.
            </div>
          </div>
          <div style="display:flex;gap:.5rem;align-items:center;">
            <button type="button" class="btn btn-sm btn-primary" id="btnRestoreSelectedTrash" style="display:${this.selectedTrashIds.size > 0 ? 'inline-flex' : 'none'};font-weight:700;">
              Seçilenleri Geri Yükle (<span id="trashSelectedCount">${this.selectedTrashIds.size}</span>)
            </button>
            <button type="button" class="btn btn-sm btn-danger" id="btnPurgeSelectedTrash" style="display:${this.selectedTrashIds.size > 0 ? 'inline-flex' : 'none'};font-weight:700;">
              Seçilenleri Kalıcı Sil
            </button>
            ${trashItems.length > 0 ? `
              <button type="button" class="btn btn-sm btn-danger" id="btnEmptyTrashAll" style="font-weight:700;">
                Çöp Kutusunu Boşalt
              </button>
            ` : ''}
          </div>
        </div>

        ${trashItems.length > 0 ? `
          <div style="display:flex;align-items:center;gap:.75rem;">
            <div style="position:relative;flex:1;">
              <input type="text" id="trashSearchInput" placeholder="🔍 Çöp kutusunda ara (Rapor adı, dosya adı)..." class="master-search-input" style="width:100%;font-size:.82rem;padding:.45rem .8rem;" />
            </div>
            <label style="display:flex;align-items:center;gap:.4rem;font-size:.78rem;font-weight:700;cursor:pointer;color:var(--text-secondary);">
              <input type="checkbox" id="trashSelectAll" style="width:16px;height:16px;cursor:pointer;" />
              <span>Tümünü Seç</span>
            </label>
          </div>

          <div id="trashItemsListContainer" style="display:flex;flex-direction:column;gap:.45rem;max-height:360px;overflow-y:auto;padding-right:.3rem;">
            ${trashRowsHtml}
          </div>
        ` : `
          <div style="text-align:center;padding:3.5rem 1rem;background:var(--bg-surface);border-radius:12px;border:1px dashed var(--border);">
            <div style="font-size:2.8rem;margin-bottom:.6rem;">🎉</div>
            <div style="font-weight:800;font-size:1rem;color:var(--text-primary);">Çöp Kutusu Boş</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">Silinmiş herhangi bir rapor bulunmuyor.</div>
          </div>
        `}
      </div>
    `;
  },

  bind({ overlay, renderModal, safeToast }) {
    const updateTrashSelectionUI = () => {
      const count = this.selectedTrashIds.size;
      const btnRestore = overlay.querySelector('#btnRestoreSelectedTrash');
      const btnPurge = overlay.querySelector('#btnPurgeSelectedTrash');
      const countSpan = overlay.querySelector('#trashSelectedCount');

      if (btnRestore) btnRestore.style.display = count > 0 ? 'inline-flex' : 'none';
      if (btnPurge) btnPurge.style.display = count > 0 ? 'inline-flex' : 'none';
      if (countSpan) countSpan.textContent = count;
    };

    overlay.querySelector('#trashSearchInput')?.addEventListener('input', (e) => {
      const query = (e.target.value || '').toLowerCase().trim();
      overlay.querySelectorAll('.trash-item-row').forEach(row => {
        const text = row.dataset.search || '';
        row.style.display = text.includes(query) ? 'flex' : 'none';
      });
    });

    overlay.querySelector('#trashSelectAll')?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      overlay.querySelectorAll('.trash-item-cb').forEach(cb => {
        cb.checked = isChecked;
        const id = cb.dataset.id;
        if (isChecked) this.selectedTrashIds.add(id);
        else this.selectedTrashIds.delete(id);
      });
      updateTrashSelectionUI();
    });

    overlay.querySelectorAll('.trash-item-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        if (e.target.checked) this.selectedTrashIds.add(id);
        else this.selectedTrashIds.delete(id);
        updateTrashSelectionUI();
      });
    });

    // Tekil Kurtar
    overlay.querySelectorAll('.btn-restore-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        await FrpStore.restoreFromTrash(id);
        if (window.FrpAudit) {
          window.FrpAudit.logAction({
            action: 'TRASH_RESTORE',
            target: id,
            details: `Rapor (${id}) çöp kutusundan geri yüklendi.`
          });
        }
        this.selectedTrashIds.delete(id);
        safeToast('Rapor başarıyla geri yüklendi.', 'success');
        if (typeof window.refreshAll === 'function') window.refreshAll();
        renderModal();
      });
    });

    // Tekil Kalıcı Sil
    overlay.querySelectorAll('.btn-purge-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        window.showConfirmDialog({
          title: 'Raporu Kalıcı Olarak Sil',
          message: 'Bu raporu kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
          confirmText: 'Kalıcı Olarak Sil',
          isDanger: true,
          onConfirm: async () => {
            await FrpStore.purgeFromTrash(id);
            if (window.FrpAudit) {
              window.FrpAudit.logAction({
                action: 'TRASH_PURGE',
                target: id,
                details: `Rapor (${id}) çöp kutusundan kalıcı olarak silindi.`
              });
            }
            this.selectedTrashIds.delete(id);
            safeToast('Rapor kalıcı olarak silindi.', 'info');
            if (typeof window.refreshAll === 'function') window.refreshAll();
            renderModal();
          }
        });
      });
    });

    // Toplu Kurtar
    overlay.querySelector('#btnRestoreSelectedTrash')?.addEventListener('click', async () => {
      const ids = Array.from(this.selectedTrashIds);
      if (ids.length === 0) return;
      for (const id of ids) {
        await FrpStore.restoreFromTrash(id);
      }
      if (window.FrpAudit) {
        window.FrpAudit.logAction({
          action: 'TRASH_RESTORE',
          target: `${ids.length} Rapor`,
          details: `${ids.length} adet rapor çöp kutusundan geri yüklendi.`
        });
      }
      this.selectedTrashIds.clear();
      safeToast(`${ids.length} rapor başarıyla geri yüklendi.`, 'success');
      if (typeof window.refreshAll === 'function') window.refreshAll();
      renderModal();
    });

    // Toplu Kalıcı Sil
    overlay.querySelector('#btnPurgeSelectedTrash')?.addEventListener('click', () => {
      const ids = Array.from(this.selectedTrashIds);
      if (ids.length === 0) return;
      window.showConfirmDialog({
        title: 'Seçilenleri Kalıcı Sil',
        message: `${ids.length} adet raporu kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
        confirmText: 'Evet, Kalıcı Olarak Sil',
        isDanger: true,
        onConfirm: async () => {
          for (const id of ids) {
            await FrpStore.purgeFromTrash(id);
          }
          if (window.FrpAudit) {
            window.FrpAudit.logAction({
              action: 'TRASH_PURGE',
              target: `${ids.length} Rapor`,
              details: `${ids.length} adet rapor çöp kutusundan kalıcı olarak silindi.`
            });
          }
          this.selectedTrashIds.clear();
          safeToast(`${ids.length} rapor kalıcı olarak silindi.`, 'info');
          if (typeof window.refreshAll === 'function') window.refreshAll();
          renderModal();
        }
      });
    });

    // Çöp Kutusunu Tamamen Boşalt
    overlay.querySelector('#btnEmptyTrashAll')?.addEventListener('click', () => {
      window.showConfirmDialog({
        title: 'Çöp Kutusunu Boşalt',
        message: 'Çöp kutusundaki tüm raporları kalıcı olarak temizlemek istediğinize emin misiniz? Bu işlem geri alınamaz.',
        confirmText: 'Tümünü Temizle',
        isDanger: true,
        onConfirm: async () => {
          await FrpStore.emptyTrash();
          if (window.FrpAudit) {
            window.FrpAudit.logAction({
              action: 'TRASH_EMPTY',
              target: 'Tüm Çöp Kutusu',
              details: 'Çöp kutusundaki tüm raporlar kalıcı olarak temizlendi.'
            });
          }
          this.selectedTrashIds.clear();
          safeToast('Çöp kutusu tamamen boşaltıldı.', 'info');
          if (typeof window.refreshAll === 'function') window.refreshAll();
          renderModal();
        }
      });
    });
  }
};
