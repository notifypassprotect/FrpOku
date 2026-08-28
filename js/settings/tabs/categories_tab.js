// ============================================================
//  categories_tab.js — Özel Kategori & Etiket Yönetimi
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.categories = {
  render({ escHtml }) {
    const categories = FrpStore.getCategoryObjects();
    const customTags = FrpStore.getCustomTags();

    const catListHtml = categories.map(cat => `
      <div class="category-item-row" style="display:flex;align-items:center;justify-content:space-between;padding:.6rem .85rem;background:var(--bg-surface);border:1px solid var(--border-light);border-radius:9px;gap:.75rem;">
        <div style="display:flex;align-items:center;gap:.6rem;">
          <span style="width:14px;height:14px;border-radius:50%;background:${cat.color};display:inline-block;box-shadow:0 0 5px ${cat.color};"></span>
          <span style="font-weight:700;font-size:.84rem;color:var(--text-primary);">${escHtml(cat.name)}</span>
        </div>
        <button type="button" class="btn btn-sm btn-ghost btn-delete-cat" data-id="${cat.id}" style="color:var(--red);padding:.2rem .5rem;font-size:.75rem;" title="Kategoriyi Sil">
          🗑️ Sil
        </button>
      </div>
    `).join('');

    const customTagsHtml = customTags.map(tag => `
      <span class="custom-tag-chip" style="display:inline-flex;align-items:center;gap:.35rem;padding:.3rem .65rem;border-radius:8px;background:var(--bg-surface);border:1px solid var(--border-light);font-size:.78rem;font-weight:600;">
        <span>🏷️ ${escHtml(tag)}</span>
        <button type="button" class="btn-remove-custom-tag" data-tag="${escHtml(tag)}" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:.75rem;padding:0;" title="Etiketi Kaldır">✕</button>
      </span>
    `).join('');

    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">🏷️ Kategori & Etiket Yönetimi</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
            Raporlarınızı gruplandırabileceğiniz özel kategoriler ve etiketler tanımlayın.
          </div>
        </div>

        <!-- Yeni Kategori Ekle -->
        <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
          <div style="font-weight:700;font-size:.85rem;">➕ Yeni Kategori Oluştur</div>
          <div style="display:flex;gap:.5rem;align-items:center;">
            <input type="text" id="newCategoryName" class="master-search-input" style="flex:1;" placeholder="Kategori adı (Örn: Finans, Ameliyathane)..." />
            <input type="color" id="newCategoryColor" value="#3b82f6" style="width:40px;height:38px;border:none;border-radius:8px;cursor:pointer;background:none;" title="Renk Seç" />
            <button type="button" class="btn btn-sm btn-primary" id="btnSaveNewCat" style="font-weight:700;padding:.5rem 1rem;">➕ Ekle</button>
          </div>
        </div>

        <!-- Kayıtlı Kategoriler Listesi -->
        <div style="display:flex;flex-direction:column;gap:.55rem;">
          <div style="font-weight:700;font-size:.84rem;color:var(--text-secondary);">Kayıtlı Kategoriler (${categories.length})</div>
          <div style="display:flex;flex-direction:column;gap:.45rem;max-height:220px;overflow-y:auto;padding-right:.3rem;">
            ${catListHtml || '<div style="color:var(--text-muted);font-size:.8rem;padding:1.5rem;text-align:center;">Henüz kategori tanımlanmamış.</div>'}
          </div>
        </div>

        <!-- Özel Kullanıcı Etiketleri (Custom Tags) -->
        <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
          <div style="font-weight:700;font-size:.85rem;">🏷️ Özel Kullanıcı Etiketleri (Manuel Tag Havuzu)</div>
          <div style="font-size:.74rem;color:var(--text-muted);">Otomatik etiketlerin yanı sıra kendi özel etiketlerinizi oluşturabilirsiniz.</div>
          <div style="display:flex;gap:.5rem;align-items:center;">
            <input type="text" id="newCustomTagName" class="master-search-input" style="flex:1;" placeholder="Yeni etiket adı (Örn: Acil, Revizyon2026)..." />
            <button type="button" class="btn btn-sm btn-primary" id="btnAddCustomTag" style="font-weight:700;padding:.5rem 1rem;">➕ Etiket Ekle</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:.45rem;margin-top:.4rem;min-height:30px;">
            ${customTagsHtml || '<div style="color:var(--text-muted);font-size:.76rem;">Henüz özel etiket eklenmemiş.</div>'}
          </div>
        </div>
      </div>
    `;
  },

  bind({ overlay, renderModal, safeToast }) {
    // Kategori Ekle
    overlay.querySelector('#btnSaveNewCat')?.addEventListener('click', () => {
      const name = (overlay.querySelector('#newCategoryName')?.value || '').trim();
      const color = overlay.querySelector('#newCategoryColor')?.value || '#3b82f6';
      if (!name) {
        safeToast('Lütfen bir kategori adı girin.', 'error');
        return;
      }
      FrpStore.addCategory(name, color);
      safeToast(`'${name}' kategorisi eklendi! 🏷️`, 'success');
      renderModal();
    });

    // Kategori Sil
    overlay.querySelectorAll('.btn-delete-cat').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        FrpStore.deleteCategory(id);
        safeToast('Kategori silindi.', 'info');
        renderModal();
      });
    });

    // Özel Etiket Ekle
    overlay.querySelector('#btnAddCustomTag')?.addEventListener('click', () => {
      const tag = (overlay.querySelector('#newCustomTagName')?.value || '').trim();
      if (!tag) {
        safeToast('Lütfen bir etiket adı girin.', 'error');
        return;
      }
      FrpStore.addCustomTag(tag);
      safeToast(`'${tag}' etiketi eklendi! 🏷️`, 'success');
      renderModal();
    });

    // Özel Etiket Sil
    overlay.querySelectorAll('.btn-remove-custom-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tag = e.currentTarget.dataset.tag;
        FrpStore.deleteCustomTag(tag);
        safeToast(`'${tag}' etiketi silindi.`, 'info');
        renderModal();
      });
    });
  }
};
