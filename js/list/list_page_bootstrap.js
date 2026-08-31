(() => {
  function dismissSplash() {
    const splash = document.getElementById('splashScreen');
    if (!splash) return;
    splash.style.transition = 'opacity 0.25s ease, visibility 0.25s ease';
    splash.style.pointerEvents = 'none';
    splash.style.opacity = '0';
    splash.style.visibility = 'hidden';
    setTimeout(() => {
      if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    }, 300);
  }

  // İlk 500ms ve sayfa tam yüklendiğinde kapat
  setTimeout(dismissSplash, 500);
  if (document.readyState === 'complete') {
    setTimeout(dismissSplash, 50);
  } else {
    window.addEventListener('load', () => setTimeout(dismissSplash, 50));
    document.addEventListener('DOMContentLoaded', () => setTimeout(dismissSplash, 200));
  }

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
