(() => {
  setTimeout(() => {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;
    splash.style.pointerEvents = 'none';
    splash.style.opacity = '0';
    splash.style.visibility = 'hidden';
    setTimeout(() => splash.remove(), 420);
  }, 450);

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f' && !['TEXTAREA', 'INPUT'].includes(event.target.tagName)) {
      event.preventDefault();
      document.getElementById('searchInput')?.focus();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      window.exportReportListExcel?.();
    }
  });
})();
