let searchDebounceTimer = null;

function performCodeSearch(immediate = false) {
  if (!codeSearchInput) return;

  if (!immediate) {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => _executeCodeSearch(), 100);
  } else {
    _executeCodeSearch();
  }
}

function _executeCodeSearch() {
  if (!codeSearchInput) return;
  const q = codeSearchInput.value.trim();
  matchElements = [];
  currentMatchIdx = -1;

  const activePanel = document.querySelector('.code-panel.active');
  if (!activePanel) return;

  const activeTabObj = activeTabs.find(t => document.getElementById(t.id + '_panel')?.classList.contains('active'));
  if (!activeTabObj || activeTabObj.isTree) {
    if (codeSearchCount) codeSearchCount.textContent = '';
    return;
  }

  const scroll = activePanel.querySelector('.code-scroll');
  if (!scroll) return;

  if (!q) {
    if (codeSearchCount) codeSearchCount.textContent = '';
    scroll.innerHTML = buildLineTable(activeTabObj.rawCode, activeTabObj.highlightFn);
    return;
  }

  const lines = (activeTabObj.rawCode || '').split('\n');
  const digits = String(lines.length).length;
  const rx = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');

  let html = '<div class="code-table">';

  lines.forEach((line, i) => {
    const highlighted = activeTabObj.highlightFn(line);
    const markedHtml = highlighted.replace(rx, '<mark class="code-match">$1</mark>');

    html += `<div class="code-line">` +
      `<span class="line-num">${String(i + 1).padStart(digits, ' ')}</span>` +
      `<span class="line-src">${markedHtml}</span>` +
      `</div>`;
  });
  html += '</div>';

  scroll.innerHTML = html;

  matchElements = Array.from(scroll.querySelectorAll('mark.code-match'));
  if (codeSearchCount) codeSearchCount.textContent = `${matchElements.length} eşleşme`;

  if (matchElements.length > 0) {
    currentMatchIdx = 0;
    highlightCurrentMatch();
  }
}

function navigateMatch(direction) {
  if (matchElements.length === 0) return;
  currentMatchIdx += direction;
  if (currentMatchIdx < 0) currentMatchIdx = matchElements.length - 1;
  if (currentMatchIdx >= matchElements.length) currentMatchIdx = 0;
  highlightCurrentMatch();
}

function highlightCurrentMatch() {
  matchElements.forEach((el, idx) => {
    const isCur = idx === currentMatchIdx;
    el.classList.toggle('current', isCur);
    if (isCur) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
  if (codeSearchCount) codeSearchCount.textContent = `${currentMatchIdx + 1}/${matchElements.length}`;
}

// Enter & Shift+Enter Arama Gezintisi
document.addEventListener('DOMContentLoaded', () => {
  const searchInp = document.getElementById('codeSearchInput');
  if (searchInp) {
    searchInp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        navigateMatch(e.shiftKey ? -1 : 1);
      }
    });
  }
});

window.performCodeSearch = performCodeSearch;
window.navigateMatch = navigateMatch;

