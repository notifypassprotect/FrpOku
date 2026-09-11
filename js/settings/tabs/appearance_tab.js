// ============================================================
//  appearance_tab.js — Görünüm, Tema, Yazı Tipi ve Ölçek Ayarları
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.appearance = {
  fontList: [
    { id: 'inter', name: 'Inter', sample: 'Rapor listesi ve sorgular', fontCss: "'Inter', sans-serif" },
    { id: 'jakarta', name: 'Plus Jakarta Sans', sample: 'Rapor listesi ve sorgular', fontCss: "'Plus Jakarta Sans', sans-serif" },
    { id: 'outfit', name: 'Outfit', sample: 'Rapor listesi ve sorgular', fontCss: "'Outfit', sans-serif" },
    { id: 'roboto', name: 'Roboto', sample: 'Rapor listesi ve sorgular', fontCss: "'Roboto', sans-serif" },
    { id: 'poppins', name: 'Poppins', sample: 'Rapor listesi ve sorgular', fontCss: "'Poppins', sans-serif" },
    { id: 'montserrat', name: 'Montserrat', sample: 'Rapor listesi ve sorgular', fontCss: "'Montserrat', sans-serif" },
    { id: 'nunito', name: 'Nunito', sample: 'Rapor listesi ve sorgular', fontCss: "'Nunito', sans-serif" },
    { id: 'raleway', name: 'Raleway', sample: 'Rapor listesi ve sorgular', fontCss: "'Raleway', sans-serif" },
    { id: 'ubuntu', name: 'Ubuntu', sample: 'Rapor listesi ve sorgular', fontCss: "'Ubuntu', sans-serif" },
    { id: 'sourcesans', name: 'Source Sans 3', sample: 'Rapor listesi ve sorgular', fontCss: "'Source Sans 3', sans-serif" },
    { id: 'opensans', name: 'Open Sans', sample: 'Rapor listesi ve sorgular', fontCss: "'Open Sans', sans-serif" },
    { id: 'jetbrains', name: 'JetBrains Mono', sample: 'SELECT * FROM rapor', fontCss: "'JetBrains Mono', monospace" },
    { id: 'fira', name: 'Fira Code', sample: 'SELECT count(1) >= 0', fontCss: "'Fira Code', monospace" },
    { id: 'cascadia', name: 'Cascadia Code', sample: 'SELECT id, adi FROM tablo', fontCss: "'Cascadia Code', monospace" },
    { id: 'system', name: 'Sistem Varsayılanı', sample: 'Segoe UI / Apple System', fontCss: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
  ],

  codeFonts: [
    { id: 'jetbrains', name: 'JetBrains Mono', sample: 'SELECT count(1) FROM rapor\nWHERE aktif = 1' },
    { id: 'fira',      name: 'Fira Code',      sample: 'SELECT * FROM musteri\nWHERE bakiye != 0' },
    { id: 'cascadia',  name: 'Cascadia Code',  sample: 'procedure RaporHazirla;\nbegin Engine.Start; end;' },
    { id: 'inconsolata', name: 'Inconsolata',  sample: 'SELECT id, unvan FROM cariler\nWHERE borc > 0' },
    { id: 'sourcecode', name: 'Source Code Pro', sample: 'SELECT k.id, k.adi FROM kullanicilar k' },
    { id: 'monaco',    name: 'Monaco / Menlo', sample: 'UPDATE rapor SET versiyon = versiyon + 1;' },
    { id: 'courierprime', name: 'Courier Prime', sample: 'CREATE TABLE raporlar (id INT PRIMARY KEY);' },
    { id: 'consolas',  name: 'Consolas', sample: 'SELECT p.id, p.adi_soyadi\nFROM personel p' }
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
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">Genel Yazı Tipi Ailesi (Popüler Fontlar)</div>
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

        <!-- Yazı Tipi Kalınlığı (Font Weight) -->
        <div class="settings-card">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">Yazı Tipi Kalınlığı (Font Weight)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:.5rem;">
            ${[
              { id: 'light', name: 'İnce (Light)', desc: 'Zarif 400', weight: '400' },
              { id: 'normal', name: 'Normal (Medium)', desc: 'Standart 500', weight: '500' },
              { id: 'bold', name: 'Kalın (Semi-Bold)', desc: 'Belirgin 600', weight: '600' },
              { id: 'extrabold', name: 'Çok Kalın (Bold)', desc: 'Güçlü 700', weight: '700' }
            ].map(w => `
              <label class="settings-radio-card ${(stagedPrefs.fontWeight || 'normal') === w.id ? 'active' : ''}">
                <input type="radio" name="stagedFontWeight" value="${w.id}" ${(stagedPrefs.fontWeight || 'normal') === w.id ? 'checked' : ''} style="display:none;" />
                <div style="font-weight:${w.weight};font-size:.84rem;">${w.name}</div>
                <div style="font-size:.68rem;color:var(--text-muted);margin-top:.15rem;">${w.desc}</div>
              </label>
            `).join('')}
          </div>
        </div>

        <!-- Arayüz & Yazı Boyutu (5 Seçenek) -->
        <div class="settings-card">
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">Arayüz & Yazı Boyutu (UI Scale)</div>
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
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">Tablo & Liste Sıkışıklığı (Density)</div>
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
          <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">Kod & SQL Editör Fontu (Önizlemeli)</div>
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
      safeToast('Koyu tema önizlemesi etkinleştirildi.', 'info');
    });

    btnLight?.addEventListener('click', () => {
      stagedPrefs.theme = 'light';
      btnLight.className = 'btn btn-sm btn-primary';
      if (btnDark) btnDark.className = 'btn btn-sm btn-ghost';
      if (window.FrpThemes && typeof window.FrpThemes.setTheme === 'function') {
        window.FrpThemes.setTheme('light');
      }
      markDirty();
      safeToast('Açık tema önizlemesi etkinleştirildi.', 'info');
    });

    overlay.querySelectorAll('input[name="stagedFontFamily"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        stagedPrefs.fontFamily = e.target.value;
        markDirty();
        const fontObj = this.fontList.find(f => f.id === e.target.value);
        if (fontObj) document.documentElement.style.setProperty('--font', fontObj.fontCss);
        
        overlay.querySelectorAll('input[name="stagedFontFamily"]').forEach(r => {
          r.closest('.settings-radio-card')?.classList.toggle('active', r.checked);
        });
      });
    });

    overlay.querySelectorAll('input[name="stagedFontWeight"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        stagedPrefs.fontWeight = e.target.value;
        markDirty();
        const weightMap = {
          'light':     { base: '300', bold: '500', heading: '600' },
          'normal':    { base: '400', bold: '600', heading: '700' },
          'bold':      { base: '500', bold: '700', heading: '800' },
          'extrabold': { base: '600', bold: '800', heading: '900' }
        };
        const fwConfig = weightMap[e.target.value] || weightMap['normal'];
        document.documentElement.style.setProperty('--base-weight', fwConfig.base);
        document.documentElement.style.setProperty('--bold-weight', fwConfig.bold);
        document.documentElement.style.setProperty('--heading-weight', fwConfig.heading);
        document.documentElement.style.setProperty('--report-title-weight', fwConfig.bold);
        if (document.body) document.body.style.fontWeight = fwConfig.base;
        
        overlay.querySelectorAll('input[name="stagedFontWeight"]').forEach(r => {
          r.closest('.settings-radio-card')?.classList.toggle('active', r.checked);
        });
      });
    });

    overlay.querySelectorAll('input[name="stagedFontSize"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        stagedPrefs.fontSize = e.target.value;
        const fontSizeMap = { micro: '13px', compact: '14px', normal: '15px', spacious: '16px', large: '17px' };
        document.documentElement.setAttribute('data-ui-scale', e.target.value);
        if (fontSizeMap[e.target.value]) document.documentElement.style.setProperty('--font-size-base', fontSizeMap[e.target.value]);
        overlay.querySelectorAll('input[name="stagedFontSize"]').forEach(r => {
          r.closest('.settings-radio-card')?.classList.toggle('active', r.checked);
        });
        markDirty();
      });
    });

    overlay.querySelectorAll('input[name="stagedDensity"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const dVal = e.target.value;
        stagedPrefs.density = dVal;
        document.documentElement.setAttribute('data-density', dVal);
        if (document.body) document.body.setAttribute('data-density', dVal);
        if (dVal === 'minimal') {
          document.documentElement.style.setProperty('--row-height', '24px');
          document.documentElement.style.setProperty('--cell-padding', '2px 6px');
        } else if (dVal === 'compact') {
          document.documentElement.style.setProperty('--row-height', '30px');
          document.documentElement.style.setProperty('--cell-padding', '5px 8px');
        } else if (dVal === 'comfortable') {
          document.documentElement.style.setProperty('--row-height', '48px');
          document.documentElement.style.setProperty('--cell-padding', '12px 14px');
        } else {
          document.documentElement.style.setProperty('--row-height', '38px');
          document.documentElement.style.setProperty('--cell-padding', '8px 10px');
        }
        overlay.querySelectorAll('input[name="stagedDensity"]').forEach(r => {
          r.closest('.settings-radio-card')?.classList.toggle('active', r.checked);
        });
        markDirty();
      });
    });

    overlay.querySelectorAll('input[name="stagedCodeFont"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        stagedPrefs.codeFont = e.target.value;
        const codeFontMap = {
          'jetbrains': "'JetBrains Mono', monospace",
          'fira': "'Fira Code', monospace",
          'cascadia': "'Cascadia Code', monospace",
          'inconsolata': "'Inconsolata', monospace",
          'sourcecode': "'Source Code Pro', monospace",
          'monaco': "'Monaco', 'Menlo', monospace",
          'courierprime': "'Courier Prime', monospace",
          'consolas': "'Consolas', monospace"
        };
        if (codeFontMap[e.target.value]) document.documentElement.style.setProperty('--mono', codeFontMap[e.target.value]);
        overlay.querySelectorAll('input[name="stagedCodeFont"]').forEach(r => {
          r.closest('.settings-radio-card')?.classList.toggle('active', r.checked);
        });
        markDirty();
      });
    });
  }
};
