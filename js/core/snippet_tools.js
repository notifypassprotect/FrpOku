/**
 * FrpOku - Snippet Tools (Sorgu Kütüphanesi Yardımcıları)
 */

function addToSnippetLibrary(queryIndex) {
  const toastFn = window.showToast || window.toast || alert;
  const store = window.FrpStore || (typeof FrpStore !== 'undefined' ? FrpStore : null);

  // 1. window.currentFile al ya da URL'den yükle
  let file = window.currentFile;
  if (!file && store && typeof store.getById === 'function') {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      file = store.getById(id);
      if (file) window.currentFile = file;
    }
  }

  if (!file || !Array.isArray(file.queries) || !file.queries[queryIndex]) {
    toastFn('Sorgu verisi bulunamadı.', 'error');
    return;
  }
  if (!store || typeof store.addSnippet !== 'function') {
    toastFn('Depolama servisine erişilemedi.', 'error');
    return;
  }

  const query = file.queries[queryIndex];
  const reportName = file.meta?.reportName || file.name || '—';

  // Canlı editörde kaydedilmemiş değişiklik varsa öncelikle canlı metni al
  let sqlToSave = query.sql || '';
  const tabId = `tab_sql_${queryIndex}`;
  const editArea = document.getElementById(`${tabId}_editarea`);
  if (editArea && editArea.value) {
    sqlToSave = editArea.value;
  }

  const snippetTitle = query.name || 'SQL Sorgusu';
  
  // Çift kayıt uyarısı / kontrolü
  const existingSnippets = FrpStore.getSnippets ? FrpStore.getSnippets() : [];
  const isDuplicate = existingSnippets.some(s => s.sql === sqlToSave && s.reportName === reportName);

  FrpStore.addSnippet(snippetTitle, sqlToSave, reportName);
  
  if (isDuplicate) {
    toastFn(`'${snippetTitle}' kütüphaneye tekrar eklendi.`, 'info');
  } else {
    toastFn(`'${snippetTitle}' kütüphaneye eklendi.`, 'success');
  }
}

/**
 * Aktif kütüphane modalinden detay sayfasındaki aktif sekmeye / editöre SQL yapıştırma
 */
function insertSnippetToActiveEditor(sqlText) {
  if (!sqlText) return false;

  const activePanel = document.querySelector('.code-panel.active');
  if (activePanel) {
    const editArea = activePanel.querySelector('.edit-mode-textarea');
    if (editArea) {
      const start = editArea.selectionStart || 0;
      const end = editArea.selectionEnd || 0;
      const val = editArea.value || '';
      
      let newVal = '';
      let newCursorPos = 0;

      if (start !== end) {
        newVal = val.substring(0, start) + sqlText.trim() + val.substring(end);
        newCursorPos = start + sqlText.trim().length;
      } else if (!val.trim()) {
        newVal = sqlText.trim();
        newCursorPos = newVal.length;
      } else {
        const before = val.substring(0, start);
        const after = val.substring(end);
        const needsLeadingNewline = before.length > 0 && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
        const needsTrailingNewline = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
        newVal = before + needsLeadingNewline + sqlText.trim() + needsTrailingNewline + after;
        newCursorPos = (before + needsLeadingNewline + sqlText.trim()).length;
      }

      editArea.value = newVal;
      editArea.focus();
      editArea.selectionStart = newCursorPos;
      editArea.selectionEnd = newCursorPos;
      editArea.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
  }

  return false;
}

window.addToSnippetLibrary = addToSnippetLibrary;
window.insertSnippetToActiveEditor = insertSnippetToActiveEditor;