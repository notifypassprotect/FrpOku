// ============================================================
//  outline.js — PascalScript AST & Fonksiyon Ağacı Ayrıştırıcısı
//  Procedur, Function, Event Handler ve Global Değişken Tespiti
//  FrpOku v5 — Offline, bağımlılıksız.
// ============================================================
(function () {
  'use strict';

  /**
   * PascalScript kodundan fonksiyon, prosedür, olay ve değişken ağacı çıkarır
   */
  function parseOutline(code) {
    if (!code || !code.trim()) return { items: [], stats: { procedures: 0, functions: 0, events: 0, vars: 0 } };

    const lines = code.split('\n');
    const items = [];
    const stats = { procedures: 0, functions: 0, events: 0, vars: 0 };

    // 1. Prosedür ve Fonksiyonlar (procedure Name(args): type;)
    const procRx = /^\s*(procedure|function)\s+([a-zA-Z0-9_]+)\s*(\([^)]*\))?\s*(?::\s*([a-zA-Z0-9_]+))?/i;

    // 2. Global var / const tanımları
    const varRx = /^\s*var\s+([a-zA-Z0-9_,\s]+):\s*([a-zA-Z0-9_]+)/i;

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;

      const procMatch = lineText.match(procRx);
      if (procMatch) {
        const kind  = procMatch[1].toLowerCase();
        const name  = procMatch[2];
        const params = procMatch[3] || '()';
        const returnType = procMatch[4] || '';

        const isEvent = /OnBeforePrint|OnAfterPrint|OnManualBuild|OnClick|OnGetValue/i.test(name);
        if (kind === 'function') stats.functions++;
        else stats.procedures++;
        if (isEvent) stats.events++;

        items.push({
          type: isEvent ? 'event' : kind,
          name,
          params,
          returnType,
          line: lineNum,
          codeSnippet: lineText.trim()
        });
        return;
      }

      const varMatch = lineText.match(varRx);
      if (varMatch) {
        stats.vars++;
        items.push({
          type: 'var',
          name: varMatch[1].trim(),
          params: '',
          returnType: varMatch[2],
          line: lineNum,
          codeSnippet: lineText.trim()
        });
      }
    });

    return { items, stats };
  }

  /**
   * Outline ağacını HTML listesi olarak render eder
   */
  function renderOutlineTree(container, outlineData, onSelectLine) {
    if (!container || !outlineData) return;

    const { items, stats } = outlineData;

    if (items.length === 0) {
      container.innerHTML = '<div style="font-size:.78rem;color:var(--text-muted);padding:.5rem;">Tanımlı prosedür veya fonksiyon bulunamadı.</div>';
      return;
    }

    const typeIcons = {
      procedure: 'P',
      function:  'ƒ',
      event:     'E',
      var:       'V'
    };

    const typeBadges = {
      procedure: 'badge-blue',
      function:  'badge-purple',
      event:     'badge-orange',
      var:       'badge-gray'
    };

    container.innerHTML = `
      <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:.5rem;display:flex;gap:.3rem;flex-wrap:wrap;">
        <span class="badge badge-blue">${stats.procedures} Prosedür</span>
        <span class="badge badge-purple">${stats.functions} Fonksiyon</span>
        <span class="badge badge-orange">${stats.events} Olay</span>
        ${stats.vars > 0 ? `<span class="badge badge-gray">${stats.vars} Var</span>` : ''}
      </div>
      <div class="outline-list" style="display:flex;flex-direction:column;gap:.25rem;max-height:280px;overflow-y:auto;">
        ${items.map(it => `
          <div class="outline-item" data-line="${it.line}"
               style="display:flex;align-items:center;justify-content:space-between;padding:.35rem .6rem;border-radius:6px;background:var(--bg-surface);border:1px solid var(--border-light);cursor:pointer;transition:background .15s;"
               title="Satır ${it.line}: ${it.codeSnippet}">
            <div style="display:flex;align-items:center;gap:.4rem;overflow:hidden;">
              <span style="font-weight:700;font-size:.78rem;">${typeIcons[it.type] || '•'}</span>
              <span style="font-size:.78rem;font-weight:600;color:var(--text-primary);text-overflow:ellipsis;overflow:hidden;white-space:nowrap;">${it.name}</span>
            </div>
            <div style="display:flex;align-items:center;gap:.3rem;">
              <span class="badge ${typeBadges[it.type]}" style="font-size:.65rem;padding:.1rem .35rem;">S${it.line}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    container.querySelectorAll('.outline-item').forEach(el => {
      el.addEventListener('click', () => {
        const line = parseInt(el.dataset.line, 10);
        if (typeof onSelectLine === 'function') onSelectLine(line);
      });
    });
  }

  window.PascalOutline = { parseOutline, renderOutlineTree };
})();
