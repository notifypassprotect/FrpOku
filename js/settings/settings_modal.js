// ============================================================
//  settings.js — FrpOku Ayarlar & Kullanıcı Yönetimi Merkezi v4
//  Sıfır Tarayıcı Uyarısı (Tam Özel Modallar), Özel Etiket Yönetimi,
//  Ayrı Dosya Boyutu Sütunu, Temiz Kullanıcı Profili
// ============================================================

// ── MODERN CAM EFEKTLİ DİYALOG MOTORLARI (SIFIR NATIVE ALERT/CONFIRM) ──
window.showConfirmDialog = function({
  title = 'İşlemi Onaylayın',
  message = '',
  confirmText = 'Evet, Onayla',
  cancelText = 'İptal',
  isDanger = false,
  onConfirm = () => {},
  onCancel = () => {}
}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '999999';

  overlay.innerHTML = `
    <div class="modal" style="max-width:450px;width:92vw;padding:1.6rem;text-align:center;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.4);border:1px solid var(--border);background:var(--bg-surface);animation:fadeIn .18s ease-out;">
      <div style="font-size:2.5rem;margin-bottom:.5rem;">${isDanger ? '🚨' : '❓'}</div>
      <div style="font-size:1.12rem;font-weight:800;color:var(--text-primary);margin-bottom:.4rem;">${title}</div>
      <div style="font-size:.83rem;color:var(--text-secondary);line-height:1.5;margin-bottom:1.4rem;">${message}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:.75rem;">
        <button type="button" class="btn btn-sm btn-ghost btn-cancel-confirm" style="padding:.5rem 1.25rem;font-weight:700;">
          ${cancelText}
        </button>
        <button type="button" class="btn btn-sm ${isDanger ? 'btn-danger' : 'btn-primary'} btn-ok-confirm" style="padding:.5rem 1.5rem;font-weight:800;box-shadow:${isDanger ? '0 4px 14px rgba(239,68,68,.35)' : '0 4px 14px rgba(37,99,235,.35)'};">
          ${confirmText}
        </button>
      </div>
    </div>
  `;

  overlay.querySelector('.btn-cancel-confirm').addEventListener('click', () => {
    overlay.remove();
    if (typeof onCancel === 'function') onCancel();
  });

  overlay.querySelector('.btn-ok-confirm').addEventListener('click', () => {
    overlay.remove();
    if (typeof onConfirm === 'function') onConfirm();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (typeof onCancel === 'function') onCancel();
    }
  });

  document.body.appendChild(overlay);
};

