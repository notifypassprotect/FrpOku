// ============================================================
//  themes.js — Gelişmiş Tema Yöneticisi (13 Renk Teması & Canlı Senkronizasyon)
// ============================================================
(function () {
  'use strict';

  const THEME_CODE_KEY = 'frpoku_code_theme';
  const THEME_UI_KEY = 'frpoku_ui_theme';
  const THEME_GLOBAL_KEY = 'frpoku_theme';

  const CODE_THEMES = [
    { id: 'frpoku-light',     label: 'Açık Tema (FrpOku Light)' },
    { id: 'frpoku-dark',      label: 'Koyu Tema (FrpOku Dark)' },
    { id: 'dracula',          label: 'Dracula' },
    { id: 'github-dark',      label: 'GitHub Dark' },
    { id: 'monokai',          label: 'Monokai' },
    { id: 'nord',             label: 'Nord Frost' },
    { id: 'tokyo-night',      label: 'Tokyo Night' },
    { id: 'cyberpunk',        label: 'Cyberpunk Neon' },
    { id: 'matrix',           label: 'Matrix Emerald' },
    { id: 'synthwave',        label: 'Synthwave Sunset' },
    { id: 'deep-ocean',       label: 'Deep Ocean Blue' },
    { id: 'solarized-light',  label: 'Solarized Light' },
    { id: 'solarized-dark',   label: 'Solarized Dark' }
  ];

  function getCodeTheme() {
    const saved = localStorage.getItem(THEME_CODE_KEY);
    if (saved) return saved;
    const globalT = getGlobalTheme();
    return globalT === 'dark' ? 'frpoku-dark' : 'frpoku-light';
  }

  function getGlobalTheme() {
    let t = localStorage.getItem(THEME_GLOBAL_KEY);
    if (!t) {
      try {
        const p = JSON.parse(localStorage.getItem('frpoku_preferences') || '{}');
        if (p && p.theme) t = p.theme;
      } catch (e) {}
    }
    return t === 'dark' ? 'dark' : 'light';
  }

  function applyCodeTheme(themeId, skipStorage = false) {
    const valid = CODE_THEMES.some(t => t.id === themeId);
    const target = valid ? themeId : (getGlobalTheme() === 'dark' ? 'frpoku-dark' : 'frpoku-light');

    // Eski tema class'larını kaldır
    CODE_THEMES.forEach(t => {
      document.documentElement.classList.remove('code-theme-' + t.id);
      document.documentElement.classList.remove('ui-theme-' + t.id);
    });

    document.documentElement.classList.add('code-theme-' + target);
    document.documentElement.classList.add('ui-theme-' + target);
    if (document.body) {
      CODE_THEMES.forEach(t => {
        document.body.classList.remove('code-theme-' + t.id);
        document.body.classList.remove('ui-theme-' + t.id);
      });
      document.body.classList.add('code-theme-' + target);
      document.body.classList.add('ui-theme-' + target);
    }
    
    // UI tema eşlemesi (light / dark)
    const isDark = target === 'frpoku-dark' || target === 'dracula' || target === 'github-dark' || 
                   target === 'monokai' || target === 'nord' || target === 'tokyo-night' || target === 'cyberpunk' || 
                   target === 'matrix' || target === 'synthwave' || target === 'deep-ocean' || 
                   target === 'solarized-dark';
    const uiTheme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', uiTheme);
    if (document.body) document.body.setAttribute('data-theme', uiTheme);

    if (!skipStorage) {
      try {
        localStorage.setItem(THEME_CODE_KEY, target);
        localStorage.setItem(THEME_UI_KEY, target);
        localStorage.setItem(THEME_GLOBAL_KEY, uiTheme);
        const prefs = JSON.parse(localStorage.getItem('frpoku_preferences') || '{}');
        prefs.theme = uiTheme;
        localStorage.setItem('frpoku_preferences', JSON.stringify(prefs));
      } catch (e) {}
    }

    // Varsa tüm select'leri senkronize et
    document.querySelectorAll('.theme-selector-select, #codeThemeSelect, #themeSelect').forEach(el => {
      if (el.value !== target) el.value = target;
    });

    // Tema düğmelerini güncelle
    document.querySelectorAll('#btnThemeToggle').forEach(btn => {
      btn.textContent = uiTheme === 'dark' ? 'Aydınlık Mod' : 'Koyu Mod';
    });

    // Custom event fırlat
    window.dispatchEvent(new CustomEvent('frpoku:themeChanged', { detail: { themeId: target, uiTheme } }));
  }

  function setTheme(theme) {
    const isDark = theme === 'dark';
    const targetCodeTheme = isDark ? 'frpoku-dark' : 'frpoku-light';
    applyCodeTheme(targetCodeTheme);
  }

  function initCodeTheme() {
    const savedGlobal = getGlobalTheme();
    const isDark = savedGlobal === 'dark';
    const savedCode = localStorage.getItem(THEME_CODE_KEY);
    
    if (savedCode) {
      applyCodeTheme(savedCode);
    } else {
      applyCodeTheme(isDark ? 'frpoku-dark' : 'frpoku-light');
    }
  }

  /**
   * Tema seçici dropdown oluştur ve verilen container'a ekle
   */
  function createThemeSelector(container, customLabel = 'Renk Teması') {
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

  // Tarayıcı sekmeleri ve pencereler arası senkronizasyon (Storage Event)
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_CODE_KEY && e.newValue) {
      applyCodeTheme(e.newValue, true);
    } else if (e.key === THEME_GLOBAL_KEY && e.newValue) {
      document.documentElement.setAttribute('data-theme', e.newValue);
      const isDark = e.newValue === 'dark';
      document.querySelectorAll('#btnThemeToggle').forEach(btn => {
        btn.textContent = isDark ? 'Aydınlık Mod' : 'Koyu Mod';
      });
    }
  });

  // Global Theme Toggle Click Handler
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#btnThemeToggle');
    if (btn) {
      e.preventDefault();
      const cur = getGlobalTheme();
      const next = cur === 'dark' ? 'light' : 'dark';
      setTheme(next);
    }
  });

  // Public API
  window.FrpThemes = {
    CODE_THEMES,
    getCodeTheme,
    getGlobalTheme,
    applyCodeTheme,
    setTheme,
    initCodeTheme,
    createThemeSelector
  };

  // Sayfa yüklendiğinde otomatik uygula
  initCodeTheme();
})();
