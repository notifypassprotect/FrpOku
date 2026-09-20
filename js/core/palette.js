// ============================================================
// palette.js — Command Palette (Ctrl+K)
// Fuzzy search ile tüm uygulama komutlarına anında erişim.
// FrpOku v5 — Offline, bağımlılıksız.
// ============================================================
(function () {
 'use strict';

 const clickFirstAvailable = (...ids) => {
   const element = ids.map(id => document.getElementById(id)).find(Boolean);
   if (!element) return false;
   element.click();
   return true;
 };

 const COMMAND_GROUPS = {
   nav: 'Gezinme', search: 'Arama', file: 'Dosya işlemleri', view: 'Görünüm',
   tool: 'Araçlar', filter: 'Filtreler', settings: 'Ayarlar'
 };

 const COMMAND_ICONS = {
   nav: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"></path></svg>',
   search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>',
   file: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h10l6 6v10H4z"></path><path d="M14 4v6h6"></path></svg>',
   view: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18M9 10v10"></path></svg>',
   tool: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-3-3z"></path></svg>',
   filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16l-6 7v5l-4 2v-7z"></path></svg>',
   settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19 13.5v-3l-2-.7-.8-1.9.9-1.9-2.1-2.1-1.9.9-1.9-.8-.7-2h-3l-.7 2-1.9.8-1.9-.9L.9 6l.9 1.9L1 9.8l-2 .7v3l2 .7.8 1.9-.9 1.9L3 20.1l1.9-.9 1.9.8.7 2h3l.7-2 1.9-.8 1.9.9 2.1-2.1-.9-1.9.8-1.9z" transform="translate(2 0) scale(.83)"></path></svg>'
 };

 const commandGroup = command => command.group || command.id.split('_')[0];
 const commandIcon = command => COMMAND_ICONS[commandGroup(command)] || COMMAND_ICONS.tool;

 // ── Komut Tanımları ─────────────────────────────────────────
 const COMMANDS = [
 // Navigasyon
 { id: 'nav_index', label: 'Ana Sayfaya Git', desc: 'Rapor listesi', action: () => { window.location.href = 'index.html'; } },
 { id: 'nav_dashboard', label: 'Dashboard Aç', desc: 'İstatistik & grafikler (Admin)', adminOnly: true, action: () => { window.location.href = 'dashboard.html'; } },
 { id: 'nav_compare', label: 'Karşılaştırma Ekranı', desc: 'İki raporu yan yana diff', action: () => { window.location.href = 'compare.html'; } },

 // Arama
 { id: 'search_reports', label: 'Raporlarda Ara', desc: 'Ana listedeki arama alanına geç', available: () => Boolean(document.getElementById('searchInput')), action: () => {
 const input = document.getElementById('searchInput'); input?.focus(); input?.select();
 }},

 // Dosya İşlemleri
 { id: 'file_add', label: 'Rapor Ekle (.frp)', desc: 'Tek dosya yükle', available: () => Boolean(document.getElementById('fileInputSingle') || document.getElementById('fileInputMulti')), action: () => { clickFirstAvailable('fileInputSingle', 'fileInputMulti'); } },
 { id: 'file_export_backup', label: 'Yedek Al (JSON)', desc: 'Tüm verileri yedekle', available: () => Boolean(document.getElementById('btnExportBackup')), action: () => { document.getElementById('btnExportBackup')?.click(); } },
 { id: 'file_import_backup', label: 'Yedek Yükle (JSON)', desc: 'Yedeği geri yükle', available: () => Boolean(document.getElementById('btnImportBackup') || document.getElementById('fileInputBackup')), action: () => { clickFirstAvailable('btnImportBackup', 'fileInputBackup'); } },
 { id: 'file_export_sqls', label: 'Tüm SQL\'leri İndir', desc: 'Toplu SQL export', available: () => Boolean(document.getElementById('btnExportAllSqls')), action: () => { document.getElementById('btnExportAllSqls')?.click(); } },
 { id: 'file_export_csv', label: 'CSV Dışa Aktar', desc: 'Sorguları CSV olarak indir', action: () => {
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
 { id: 'view_table', label: 'Tablo Görünümü', desc: 'Liste görünüme geç', available: () => typeof window.setViewMode === 'function', action: () => { window.setViewMode?.('table'); } },
 { id: 'view_cards', label: 'Kart Görünümü', desc: 'Kart/grid görünüme geç', available: () => typeof window.setViewMode === 'function', action: () => { window.setViewMode?.('cards'); } },
 { id: 'view_timeline', label: 'Zaman Çizelgesi', desc: 'Timeline görünüme geç', available: () => typeof window.setViewMode === 'function', action: () => { window.setViewMode?.('timeline'); } },
 { id: 'view_theme', label: 'Tema Değiştir', desc: 'Koyu veya aydınlık görünüme geç', action: () => {
 const button = document.getElementById('btnThemeToggle');
 if (button) button.click();
 else if (window.FrpThemes) {
   const next = window.FrpThemes.getGlobalTheme() === 'dark' ? 'light' : 'dark';
   window.FrpThemes.setTheme(next, true);
 }
 }},

 // Araçlar
 { id: 'tool_params', label: 'SQL Parametre Paneli', desc: 'Tüm parametreleri görüntüle', available: () => Boolean(document.getElementById('btnParams') || window.openParamsModal), action: () => { if (!clickFirstAvailable('btnParams')) window.openParamsModal?.(); } },
 { id: 'tool_deps', label: 'Bağımlılık Haritası', desc: 'Tablo bağımlılıkları', available: () => Boolean(document.getElementById('btnDependencies') || window.openDependenciesModal), action: () => { if (!clickFirstAvailable('btnDependencies')) window.openDependenciesModal?.(); } },
 { id: 'tool_snippets', label: 'Sorgu Kütüphanesi', desc: 'Kayıtlı SQL şablonları', available: () => Boolean(window.renderSnippetsModal || document.getElementById('btnSnippets')), action: () => { if (window.renderSnippetsModal) { window.renderSnippetsModal(); } else { document.getElementById('btnSnippets')?.click(); } } },
 { id: 'tool_dupes', label: 'Mükerrer Sorgular', desc: 'Tekrarlayan SQL tespiti', available: () => typeof window.openDuplicateQueriesModal === 'function', action: () => { window.openDuplicateQueriesModal?.(); } },
 { id: 'tool_shortcuts',label: 'Klavye Kısayolları', desc: 'Kısayol tablosunu aç', available: () => typeof window.openSettingsModal === 'function', action: () => { window.openSettingsModal?.('shortcuts'); } },

 // Ayarlar
 { id: 'settings_appearance', label: 'Görünüm Ayarları', desc: 'Tema, yazı tipi ve yoğunluğu düzenle', available: () => typeof window.openSettingsModal === 'function', action: () => { window.openSettingsModal?.('appearance'); } },
 { id: 'settings_profile', label: 'Profil Ayarları', desc: 'Hesap ve profil bilgilerini düzenle', available: () => typeof window.openSettingsModal === 'function', action: () => { window.openSettingsModal?.('profile'); } },

 // Filtreler
 { id: 'filter_favs', label: 'Sadece Favoriler', desc: 'Favori filtresi aç/kapat', available: () => Boolean(document.getElementById('btnFavOnly')), action: () => { document.getElementById('btnFavOnly')?.click(); } },
 { id: 'filter_pinned', label: 'Sadece Sabitlenmiş', desc: 'Pin filtresi aç/kapat', available: () => Boolean(document.getElementById('btnPinnedOnly')), action: () => { document.getElementById('btnPinnedOnly')?.click(); } },
 { id: 'filter_clear', label: 'Filtreyi Temizle', desc: 'Aramayı sıfırla', available: () => Boolean(document.getElementById('searchInput')), action: () => {
 const si = document.getElementById('searchInput');
 if (si) { si.value = ''; si.dispatchEvent(new Event('input')); si.focus(); }
 }},
 ];

 let _overlay = null;
 let _input = null;
 let _list = null;
 let _filtered = [];
 let _activeIdx = -1;
 let _previousFocus = null;

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

 _previousFocus = document.activeElement;

 _overlay = document.createElement('div');
 _overlay.id = 'cmdPaletteOverlay';
 _overlay.className = 'frp-command-overlay';

 const panel = document.createElement('div');
 panel.className = 'frp-command-panel';
 panel.setAttribute('role', 'dialog');
 panel.setAttribute('aria-modal', 'true');
 panel.setAttribute('aria-labelledby', 'frpCommandTitle');

 const searchRow = document.createElement('div');
 searchRow.className = 'frp-command-search';
 searchRow.innerHTML = `<span class="frp-command-search-icon">${COMMAND_ICONS.search}</span><span id="frpCommandTitle" class="sr-only">Komut menüsü</span>`;

 _input = document.createElement('input');
 _input.type = 'text';
 _input.className = 'frp-command-input';
 _input.placeholder = 'Komut veya işlem ara…';
 _input.setAttribute('aria-label', 'Komut ara');
 _input.setAttribute('aria-controls', 'frpCommandList');
 _input.setAttribute('aria-autocomplete', 'list');

 const closeHint = document.createElement('kbd');
 closeHint.className = 'frp-command-key';
 closeHint.textContent = 'Esc';

 searchRow.appendChild(_input);
 searchRow.appendChild(closeHint);

 _list = document.createElement('div');
 _list.id = 'frpCommandList';
 _list.className = 'frp-command-list';
 _list.setAttribute('role', 'listbox');

 const footer = document.createElement('div');
 footer.className = 'frp-command-footer';
 footer.innerHTML = '<span><kbd>↑</kbd><kbd>↓</kbd> Gezin</span><span><kbd>Enter</kbd> Aç</span><span><kbd>Esc</kbd> Kapat</span>';

 panel.appendChild(searchRow);
 panel.appendChild(_list);
 panel.appendChild(footer);
 _overlay.appendChild(panel);
 document.body.appendChild(_overlay);

 // Events
 _input.addEventListener('input', renderList);
 _input.addEventListener('keydown', handleKey);
 _overlay.addEventListener('click', e => { if (e.target === _overlay) closePalette(); });

 renderList();
 setTimeout(() => _input.focus(), 50);
 }

 function getAvailableCommands() {
 const isAdmin = window.FrpAuth? window.FrpAuth.isAdmin(): false;
 return COMMANDS.filter(cmd => (!cmd.adminOnly || isAdmin) && (!cmd.available || cmd.available()));
 }

 function renderList() {
 const q = (_input?.value || '').trim();
 const available = getAvailableCommands();
 if (!q) {
 _filtered = available.slice(0, 18);
 } else {
 _filtered = available
.filter(cmd => fuzzyMatch(q, cmd.label) || fuzzyMatch(q, cmd.desc || '') || fuzzyMatch(q, COMMAND_GROUPS[commandGroup(cmd)] || ''))
.sort((a, b) => fuzzyScore(q, b.label) - fuzzyScore(q, a.label))
.slice(0, 18);
 }
 _activeIdx = _filtered.length > 0? 0: -1;
 paintList();
 }

 function paintList() {
 if (!_list) return;
 _list.replaceChildren();
 if (_filtered.length === 0) {
 const empty = document.createElement('div');
 empty.className = 'frp-command-empty';
 empty.textContent = 'Aramanızla eşleşen komut bulunamadı.';
 _list.appendChild(empty);
 _input?.removeAttribute('aria-activedescendant');
 return;
 }
 let lastGroup = '';
 _filtered.forEach((cmd, i) => {
 const group = commandGroup(cmd);
 if (group !== lastGroup) {
   const heading = document.createElement('div');
   heading.className = 'frp-command-group';
   heading.textContent = COMMAND_GROUPS[group] || 'Komutlar';
   _list.appendChild(heading);
   lastGroup = group;
 }
 const el = document.createElement('button');
 el.type = 'button';
 el.id = `frpCommandOption${i}`;
 el.className = `palette-item${i === _activeIdx ? ' active' : ''}`;
 el.dataset.idx = String(i);
 el.setAttribute('role', 'option');
 el.setAttribute('aria-selected', i === _activeIdx ? 'true' : 'false');
 const icon = document.createElement('span'); icon.className = 'frp-command-item-icon'; icon.innerHTML = commandIcon(cmd);
 const copy = document.createElement('span'); copy.className = 'frp-command-item-copy';
 const label = document.createElement('strong'); label.textContent = cmd.label; copy.appendChild(label);
 if (cmd.desc) { const desc = document.createElement('small'); desc.textContent = cmd.desc; copy.appendChild(desc); }
 const arrow = document.createElement('span'); arrow.className = 'frp-command-arrow'; arrow.textContent = '↵'; arrow.setAttribute('aria-hidden', 'true');
 el.append(icon, copy, arrow);
 el.addEventListener('click', () => {
 const idx = parseInt(el.dataset.idx, 10);
 executeCommand(idx);
 });
 el.addEventListener('mouseenter', () => {
 _activeIdx = parseInt(el.dataset.idx, 10);
 syncActiveOption(false);
 });
 _list.appendChild(el);
 });
 syncActiveOption(true);
 }

 function syncActiveOption(shouldScroll = true) {
 const options = Array.from(_list?.querySelectorAll('.palette-item') || []);
 options.forEach((option, index) => {
   const active = index === _activeIdx;
   option.classList.toggle('active', active);
   option.setAttribute('aria-selected', active ? 'true' : 'false');
 });
 const active = options[_activeIdx];
 if (active) {
   _input?.setAttribute('aria-activedescendant', active.id);
   if (shouldScroll) active.scrollIntoView({ block: 'nearest' });
 } else _input?.removeAttribute('aria-activedescendant');
 }

 function handleKey(e) {
 if (e.key === 'Escape') { closePalette(); return; }
 if (e.key === 'ArrowDown') { e.preventDefault(); _activeIdx = Math.min(_activeIdx + 1, _filtered.length - 1); syncActiveOption(); }
 if (e.key === 'ArrowUp') { e.preventDefault(); _activeIdx = Math.max(_activeIdx - 1, 0); syncActiveOption(); }
 if (e.key === 'Enter') { e.preventDefault(); executeCommand(_activeIdx); }
 }

 function executeCommand(idx) {
 const cmd = _filtered[idx];
 if (!cmd) return;
 closePalette();
 setTimeout(() => { try { cmd.action(); } catch(e) { console.warn('Palette command error:', e); } }, 50);
 }

 function closePalette() {
 if (_overlay) {
   _overlay.remove(); _overlay = null; _input = null; _list = null;
   if (_previousFocus?.isConnected && typeof _previousFocus.focus === 'function') _previousFocus.focus();
   _previousFocus = null;
 }
 }

 function openPalette() {
 if (_overlay) { closePalette(); return; }
 buildPalette();
 }

 function installPaletteTrigger() {
   if (document.getElementById('btnCommandPalette')) return;
   const host = document.querySelector('.topbar-right, .cmp-topbar-right');
   if (!host) return;
   const button = document.createElement('button');
   button.type = 'button';
   button.id = 'btnCommandPalette';
   button.className = 'frp-command-trigger';
   button.title = 'Hızlı komut menüsünü aç (Ctrl+K)';
   button.setAttribute('aria-haspopup', 'dialog');
   button.innerHTML = `${COMMAND_ICONS.search}<span>Hızlı ara</span><kbd>${navigator.platform?.includes('Mac') ? '⌘ K' : 'Ctrl K'}</kbd>`;
   button.addEventListener('click', openPalette);
   host.prepend(button);
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

 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installPaletteTrigger);
 else installPaletteTrigger();

 window.FrpPalette = { open: openPalette, close: closePalette, addCommand: (cmd) => {
   if (cmd && cmd.id && cmd.label && typeof cmd.action === 'function') COMMANDS.push(cmd);
 } };
})();
