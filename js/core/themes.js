// ============================================================
//  themes.js — Kod Tema Yöneticisi (5 Tema, Offline)
//  Temalar: frpoku-dark, frpoku-light, dracula, github-dark, monokai
// ============================================================
(function () {
  'use strict';

  const THEME_CODE_KEY = 'frpoku_code_theme';

  const CODE_THEMES = [
    { id: 'frpoku-dark',  label: '🌙 FrpOku Dark',  icon: '🌙' },
    { id: 'frpoku-light', label: '☀️ FrpOku Light', icon: '☀️' },
    { id: 'dracula',      label: '🧛 Dracula',       icon: '🧛' },
    { id: 'github-dark',  label: '🐙 GitHub Dark',  icon: '🐙' },
    { id: 'monokai',      label: '🟠 Monokai',       icon: '🟠' },
    { id: 'nord',         label: '❄️ Nord Frost',    icon: '❄️' },
    { id: 'tokyo-night',  label: '🌆 Tokyo Night',  icon: '🌆' }
  ];

  function getCodeTheme() {
    return localStorage.getItem(THEME_CODE_KEY) || 'frpoku-dark';
  }

  function applyCodeTheme(themeId) {
    // Eski tema class'larını kaldır
    CODE_THEMES.forEach(t => document.documentElement.classList.remove('code-theme-' + t.id));
    document.documentElement.classList.add('code-theme-' + themeId);
    localStorage.setItem(THEME_CODE_KEY, themeId);
  }

  function initCodeTheme() {
    applyCodeTheme(getCodeTheme());
  }

  /**
   * Tema seçici dropdown oluştur ve verilen container'a ekle
   */
  function createThemeSelector(container) {
    if (!container) return;

    const wrap = document.createElement('div');
    wrap.className = 'theme-selector-wrap';
    wrap.innerHTML = `
      <label class="theme-selector-label">🎨 Kod Teması</label>
      <select class="theme-selector-select" id="codeThemeSelect">
        ${CODE_THEMES.map(t => `
          <option value="${t.id}" ${getCodeTheme() === t.id ? 'selected' : ''}>${t.label}</option>
        `).join('')}
      </select>
    `;
    container.appendChild(wrap);

    const sel = wrap.querySelector('#codeThemeSelect');
    sel.addEventListener('change', () => {
      applyCodeTheme(sel.value);
    });
  }

  // Public API
  window.FrpThemes = {
    CODE_THEMES,
    getCodeTheme,
    applyCodeTheme,
    initCodeTheme,
    createThemeSelector
  };

  // Otomatik uygula
  initCodeTheme();
})();