window.showPromptDialog = function({
  title = 'Bilgi Girin',
  message = '',
  defaultValue = '',
  placeholder = '',
  confirmText = 'Kaydet',
  cancelText = 'İptal',
  onConfirm = (val) => {}
}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '999999';

  overlay.innerHTML = `
    <div class="modal" style="max-width:440px;width:90vw;padding:1.5rem;text-align:left;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.4);border:1px solid var(--border);background:var(--bg-surface);animation:fadeIn .18s ease-out;">
      <div style="font-size:1.08rem;font-weight:800;color:var(--text-primary);margin-bottom:.3rem;">${title}</div>
      ${message ? `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.8rem;">${message}</div>` : ''}
      <div style="margin-bottom:1.2rem;">
        <input type="text" id="customPromptInput" class="master-search-input" style="width:100%;font-size:.88rem;" value="${defaultValue}" placeholder="${placeholder}" />
      </div>
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:.65rem;">
        <button type="button" class="btn btn-sm btn-ghost btn-cancel-prompt" style="padding:.45rem 1rem;font-weight:700;">
          ${cancelText}
        </button>
        <button type="button" class="btn btn-sm btn-primary btn-ok-prompt" style="padding:.45rem 1.35rem;font-weight:800;">
          ${confirmText}
        </button>
      </div>
    </div>
  `;

  const input = overlay.querySelector('#customPromptInput');
  const doSubmit = () => {
    const val = input.value;
    overlay.remove();
    if (typeof onConfirm === 'function') onConfirm(val);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSubmit();
    }
  });

  overlay.querySelector('.btn-cancel-prompt').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-ok-prompt').addEventListener('click', doSubmit);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 50);
};

window.openSettingsModal = function(initialTab = 'appearance') {
  let activeTab = initialTab;
  
  // Taslak (Staged) Ayarlar — "Tüm Değişiklikleri Kaydet" basılana kadar izole tutulur
  const livePrefs = FrpStore.getPreferences();
  let stagedPrefs = {
    ...livePrefs,
    visibleColumns: {
      reportName: true,
      fileName: true,
      fileSize: true,
      category: true,
      guid: true,
      tags: true,
      queries: false,
      date: true,
      ...(livePrefs.visibleColumns || {})
    },
    theme: FrpStore.getTheme() || 'dark'
  };

  const liveProfile = FrpStore.getUserProfile();
  let stagedProfile = {
    ...liveProfile,
    firstName: liveProfile.firstName || '',
    lastName: liveProfile.lastName || '',
    username: liveProfile.username || '',
    phone: liveProfile.phone || '',
    email: liveProfile.email || ''
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '99999';

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderModal() {
    const categories = FrpStore.getCategoryObjects();
    const customTags = FrpStore.getCustomTags();
    const trashItems = FrpStore.getTrash();
    const files = FrpStore.getAll();
    const isDark = stagedPrefs.theme === 'dark';
    const stats = FrpStore.getStats() || { total: files.length, queries: 0, storageFormatted: '0 MB' };

    // 7 Sekme Tanımı
    const tabs = [
      { id: 'appearance', icon: '🎨', label: 'Görünüm & Yazı Tipi' },
      { id: 'profile',    icon: '👤', label: 'Kullanıcı & Cihaz Profili' },
      { id: 'categories', icon: '🏷️', label: `Kategoriler & Etiketler` },
      { id: 'columns',    icon: '👁️', label: 'Sütun & Tablo' },
      { id: 'shortcuts',  icon: '⌨️', label: 'Klavye Kısayolları' },
      { id: 'trash',      icon: '🗑️', label: `Çöp Kutusu (${trashItems.length})` },
      { id: 'storage',    icon: '💾', label: 'Yedekleme & Depolama' }
    ];

    const tabButtonsHtml = tabs.map(t => `
      <button type="button" class="settings-nav-btn ${t.id === activeTab ? 'active' : ''}" data-tab="${t.id}">
        <span style="font-size:1.05rem;">${t.icon}</span>
        <span>${t.label}</span>
      </button>
    `).join('');

    let tabContentHtml = '';

    // ── 1. GÖRÜNÜM & YAZI TİPİ ────────────────────────────────
    if (activeTab === 'appearance') {
      const fontList = [
        { id: 'inter', name: 'Inter (Modern & Temiz)', sample: 'Rapor listesi ve sorgular', fontCss: "'Inter', sans-serif" },
        { id: 'jakarta', name: 'Plus Jakarta Sans (Zarif)', sample: 'Rapor listesi ve sorgular', fontCss: "'Plus Jakarta Sans', sans-serif" },
        { id: 'outfit', name: 'Outfit (Ferah & Yuvarlak)', sample: 'Rapor listesi ve sorgular', fontCss: "'Outfit', sans-serif" },
        { id: 'roboto', name: 'Roboto (Klasik Okunaklı)', sample: 'Rapor listesi ve sorgular', fontCss: "'Roboto', sans-serif" },
        { id: 'poppins', name: 'Poppins (Geometrik Şık)', sample: 'Rapor listesi ve sorgular', fontCss: "'Poppins', sans-serif" },
        { id: 'opensans', name: 'Open Sans (Dengeli Nötr)', sample: 'Rapor listesi ve sorgular', fontCss: "'Open Sans', sans-serif" },
        { id: 'jetbrains', name: 'JetBrains Mono (Geliştirici)', sample: 'SELECT * FROM rapor', fontCss: "'JetBrains Mono', monospace" },
        { id: 'fira', name: 'Fira Code (Ligatürlü)', sample: 'SELECT count(1) >= 0', fontCss: "'Fira Code', monospace" },
        { id: 'cascadia', name: 'Cascadia Code (Terminal)', sample: 'SELECT id, adi FROM tablo', fontCss: "'Cascadia Code', monospace" },
        { id: 'system', name: 'Sistem Varsayılanı (Native OS)', sample: 'Segoe UI / Apple System', fontCss: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
      ];

      const codeFonts = [
        { id: 'jetbrains', name: 'JetBrains Mono', sample: 'SELECT count(1) FROM rapor\nWHERE aktif = 1' },
        { id: 'fira',      name: 'Fira Code',      sample: 'SELECT * FROM musteri\nWHERE bakiye != 0' },
        { id: 'cascadia',  name: 'Cascadia Code',  sample: 'procedure RaporHazirla;\nbegin Engine.Start; end;' },
        { id: 'consolas',  name: 'Consolas',       sample: 'SELECT p.id, p.adi_soyadi\nFROM personel p' }
      ];

      tabContentHtml = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">🎨 Görünüm & Tipografi Tercihleri</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
              Yazı tipi ailesi, arayüz boyutu ve tema seçimlerinizi belirleyin (Değişiklikler kaydet butonuna basıldığında uygulanır).
            </div>
          </div>

          <!-- Tema Seçimi -->
          <div class="settings-card">
            <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">🌓 Arayüz Teması</div>
            <div style="display:flex;gap:.75rem;">
              <button type="button" class="btn btn-sm ${isDark ? 'btn-primary' : 'btn-ghost'}" id="btnStagedThemeDark" style="flex:1;padding:.55rem;font-weight:700;">
                🌙 Koyu Tema (Dark)
              </button>
              <button type="button" class="btn btn-sm ${!isDark ? 'btn-primary' : 'btn-ghost'}" id="btnStagedThemeLight" style="flex:1;padding:.55rem;font-weight:700;">
                ☀️ Açık Tema (Light)
              </button>
            </div>
          </div>

          <!-- 10 Popüler Yazı Tipi Ailesi -->
          <div class="settings-card">
            <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">🔤 Genel Yazı Tipi Ailesi (10 Popüler Font)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;">
              ${fontList.map(f => `
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
              ${codeFonts.map(cf => `
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
    }

    // ── 2. KULLANICI & CİHAZ PROFİLİ (Temiz Gerçek Form) ──────
    else if (activeTab === 'profile') {
      tabContentHtml = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">👤 Kullanıcı & Cihaz Profili</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
              Oturum güvenliği, yetkilendirme ve sunucu ortamı için kayıtlı profil bilgileri.
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            
            <!-- Sol Kart: Kullanıcı Profili (Boş gerçek form) -->
            <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
              <div style="font-weight:800;font-size:.88rem;color:var(--text-primary);border-bottom:1px solid var(--border-light);padding-bottom:.4rem;">
                Kullanıcı Profili
                <div style="font-size:.72rem;color:var(--text-muted);font-weight:normal;margin-top:.1rem;">Hesabınız için temel iletişim bilgileri</div>
              </div>

              <div>
                <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">Adınız</label>
                <input type="text" id="profFirstName" class="master-search-input" style="width:100%;" value="${escHtml(stagedProfile.firstName || '')}" />
              </div>

              <div>
                <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">Soyadınız</label>
                <input type="text" id="profLastName" class="master-search-input" style="width:100%;" value="${escHtml(stagedProfile.lastName || '')}" />
              </div>

              <div>
                <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">Kullanıcı Adı / Sicil No</label>
                <input type="text" id="profUsername" class="master-search-input" style="width:100%;" value="${escHtml(stagedProfile.username || '')}" />
              </div>

              <div>
                <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">Telefon Numarası</label>
                <input type="text" id="profPhone" class="master-search-input" style="width:100%;" value="${escHtml(stagedProfile.phone || '')}" />
              </div>

              <div>
                <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">E-Posta Adresiniz</label>
                <input type="email" id="profEmail" class="master-search-input" style="width:100%;" value="${escHtml(stagedProfile.email || '')}" />
              </div>

              <div>
                <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">Hesap Oluşturulma Tarihi</label>
                <input type="text" class="master-search-input" style="width:100%;background:rgba(0,0,0,.03);cursor:not-allowed;" value="${escHtml(stagedProfile.accountCreatedDate || '01.05.2026 18:55')}" readonly />
              </div>
            </div>

            <!-- Sağ Kart: Tarayıcı ve Sistem Çalışma Ortamı -->
            ${(() => {
              const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
              
              let browser = 'Modern Web Tarayıcı';
              const edgeM = ua.match(/edg\/([\d.]+)/i);
              const chromeM = ua.match(/chrome\/([\d.]+)/i);
              const ffM = ua.match(/firefox\/([\d.]+)/i);
              const operaM = ua.match(/(?:opr|opera)\/([\d.]+)/i);
              const safariM = ua.match(/version\/([\d.]+).*safari/i);

              if (edgeM) browser = `Microsoft Edge (v${edgeM[1].split('.')[0]} · Chromium)`;
              else if (operaM) browser = `Opera (v${operaM[1].split('.')[0]})`;
              else if (chromeM) browser = `Google Chrome (v${chromeM[1].split('.')[0]} · V8)`;
              else if (ffM) browser = `Mozilla Firefox (v${ffM[1].split('.')[0]} · Gecko)`;
              else if (safariM) browser = `Apple Safari (v${safariM[1].split('.')[0]} · WebKit)`;

              let os = 'Masaüstü İşletim Sistemi';
              if (/windows nt 10\.0/i.test(ua)) os = 'Windows 10 / 11 (64-bit)';
              else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1 (64-bit)';
              else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7 (64-bit)';
              else if (/windows/i.test(ua)) os = 'Windows OS (x64)';
              else if (/macintosh|mac os x/i.test(ua)) os = 'macOS (Apple Silicon / Intel)';
              else if (/linux/i.test(ua)) os = 'Linux OS (Desktop)';

              const w = typeof window !== 'undefined' && window.screen ? window.screen.width : 1920;
              const h = typeof window !== 'undefined' && window.screen ? window.screen.height : 1080;
              const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? Math.round(window.devicePixelRatio * 100) : 100;
              let resLabel = '';
              if (w >= 3840) resLabel = '4K UHD';
              else if (w >= 2560) resLabel = '2K QHD';
              else if (w >= 1920) resLabel = 'FHD';
              const resolution = `${w} x ${h} ${resLabel ? `(${resLabel})` : ''} · @${dpr}% DPR`;

              const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Mantıksal CPU Çekirdeği` : 'Çok Çekirdekli CPU';
              
              let storageFormatted = '1.4 MB';
              try {
                const totalBytes = new Blob([JSON.stringify(localStorage || {})]).size;
                storageFormatted = totalBytes > 1024 * 1024 ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.round(totalBytes / 1024)} KB`;
              } catch {}

              const protocol = typeof window !== 'undefined' ? (window.location.protocol.replace(':', '').toUpperCase()) : 'HTTP';
              const host = typeof window !== 'undefined' ? (window.location.host || 'localhost:3000') : 'localhost:3000';
              let tz = 'Europe/Istanbul';
              try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul'; } catch {}

              return `
                <div class="settings-card" style="display:flex;flex-direction:column;gap:.85rem;">
                  <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-light);padding-bottom:.5rem;">
                    <div>
                      <div style="font-weight:800;font-size:.88rem;color:var(--text-primary);display:flex;align-items:center;gap:.4rem;">
                        🖥️ İstemci & Sistem Ortamı
                      </div>
                      <div style="font-size:.72rem;color:var(--text-muted);margin-top:.1rem;">Gerçek zamanlı tarayıcı, ekran ve sunucu parametreleri</div>
                    </div>
                    <span class="badge badge-green" style="font-size:.72rem;padding:.2rem .6rem;">🟢 Aktif &amp; Hazır</span>
                  </div>

                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;">
                    
                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">🌐 Tarayıcı &amp; Motor</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(browser)}</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">💻 İşletim Sistemi</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(os)}</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">🖥️ Ekran &amp; Çözünürlük</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--accent);margin-top:.15rem;font-family:var(--mono);">${escHtml(resolution)}</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">⚡ CPU / Donanım İş Parçacığı</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(cores)}</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">💾 Yerel Veri Depolama (Store)</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(storageFormatted)} / LocalStorage + JSON</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">🚀 Sunucu Modu &amp; Port</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;font-family:var(--mono);">${escHtml(protocol)} · ${escHtml(host)}</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">🌍 Dil &amp; Saat Dilimi</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${typeof navigator !== 'undefined' ? navigator.language : 'tr-TR'} · ${escHtml(tz)}</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">🛡️ Uygulama Sürümü</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">FrpOku v2.4 Enterprise</div>
                    </div>

                  </div>

                  <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-raised);padding:.55rem .85rem;border-radius:8px;font-size:.75rem;border:1px solid var(--border-light);margin-top:.2rem;">
                    <div style="color:var(--text-secondary);font-weight:600;">Bağlantı &amp; Çalışma Durumu:</div>
                    <div style="font-weight:800;color:var(--accent);">${typeof navigator !== 'undefined' && navigator.onLine ? '🟢 Çevrimiçi · Kesintisiz Yerel Oturum' : '⚪ Çevrimdışı Mod'}</div>
                  </div>

                </div>
              `;
            })()}

          </div>
        </div>
      `;
    }

    // ── 3. KATEGORİLER & ÖZEL ETİKETLER ───────────────────────
    else if (activeTab === 'categories') {
      const catListHtml = categories.map(cat => {
        const count = files.filter(f => (f.category || '').toLowerCase() === cat.name.toLowerCase()).length;
        return `
          <div class="cat-manage-row" style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:var(--bg-surface);border:1px solid var(--border-light);border-radius:12px;gap:.75rem;">
            <div style="display:flex;align-items:center;gap:.75rem;">
              <span style="font-size:1.4rem;">${cat.icon || '🏷️'}</span>
              <div>
                <div style="font-weight:800;font-size:.88rem;color:var(--text-primary);">${escHtml(cat.name)}</div>
                <div style="font-size:.72rem;color:var(--text-muted);margin-top:.1rem;">${count} rapora atanmış</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:.5rem;">
              <span style="width:16px;height:16px;border-radius:50%;background:${cat.color || '#3b82f6'};display:inline-block;"></span>
              <button type="button" class="btn btn-sm btn-ghost btn-edit-cat" data-name="${escHtml(cat.name)}" data-color="${cat.color || '#3b82f6'}" data-icon="${cat.icon || '🏷️'}" title="Kategoriyi Düzenle" style="padding:.35rem .6rem;">✏️</button>
              <button type="button" class="btn btn-sm btn-ghost btn-delete-cat" data-name="${escHtml(cat.name)}" style="color:#ef4444;padding:.35rem .6rem;" title="Kategoriyi Sil">🗑️</button>
            </div>
          </div>
        `;
      }).join('');

      const customTagsHtml = customTags.map(tag => `
        <div style="display:inline-flex;align-items:center;gap:.4rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:20px;padding:.25rem .75rem;font-size:.78rem;font-weight:700;">
          <span>🏷️ ${escHtml(tag)}</span>
          <button type="button" class="btn-delete-custom-tag" data-tag="${escHtml(tag)}" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:.85rem;padding:0;line-height:1;" title="Etiketi Sil">✕</button>
        </div>
      `).join('');

      tabContentHtml = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">🏷️ Kategori & Özel Etiket Yönetimi</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
              Rapor havuzunuz için kategori ve özel kullanıcı etiketlerini tanımlayın.
            </div>
          </div>

          <!-- Kategori Ekleme Formu -->
          <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
            <div style="font-weight:700;font-size:.85rem;">➕ Yeni Kategori Oluştur</div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">
              <input type="text" id="newCatName" class="master-search-input" style="flex:1;min-width:180px;" placeholder="Kategori adı girin..." />
              <input type="color" id="newCatColor" value="#3b82f6" style="width:38px;height:38px;border:none;border-radius:8px;cursor:pointer;background:none;" title="Kategori Rengi" />
              <select id="newCatIcon" class="master-search-input" style="width:95px;">
                <option value="🏷️">🏷️ Etiket</option>
                <option value="💰">💰 Finans</option>
                <option value="🏥">🏥 Klinik</option>
                <option value="📊">📊 İstatistik</option>
                <option value="🔬">🔬 Lab</option>
                <option value="📦">📦 Stok</option>
                <option value="👥">👥 Personel</option>
                <option value="⚡">⚡ Sistem</option>
              </select>
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
              <button type="button" class="btn btn-sm btn-primary" id="btnSaveNewCustomTag" style="font-weight:700;padding:.5rem 1rem;">➕ Etiket Ekle</button>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.4rem;">
              ${customTagsHtml || '<span style="font-size:.76rem;color:var(--text-muted);">Henüz özel etiket eklenmemiş.</span>'}
            </div>
          </div>

        </div>
      `;
    }

    // ── 4. SÜTUN & TABLO TERCİHLERİ (Dosya Boyutu Dahil) ─────
    else if (activeTab === 'columns') {
      const cols = stagedPrefs.visibleColumns || {};
      const columnDefs = [
        { id: 'reportName', label: 'Rapor Başlığı',              desc: 'Raporun ana başlığı' },
        { id: 'fileName',   label: 'Dosya Adı (.frp)',           desc: 'Raporun disk üzerindeki orijinal dosya adı' },
        { id: 'fileSize',   label: 'Dosya Boyutu (KB / MB)',      desc: 'Fiziksel .frp dosyasının disk üzerindeki boyutu' },
        { id: 'category',   label: 'Kategori Etiketi',           desc: 'Rapora atanmış renkli kategori rozeti' },
        { id: 'guid',       label: 'GUID (Benzersiz Kimlik)',    desc: 'FastReport raporunun 36 haneli benzersiz GUID kodu' },
        { id: 'tags',       label: 'Etiketler (Tags)',           desc: 'Otomatik ve özel departman etiketleri' },
        { id: 'queries',    label: 'SQL Sorguları Rozeti',       desc: 'İçerdiği SQL sorgu adedi rozeti' },
        { id: 'date',       label: 'Yüklenme / Değiştirilme Tarihi', desc: 'Raporun sisteme eklenme tarihi' }
      ];

      tabContentHtml = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">👁️ Liste & Sütun Görünürlüğü</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
              Ana sayfadaki rapor listesinde görmek istediğiniz sütunları ve sayfalama limitini ayarlayın.
            </div>
          </div>

          <div class="settings-card" style="display:flex;flex-direction:column;gap:.6rem;">
            <div style="font-weight:700;font-size:.85rem;margin-bottom:.2rem;">Tablo Sütunları</div>
            ${columnDefs.map(c => `
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
    }

    // ── 5. KLAVYE KISAYOLLARI ─────────────────────────────────
    else if (activeTab === 'shortcuts') {
      const shortcutsList = [
        { key: 'Ctrl + F', desc: 'Raporlar ve sorgularda anında ara' },
        { key: 'Ctrl + E', desc: 'Tüm rapor listesini Excel (CSV) olarak dışa aktar' },
        { key: 'Ctrl + R', desc: 'Editörde seçili ifadeyi değiştir (Replace)' },
        { key: 'Ctrl + ,', desc: 'Ayarlar & Kullanıcı Yönetimi penceresini aç' },
        { key: 'Alt + N / Ctrl + I', desc: 'Yeni .frp rapor dosyası ekle' },
        { key: 'Ctrl + M', desc: 'Komut Paletini aç (Hızlı Menü)' },
        { key: 'ESC',      desc: 'Açık modal pencereleri veya aramayı kapat' },
        { key: 'F6',       desc: 'Görünüm modunu değiştir (Tablo / Kartlar / Zaman Tüneli)' },
        { key: 'F7',       desc: '🧠 SQL Karmaşıklık & Anti-Pattern Analizini aç' },
        { key: 'F8',       desc: 'Seçili raporlar için Karşılaştırma (Diff) modunu aç' }
      ];

      tabContentHtml = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">⌨️ Klavye Kısayolları</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
              FrpOku içerisinde işinizi hızlandıracak tüm klavye kısayolları.
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:.5rem;">
            ${shortcutsList.map(s => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:.7rem 1rem;background:var(--bg-surface);border:1px solid var(--border-light);border-radius:10px;">
                <span class="badge" style="font-family:var(--mono);font-size:.78rem;padding:.3rem .65rem;background:var(--bg-raised);border:1px solid var(--border);color:var(--accent);font-weight:700;">
                  ${s.key}
                </span>
                <span style="font-size:.82rem;color:var(--text-secondary);font-weight:600;">${s.desc}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // ── 6. GERİ DÖNÜŞÜM KUTUSU (TRASH) ────────────────────────
    else if (activeTab === 'trash') {
      const trashRowsHtml = trashItems.map(item => {
        const delDate = item.deletedAt ? new Date(item.deletedAt).toLocaleString('tr-TR') : 'Bilinmiyor';
        const qCount = Array.isArray(item.queries) ? item.queries.length : 0;
        return `
          <div class="trash-item-row" style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;background:var(--bg-surface);border:1.5px solid var(--border-light);border-radius:10px;gap:1rem;flex-wrap:wrap;transition:border-color .15s;">
            <div style="display:flex;align-items:center;gap:.75rem;min-width:0;flex:1;">
              <input type="checkbox" class="trash-item-cb" data-id="${item.id}" style="width:17px;height:17px;cursor:pointer;flex-shrink:0;" />
              <div style="min-width:0;flex:1;">
                <div style="font-weight:700;font-size:.85rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  📄 ${escHtml(item.meta?.reportName || item.name)}
                </div>
                <div style="font-size:.72rem;color:var(--text-muted);margin-top:.2rem;">
                  Dosya: ${escHtml(item.name)} · ${qCount} SQL · Silinme: <strong>${delDate}</strong>
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:.4rem;flex-shrink:0;">
              <button type="button" class="btn btn-sm btn-primary btn-restore-item" data-id="${item.id}" style="font-weight:700;padding:.3rem .75rem;">
                🔄 Geri Yükle
              </button>
              <button type="button" class="btn btn-sm btn-danger btn-purge-item" data-id="${item.id}" style="padding:.3rem .6rem;" title="Kalıcı Olarak Sil">
                ❌
              </button>
            </div>
          </div>
        `;
      }).join('');

      tabContentHtml = `
        <div style="display:flex;flex-direction:column;gap:1rem;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <div>
              <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">🗑️ Geri Dönüşüm Kutusu (${trashItems.length})</div>
              <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
                Silinen raporları tek tek ya da çoklu seçim yaparak geri yükleyebilir veya kalıcı olarak temizleyebilirsiniz.
              </div>
            </div>
            ${trashItems.length > 0 ? `
              <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-primary" id="btnRestoreSelectedTrash" style="display:none;font-weight:700;">
                  🔄 Seçilenleri Geri Yükle (<span id="trashSelectedCount">0</span>)
                </button>
                <button type="button" class="btn btn-sm btn-danger" id="btnPurgeSelectedTrash" style="display:none;font-weight:700;">
                  ❌ Seçilenleri Kalıcı Sil
                </button>
                <button type="button" class="btn btn-sm btn-ghost" id="btnEmptyTrashAll" style="font-weight:700;color:var(--red);border:1px solid rgba(239,68,68,.3);">
                  🗑️ Tümünü Boşalt
                </button>
              </div>
            ` : ''}
          </div>

          ${trashItems.length > 0 ? `
            <div style="display:flex;gap:.6rem;align-items:center;">
              <div style="flex:1;position:relative;">
                <input type="text" id="trashSearchInput" placeholder="🔍 Çöp kutusunda ara (Rapor adı, dosya adı)..." class="master-search-input" style="width:100%;font-size:.82rem;padding:.45rem .8rem;" />
              </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;background:var(--bg-raised);padding:.45rem .85rem;border-radius:8px;border:1px solid var(--border-light);font-size:.78rem;">
              <label style="display:flex;align-items:center;gap:.45rem;cursor:pointer;font-weight:700;user-select:none;color:var(--text-secondary);">
                <input type="checkbox" id="trashSelectAll" style="width:16px;height:16px;cursor:pointer;" />
                Tümünü Seç / Seçimi Kaldır
              </label>
              <span style="color:var(--text-muted);font-size:.73rem;" id="trashCountDisplay">Toplam ${trashItems.length} silinmiş rapor</span>
            </div>
          ` : ''}

          <div style="display:flex;flex-direction:column;gap:.55rem;max-height:55vh;min-height:220px;overflow-y:auto;padding-right:.3rem;" id="trashItemsList">
            ${trashRowsHtml || `
              <div style="background:var(--bg-raised);border-radius:12px;padding:3rem 1.5rem;text-align:center;color:var(--text-muted);border:1px dashed var(--border);">
                <div style="font-size:2.5rem;margin-bottom:.5rem;">🗑️</div>
                <div style="font-weight:700;font-size:.9rem;color:var(--text-primary);">Geri Dönüşüm Kutusu Boş</div>
                <div style="font-size:.78rem;margin-top:.2rem;">Silinen raporlar güvenliğiniz için burada saklanır.</div>
              </div>
            `}
          </div>
        </div>
      `;
    }

    // ── 7. YEDEKLEME & DEPOLAMA ───────────────────────────────
    else if (activeTab === 'storage') {
      tabContentHtml = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">💾 Yedekleme & Depolama Yönetimi</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
              Tüm rapor ve sorgu veritabanınızı yedekleyin, dışarı aktarın veya temizleyin.
            </div>
          </div>

          <!-- 3'lü İstatistik Kartı -->
          <div class="settings-card">
            <div style="font-weight:700;font-size:.85rem;margin-bottom:.6rem;">📊 Depolama & Veritabanı Durumu</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem;text-align:center;">
              <div style="background:var(--bg-surface);padding:.8rem .6rem;border-radius:10px;border:1px solid var(--border-light);">
                <div style="font-size:1.4rem;font-weight:800;color:var(--accent);">${stats.total !== undefined ? stats.total : files.length}</div>
                <div style="font-size:.74rem;color:var(--text-muted);font-weight:600;margin-top:.15rem;">Aktif Rapor</div>
              </div>
              <div style="background:var(--bg-surface);padding:.8rem .6rem;border-radius:10px;border:1px solid var(--border-light);">
                <div style="font-size:1.4rem;font-weight:800;color:var(--green);">${stats.queries !== undefined ? stats.queries : 0}</div>
                <div style="font-size:.74rem;color:var(--text-muted);font-weight:600;margin-top:.15rem;">SQL Sorgusu</div>
              </div>
              <div style="background:var(--bg-surface);padding:.8rem .6rem;border-radius:10px;border:1px solid var(--border-light);">
                <div style="font-size:1.4rem;font-weight:800;color:var(--purple);">${stats.storageFormatted || '0 MB'}</div>
                <div style="font-size:.74rem;color:var(--text-muted);font-weight:600;margin-top:.15rem;">Bellek Kullanımı</div>
              </div>
            </div>
          </div>

          <!-- Yedekleme Eylemleri -->
          <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
            <div style="font-weight:700;font-size:.85rem;">💾 JSON Yedekleme & İçe Aktarma</div>
            <div style="display:flex;gap:.75rem;flex-wrap:wrap;">
              <button type="button" class="btn btn-sm btn-primary" id="btnActionExportJson" style="font-weight:700;flex:1;padding:.55rem;">
                📥 Tüm Verileri JSON Olarak İndir (Yedekle)
              </button>
              <button type="button" class="btn btn-sm" id="btnActionImportJson" style="font-weight:700;flex:1;padding:.55rem;">
                📤 JSON Yedeğini Geri Yükle
              </button>
            </div>
            <input type="file" id="settingsBackupFileInput" accept=".json" style="display:none;" />
          </div>

          <!-- Tehlikeli Bölge -->
          <div style="background:rgba(239,68,68,.05);border:1.5px solid rgba(239,68,68,.3);border-radius:12px;padding:1rem 1.15rem;display:flex;flex-direction:column;gap:.6rem;">
            <div style="font-weight:800;font-size:.85rem;color:#ef4444;">🚨 Tehlikeli Bölge (Fabrika Ayarlarına Sıfırla)</div>
            <div style="font-size:.76rem;color:var(--text-secondary);line-height:1.45;">
              Tüm yüklenen raporları, kategorileri ve düzenleme geçmişini kalıcı olarak temizler. Bu işlem geri alınamaz.
            </div>
            <div>
              <button type="button" class="btn btn-sm btn-danger" id="btnActionResetAll" style="font-weight:700;">
                🗑️ Tüm Raporları & Verileri Kalıcı Olarak Temizle
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Modal Ana İskeleti & Alt Kaydet Kontrol Barı
    overlay.innerHTML = `
      <div class="modal settings-modal-box" style="max-width:1060px;width:94vw;padding:0;overflow:hidden;display:grid;grid-template-columns:250px 1fr;height:80vh;min-height:580px;max-height:840px;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.3);">
        
        <!-- Sol Sekme Çubuğu (Sidebar) -->
        <div style="background:var(--bg-raised);border-right:1px solid var(--border-light);padding:1.25rem 1rem;display:flex;flex-direction:column;gap:.4rem;">
          <div style="font-weight:800;font-size:.95rem;color:var(--text-primary);margin-bottom:.75rem;display:flex;align-items:center;gap:.4rem;">
            ⚙️ Ayarlar & Yönetim
          </div>
          <div style="display:flex;flex-direction:column;gap:.35rem;flex:1;overflow-y:auto;">
            ${tabButtonsHtml}
          </div>
          <div style="border-top:1px solid var(--border-light);padding-top:.75rem;">
            <button type="button" class="btn btn-sm btn-ghost" id="btnCloseSettingsModal" style="width:100%;font-weight:700;">
              ✕ Kapat
            </button>
          </div>
        </div>

        <!-- Sağ Sekme İçeriği ve Alt Kaydet Barı -->
        <div style="background:var(--bg-surface);display:flex;flex-direction:column;overflow:hidden;">
          
          <div id="settingsTabContentArea" style="padding:1.5rem 1.75rem;flex:1;overflow-y:auto;">
            ${tabContentHtml}
          </div>

          <!-- Alt Kaydet Barı -->
          <div style="padding:.9rem 1.75rem;background:var(--bg-raised);border-top:1px solid var(--border-light);display:flex;align-items:center;justify-content:space-between;gap:1rem;">
            <button type="button" class="btn btn-sm btn-ghost" id="btnResetToFactoryPrefs" style="color:var(--red);font-weight:700;">
              🔄 Fabrika Ayarlarına Dön
            </button>
            <button type="button" class="btn btn-sm btn-primary" id="btnSaveAllSettingsChanges" style="font-weight:800;padding:.5rem 1.6rem;box-shadow:0 4px 14px rgba(37,99,235,.35);">
              💾 Tüm Değişiklikleri Kaydet
            </button>
          </div>

        </div>

      </div>
    `;

    // ── Olay Dinleyicileri (Event Listeners) ───────────────────
    
    overlay.querySelectorAll('.settings-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        captureProfileInputs();
        activeTab = btn.dataset.tab;
        renderModal();
      });
    });

    function captureProfileInputs() {
      const fName = overlay.querySelector('#profFirstName')?.value;
      const lName = overlay.querySelector('#profLastName')?.value;
      const uName = overlay.querySelector('#profUsername')?.value;
      const phone = overlay.querySelector('#profPhone')?.value;
      const email = overlay.querySelector('#profEmail')?.value;

      if (fName !== undefined) stagedProfile.firstName = fName;
      if (lName !== undefined) stagedProfile.lastName = lName;
      if (uName !== undefined) stagedProfile.username = uName;
      if (phone !== undefined) stagedProfile.phone = phone;
      if (email !== undefined) stagedProfile.email = email;
    }

    // Kapatma
    overlay.querySelector('#btnCloseSettingsModal')?.addEventListener('click', () => overlay.remove());

    // 💾 TÜM DEĞİŞİKLİKLERİ KAYDET BUTONU
    overlay.querySelector('#btnSaveAllSettingsChanges')?.addEventListener('click', () => {
      captureProfileInputs();

      FrpStore.setUserProfile(stagedProfile);
      FrpStore.setPreferences(stagedPrefs);
      if (stagedPrefs.theme) {
        FrpStore.setTheme(stagedPrefs.theme);
      }

      toast('Tüm ayarlar ve tercihler başarıyla kaydedildi! 💾', 'success');
      if (typeof window.refreshAll === 'function') window.refreshAll();
      if (typeof window.updateStats === 'function') window.updateStats();
      if (typeof window._refreshUserTopbarBadge === 'function') window._refreshUserTopbarBadge();
      overlay.remove();
    });

    // 🔄 FABRİKA AYARLARINA DÖN (ÖZEL MODAL)
    overlay.querySelector('#btnResetToFactoryPrefs')?.addEventListener('click', () => {
      window.showConfirmDialog({
        title: 'Fabrika Ayarlarına Sıfırla',
        message: 'Tüm arayüz, tipografi, tema ve sütun ayarlarınızı varsayılana sıfırlamak istediğinize emin misiniz?',
        confirmText: 'Evet, Sıfırla',
        isDanger: true,
        onConfirm: () => {
          stagedPrefs = {
            fontFamily: 'inter',
            fontSize: 'normal',
            density: 'normal',
            codeFont: 'jetbrains',
            visibleColumns: {
              reportName: true,
              fileName: true,
              fileSize: true,
              category: true,
              guid: true,
              tags: true,
              queries: false,
              date: true
            },
            columnOrder: ['reportName', 'fileName', 'fileSize', 'category', 'guid', 'tags', 'queries', 'date'],
            pageSize: 50,
            enableFirebirdFilter: true,
            theme: 'dark'
          };
          FrpStore.setPreferences(stagedPrefs);
          toast('Ayarlar varsayılana sıfırlandı.', 'info');
          if (typeof window.refreshAll === 'function') window.refreshAll();
          renderModal();
        }
      });
    });

    // 1. Görünüm Olayları (Flicker-Free In-Place Güncelleme)
    if (activeTab === 'appearance') {
      const btnDark = overlay.querySelector('#btnStagedThemeDark');
      const btnLight = overlay.querySelector('#btnStagedThemeLight');

      btnDark?.addEventListener('click', () => {
        stagedPrefs.theme = 'dark';
        btnDark.className = 'btn btn-sm btn-primary';
        if (btnLight) btnLight.className = 'btn btn-sm btn-ghost';
      });
      btnLight?.addEventListener('click', () => {
        stagedPrefs.theme = 'light';
        btnLight.className = 'btn btn-sm btn-primary';
        if (btnDark) btnDark.className = 'btn btn-sm btn-ghost';
      });

      overlay.querySelectorAll('input[name="stagedFontFamily"]').forEach(radio => {
        radio.addEventListener('change', () => {
          stagedPrefs.fontFamily = radio.value;
          overlay.querySelectorAll('input[name="stagedFontFamily"]').forEach(r => {
            r.closest('.settings-radio-card')?.classList.toggle('active', r.value === radio.value);
          });
        });
      });

      overlay.querySelectorAll('input[name="stagedFontSize"]').forEach(radio => {
        radio.addEventListener('change', () => {
          stagedPrefs.fontSize = radio.value;
          overlay.querySelectorAll('input[name="stagedFontSize"]').forEach(r => {
            r.closest('.settings-radio-card')?.classList.toggle('active', r.value === radio.value);
          });
        });
      });

      overlay.querySelectorAll('input[name="stagedDensity"]').forEach(radio => {
        radio.addEventListener('change', () => {
          stagedPrefs.density = radio.value;
          overlay.querySelectorAll('input[name="stagedDensity"]').forEach(r => {
            r.closest('.settings-radio-card')?.classList.toggle('active', r.value === radio.value);
          });
        });
      });

      overlay.querySelectorAll('input[name="stagedCodeFont"]').forEach(radio => {
        radio.addEventListener('change', () => {
          stagedPrefs.codeFont = radio.value;
          overlay.querySelectorAll('input[name="stagedCodeFont"]').forEach(r => {
            r.closest('.settings-radio-card')?.classList.toggle('active', r.value === radio.value);
          });
        });
      });
    }

    // 3. Kategori & Özel Etiket Olayları
    else if (activeTab === 'categories') {
      overlay.querySelector('#btnSaveNewCat')?.addEventListener('click', () => {
        const name = overlay.querySelector('#newCatName').value;
        const color = overlay.querySelector('#newCatColor').value;
        const icon = overlay.querySelector('#newCatIcon').value;
        const res = FrpStore.addCategory(name, color, icon);
        if (res.success) {
          toast(`'${name.trim()}' kategorisi eklendi 🏷️`, 'success');
          if (typeof window.updateCategoryDropdowns === 'function') window.updateCategoryDropdowns();
          if (typeof window.refreshAll === 'function') window.refreshAll();
          renderModal();
        } else {
          toast(res.reason || 'Kategori eklenemedi', 'warning');
        }
      });

      overlay.querySelectorAll('.btn-delete-cat').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = btn.dataset.name;
          window.showConfirmDialog({
            title: 'Kategoriyi Sil',
            message: `'${name}' kategorisini silmek istediğinize emin misiniz? Bu kategoriye ait raporlar kategorisiz kalacaktır.`,
            confirmText: 'Kategoriyi Sil',
            isDanger: true,
            onConfirm: () => {
              FrpStore.deleteCategory(name);
              toast(`'${name}' kategorisi silindi`, 'info');
              if (typeof window.updateCategoryDropdowns === 'function') window.updateCategoryDropdowns();
              if (typeof window.refreshAll === 'function') window.refreshAll();
              renderModal();
            }
          });
        });
      });

      overlay.querySelectorAll('.btn-edit-cat').forEach(btn => {
        btn.addEventListener('click', () => {
          const oldName = btn.dataset.name;
          const oldColor = btn.dataset.color;
          const oldIcon = btn.dataset.icon;
          window.showPromptDialog({
            title: 'Kategori Adını Düzenle',
            message: `'${oldName}' kategorisi için yeni ismi girin:`,
            defaultValue: oldName,
            confirmText: 'Güncelle',
            onConfirm: (newName) => {
              if (newName && newName.trim()) {
                FrpStore.updateCategory(oldName, newName.trim(), oldColor, oldIcon);
                toast('Kategori güncellendi ✏️', 'success');
                if (typeof window.updateCategoryDropdowns === 'function') window.updateCategoryDropdowns();
                if (typeof window.refreshAll === 'function') window.refreshAll();
                renderModal();
              }
            }
          });
        });
      });

      // Özel Etiket Ekle
      overlay.querySelector('#btnSaveNewCustomTag')?.addEventListener('click', () => {
        const input = overlay.querySelector('#newCustomTagName');
        const res = FrpStore.addCustomTag(input.value);
        if (res.success) {
          toast(`'${res.tag}' etiketi eklendi 🏷️`, 'success');
          if (typeof window.updateTagSelect === 'function') window.updateTagSelect();
          renderModal();
        } else {
          toast(res.reason || 'Etiket eklenemedi', 'warning');
        }
      });

      // Özel Etiket Sil
      overlay.querySelectorAll('.btn-delete-custom-tag').forEach(btn => {
        btn.addEventListener('click', () => {
          const tag = btn.dataset.tag;
          FrpStore.deleteCustomTag(tag);
          toast(`'${tag}' etiketi kaldırıldı`, 'info');
          if (typeof window.updateTagSelect === 'function') window.updateTagSelect();
          renderModal();
        });
      });
    }

    // 4. Sütun Olayları
    else if (activeTab === 'columns') {
      overlay.querySelectorAll('.staged-col-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          const colId = cb.dataset.col;
          stagedPrefs.visibleColumns[colId] = cb.checked;
        });
      });

      overlay.querySelector('#stagedPageSize')?.addEventListener('change', (e) => {
        stagedPrefs.pageSize = parseInt(e.target.value, 10);
      });
    }

    // 6. Çöp Kutusu Olayları
    else if (activeTab === 'trash') {
      const selectedTrashIds = new Set();
      const btnRestoreSel = overlay.querySelector('#btnRestoreSelectedTrash');
      const btnPurgeSel = overlay.querySelector('#btnPurgeSelectedTrash');
      const trashCountEl = overlay.querySelector('#trashSelectedCount');
      const selectAllCb = overlay.querySelector('#trashSelectAll');
      const allItemCbs = overlay.querySelectorAll('.trash-item-cb');

      function updateTrashBulkUI() {
        const count = selectedTrashIds.size;
        if (trashCountEl) trashCountEl.textContent = count;
        if (btnRestoreSel) btnRestoreSel.style.display = count > 0 ? 'inline-flex' : 'none';
        if (btnPurgeSel) btnPurgeSel.style.display = count > 0 ? 'inline-flex' : 'none';
        if (selectAllCb) {
          selectAllCb.checked = allItemCbs.length > 0 && count === allItemCbs.length;
          selectAllCb.indeterminate = count > 0 && count < allItemCbs.length;
        }
      }

      const trashSearchInp = overlay.querySelector('#trashSearchInput');
      const trashCountDisplay = overlay.querySelector('#trashCountDisplay');

      trashSearchInp?.addEventListener('input', () => {
        const q = (trashSearchInp.value || '').toLowerCase().trim();
        let visibleCount = 0;
        overlay.querySelectorAll('.trash-item-row').forEach(row => {
          const text = row.textContent.toLowerCase();
          const match = text.includes(q);
          row.style.display = match ? 'flex' : 'none';
          if (match) visibleCount++;
        });
        if (trashCountDisplay) {
          trashCountDisplay.textContent = q ? `Bulunan: ${visibleCount} / Toplam ${allItemCbs.length}` : `Toplam ${allItemCbs.length} silinmiş rapor`;
        }
      });

      allItemCbs.forEach(cb => {
        cb.addEventListener('change', () => {
          const id = cb.dataset.id;
          if (cb.checked) {
            selectedTrashIds.add(id);
            cb.closest('.trash-item-row')?.style.setProperty('border-color', 'var(--accent)');
          } else {
            selectedTrashIds.delete(id);
            cb.closest('.trash-item-row')?.style.removeProperty('border-color');
          }
          updateTrashBulkUI();
        });
      });

      selectAllCb?.addEventListener('change', () => {
        const check = selectAllCb.checked;
        allItemCbs.forEach(cb => {
          cb.checked = check;
          const id = cb.dataset.id;
          if (check) {
            selectedTrashIds.add(id);
            cb.closest('.trash-item-row')?.style.setProperty('border-color', 'var(--accent)');
          } else {
            selectedTrashIds.delete(id);
            cb.closest('.trash-item-row')?.style.removeProperty('border-color');
          }
        });
        updateTrashBulkUI();
      });

      btnRestoreSel?.addEventListener('click', () => {
        const ids = [...selectedTrashIds];
        if (ids.length === 0) return;
        const restored = FrpStore.restoreManyFromTrash(ids);
        toast(`${restored} rapor başarıyla geri yüklendi! 🔄`, 'success');
        if (typeof window.refreshAll === 'function') window.refreshAll();
        renderModal();
      });

      btnPurgeSel?.addEventListener('click', () => {
        const ids = [...selectedTrashIds];
        if (ids.length === 0) return;
        window.showConfirmDialog({
          title: 'Seçilen Raporları Kalıcı Olarak Sil',
          message: `Seçilen <strong>${ids.length} rapor</strong> kalıcı olarak silinecektir. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?`,
          confirmText: `${ids.length} Raporu Kalıcı Sil`,
          isDanger: true,
          onConfirm: () => {
            FrpStore.purgeManyFromTrash(ids);
            toast(`${ids.length} rapor kalıcı olarak silindi.`, 'info');
            renderModal();
          }
        });
      });

      overlay.querySelectorAll('.btn-restore-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          FrpStore.restoreFromTrash(id);
          toast('Rapor başarıyla geri yüklendi! 🔄', 'success');
          if (typeof window.refreshAll === 'function') window.refreshAll();
          renderModal();
        });
      });

      overlay.querySelectorAll('.btn-purge-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.id;
          window.showConfirmDialog({
            title: 'Raporu Kalıcı Olarak Sil',
            message: 'Bu raporu kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
            confirmText: 'Kalıcı Olarak Sil',
            isDanger: true,
            onConfirm: () => {
              FrpStore.purgeFromTrash(id);
              toast('Rapor kalıcı olarak silindi.', 'info');
              renderModal();
            }
          });
        });
      });

      overlay.querySelector('#btnEmptyTrashAll')?.addEventListener('click', () => {
        window.showConfirmDialog({
          title: 'Çöp Kutusunu Boşalt',
          message: 'Çöp kutusundaki tüm raporları kalıcı olarak temizlemek istediğinize emin misiniz?',
          confirmText: 'Tümünü Temizle',
          isDanger: true,
          onConfirm: () => {
            FrpStore.emptyTrash();
            toast('Çöp kutusu tamamen boşaltıldı. 🗑️', 'info');
            renderModal();
          }
        });
      });
    }

    // 7. Yedekleme & Depolama Olayları
    else if (activeTab === 'storage') {
      overlay.querySelector('#btnActionExportJson')?.addEventListener('click', () => {
        const json = FrpStore.exportBackup();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `frpoku_yedek_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast('Tüm veriler JSON olarak yedeklendi! 💾', 'success');
      });

      const backupInput = overlay.querySelector('#settingsBackupFileInput');
      overlay.querySelector('#btnActionImportJson')?.addEventListener('click', () => {
        backupInput.click();
      });

      backupInput?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          const count = FrpStore.importBackup(ev.target.result);
          if (count > 0) {
            toast(`${count} rapor başarıyla içe aktarıldı! 🎉`, 'success');
            if (typeof window.refreshAll === 'function') window.refreshAll();
            renderModal();
          } else {
            toast('Geçersiz yedek dosyası.', 'error');
          }
        };
        reader.readAsText(file);
      });

      overlay.querySelector('#btnActionResetAll')?.addEventListener('click', () => {
        window.showConfirmDialog({
          title: 'Tüm Verileri Sıfırla',
          message: 'DİKKAT: Yüklenen tüm raporlar, kategoriler ve veritabanı kalıcı olarak silinecektir! Devam edilsin mi?',
          confirmText: 'Evet, Hepsini Sil',
          isDanger: true,
          onConfirm: () => {
            FrpStore.deleteAll();
            FrpStore.emptyTrash();
            toast('Tüm veriler temizlendi ve sıfırlandı.', 'info');
            if (typeof window.refreshAll === 'function') window.refreshAll();
            overlay.remove();
          }
        });
      });
    }
  }

  renderModal();
  document.body.appendChild(overlay);
};
