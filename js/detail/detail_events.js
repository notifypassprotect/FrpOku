(() => {
  const decoded = value => decodeURIComponent(String(value || ''));
  const call = (name, ...args) => typeof window[name] === 'function' ? window[name](...args) : undefined;
  const closeModal = target => target.closest('.modal-overlay')?.remove();

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-detail-action]');
    if (!target) return;
    const action = target.dataset.detailAction;
    const tab = decoded(target.dataset.tab);
    const index = Number(target.dataset.index);
    const line = Number(target.dataset.line);

    if (action === 'open-index') window.location.href = 'index.html';
    else if (action === 'remove-tag') call('removeTagFromDetail', decoded(target.dataset.value));
    else if (action === 'copy-guid') call('copyGuidText', decoded(target.dataset.value));
    else if (action === 'export-sql') call('exportSqlQueryModal', index);
    else if (action === 'export-json') call('exportReportJson');
    else if (action === 'export-html') call('exportHtmlDoc');
    else if (action === 'format-sql') call('formatSqlInTab', tab, target.dataset.mode);
    else if (action === 'minify-sql') call('minifySqlInTab', tab);
    else if (action === 'change-case') call('changeSqlCaseInTab', tab);
    else if (action === 'complexity') call('openComplexityModal', index);
    else if (action === 'snippet') call('addToSnippetLibrary', index);
    else if (action === 'param') call('openParamInjector', index);
    else if (action === 'check-pascal') call('checkPascalSyntaxInTab');
    else if (action === 'last-edit') call('openLastEditDiffModal', tab);
    else if (action === 'toggle-edit') call('toggleEditMode', tab);
    else if (action === 'copy-tab') call('copyTabCode', tab, target);
    else if (action === 'save-edit') call('saveEditMode', tab);
    else if (action === 'save-download') call('saveAndDownloadEditMode', tab);
    else if (action === 'cancel-edit') call('cancelEditMode', tab);
    else if (action === 'jump-editor') {
      call('jumpToEditorLine', tab, line, decoded(target.dataset.token));
      if (target.dataset.closeModal === 'true') closeModal(target);
    } else if (action === 'all-syntax') call('openAllSyntaxErrorsModal', tab);
    else if (action === 'copy-text') {
      navigator.clipboard.writeText(decoded(target.dataset.value)).then(() => call('showToast', 'Kopyalandı', 'success'));
    } else if (action === 'scroll-pascal') {
      call('scrollToPascalLine', line);
      if (target.dataset.closeModal === 'true') closeModal(target);
    } else if (action === 'copy-data-tree') {
      call('copyDataTreeField', decoded(target.dataset.query), decoded(target.dataset.field));
    } else if (action === 'switch-dialog-tab') {
      call('switchDialogTab', target, target.dataset.controlIndex, Number(target.dataset.tabIndex));
    }
  });
})();
