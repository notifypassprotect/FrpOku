// ============================================================
//  columns_tab.js — Liste ve Sütun Görünürlüğü Ayarları
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.columns = {
  columnDefs: [
    { id: 'reportName',   label: 'Rapor Başlığı',              desc: 'Raporun ana başlığı' },
    { id: 'fileName',     label: 'Dosya Adı (.frp)',           desc: 'Raporun disk üzerindeki orijinal dosya adı' },
    { id: 'fileSize',     label: 'Dosya Boyutu (KB / MB)',      desc: 'Fiziksel .frp dosyasının disk üzerindeki boyutu' },
    { id: 'category',     label: 'Kategori Etiketi',           desc: 'Rapora atanmış renkli kategori rozeti' },
    { id: 'guid',         label: 'GUID (Benzersiz Kimlik)',    desc: 'FastReport raporunun 36 haneli benzersiz GUID kodu' },
    { id: 'tags',         label: 'Etiketler (Tags)',           desc: 'Otomatik ve özel departman etiketleri' },
    { id: 'queries',      label: 'SQL Sorguları Rozeti',       desc: 'İçerdiği SQL sorgu adedi rozeti' },
    { id: 'date',         label: 'Yüklenme Tarihi',            desc: 'Raporun sisteme ilk eklenme tarihi' },
    { id: 'lastModified', label: 'Son Değişiklik Tarihi',      desc: 'Raporun en son düzenlenme ve güncellenme zamanı' }
  ],

  render({ stagedPrefs }) {
    const cols = stagedPrefs.visibleColumns || {};

    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">Liste & Sütun Görünürlüğü</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
            Ana sayfadaki rapor listesinde görmek istediğiniz sütunları ve sayfalama limitini ayarlayın.
          </div>
        </div>

        <div class="settings-card" style="display:flex;flex-direction:column;gap:.6rem;">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.2rem;">Tablo Sütunları</div>
          ${this.columnDefs.map(c => `
            <label style="display:flex;align-items:flex-start;gap:.65rem;cursor:pointer;padding:.4rem 0;border-bottom:1px solid var(--border-light);">
              <input type="checkbox" class="staged-col-cb" data-col="${c.id}" ${cols[c.id] !== false ? 'checked' : ''} style="margin-top:.2rem;cursor:pointer;" />
              <div>
                <div style="font-weight:700;font-size:.82rem;color:var(--text-primary);">${c.label}</div>
                <div style="font-size:.72rem;color:var(--text-muted);">${c.desc}</div>
              </div>
            </label>
          `).join('')}
        </div>

        <div class="settings-card" style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-weight:700;font-size:.85rem;">Sayfa Başına Gösterilecek Rapor Sayısı (Pagination)</div>
            <div style="font-size:.72rem;color:var(--text-muted);">Listede tek sayfada kaç rapor listelensin?</div>
          </div>
          <select id="stagedPageSize" class="master-search-input" style="width:130px;font-weight:700;">
            <option value="25" ${stagedPrefs.pageSize === 25 ? 'selected' : ''}>25 Rapor</option>
            <option value="50" ${stagedPrefs.pageSize === 50 ? 'selected' : ''}>50 Rapor</option>
            <option value="100" ${stagedPrefs.pageSize === 100 ? 'selected' : ''}>100 Rapor</option>
            <option value="9999" ${stagedPrefs.pageSize >= 9999 ? 'selected' : ''}>Tümü (Sonsuz)</option>
          </select>
        </div>
      </div>
    `;
  },

  bind({ overlay, stagedPrefs, markDirty }) {
    stagedPrefs.visibleColumns = stagedPrefs.visibleColumns || {};

    overlay.querySelectorAll('.staged-col-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const col = e.target.dataset.col;
        stagedPrefs.visibleColumns[col] = e.target.checked;
        markDirty();
      });
    });

    overlay.querySelector('#stagedPageSize')?.addEventListener('change', (e) => {
      stagedPrefs.pageSize = parseInt(e.target.value, 10) || 25;
      markDirty();
    });
  }
};
