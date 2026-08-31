(() => {
  const theme = localStorage.getItem('frpoku_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();
