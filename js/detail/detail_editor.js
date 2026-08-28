// ============================================================
//  detail_editor.js — Detay Sayfası Canlı Kod Editörü & Gutter Motoru
// ============================================================

window.FrpDetailEditor = window.FrpDetailEditor || {};

(function () {
  'use strict';

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  window.FrpDetailEditor.updateCursorInfo = function(tabId) {
    const editArea = document.getElementById(tabId + '_editarea');
    const posEl = document.getElementById(tabId + '_cursor_pos');
    if (!editArea || !posEl) return;
    const val = editArea.value || '';
    const selStart = editArea.selectionStart || 0;
    const lines = val.slice(0, selStart).split('\n');
    const lineNum = lines.length;
    const colNum = lines[lines.length - 1].length + 1;
    const totalLines = val.split('\n').length;
    posEl.innerHTML = `📍 Satır: <strong>${lineNum}</strong>, Sütun: <strong>${colNum}</strong> <span style="opacity:.6;margin-left:.3rem;">(Toplam ${totalLines} Satır)</span>`;
  };

  window.FrpDetailEditor.jumpToLine = function(tabId, targetLine, token) {
    const editWrap = document.getElementById(tabId + '_editorwrap');
    if (editWrap && editWrap.style.display === 'none') {
      if (typeof window.toggleEditMode === 'function') window.toggleEditMode(tabId);
    }

    setTimeout(() => {
      const ta = document.getElementById(tabId + '_editarea');
      const bd = document.getElementById(tabId + '_backdrop');
      const gt = document.getElementById(tabId + '_gutter');
      if (!ta) return;
      const lines = ta.value.split('\n');
      let pos = 0;
      for (let i = 0; i < Math.min(targetLine - 1, lines.length); i++) {
        pos += lines[i].length + 1;
      }
      const lineText = lines[targetLine - 1] || '';
      let tokenOffset = 0;
      if (token && lineText.includes(token)) {
        tokenOffset = lineText.indexOf(token);
      }
      const targetPos = pos + tokenOffset;
      ta.focus();
      ta.setSelectionRange(targetPos, targetPos + (token ? token.length : 0));

      const lineHeight = 22.1;
      const targetScroll = Math.max(0, (targetLine - 6) * lineHeight);
      ta.scrollTop = targetScroll;
      if (bd) bd.scrollTop = targetScroll;
      if (gt) gt.scrollTop = targetScroll;

      if (bd) {
        const lineEl = bd.querySelector(`.code-line-raw[data-line="${targetLine}"]`);
        if (lineEl) {
          lineEl.classList.add('flash-jump-line');
          setTimeout(() => lineEl.classList.remove('flash-jump-line'), 1600);
        }
      }
      window.FrpDetailEditor.updateCursorInfo(tabId);
    }, 60);
  };

  window.FrpDetailEditor.measureTextareaSelectionAnchor = function(textarea, selectionEnd) {
    const mirror = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    const copiedStyles = [
      'boxSizing', 'width', 'height', 'overflowX', 'overflowY', 'paddingTop', 'paddingRight',
      'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth',
      'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
      'lineHeight', 'tabSize', 'MozTabSize', 'textAlign', 'textTransform', 'textIndent', 'direction'
    ];

    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.pointerEvents = 'none';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';

    copiedStyles.forEach(prop => { mirror.style[prop] = style[prop]; });

    const textBefore = textarea.value.slice(0, selectionEnd);
    mirror.textContent = textBefore;

    const caretMarker = document.createElement('span');
    caretMarker.textContent = '\u200b';
    mirror.appendChild(caretMarker);

    document.body.appendChild(mirror);
    const caretRect = caretMarker.getBoundingClientRect();
    const taRect = textarea.getBoundingClientRect();
    document.body.removeChild(mirror);

    return {
      top: taRect.top + (caretRect.top - mirror.getBoundingClientRect().top) - textarea.scrollTop,
      left: taRect.left + (caretRect.left - mirror.getBoundingClientRect().left) - textarea.scrollLeft
    };
  };
})();
