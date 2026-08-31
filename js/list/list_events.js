(() => {
  const decoded = value => decodeURIComponent(String(value || ''));

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-list-action]');
    if (!target) return;
    const action = target.dataset.listAction;
    const id = decoded(target.dataset.id);

    if (action === 'dashboard') window.location.href = 'dashboard.html';
    else if (action === 'open-detail') window.openDetail?.(id);
    else if (action === 'category') { event.stopPropagation(); window.openCategoryModalFor?.(id); }
    else if (action === 'copy-guid') { event.stopPropagation(); window.copyGuidText?.(decoded(target.dataset.value)); }
    else if (action === 'toggle-pin') window.togglePin?.(event, id);
    else if (action === 'toggle-fav') window.toggleFav?.(event, id);
    else if (action === 'row') window.handleItemClick?.(event, id);
    else if (action === 'download') window.downloadSingleReport?.(id);
    else if (action === 'stop') event.stopPropagation();
  });

  document.addEventListener('change', event => {
    const target = event.target.closest('[data-list-change="select"]');
    if (target) window.toggleSelect?.(event, decoded(target.dataset.id));
  });
})();
