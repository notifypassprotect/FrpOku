// ============================================================
//  palette.js — Command Palette (Ctrl+K)
//  Fuzzy search ile tüm uygulama komutlarına anında erişim.
//  FrpOku v5 — Offline, bağımlılıksız.
// ============================================================
(function () {
  'use strict';

  // ── Komut Tanımları ─────────────────────────────────────────
  const COMMANDS = [
    // Navigasyon
    { id: 'nav_index',     label: '🏠 Ana Sayfaya Git',           desc: 'Rapor listesi',             action: () => { window.location.href = 'index.html'; } },
    { id: 'nav_dashboard', label: '📊 Dashboard Aç',              desc: 'İstatistik & grafikler',    action: () => { window.location.href = 'dashboard.html'; } },
    { id: 'nav_compare',   label: '🔀 Karşılaştırma Ekranı',      desc: 'İki raporu yan yana diff',  action: () => { window.location.href = 'compare.html'; } },

    // Dosya İşlemleri
    { id: 'file_add',      label: '➕ Rapor Ekle (.frp)',          desc: 'Tek dosya yükle',           action: () => { document.getElementById('fileInputSingle')?.click() || document.getElementById('fileInputMulti')?.click(); } },
    { id: 'file_export_backup', label: '💾 Yedek Al (JSON)',       desc: 'Tüm verileri yedekle',      action: () => { document.getElementById('btnExportBackup')?.click(); } },
    { id: 'file_import_backup', label: '📥 Yedek Yükle (JSON)',    desc: 'Yedeği geri yükle',         action: () => { document.getElementById('btnImportBackup')?.click() || document.getElementById('fileInputBackup')?.click(); } },
    { id: 'file_export_sqls',   label: '📦 Tüm SQL\'leri İndir',  desc: 'Toplu SQL export',          action: () => { document.getElementById('btnExportAllSqls')?.click(); } },
    { id: 'file_export_csv',    label: '📊 CSV Dışa Aktar',        desc: 'Sorguları CSV olarak indir', action: () => {
      if (!window.FrpStore) return;
      const csv = FrpStore.exportAllSqlsCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `frpoku_sorgular_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }},

    // Görünüm
    { id: 'view_table',    label: '📋 Tablo Görünümü',            desc: 'Liste görünüme geç',         action: () => { window.setViewMode?.('table'); } },
    { id: 'view_cards',    label: '🃏 Kart Görünümü',             desc: 'Kart/grid görünüme geç',    action: () => { window.setViewMode?.('cards'); } },
    { id: 'view_timeline', label: '🕐 Zaman Çizelgesi',           desc: 'Timeline görünüme geç',     action: () => { window.setViewMode?.('timeline'); } },
    { id: 'view_theme',    label: '🌙 Tema Değiştir',             desc: 'Koyu/Aydınlık tema',        action: () => { document.getElementById('btnThemeToggle')?.click(); } },

    // Araçlar
    { id: 'tool_complexity', label: '🧠 SQL Karmaşıklık & DBA Analizi', desc: 'Tüm sorguların zeki statik analizi', action: () => { document.getElementById('btnComplexityCenter')?.click() || window.openComplexityModal?.(); } },
    { id: 'tool_params',   label: '⚙️ SQL Parametre Paneli',      desc: 'Tüm parametreleri görüntüle', action: () => { document.getElementById('btnParams')?.click(); } },
    { id: 'tool_deps',     label: '🕸️ Bağımlılık Haritası',      desc: 'Tablo bağımlılıkları',      action: () => { document.getElementById('btnDependencies')?.click(); } },
    { id: 'tool_snippets', label: '📚 Sorgu Kütüphanesi',         desc: 'Kayıtlı SQL şablonları',    action: () => { if (window.renderSnippetsModal) { window.renderSnippetsModal(); } else { document.getElementById('btnSnippets')?.click(); } } },
    { id: 'tool_dupes',    label: '🔎 Duplicate Sorgular',        desc: 'Tekrarlayan SQL tespiti',   action: () => { document.getElementById('btnFindDuplicates')?.click(); } },
    { id: 'tool_shortcuts',label: '⌨️ Klavye Kısayolları',        desc: '? tuşu ile açılır',         action: () => { window.showShortcutsModal?.(); } },

    // Filtreler
    { id: 'filter_favs',   label: '⭐ Sadece Favoriler',           desc: 'Favori filtresi aç/kapat', action: () => { document.getElementById('btnFavOnly')?.click(); } },
    { id: 'filter_pinned', label: '📌 Sadece Sabitlenmiş',         desc: 'Pin filtresi aç/kapat',    action: () => { document.getElementById('btnPinnedOnly')?.click(); } },
    { id: 'filter_clear',  label: '✖️ Filtreyi Temizle',           desc: 'Aramayı sıfırla',           action: () => {
      const si = document.getElementById('searchInput');
      if (si) { si.value = ''; si.dispatchEvent(new Event('input')); si.focus(); }
    }},
  ];

  let _overlay  = null;
  let _input    = null;
  let _list     = null;
  let _filtered = [];
  let _activeIdx = -1;

  // ── Fuzzy Match ─────────────────────────────────────────────
  function fuzzyMatch(needle, haystack) {
    needle = needle.toLowerCase();
    haystack = haystack.toLowerCase();
    if (haystack.includes(needle)) return true;
    let ni = 0;
    for (let i = 0; i < haystack.length && ni < needle.length; i++) {
      if (haystack[i] === needle[ni]) ni++;
    }
    return ni === needle.length;
  }

  function fuzzyScore(needle, haystack) {
    needle = needle.toLowerCase();
    haystack = haystack.toLowerCase();
    if (haystack.startsWith(needle)) return 100;
    if (haystack.includes(needle)) return 80;
    return 50;
  }

  // ── Palette Oluştur ─────────────────────────────────────────
  function buildPalette() {
    if (_overlay) return;

    _overlay = document.createElement('div');
    _overlay.id = 'cmdPaletteOverlay';
    _overlay.style.cssText = [
      'position:fixed;inset:0;z-index:99999;',
      'background:rgba(0,0,0,.55);backdrop-filter:blur(6px);',
      'display:flex;align-items:flex-start;justify-content:center;',
      'padding-top:15vh;animation:fadeIn .15s ease;'
    ].join('');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'width:min(580px,92vw);background:var(--bg-surface);',
      'border:1px solid var(--border);border-radius:16px;',
      'box-shadow:0 24px 64px rgba(0,0,0,.45);',
      'overflow:hidden;animation:scaleIn .18s cubic-bezier(.16,1,.3,1);'
    ].join('');

    const searchRow = document.createElement('div');
    searchRow.style.cssText = 'display:flex;align-items:center;gap:.6rem;padding:.9rem 1.1rem;border-bottom:1px solid var(--border);';
    searchRow.innerHTML = '<span style="font-size:1.1rem;">🔍</span>';

    _input = document.createElement('input');
    _input.type = 'text';
    _input.placeholder = 'Komut ara... (Esc ile kapat)';
    _input.style.cssText = [
      'flex:1;background:none;border:none;outline:none;',
      'font-size:.95rem;font-family:var(--font);',
      'color:var(--text-primary);'
    ].join('');

    const hint = document.createElement('span');
    hint.style.cssText = 'font-size:.72rem;color:var(--text-muted);white-space:nowrap;';
    hint.textContent = 'Ctrl+K';

    searchRow.appendChild(_input);
    searchRow.appendChild(hint);

    _list = document.createElement('div');
    _list.style.cssText = 'max-height:360px;overflow-y:auto;padding:.4rem;';

    panel.appendChild(searchRow);
    panel.appendChild(_list);
    _overlay.appendChild(panel);
    document.body.appendChild(_overlay);

    // Events
    _input.addEventListener('input', renderList);
    _input.addEventListener('keydown', handleKey);
    _overlay.addEventListener('click', e => { if (e.target === _overlay) closePalette(); });

    renderList();
    setTimeout(() => _input.focus(), 50);
  }

  function renderList() {
    const q = (_input?.value || '').trim();
    if (!q) {
      _filtered = COMMANDS.slice(0, 12);
    } else {
      _filtered = COMMANDS
        .filter(cmd => fuzzyMatch(q, cmd.label) || fuzzyMatch(q, cmd.desc || ''))
        .sort((a, b) => fuzzyScore(q, b.label) - fuzzyScore(q, a.label))
        .slice(0, 12);
    }
    _activeIdx = _filtered.length > 0 ? 0 : -1;
    paintList();
  }

  function paintList() {
    if (!_list) return;
    if (_filtered.length === 0) {
      _list.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text-muted);font-size:.85rem;">Komut bulunamadı</div>';
      return;
    }
    _list.innerHTML = _filtered.map((cmd, i) => `
      <div class="palette-item${i === _activeIdx ? ' active' : ''}"
           data-idx="${i}"
           style="display:flex;align-items:center;gap:.75rem;padding:.65rem .85rem;border-radius:9px;
                  cursor:pointer;transition:background .1s;
                  background:${i === _activeIdx ? 'var(--accent-light)' : 'transparent'};
                  border-left:${i === _activeIdx ? '3px solid var(--accent-bright)' : '3px solid transparent'};">
        <span style="font-size:1.05rem;min-width:1.6rem;text-align:center;">${cmd.label.split(' ')[0]}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:.875rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${cmd.label.replace(/^[\S]+\s/, '')}
          </div>
          ${cmd.desc ? `<div style="font-size:.72rem;color:var(--text-muted);">${cmd.desc}</div>` : ''}
        </div>
        ${i === _activeIdx ? '<kbd style="font-size:.7rem;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;padding:.1rem .4rem;color:var(--text-muted);">Enter</kbd>' : ''}
      </div>
    `).join('');

    _list.querySelectorAll('.palette-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        executeCommand(idx);
      });
      el.addEventListener('mouseenter', () => {
        _activeIdx = parseInt(el.dataset.idx, 10);
        paintList();
      });
    });
  }

  function handleKey(e) {
    if (e.key === 'Escape') { closePalette(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); _activeIdx = Math.min(_activeIdx + 1, _filtered.length - 1); paintList(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); _activeIdx = Math.max(_activeIdx - 1, 0); paintList(); }
    if (e.key === 'Enter')     { e.preventDefault(); executeCommand(_activeIdx); }
  }

  function executeCommand(idx) {
    const cmd = _filtered[idx];
    if (!cmd) return;
    closePalette();
    setTimeout(() => { try { cmd.action(); } catch(e) { console.warn('Palette command error:', e); } }, 50);
  }

  function closePalette() {
    if (_overlay) { _overlay.remove(); _overlay = null; _input = null; _list = null; }
  }

  function openPalette() {
    if (_overlay) { closePalette(); return; }
    buildPalette();
  }

  // ── Klavye Kısayolları (Ctrl+M, Ctrl+K, Alt+N, Ctrl+I, Ctrl+N) ────
  document.addEventListener('keydown', e => {
    // Ctrl+M veya Ctrl+K: Komut Paletini Aç
    if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M' || e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openPalette();
      return;
    }
    // Alt+N, Ctrl+Shift+N, Ctrl+I veya Ctrl+N: Yeni Rapor / Dosya Ekle
    const isNewReportKey = (e.altKey && (e.key === 'n' || e.key === 'N')) ||
                           ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'n' || e.key === 'N')) ||
                           ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) ||
                           ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N'));
    if (isNewReportKey) {
      e.preventDefault();
      const btn = document.getElementById('btnAddSingle') || document.getElementById('fileInputSingle') || document.getElementById('fileInputMulti');
      if (btn) btn.click();
      return;
    }
  });

  window.FrpPalette = { open: openPalette, close: closePalette, addCommand: (cmd) => COMMANDS.push(cmd) };
})();
