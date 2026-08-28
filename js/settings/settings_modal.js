// ============================================================
//  settings.js — FrpOku Ayarlar & Kullanıcı Yönetimi Merkezi v4
//  Sıfır Tarayıcı Uyarısı (Tam Özel Modallar), Özel Etiket Yönetimi,
//  Ayrı Dosya Boyutu Sütunu, Temiz Kullanıcı Profili
// ============================================================

function safeToast(msg, type = 'info') {
  if (typeof window.toast === 'function') {
    window.toast(msg, type);
  } else if (typeof window.showToast === 'function') {
    window.showToast(msg, type);
  } else if (window.FrpNotify && typeof window.FrpNotify[type] === 'function') {
    window.FrpNotify[type](msg);
  } else {
    console.log('[Toast]', type, msg);
  }
}
window.safeToast = safeToast;
const _settingsToast = safeToast;

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
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
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
    theme: FrpStore.getTheme() || 'light'
  };

  const authUser = (typeof window.FrpAuth !== 'undefined' && window.FrpAuth.getUser) ? window.FrpAuth.getUser() : null;
  const nameParts = (authUser?.full_name || '').split(' ');
  const authFirstName = nameParts[0] || '';
  const authLastName = nameParts.slice(1).join(' ') || '';

  const liveProfile = FrpStore.getUserProfile();
  let stagedProfile = {
    ...liveProfile,
    firstName: liveProfile.firstName || authFirstName,
    lastName: liveProfile.lastName || authLastName,
    username: authUser?.username || liveProfile.username || '',
    phone: authUser?.phone || liveProfile.phone || '',
    email: authUser?.email || liveProfile.email || '',
    department: authUser?.department || liveProfile.department || ''
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
    const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
    const isAdmin = curUser && (curUser.role === 'admin' || curUser.username === 'admin');

    // Sekme Tanımları
    const tabs = [
      { id: 'appearance', icon: '🎨', label: 'Görünüm & Yazı Tipi' },
      { id: 'profile',    icon: '👤', label: 'Kullanıcı & Cihaz Profili' },
      { id: 'categories', icon: '🏷️', label: `Kategoriler & Etiketler` },
      { id: 'columns',    icon: '👁️', label: 'Sütun & Tablo' },
      { id: 'shortcuts',  icon: '⌨️', label: 'Klavye Kısayolları' },
      { id: 'trash',      icon: '🗑️', label: 'Çöp Kutusu', count: trashItems.length, isTrash: true },
      { id: 'storage',    icon: '💾', label: 'Yedekleme & Depolama' },
      { id: 'audit',      icon: '📋', label: 'İşlem Geçmişi (Audit)' }
    ];

    const tabButtonsHtml = tabs.map(t => {
      const isTrashWithItems = t.isTrash && (t.count > 0);
      const countBadge = t.count !== undefined ? `
        <span class="badge ${t.count > 0 ? 'badge-red' : 'badge-gray'}" style="margin-left:auto;font-size:.68rem;padding:2px 6px;border-radius:10px;${isTrashWithItems ? 'animation:pulse 2s infinite;' : ''}">
          ${t.count}
        </span>
      ` : '';
      return `
        <button type="button" class="settings-nav-btn ${t.id === activeTab ? 'active' : ''} ${isTrashWithItems ? 'trash-has-items' : ''}" data-tab="${t.id}" style="display:flex;align-items:center;width:100%;${isTrashWithItems ? 'border-left:3px solid #ef4444;' : ''}">
          <span style="font-size:1.05rem;">${t.icon}</span>
          <span style="flex:1;text-align:left;">${t.label}</span>
          ${countBadge}
        </button>
      `;
    }).join('');

    let tabContentHtml = '';

    // ── 1. GÖRÜNÜM & YAZI TİPİ ────────────────────────────────
    if (activeTab === 'appearance') {
      const fontList = [
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
      ];

      const codeFonts = [
        { id: 'jetbrains', name: 'JetBrains Mono (Gelişmiş)', sample: 'SELECT count(1) FROM rapor\nWHERE aktif = 1' },
        { id: 'fira',      name: 'Fira Code (Ligatürlü)',      sample: 'SELECT * FROM musteri\nWHERE bakiye != 0' },
        { id: 'cascadia',  name: 'Cascadia Code (Modern)',  sample: 'procedure RaporHazirla;\nbegin Engine.Start; end;' },
        { id: 'inconsolata', name: 'Inconsolata (Net)',      sample: 'SELECT id, unvan FROM cariler\nWHERE borc > 0' },
        { id: 'sourcecode', name: 'Source Code Pro (Adobe)', sample: 'SELECT k.id, k.adi FROM kullanicilar k' },
        { id: 'monaco',    name: 'Monaco / Menlo (Terminal)', sample: 'UPDATE rapor SET versiyon = versiyon + 1;' },
        { id: 'courierprime', name: 'Courier Prime (Klasik)', sample: 'CREATE TABLE raporlar (id INT PRIMARY KEY);' },
        { id: 'consolas',  name: 'Consolas (Windows Standart)', sample: 'SELECT p.id, p.adi_soyadi\nFROM personel p' }
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
                <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">E-Posta Adresiniz</label>
                <div style="display:flex;gap:.4rem;">
                  <input type="email" id="profEmail" class="master-search-input" style="flex:1;" value="${escHtml(stagedProfile.email || '')}" />
                  <button type="button" class="btn btn-sm btn-primary" id="btnUpdateEmailDirectly" style="font-weight:700;font-size:.75rem;padding:.3rem .65rem;">Değiştir</button>
                </div>
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
                const totalBytes = new Blob([localStorage.getItem('frpoku_store_v2') || '']).size;
                storageFormatted = (totalBytes / 1024).toFixed(1) + ' KB';
              } catch {}

              const host = typeof window !== 'undefined' && window.location ? window.location.host : 'localhost';
              const protocol = typeof window !== 'undefined' && window.location ? window.location.protocol.replace(':', '').toUpperCase() : 'HTTP';
              const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Istanbul';

              return `
                <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
                  <div style="font-weight:800;font-size:.88rem;color:var(--text-primary);border-bottom:1px solid var(--border-light);padding-bottom:.4rem;display:flex;align-items:center;justify-content:space-between;">
                    <span>🖥️ İstemci & Sistem Ortamı</span>
                    <span class="badge badge-green" style="font-size:.68rem;">🟢 Aktif & Hazır</span>
                  </div>

                  <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:.55rem;font-size:.78rem;">
                    
                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">🌐 Tarayıcı & Motor</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(browser)}</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">💻 İşletim Sistemi</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(os)}</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">🖥️ Ekran & Çözünürlük</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--accent);margin-top:.15rem;">${escHtml(resolution)}</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">⚡ CPU / Donanım</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(cores)}</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">💾 Depolama (Store)</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(storageFormatted)}</div>
                    </div>

                    <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                      <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">🚀 Sunucu Modu & Port</div>
                      <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;font-family:var(--mono);">${escHtml(protocol)} · ${escHtml(host)}</div>
                    </div>

                  </div>

                </div>
              `;
            })()}

            <!-- Alt Kart: 🔒 Şifre ve Hesap Güvenliği -->
            <div class="settings-card" style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:.85rem; border: 1.5px solid var(--accent); background: var(--bg-surface); padding: 1.25rem; border-radius: 14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-light); padding-bottom:.5rem;">
                <div style="display:flex; align-items:center; gap:.5rem;">
                  <span style="font-size:1.2rem;">🔒</span>
                  <div>
                    <div style="font-weight:800; font-size:.92rem; color:var(--text-primary);">Şifre ve Hesap Güvenliği</div>
                    <div style="font-size:.74rem; color:var(--text-muted);">Giriş şifrenizi güvenli bir şekilde güncelleyin</div>
                  </div>
                </div>
                <span class="badge" style="background:var(--accent-light); color:var(--accent); font-weight:700; font-size:.7rem;">🛡️ Uçtan Uca Şifreli</span>
              </div>

              <!-- Canlı Uyarı / Bilgi Kutusu -->
              <div id="profilePassAlert" style="display:none; padding:.75rem 1rem; border-radius:10px; font-size:.82rem; font-weight:600;"></div>

              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:.85rem;">
                <div>
                  <label style="font-size:.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:.3rem; display:block;">🔑 Mevcut Şifre</label>
                  <input type="password" id="profOldPass" class="master-search-input" style="width:100%;" placeholder="Mevcut şifrenizi girin" />
                </div>
                <div>
                  <label style="font-size:.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:.3rem; display:block;">🔒 Yeni Şifre</label>
                  <input type="password" id="profNewPass" class="master-search-input" style="width:100%;" placeholder="En az 4 karakter" />
                </div>
                <div>
                  <label style="font-size:.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:.3rem; display:block;">🔒 Yeni Şifre Tekrar</label>
                  <input type="password" id="profNewPassConfirm" class="master-search-input" style="width:100%;" placeholder="Yeni şifreyi onaylayın" />
                </div>
              </div>

              <div style="display:flex; justify-content:flex-end; margin-top:.3rem;">
                <button type="button" id="btnUpdatePasswordProfile" class="btn btn-primary" style="padding:.6rem 1.4rem; font-weight:800; font-size:.85rem; border-radius:10px;">
                  🔐 Şifremi Güncelle
                </button>
              </div>
            </div>

          </div>
        </div>
      `;
    }

    // ── 3. KATEGORİLER & ETİKETLER ────────────────────────────
    else if (activeTab === 'categories') {
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

      tabContentHtml = `
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
              <button type="button" class="btn btn-sm btn-primary" id="btnSaveNewCustomTag" style="font-weight:700;padding:.5rem 1rem;">➕ Etiket Ekle</button>
            </div>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.4rem;">
              ${customTagsHtml || '<span style="font-size:.76rem;color:var(--text-muted);">Henüz özel etiket eklenmemiş.</span>'}
            </div>
          </div>

        </div>
      `;
    }

    // ── 4. SÜTUN & TABLO TERCİHLERİ (Dosya Boyutu & Son Değişiklik Dahil) ─────
    else if (activeTab === 'columns') {
      const cols = stagedPrefs.visibleColumns || {};
      const columnDefs = [
        { id: 'reportName',   label: 'Rapor Başlığı',              desc: 'Raporun ana başlığı' },
        { id: 'fileName',     label: 'Dosya Adı (.frp)',           desc: 'Raporun disk üzerindeki orijinal dosya adı' },
        { id: 'fileSize',     label: 'Dosya Boyutu (KB / MB)',      desc: 'Fiziksel .frp dosyasının disk üzerindeki boyutu' },
        { id: 'category',     label: 'Kategori Etiketi',           desc: 'Rapora atanmış renkli kategori rozeti' },
        { id: 'guid',         label: 'GUID (Benzersiz Kimlik)',    desc: 'FastReport raporunun 36 haneli benzersiz GUID kodu' },
        { id: 'tags',         label: 'Etiketler (Tags)',           desc: 'Otomatik ve özel departman etiketleri' },
        { id: 'queries',      label: 'SQL Sorguları Rozeti',       desc: 'İçerdiği SQL sorgu adedi rozeti' },
        { id: 'date',         label: 'Yüklenme Tarihi',            desc: 'Raporun sisteme ilk eklenme tarihi' },
        { id: 'lastModified', label: 'Son Değişiklik Tarihi',      desc: 'Raporun en son düzenlenme ve güncellenme zamanı' }
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
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;">
            <div>
              <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">🗑️ Çöp Kutusu (${trashItems.length})</div>
              <div style="font-size:.78rem;color:var(--green);margin-top:.2rem;font-weight:700;">
                ⚡ Geri yükleme ve silme işlemleri anında uygulanır (Ayrıca kaydet butonuna basmaya gerek yoktur).
              </div>
            </div>
            <div style="display:flex;gap:.5rem;align-items:center;">
              <button type="button" class="btn btn-sm btn-primary" id="btnRestoreSelectedTrash" style="display:none;font-weight:700;">
                🔄 Seçilenleri Geri Yükle (<span id="trashSelectedCount">0</span>)
              </button>
              <button type="button" class="btn btn-sm btn-danger" id="btnPurgeSelectedTrash" style="display:none;font-weight:700;">
                ❌ Seçilenleri Kalıcı Sil
              </button>
              ${trashItems.length > 0 ? `
                <button type="button" class="btn btn-sm btn-danger" id="btnEmptyTrashAll" style="font-weight:700;">
                  🗑️ Çöp Kutusunu Boşalt
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
    }

    // ── 7. YEDEKLENDİRME & DEPOLAMA ───────────────────────────
    else if (activeTab === 'storage') {
      tabContentHtml = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
          <div>
            <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">💾 Yedekleme & Depolama Yönetimi</div>
            <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
              Raporlarınızın snapshot yedeğini alın, otomatik yedekleme zamanlayın veya verileri sıfırlayın.
            </div>
          </div>

          <!-- Depolama İstatistikleri -->
          <div class="settings-card" style="display:flex;flex-direction:column;gap:.6rem;">
            <div style="font-weight:700;font-size:.85rem;">📊 Yerel Depolama Durumu</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:.6rem;text-align:center;">
              <div style="background:var(--bg-surface);padding:.8rem .6rem;border-radius:10px;border:1px solid var(--border-light);">
                <div style="font-size:1.4rem;font-weight:800;color:var(--accent);">${stats.total || files.length}</div>
                <div style="font-size:.74rem;color:var(--text-muted);font-weight:600;margin-top:.15rem;">Kayıtlı Rapor</div>
              </div>
              <div style="background:var(--bg-surface);padding:.8rem .6rem;border-radius:10px;border:1px solid var(--border-light);">
                <div style="font-size:1.4rem;font-weight:800;color:var(--green);">${stats.queries || 0}</div>
                <div style="font-size:.74rem;color:var(--text-muted);font-weight:600;margin-top:.15rem;">SQL Sorgusu</div>
              </div>
              <div style="background:var(--bg-surface);padding:.8rem .6rem;border-radius:10px;border:1px solid var(--border-light);">
                <div style="font-size:1.4rem;font-weight:800;color:var(--purple);">${stats.storageFormatted || '0 MB'}</div>
                <div style="font-size:.74rem;color:var(--text-muted);font-weight:600;margin-top:.15rem;">Bellek Kullanımı</div>
              </div>
            </div>
          </div>

          <!-- Otomatik Yedekleme Sıklığı -->
          <div class="settings-card" style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">
            <div>
              <div style="font-weight:700;font-size:.85rem;">⏱️ Otomatik Snapshot Yedekleme</div>
              <div style="font-size:.72rem;color:var(--text-muted);">Sistemin arka planda belirli aralıklarla otomatik yedek almasını sağlar.</div>
            </div>
            <select id="stagedAutoBackup" class="master-search-input" style="width:170px;font-weight:700;">
              <option value="0" ${!stagedPrefs.autoBackupInterval ? 'selected' : ''}>Kapalı (Manuel)</option>
              <option value="15" ${stagedPrefs.autoBackupInterval === 15 ? 'selected' : ''}>Her 15 Dakikada</option>
              <option value="30" ${stagedPrefs.autoBackupInterval === 30 ? 'selected' : ''}>Her 30 Dakikada</option>
              <option value="60" ${stagedPrefs.autoBackupInterval === 60 ? 'selected' : ''}>Her 1 Saatte</option>
              <option value="360" ${stagedPrefs.autoBackupInterval === 360 ? 'selected' : ''}>Her 6 Saatte</option>
              <option value="1440" ${stagedPrefs.autoBackupInterval === 1440 ? 'selected' : ''}>Her 24 Saatte (Günlük)</option>
            </select>
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

          <!-- Tehlikeli Bölge (Şifreli Silme) -->
          <div style="background:rgba(239,68,68,.05);border:1.5px solid rgba(239,68,68,.3);border-radius:12px;padding:1rem 1.15rem;display:flex;flex-direction:column;gap:.6rem;">
            <div style="font-weight:800;font-size:.85rem;color:#ef4444;">🚨 Tehlikeli Bölge (Fabrika Ayarlarına Sıfırla)</div>
            <div style="font-size:.76rem;color:var(--text-secondary);line-height:1.45;">
              Tüm yüklenen raporları, kategorileri ve veritabanını kalıcı olarak temizler. Bu işlem güvenlik doğrulaması (hesap şifresi) gerektirir.
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

    // ── 8. ADMİN İŞLEM GEÇMİŞİ (AUDIT LOGS) ───────────────────
    else if (activeTab === 'audit') {
      tabContentHtml = `
        <div style="display:flex;flex-direction:column;gap:1.1rem;">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;">
            <div>
              <div style="font-size:1.15rem;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:.5rem;">
                <span>📋</span> <span>Kullanıcı İşlem Geçmişi & Denetim Günlüğü</span>
                <span class="badge badge-purple" style="font-size:.68rem;">Canlı Kayıtlar</span>
              </div>
              <div style="font-size:.78rem;color:var(--text-muted);margin-top:.25rem;">
                Kullanıcıların gerçekleştirdiği oturum açma, rapor yükleme, indirme, silme, havuz paylaşımı ve sistem olaylarını takip edin.
              </div>
            </div>
            <div style="display:flex;gap:.5rem;align-items:center;">
              <button type="button" class="btn btn-sm btn-ghost" id="btnRefreshAuditLogs" style="font-weight:700;">
                🔄 Yenile
              </button>
              <button type="button" class="btn btn-sm btn-primary" id="btnExportAuditExcel" style="font-weight:700;background:linear-gradient(135deg,#059669,#10b981);border:none;box-shadow:0 2px 8px rgba(16,185,129,0.3);">
                📊 Excel (.xls) Olarak İndir
              </button>
            </div>
          </div>

          <!-- KPI Özet Kartları -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:.65rem;" id="auditKpiRow">
            <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:10px;padding:.75rem 1rem;display:flex;flex-direction:column;gap:.2rem;">
              <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Toplam Kayıt</div>
              <div id="kpiAuditTotal" style="font-size:1.35rem;font-weight:900;color:var(--accent);">0</div>
            </div>
            <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:10px;padding:.75rem 1rem;display:flex;flex-direction:column;gap:.2rem;">
              <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Yükleme / İndirme</div>
              <div id="kpiAuditFiles" style="font-size:1.35rem;font-weight:900;color:var(--green);">0</div>
            </div>
            <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:10px;padding:.75rem 1rem;display:flex;flex-direction:column;gap:.2rem;">
              <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Kod / Tasarım</div>
              <div id="kpiAuditEdits" style="font-size:1.35rem;font-weight:900;color:var(--purple);">0</div>
            </div>
            <div style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:10px;padding:.75rem 1rem;display:flex;flex-direction:column;gap:.2rem;">
              <div style="font-size:.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;">Silme & Çöp</div>
              <div id="kpiAuditDeletes" style="font-size:1.35rem;font-weight:900;color:var(--red);">0</div>
            </div>
          </div>

          <!-- Filtreler & Arama -->
          <div style="display:grid;grid-template-columns:1fr 220px;gap:.65rem;">
            <div style="position:relative;">
              <input type="text" id="auditSearchInput" placeholder="🔍 Loglarda ara (Kullanıcı adı, işlem, hedef, IP, açıklama)..." class="master-search-input" style="width:100%;font-size:.84rem;padding:.5rem .85rem;" />
            </div>
            <select id="auditActionFilter" class="master-search-input" style="font-size:.82rem;font-weight:700;">
              <option value="">Tüm İşlemler</option>
              <option value="FRP_DOWNLOAD">📥 İndirmeler (FRP_DOWNLOAD)</option>
              <option value="REPORT_UPLOAD">📤 Yüklemeler (REPORT_UPLOAD)</option>
              <option value="REPORT_UPDATE">🔄 Güncellemeler (REPORT_UPDATE)</option>
              <option value="POOL_ADD">🌐 Havuz Paylaşımı (POOL_ADD)</option>
              <option value="POOL_REMOVE">🔒 Havuzdan Kaldırma (POOL_REMOVE)</option>
              <option value="REPORT_DELETE">🗑️ Çöp Kutusuna Taşıma</option>
              <option value="TRASH_RESTORE">♻️ Çöpten Geri Yükleme</option>
              <option value="TRASH_PURGE">❌ Kalıcı Silme (TRASH_PURGE)</option>
              <option value="TRASH_EMPTY">🧹 Çöp Kutusunu Boşaltma</option>
              <option value="DESIGN_EDIT">🎨 Tasarım Düzenleme</option>
              <option value="SQL_EDIT">🗄️ SQL Sorgu Düzenleme</option>
              <option value="PASCAL_EDIT">📜 Pascal Script Düzenleme</option>
              <option value="USERNAME_CHANGE">✏️ Kullanıcı Adı Değişikliği</option>
              <option value="LOGIN">🔐 Giriş Yapma (LOGIN)</option>
              <option value="USER_UPDATE">👤 Profil Güncelleme</option>
              <option value="EMAIL_CHANGE">✉️ E-Posta Değişikliği</option>
              <option value="DATA_RESET">🚨 Tüm Verileri Sıfırlama</option>
            </select>
          </div>

          <!-- Tablo Alanı -->
          <div id="auditLogsContainer" style="background:var(--bg-surface);border:1px solid var(--border-light);border-radius:12px;overflow-x:auto;max-height:500px;overflow-y:auto;box-shadow:inset 0 1px 3px rgba(0,0,0,0.05);">
            <div style="text-align:center;padding:3rem;color:var(--text-muted);">
              <div class="splash-spinner" style="margin-bottom:.6rem;"></div>
              <div>Denetim kayıtları yükleniyor...</div>
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

      if (fName !== undefined) stagedProfile.firstName = fName.trim();
      if (lName !== undefined) stagedProfile.lastName = lName.trim();
      if (uName !== undefined) stagedProfile.username = uName.trim();
      if (phone !== undefined) stagedProfile.phone = phone.trim();
      if (email !== undefined) stagedProfile.email = email.trim();
    }

    // 🔒 PROFİL İÇİNDEN ŞİFRE GÜNCELLEME
    overlay.querySelector('#btnUpdatePasswordProfile')?.addEventListener('click', async () => {
      const alertBox = overlay.querySelector('#profPassAlertBox');
      const showStatus = (msg, type = 'error') => {
        if (!alertBox) return;
        alertBox.style.display = 'block';
        if (type === 'error') {
          alertBox.style.background = '#fef2f2'; alertBox.style.border = '1px solid #fecaca'; alertBox.style.color = '#b91c1c';
        } else {
          alertBox.style.background = '#f0fdf4'; alertBox.style.border = '1px solid #bbf7d0'; alertBox.style.color = '#15803d';
        }
        alertBox.textContent = msg;
      };

      const user = window.FrpAuth?.getUser();
      if (!user || !user.id) {
        showStatus('Şifre değiştirmek için oturum açmış olmanız gerekmektedir.', 'error');
        return;
      }

      const oldPass = overlay.querySelector('#profOldPass')?.value;
      const newPass = overlay.querySelector('#profNewPass')?.value;
      const newPassConf = overlay.querySelector('#profNewPassConfirm')?.value;

      if (!oldPass) {
        showStatus('⚠️ Lütfen mevcut şifrenizi giriniz.', 'error');
        return;
      }
      if (!newPass || newPass.length < 4) {
        showStatus('⚠️ Yeni şifreniz en az 4 karakter olmalıdır.', 'error');
        return;
      }
      if (oldPass === newPass) {
        showStatus('⚠️ Yeni şifreniz mevcut şifrenizle aynı olamaz.', 'error');
        return;
      }
      if (newPass !== newPassConf) {
        showStatus('🔒 Yeni şifreler birbiriyle eşleşmiyor!', 'error');
        return;
      }

      const btn = overlay.querySelector('#btnUpdatePasswordProfile');
      btn.disabled = true;
      btn.textContent = 'Güncelleniyor... ⏳';

      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            oldPassword: oldPass,
            newPassword: newPass
          })
        });

        const data = await res.json();
        btn.disabled = false;
        btn.textContent = '🔐 Şifremi Güncelle';

        if (data.success) {
          showStatus('✅ Şifreniz başarıyla güncellendi! Bilgilendirme e-postası gönderildi.', 'success');
          overlay.querySelector('#profOldPass').value = '';
          overlay.querySelector('#profNewPass').value = '';
          overlay.querySelector('#profNewPassConfirm').value = '';
          if (typeof window.toast === 'function') window.safeToast('Şifreniz başarıyla güncellendi! 🛡️', 'success');
        } else {
          showStatus(data.reason || 'Şifre güncellenemedi.', 'error');
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = '🔐 Şifremi Güncelle';
        showStatus('Sunucu hatası: ' + err.message, 'error');
      }
    });

    // ── Profil Alanlarını Güvenle Toplama ────────────────────────
    function captureProfileInputs() {
      const fName = overlay.querySelector('#profFirstName')?.value;
      const lName = overlay.querySelector('#profLastName')?.value;
      const uName = overlay.querySelector('#profUsername')?.value;
      const phone = overlay.querySelector('#profPhone')?.value;
      const email = overlay.querySelector('#profEmail')?.value;

      if (fName !== undefined) stagedProfile.firstName = fName.trim();
      if (lName !== undefined) stagedProfile.lastName = lName.trim();
      if (uName !== undefined) stagedProfile.username = uName.trim();
      if (phone !== undefined) stagedProfile.phone = phone.trim();
      if (email !== undefined) stagedProfile.email = email.trim();
    }

    // Kapatma
    overlay.querySelector('#btnCloseSettingsModal')?.addEventListener('click', () => overlay.remove());

    // 💾 TÜM DEĞİŞİKLİKLERİ KAYDET BUTONU
    overlay.querySelector('#btnSaveAllSettingsChanges')?.addEventListener('click', async () => {
      const saveBtn = overlay.querySelector('#btnSaveAllSettingsChanges');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Kaydediliyor... ⏳';
      }

      try {
        captureProfileInputs();

        // E-Posta format kontrolü
        const email = (stagedProfile.email || '').trim().toLowerCase();
        if (email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/.test(email)) {
          safeToast('⚠️ Lütfen geçerli bir e-posta adresi giriniz (Örn: ad.soyad@kurum.com).', 'warning');
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Tüm Değişiklikleri Kaydet';
          }
          return;
        }

        // Bulut & Auth Veritabanı ile Senkronizasyon
        const authUser = (typeof window.FrpAuth !== 'undefined' && window.FrpAuth.getUser) ? window.FrpAuth.getUser() : null;
        if (authUser && authUser.id && activeTab === 'profile') {
          try {
            const fullName = `${stagedProfile.firstName || ''} ${stagedProfile.lastName || ''}`.trim();
            const res = await fetch('/api/auth/update-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: authUser.id,
                fullName: fullName || authUser.full_name,
                username: stagedProfile.username || authUser.username,
                email: email || authUser.email,
                phone: stagedProfile.phone || authUser.phone,
                department: stagedProfile.department || authUser.department
              })
            });

            const data = await res.json();
            if (data && data.success && data.user) {
              window.FrpAuth.updateSession(data.user);
            }
          } catch (syncErr) {
            console.warn('Profile sync error:', syncErr.message);
          }
        }

        FrpStore.setUserProfile(stagedProfile);
        FrpStore.setPreferences(stagedPrefs);
        if (stagedPrefs.theme) {
          FrpStore.setTheme(stagedPrefs.theme);
        }
        if (typeof FrpStore.applyPreferences === 'function') {
          FrpStore.applyPreferences();
        }

        safeToast('Tüm ayarlar başarıyla kaydedildi! 💾', 'success');
        if (typeof window.refreshAll === 'function') window.refreshAll();
        if (typeof window.updateStats === 'function') window.updateStats();
        if (typeof window._refreshUserTopbarBadge === 'function') window._refreshUserTopbarBadge();
        if (typeof window.FrpAuth?.updateNavbarUserBadge === 'function') window.FrpAuth.updateNavbarUserBadge();
      } catch (err) {
        console.error('Settings save error:', err);
        safeToast('Ayarlar kaydedilirken hata: ' + err.message, 'error');
      } finally {
        overlay.remove();
      }
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
            theme: 'light'
          };
          FrpStore.setPreferences(stagedPrefs);
          safeToast('Ayarlar varsayılana sıfırlandı.', 'info');
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
          safeToast(`'${name.trim()}' kategorisi eklendi 🏷️`, 'success');
          if (typeof window.updateCategoryDropdowns === 'function') window.updateCategoryDropdowns();
          if (typeof window.refreshAll === 'function') window.refreshAll();
          renderModal();
        } else {
          safeToast(res.reason || 'Kategori eklenemedi', 'warning');
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
              safeToast(`'${name}' kategorisi silindi`, 'info');
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
                safeToast('Kategori güncellendi ✏️', 'success');
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
          safeToast(`'${res.tag}' etiketi eklendi 🏷️`, 'success');
          if (typeof window.updateTagSelect === 'function') window.updateTagSelect();
          renderModal();
        } else {
          safeToast(res.reason || 'Etiket eklenemedi', 'warning');
        }
      });

      // Özel Etiket Sil
      overlay.querySelectorAll('.btn-delete-custom-tag').forEach(btn => {
        btn.addEventListener('click', () => {
          const tag = btn.dataset.tag;
          FrpStore.deleteCustomTag(tag);
          safeToast(`'${tag}' etiketi kaldırıldı`, 'info');
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

      btnRestoreSel?.addEventListener('click', async () => {
        const ids = [...selectedTrashIds];
        if (ids.length === 0) return;
        await FrpStore.restoreManyFromTrash(ids);
        if (window.FrpAudit) {
          window.FrpAudit.logAction({
            action: 'TRASH_RESTORE',
            target: `${ids.length} Rapor`,
            details: `${ids.length} adet rapor çöp kutusundan geri yüklendi.`
          });
        }
        selectedTrashIds.clear();
        safeToast(`${ids.length} rapor başarıyla geri yüklendi! 🔄`, 'success');
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
          onConfirm: async () => {
            await FrpStore.purgeManyFromTrash(ids);
            if (window.FrpAudit) {
              window.FrpAudit.logAction({
                action: 'TRASH_PURGE',
                target: `${ids.length} Rapor`,
                details: `${ids.length} adet rapor çöp kutusundan kalıcı olarak temizlendi.`
              });
            }
            selectedTrashIds.clear();
            safeToast(`${ids.length} rapor kalıcı olarak silindi. 🗑️`, 'info');
            if (typeof window.refreshAll === 'function') window.refreshAll();
            renderModal();
          }
        });
      });

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
          selectedTrashIds.delete(id);
          safeToast('Rapor başarıyla geri yüklendi! 🔄', 'success');
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
            onConfirm: async () => {
              await FrpStore.purgeFromTrash(id);
              if (window.FrpAudit) {
                window.FrpAudit.logAction({
                  action: 'TRASH_PURGE',
                  target: id,
                  details: `Rapor (${id}) çöp kutusundan kalıcı olarak silindi.`
                });
              }
              selectedTrashIds.delete(id);
              safeToast('Rapor kalıcı olarak silindi. 🗑️', 'info');
              if (typeof window.refreshAll === 'function') window.refreshAll();
              renderModal();
            }
          });
        });
      });

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
            selectedTrashIds.clear();
            safeToast('Çöp kutusu tamamen boşaltıldı. 🗑️', 'info');
            if (typeof window.refreshAll === 'function') window.refreshAll();
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
        safeToast('Tüm veriler JSON olarak yedeklendi! 💾', 'success');
      });

      overlay.querySelector('#stagedAutoBackup')?.addEventListener('change', (e) => {
        const val = parseInt(e.target.value, 10) || 0;
        stagedPrefs.autoBackupInterval = val;
        if (typeof FrpStore.setAutoBackupInterval === 'function') {
          FrpStore.setAutoBackupInterval(val);
        }
        safeToast(val > 0 ? `Otomatik yedekleme her ${val} dakikada bir ayarlandı ⏱️` : 'Otomatik yedekleme kapatıldı.', 'info');
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
            safeToast(`${count} rapor başarıyla içe aktarıldı! 🎉`, 'success');
            if (typeof window.refreshAll === 'function') window.refreshAll();
            renderModal();
          } else {
            safeToast('Geçersiz yedek dosyası.', 'error');
          }
        };
        reader.readAsText(file);
      });

      overlay.querySelector('#btnActionResetAll')?.addEventListener('click', () => {
        const authUser = window.FrpAuth?.getUser();
        const promptPass = prompt('🚨 DİKKAT: Tüm yüklenen raporları ve veritabanını temizlemek üzeresiniz!\n\nİşlemi onaylamak için lütfen hesap şifrenizi giriniz:');
        if (!promptPass) return;

        fetch('/api/auth/verify-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: authUser?.id || 'admin', password: promptPass })
        }).then(r => r.json()).then(res => {
          if (!res.success || !res.verified) {
            alert('❌ Hata: Girdiğiniz şifre hatalı! İşlem iptal edildi.');
            return;
          }

          window.showConfirmDialog({
            title: 'Tüm Verileri Sıfırla',
            message: 'Şifreniz doğrulandı. Tüm yüklenen raporlar, kategoriler ve veritabanı kalıcı olarak silinecektir! Devam edilsin mi?',
            confirmText: 'Evet, Hepsini Sil',
            isDanger: true,
            onConfirm: () => {
              FrpStore.deleteAll();
              FrpStore.emptyTrash();
              safeToast('Tüm veriler temizlendi ve sıfırlandı.', 'info');
              if (typeof window.refreshAll === 'function') window.refreshAll();
              overlay.remove();
            }
          });
        }).catch(err => {
          alert('Doğrulama hatası: ' + err.message);
        });
      });
    }

    // 8. Admin İşlem Geçmişi (Audit Logs) Olayları
    else if (activeTab === 'audit') {
      let loadedLogs = [];
      const container = overlay.querySelector('#auditLogsContainer');
      const searchInp = overlay.querySelector('#auditSearchInput');
      const filterSelect = overlay.querySelector('#auditActionFilter');
      const btnRefresh = overlay.querySelector('#btnRefreshAuditLogs');
      const btnExportExcel = overlay.querySelector('#btnExportAuditExcel');

      const updateKpis = (logs) => {
        const totalEl = overlay.querySelector('#kpiAuditTotal');
        const filesEl = overlay.querySelector('#kpiAuditFiles');
        const editsEl = overlay.querySelector('#kpiAuditEdits');
        const delsEl = overlay.querySelector('#kpiAuditDeletes');
        if (!totalEl) return;

        const total = (logs || []).length;
        const fileOps = (logs || []).filter(l => ['REPORT_UPLOAD', 'REPORT_UPDATE', 'FRP_DOWNLOAD', 'BULK_DOWNLOAD', 'POOL_ADD', 'POOL_REMOVE', 'POOL_CLONE'].includes(l.action)).length;
        const editOps = (logs || []).filter(l => ['DESIGN_EDIT', 'SQL_EDIT', 'PASCAL_EDIT', 'USERNAME_CHANGE', 'USER_UPDATE'].includes(l.action)).length;
        const delOps = (logs || []).filter(l => ['REPORT_DELETE', 'REPORT_DELETE_BULK', 'TRASH_PURGE', 'TRASH_EMPTY', 'DATA_RESET'].includes(l.action)).length;

        totalEl.textContent = total;
        if (filesEl) filesEl.textContent = fileOps;
        if (editsEl) editsEl.textContent = editOps;
        if (delsEl) delsEl.textContent = delOps;
      };

      const renderLogTable = (logs) => {
        if (!container) return;
        if (!logs || logs.length === 0) {
          container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);"><div style="font-size:2rem;margin-bottom:.5rem;">🔍</div>Herhangi bir işlem kaydı bulunamadı.</div>`;
          return;
        }

        const actionBadges = {
          LOGIN: 'badge-blue',
          REGISTER: 'badge-green',
          USER_UPDATE: 'badge-purple',
          USERNAME_CHANGE: 'badge-purple',
          EMAIL_CHANGE: 'badge-amber',
          DELETE: 'badge-red',
          REPORT_DELETE: 'badge-red',
          REPORT_DELETE_BULK: 'badge-red',
          TRASH_PURGE: 'badge-red',
          TRASH_EMPTY: 'badge-red',
          TRASH_RESTORE: 'badge-green',
          REPORT_UPLOAD: 'badge-green',
          REPORT_UPDATE: 'badge-blue',
          FRP_DOWNLOAD: 'badge-purple',
          BULK_DOWNLOAD: 'badge-purple',
          POOL_ADD: 'badge-green',
          POOL_ADD_BULK: 'badge-green',
          POOL_REMOVE: 'badge-amber',
          POOL_REMOVE_BULK: 'badge-amber',
          POOL_CLONE: 'badge-blue',
          DESIGN_EDIT: 'badge-blue',
          SQL_EDIT: 'badge-purple',
          PASCAL_EDIT: 'badge-amber',
          DATA_RESET: 'badge-red',
          REPORT_EDIT: 'badge-blue',
          AUTO_BACKUP: 'badge-green',
          EXPORT: 'badge-blue'
        };

        const rows = logs.map(l => {
          const dateStr = l.timestamp ? new Date(l.timestamp).toLocaleString('tr-TR') : '-';
          const badgeClass = actionBadges[l.action] || 'badge-blue';
          return `
            <tr style="border-bottom:1px solid var(--border-light);font-size:.78rem;transition:background .12s;">
              <td style="padding:.65rem .85rem;white-space:nowrap;color:var(--text-muted);font-family:var(--mono);">${dateStr}</td>
              <td style="padding:.65rem .85rem;font-weight:700;color:var(--text-primary);">
                <div style="display:flex;align-items:center;gap:.35rem;">
                  <span>@${escHtml(l.username || 'misafir')}</span>
                  ${l.role === 'admin' ? '<span class="badge badge-purple" style="font-size:.65rem;padding:1px 4px;">Admin</span>' : ''}
                </div>
              </td>
              <td style="padding:.65rem .85rem;">
                <span class="badge ${badgeClass}" style="font-size:.7rem;padding:.2rem .5rem;">${escHtml(l.action || 'INFO')}</span>
              </td>
              <td style="padding:.65rem .85rem;font-weight:600;color:var(--accent);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(l.target || '')}">${escHtml(l.target || '-')}</td>
              <td style="padding:.65rem .85rem;color:var(--text-secondary);max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escHtml(l.details || '')}">${escHtml(l.details || '-')}</td>
              <td style="padding:.65rem .85rem;color:var(--text-muted);font-family:var(--mono);">${escHtml(l.ip || '-')}</td>
            </tr>
          `;
        }).join('');

        container.innerHTML = `
          <table style="width:100%;border-collapse:collapse;text-align:left;">
            <thead>
              <tr style="background:var(--bg-raised);border-bottom:1.5px solid var(--border);font-size:.75rem;font-weight:800;color:var(--text-secondary);position:sticky;top:0;z-index:2;">
                <th style="padding:.7rem .85rem;">Zaman</th>
                <th style="padding:.7rem .85rem;">Kullanıcı</th>
                <th style="padding:.7rem .85rem;">İşlem Türü</th>
                <th style="padding:.7rem .85rem;">Hedef</th>
                <th style="padding:.7rem .85rem;">Açıklama / Detay</th>
                <th style="padding:.7rem .85rem;">IP Adresi</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;
      };

      const filterAndDisplayLogs = () => {
        const q = (searchInp?.value || '').toLowerCase().trim();
        const act = filterSelect?.value || '';

        let filtered = loadedLogs;
        if (act) {
          filtered = filtered.filter(l => (l.action || '').toUpperCase() === act.toUpperCase());
        }
        if (q) {
          filtered = filtered.filter(l => 
            (l.username || '').toLowerCase().includes(q) ||
            (l.details || '').toLowerCase().includes(q) ||
            (l.target || '').toLowerCase().includes(q) ||
            (l.action || '').toLowerCase().includes(q) ||
            (l.ip || '').includes(q)
          );
        }
        renderLogTable(filtered);
      };

      const fetchLogs = async () => {
        if (container) {
          container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-muted);"><div class="splash-spinner" style="margin-bottom:.6rem;"></div><div>Kayıtlar yükleniyor...</div></div>`;
        }
        try {
          if (window.FrpAudit && typeof window.FrpAudit.getLogs === 'function') {
            loadedLogs = await window.FrpAudit.getLogs();
          } else {
            const res = await fetch('/api/admin/audit-logs?limit=500', {
              headers: window.FrpAuth ? window.FrpAuth.getAuthHeaders() : {}
            });
            const data = await res.json();
            if (data && data.success && Array.isArray(data.logs)) {
              loadedLogs = data.logs;
            } else {
              loadedLogs = [];
            }
          }
        } catch (e) {
          console.warn('Audit logs fetch hatası:', e.message);
          try {
            const stored = localStorage.getItem('frp_audit_logs');
            loadedLogs = stored ? JSON.parse(stored) : [];
          } catch {
            loadedLogs = [];
          }
        }
        updateKpis(loadedLogs);
        filterAndDisplayLogs();
      };

      searchInp?.addEventListener('input', filterAndDisplayLogs);
      filterSelect?.addEventListener('change', filterAndDisplayLogs);
      btnRefresh?.addEventListener('click', fetchLogs);

      // 📊 EXCEL İNDİRME MOTORU (.xls / XML Spreadsheet)
      btnExportExcel?.addEventListener('click', () => {
        if (!loadedLogs || loadedLogs.length === 0) {
          safeToast('Dışa aktarılacak denetim kaydı bulunamadı.', 'info');
          return;
        }

        const tableRows = loadedLogs.map(l => `
          <tr>
            <td style="border:1px solid #cbd5e1;padding:6px;font-family:Consolas,monospace;">${l.timestamp ? new Date(l.timestamp).toLocaleString('tr-TR') : '-'}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">@${escHtml(l.username || 'misafir')}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${escHtml(l.role || 'user')}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;color:#1e40af;font-weight:bold;">${escHtml(l.action || '-')}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-weight:bold;">${escHtml(l.target || '-')}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;">${escHtml(l.details || '-')}</td>
            <td style="border:1px solid #cbd5e1;padding:6px;font-family:Consolas,monospace;">${escHtml(l.ip || '-')}</td>
          </tr>
        `).join('');

        const excelContent = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
            <!--[if gte mso 9]>
            <xml>
              <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                  <x:ExcelWorksheet>
                    <x:Name>Denetim Günlüğü</x:Name>
                    <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                  </x:ExcelWorksheet>
                </x:ExcelWorksheets>
              </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
              th { background-color: #1e3a8a; color: #ffffff; font-weight: bold; font-family: Segoe UI, sans-serif; font-size: 11pt; padding: 8px; border: 1px solid #93c5fd; }
              td { font-family: Segoe UI, sans-serif; font-size: 10pt; vertical-align: middle; }
              tr:nth-child(even) td { background-color: #f8fafc; }
            </style>
          </head>
          <body>
            <h2 style="font-family:Segoe UI,sans-serif;color:#1e3a8a;margin-bottom:4px;">FrpOku - Kullanıcı İşlem Geçmişi & Denetim Günlüğü</h2>
            <p style="font-family:Segoe UI,sans-serif;font-size:10pt;color:#64748b;margin-top:0;">Dışa Aktarma Tarihi: ${new Date().toLocaleString('tr-TR')} | Toplam Kayıt: ${loadedLogs.length}</p>
            <table style="border-collapse:collapse;width:100%;">
              <thead>
                <tr>
                  <th style="width:160px;">Zaman</th>
                  <th style="width:140px;">Kullanıcı</th>
                  <th style="width:100px;">Rol</th>
                  <th style="width:160px;">İşlem Türü</th>
                  <th style="width:200px;">Hedef</th>
                  <th style="width:380px;">Açıklama / Detay</th>
                  <th style="width:120px;">IP Adresi</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </body>
          </html>
        `;

        const blob = new Blob(['\uFEFF' + excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `denetim_gunlugu_${new Date().toISOString().slice(0, 10)}.xls`;
        link.click();
        URL.revokeObjectURL(url);
        safeToast('Denetim günlüğü Excel tablosu (.xls) olarak indirildi! 📊', 'success');
      });

      fetchLogs();
    }

    // Profil E-posta Güncelleme Butonu (Geri Al Destekli)
    overlay.querySelector('#btnUpdateEmailDirectly')?.addEventListener('click', async () => {
      const emailInput = overlay.querySelector('#profEmail');
      const newEmail = (emailInput?.value || '').trim();
      const authUser = window.FrpAuth?.getUser();
      const oldEmail = authUser?.email || stagedProfile.email || '';

      if (!newEmail || !newEmail.includes('@')) {
        safeToast('Lütfen geçerli bir e-posta adresi giriniz.', 'warning');
        return;
      }

      if (newEmail.toLowerCase() === oldEmail.toLowerCase()) {
        safeToast('Girilen e-posta adresi zaten mevcut adresinizle aynı.', 'info');
        return;
      }

      try {
        const res = await fetch('/api/auth/change-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: authUser?.id || 'admin', newEmail })
        });
        const data = await res.json();
        if (data.success) {
          stagedProfile.email = newEmail;
          FrpStore.setUserProfile(stagedProfile);
          if (window.FrpAuth && typeof window.FrpAuth.updateSession === 'function') {
            window.FrpAuth.updateSession({ email: newEmail });
          }

          if (window.FrpAudit) {
            window.FrpAudit.logAction({
              action: 'EMAIL_CHANGE',
              target: newEmail,
              details: `Kullanıcı e-posta adresi güncellendi: ${oldEmail} ➔ ${newEmail}`
            });
          }

          if (typeof window.showUndoToast === 'function') {
            window.showUndoToast({
              title: 'E-Posta Güncellendi ✅',
              message: `Yeni e-posta adresiniz '${newEmail}' olarak kaydedildi.`,
              undoText: '↩️ Geri Al',
              duration: 8500,
              onUndo: async () => {
                try {
                  const revRes = await fetch('/api/auth/change-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: authUser?.id || 'admin', newEmail: oldEmail })
                  });
                  const revData = await revRes.json();
                  if (revData.success) {
                    stagedProfile.email = oldEmail;
                    FrpStore.setUserProfile(stagedProfile);
                    if (window.FrpAuth && typeof window.FrpAuth.updateSession === 'function') {
                      window.FrpAuth.updateSession({ email: oldEmail });
                    }
                    if (emailInput) emailInput.value = oldEmail;
                    if (window.FrpAudit) {
                      window.FrpAudit.logAction({
                        action: 'EMAIL_CHANGE',
                        target: oldEmail,
                        details: `E-posta değişikliği geri alındı: ${newEmail} ➔ ${oldEmail}`
                      });
                    }
                    safeToast(`E-posta adresi geri alındı: ${oldEmail} ↩️`, 'info');
                  }
                } catch (revErr) {
                  safeToast('Geri alma hatası: ' + revErr.message, 'error');
                }
              }
            });
          } else {
            safeToast('E-posta adresiniz başarıyla güncellendi! ✅', 'success');
          }
        } else {
          safeToast(data.reason || 'E-posta güncellenemedi.', 'error');
        }
      } catch (e) {
        safeToast('Hata: ' + e.message, 'error');
      }
    });
  }

  renderModal();
  document.body.appendChild(overlay);
};
