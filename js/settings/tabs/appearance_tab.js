// ============================================================
//  appearance_tab.js — Görünüm, Tema, Yazı Tipi ve Ölçek Ayarları
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.appearance = {
  fontList: [
    { id: 'inter', name: 'Inter (Modern & Temiz)', sample: 'Rapor listesi ve sorgular', fontCss: "'Inter', sans-serif" },
    { id: 'jakarta', name: 'Plus Jakarta Sans (Zarif)', sample: 'Rapor listesi ve sorgular', fontCss: "'Plus Jakarta Sans', sans-serif" },
    { id: 'outfit', name: 'Outfit (Ferah & Yuvarlak)', sample: 'Rapor listesi ve sorgular', fontCss: "'Outfit', sans-serif" },
    { id: 'roboto', name: 'Roboto (Klasik Okunaklı)', sample: 'Rapor listesi ve sorgular', fontCss: "'Roboto', sans-serif" },
    { id: 'poppins', name: 'Poppins (Geometrik Şık)', sample: 'Rapor listesi ve sorgular', fontCss: "'Poppins', sans-serif" },
    { id: 'montserrat', name: 'Montserrat (Modern & Güçlü)', sample: 'Rapor listesi ve sorgular', fontCss: "'Montserrat', sans-serif" },
    { id: 'nunito', name: 'Nunito (Yumuşak & Dostane)', sample: 'Rapor listesi ve sorgular', fontCss: "'Nunito', sans-serif" },
    { id: 'raleway', name: 'Raleway (Zarif & Prestijli)', sample: 'Rapor listesi ve sorgular', fontCss: "'Raleway', sans-serif" },
    { id: 'ubuntu', name: 'Ubuntu (Dinamik & Açık)', sample: 'Rapor listesi ve sorgular', fontCss: "'Ubuntu', sans-serif" },
    { id: 'sourcesans', name: 'Source Sans 3 (Kurumsal Standart)', sample: 'Rapor listesi ve sorgular', fontCss: "'Source Sans 3', sans-serif" },
    { id: 'opensans', name: 'Open Sans (Dengeli Nötr)', sample: 'Rapor listesi ve sorgular', fontCss: "'Open Sans', sans-serif" },
    { id: 'jetbrains', name: 'JetBrains Mono (Geliştirici)', sample: 'SELECT * FROM rapor', fontCss: "'JetBrains Mono', monospace" },
    { id: 'fira', name: 'Fira Code (Ligatürlü)', sample: 'SELECT count(1) >= 0', fontCss: "'Fira Code', monospace" },
    { id: 'cascadia', name: 'Cascadia Code (Terminal)', sample: 'SELECT id, adi FROM tablo', fontCss: "'Cascadia Code', monospace" },
    { id: 'system', name: 'Sistem Varsayılanı (Native OS)', sample: 'Segoe UI / Apple System', fontCss: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
  ],

  codeFonts: [
    { id: 'jetbrains', name: 'JetBrains Mono (Gelişmiş)', sample: 'SELECT count(1) FROM rapor\nWHERE aktif = 1' },
    { id: 'fira',      name: 'Fira Code (Ligatürlü)',      sample: 'SELECT * FROM musteri\nWHERE bakiye != 0' },
    { id: 'cascadia',  name: 'Cascadia Code (Modern)',  sample: 'procedure RaporHazirla;\nbegin Engine.Start; end;' },
    { id: 'inconsolata', name: 'Inconsolata (Net)',      sample: 'SELECT id, unvan FROM cariler\nWHERE borc > 0' },
    { id: 'sourcecode', name: 'Source Code Pro (Adobe)', sample: 'SELECT k.id, k.adi FROM kullanicilar k' },
    { id: 'monaco',    name: 'Monaco / Menlo (Terminal)', sample: 'UPDATE rapor SET versiyon = versiyon + 1;' },
    { id: 'courierprime', name: 'Courier Prime (Klasik)', sample: 'CREATE TABLE raporlar (id INT PRIMARY KEY);' },
    { id: 'consolas',  name: 'Consolas (Windows Standart)', sample: 'SELECT p.id, p.adi_soyadi\nFROM personel p' }
  ],

  render({ stagedPrefs }) {
    const isDark = stagedPrefs.theme === 'dark';

    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">Görünüm & Tipografi Tercihleri</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
            Yazı tipi ailesi, arayüz boyutu ve tema seçimlerinizi belirleyin.
          </div>
        </div>

        <!-- Tema Seçimi -->
        <div class="settings-card">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">Arayüz Teması</div>
          <div style="display:flex;gap:.75rem;">
            <button type="button" class="btn btn-sm ${isDark ? 'btn-primary' : 'btn-ghost'}" id="btnStagedThemeDark" style="flex:1;padding:.55rem;font-weight:700;">
              Koyu Tema (Dark)
            </button>
            <button type="button" class="btn btn-sm ${!isDark ? 'btn-primary' : 'btn-ghost'}" id="btnStagedThemeLight" style="flex:1;padding:.55rem;font-weight:700;">
              Açık Tema (Light)
            </button>
          </div>
        </div>

        <!-- 15 Popüler Yazı Tipi Ailesi -->
        <div class="settings-card">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">🔤 Genel Yazı Tipi Ailesi (Popüler Fontlar)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:.65rem;">
            ${this.fontList.map(f => `
              <label class="settings-radio-card ${stagedPrefs.fontFamily === f.id ? 'active' : ''}" style="font-family:${f.fontCss};">
                <input type="radio" name="stagedFontFamily" value="${f.id}" ${stagedPrefs.fontFamily === f.id ? 'checked' : ''} style="display:none;" />
                <div style="font-weight:700;font-size:.84rem;">${f.name}</div>
                <div style="font-size:.72rem;color:var(--text-muted);margin-top:.2rem;">${f.sample}</div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Arayüz & Yazı Boyutu (5 Seçenek) -->
        <div class="settings-card">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">🔍 Arayüz & Yazı Boyutu (UI Scale)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:.5rem;">
            ${[
              { id: 'micro', name: 'Mikro (%75)', desc: 'Ultra Kompakt' },
              { id: 'compact', name: 'Kompakt (%85)', desc: 'Küçük ekranlar' },
              { id: 'normal', name: 'Standart (%100)', desc: 'Varsayılan' },
              { id: 'spacious', name: 'Geniş (%115)', desc: 'Rahat okuma' },
              { id: 'large', name: 'Büyük (%130)', desc: 'Büyük ekran' }
            ].map(s => `
              <label class="settings-radio-card ${stagedPrefs.fontSize === s.id ? 'active' : ''}">
                <input type="radio" name="stagedFontSize" value="${s.id}" ${stagedPrefs.fontSize === s.id ? 'checked' : ''} style="display:none;" />
                <div style="font-weight:700;font-size:.8rem;">${s.name}</div>
                <div style="font-size:.68rem;color:var(--text-muted);margin-top:.15rem;">${s.desc}</div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Tablo / Liste Sıkışıklığı (Density) - 4 Seviye -->
        <div class="settings-card">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">📏 Tablo & Liste Sıkışıklığı (Density)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:.5rem;">
            ${[
              { id: 'comfortable', name: 'Rahat (Geniş)', desc: 'Ferah satır aralığı (44px)' },
              { id: 'normal',      name: 'Standart',      desc: 'Dengeli satır aralığı (36px)' },
              { id: 'compact',     name: 'Kompakt',       desc: 'Sıkışık satırlar (28px)' },
              { id: 'minimal',     name: 'Ultra Sıkışık', desc: 'Maksimum veri (22px)' }
            ].map(d => `
              <label class="settings-radio-card ${(stagedPrefs.density || 'normal') === d.id ? 'active' : ''}">
                <input type="radio" name="stagedDensity" value="${d.id}" ${(stagedPrefs.density || 'normal') === d.id ? 'checked' : ''} style="display:none;" />
                <div style="font-weight:700;font-size:.8rem;">${d.name}</div>
                <div style="font-size:.68rem;color:var(--text-muted);margin-top:.15rem;">${d.desc}</div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- SQL & Pascal Editör Fontu (Örnekli Kartlar) -->
        <div class="settings-card">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">💻 Kod & SQL Editör Fontu (Önizlemeli)</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;">
            ${this.codeFonts.map(cf => `
              <label class="settings-radio-card ${stagedPrefs.codeFont === cf.id ? 'active' : ''}" style="font-family:var(--mono);">
                <input type="radio" name="stagedCodeFont" value="${cf.id}" ${stagedPrefs.codeFont === cf.id ? 'checked' : ''} style="display:none;" />
                <div style="font-weight:700;font-size:.84rem;color:var(--accent);">${cf.name}</div>
                <pre style="margin:.3rem 0 0;font-size:.7rem;color:var(--text-secondary);background:var(--bg-surface);padding:.35rem .5rem;border-radius:6px;border:1px solid var(--border-light);line-height:1.35;">${cf.sample}</pre>
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  bind({ overlay, stagedPrefs, markDirty, safeToast }) {
    const btnDark = overlay.querySelector('#btnStagedThemeDark');
    const btnLight = overlay.querySelector('#btnStagedThemeLight');

    btnDark?.addEventListener('click', () => {
      stagedPrefs.theme = 'dark';
      btnDark.className = 'btn btn-sm btn-primary';
      if (btnLight) btnLight.className = 'btn btn-sm btn-ghost';
      if (window.FrpThemes && typeof window.FrpThemes.setTheme === 'function') {
        window.FrpThemes.setTheme('dark');
      }
      markDirty();
    });

    btnLight?.addEventListener('click', () => {
      stagedPrefs.theme = 'light';
      btnLight.className = 'btn btn-sm btn-primary';
      if (btnDark) btnDark.className = 'btn btn-sm btn-ghost';
      if (window.FrpThemes && typeof window.FrpThemes.setTheme === 'function') {
        window.FrpThemes.setTheme('light');
      }
      markDirty();
    });

    overlay.querySelectorAll('input[name="stagedFontFamily"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        stagedPrefs.fontFamily = e.target.value;
        overlay.querySelectorAll('input[name="stagedFontFamily"]').forEach(r => {
          r.parentElement?.classList.toggle('active', r.checked);
        });
        markDirty();
      });
    });

    overlay.querySelectorAll('input[name="stagedFontSize"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        stagedPrefs.fontSize = e.target.value;
        overlay.querySelectorAll('input[name="stagedFontSize"]').forEach(r => {
          r.parentElement?.classList.toggle('active', r.checked);
        });
        markDirty();
      });
    });

    overlay.querySelectorAll('input[name="stagedDensity"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        stagedPrefs.density = e.target.value;
        overlay.querySelectorAll('input[name="stagedDensity"]').forEach(r => {
          r.parentElement?.classList.toggle('active', r.checked);
        });
        markDirty();
      });
    });

    overlay.querySelectorAll('input[name="stagedCodeFont"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        stagedPrefs.codeFont = e.target.value;
        overlay.querySelectorAll('input[name="stagedCodeFont"]').forEach(r => {
          r.parentElement?.classList.toggle('active', r.checked);
        });
        markDirty();
      });
    });
  }
};
