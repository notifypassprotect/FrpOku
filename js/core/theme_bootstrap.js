(() => {
  const theme = localStorage.getItem('frpoku_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const uiMode = localStorage.getItem('frpoku_ui_mode') || 'modern';
  document.documentElement.setAttribute('data-ui-mode', uiMode);
})();
