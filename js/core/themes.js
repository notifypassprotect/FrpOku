// ============================================================
//  themes.js — Gelişmiş Tema Yöneticisi (13 Renk Teması, Offline)
// ============================================================
(function () {
  'use strict';

  const THEME_CODE_KEY = 'frpoku_code_theme';
  const THEME_UI_KEY = 'frpoku_ui_theme';

  const CODE_THEMES = [
    { id: 'frpoku-dark',      label: '🌙 FrpOku Dark',      icon: '🌙' },
    { id: 'frpoku-light',     label: '☀️ FrpOku Light',     icon: '☀️' },
    { id: 'dracula',          label: '🧛 Dracula',           icon: '🧛' },
    { id: 'github-dark',      label: '🐙 GitHub Dark',      icon: '🐙' },
    { id: 'monokai',          label: '🟠 Monokai',           icon: '🟠' },
    { id: 'nord',             label: '❄️ Nord Frost',        icon: '❄️' },
    { id: 'tokyo-night',      label: '🌆 Tokyo Night',      icon: '🌆' },
    { id: 'cyberpunk',        label: '🟣 Cyberpunk Neon',   icon: '🟣' },
    { id: 'matrix',           label: '🟢 Matrix Emerald',   icon: '🟢' },
    { id: 'synthwave',        label: '🌅 Synthwave Sunset', icon: '🌅' },
    { id: 'deep-ocean',       label: '🌌 Deep Ocean Blue',  icon: '🌌' },
    { id: 'solarized-light',  label: '☀️ Solarized Light',  icon: '☀️' },
    { id: 'solarized-dark',   label: '🌑 Solarized Dark',   icon: '🌑' }
  ];

  function getCodeTheme() {
    return localStorage.getItem(THEME_CODE_KEY) || 'frpoku-dark';
  }

  function applyCodeTheme(themeId) {
    const valid = CODE_THEMES.some(t => t.id === themeId);
    const target = valid ? themeId : 'frpoku-dark';

    // Eski tema class'larını kaldır
    CODE_THEMES.forEach(t => {
      document.documentElement.classList.remove('code-theme-' + t.id);
      document.documentElement.classList.remove('ui-theme-' + t.id);
    });

    document.documentElement.classList.add('code-theme-' + target);
    document.documentElement.classList.add('ui-theme-' + target);
    localStorage.setItem(THEME_CODE_KEY, target);
    localStorage.setItem(THEME_UI_KEY, target);

    // Varsa tüm select'leri senkronize et
    document.querySelectorAll('.theme-selector-select, #codeThemeSelect, #themeSelect').forEach(el => {
      if (el.value !== target) el.value = target;
    });

    // Custom event fırlat
    window.dispatchEvent(new CustomEvent('frpoku:themeChanged', { detail: { themeId: target } }));
  }

  function initCodeTheme() {
    applyCodeTheme(getCodeTheme());
  }

  /**
   * Tema seçici dropdown oluştur ve verilen container'a ekle
   */
  function createThemeSelector(container, customLabel = '🎨 Renk Teması') {
    if (!container) return null;

    const wrap = document.createElement('div');
    wrap.className = 'theme-selector-wrap';
    wrap.innerHTML = `
      <label class="theme-selector-label">${customLabel}</label>
      <select class="theme-selector-select" aria-label="Tema Seçimi">
        ${CODE_THEMES.map(t => `
          <option value="${t.id}" ${getCodeTheme() === t.id ? 'selected' : ''}>${t.label}</option>
        `).join('')}
      </select>
    `;
    container.appendChild(wrap);

    const sel = wrap.querySelector('.theme-selector-select');
    sel.addEventListener('change', () => {
      applyCodeTheme(sel.value);
    });

    return wrap;
  }

  // Public API
  window.FrpThemes = {
    CODE_THEMES,
    getCodeTheme,
    applyCodeTheme,
    initCodeTheme,
    createThemeSelector
  };

  // Sayfa yüklendiğinde otomatik uygula
  initCodeTheme();
})();
