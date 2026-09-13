(() => {
  const decoded = value => decodeURIComponent(String(value || ''));
  let activeAnalysis = '';

  const analysisActions = {
    dependencies: () => window.openDependenciesModal?.(),
    params: () => window.openParamsModal?.(),
    snippets: () => window.renderSnippetsModal?.()
  };

  async function runAnalysis(action) {
    if (activeAnalysis) {
      window.toast?.('Bir analiz penceresi hazırlanıyor, lütfen kısa bir süre bekleyin.', 'info');
      return;
    }
    const handler = analysisActions[action];
    if (!handler) return;
    document.querySelectorAll('.topbar-dropdown.open').forEach(dropdown => dropdown.classList.remove('open'));
    activeAnalysis = action;
    try {
      if (window.FrpStoreReady && typeof window.FrpStoreReady.then === 'function') {
        await window.FrpStoreReady.catch(() => null);
      }
      const result = handler();
      if (result === undefined && !(
        (action === 'dependencies' && window.openDependenciesModal) ||
        (action === 'params' && window.openParamsModal) ||
        (action === 'snippets' && window.renderSnippetsModal)
      )) throw new Error('Analiz modülü yüklenemedi.');
      await Promise.resolve(result);
    } catch (error) {
      window.toast?.(error?.message || 'Analiz hazırlanırken bir sorun oluştu.', 'error');
    } finally {
      activeAnalysis = '';
    }
  }

  window.runListAnalysis = runAnalysis;

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-list-action]');
    if (!target) return;
    const action = target.dataset.listAction;
    const id = decoded(target.dataset.id);

    if (analysisActions[action]) {
      event.preventDefault();
      event.stopPropagation();
      runAnalysis(action);
      return;
    }

    if (action === 'dashboard') window.location.href = 'dashboard.html';
    else if (action === 'open-detail') window.openDetail?.(id);
    else if (action === 'category') { event.stopPropagation(); window.openCategoryModalFor?.(id); }
    else if (action === 'copy-guid') { event.stopPropagation(); window.copyGuidText?.(decoded(target.dataset.value)); }
    else if (action === 'toggle-pin') window.togglePin?.(event, id);
    else if (action === 'toggle-fav') window.toggleFav?.(event, id);
    else if (action === 'row') window.handleItemClick?.(event, id);
    else if (action === 'download') window.downloadSingleReport?.(id);
    else if (action === 'recent') window.openRecentModal?.();
    else if (action === 'downloads') window.openDownloadHistoryModal?.();
    else if (action === 'stop') event.stopPropagation();
  });

  document.addEventListener('change', event => {
    const target = event.target.closest('[data-list-change="select"]');
    if (target) window.toggleSelect?.(event, decoded(target.dataset.id));
  });
})();
