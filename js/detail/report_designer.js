// ============================================================
// report_designer.js — FastReport Görsel Tasarım & Önizleme Motoru (v3.3)
// FastReport FRP/XML Rapor Sayfaları ve Parametre Formları Çizici
// ============================================================

(function(window) {
 'use strict';

 // ── DELPHI RENK DÖNÜŞTÜRÜCÜ & ETİKETLEYİCİ (BGR <-> RGB/HEX) ─────────────────
 function delphiColorToRgb(val, isBackground = true) {
 if (!val || val === 'clNone' || val === 'None' || val === '-1' || val === '536870911') {
 return { r: 255, g: 255, b: 255, a: 0, isNone: true, hex: '#ffffff', rgb: 'clNone', label: 'clNone (Şeffaf)' };
 }
 if (val === '-16777208' || val === 'clWindowText' || val === '0' || val === 'clBlack') {
 return { r: 0, g: 0, b: 0, a: 1, isNone: false, hex: '#000000', rgb: 'rgb(0, 0, 0)', label: 'clWindowText (Siyah)' };
 }
 if (val === '16777215' || val === 'clWhite' || val === '-16777211' || val === 'clWindow') {
 return { r: 255, g: 255, b: 255, a: 1, isNone: false, hex: '#ffffff', rgb: 'rgb(255, 255, 255)', label: 'clWhite (Beyaz)' };
 }
 if (val === '-16777201' || val === 'clBtnFace') {
 return { r: 236, g: 233, b: 216, a: 1, isNone: false, hex: '#ece9d8', rgb: 'rgb(236, 233, 216)', label: 'clBtnFace (Form Grisi)' };
 }
 if (val === '-16777188' || val === 'clMenuHighlight') {
 return { r: 91, g: 192, b: 222, a: 1, isNone: false, hex: '#5bc0de', rgb: 'rgb(91, 192, 222)', label: 'Sky Cyan' };
 }
 if (val === 'clRed' || val === '255') return { r: 220, g: 38, b: 38, a: 1, isNone: false, hex: '#dc2626', rgb: 'rgb(220, 38, 38)', label: 'clRed (Kırmızı)' };
 if (val === 'clYellow' || val === '65535') return { r: 202, g: 138, b: 4, a: 1, isNone: false, hex: '#ca8a04', rgb: 'rgb(202, 138, 4)', label: 'clYellow (Sarı)' };
 if (val === 'clGreen' || val === '65280') return { r: 22, g: 163, b: 74, a: 1, isNone: false, hex: '#16a34a', rgb: 'rgb(22, 163, 74)', label: 'clGreen (Yeşil)' };
 if (val === 'clBlue' || val === '16711680') return { r: 37, g: 99, b: 235, a: 1, isNone: false, hex: '#2563eb', rgb: 'rgb(37, 99, 235)', label: 'clBlue (Mavi)' };
 if (val === 'clSkyBlue' || val === '15780518') return { r: 2, g: 132, b: 199, a: 1, isNone: false, hex: '#0284c7', rgb: 'rgb(2, 132, 199)', label: 'clSkyBlue (Gök Mavisi)' };
 if (val === 'clMoneyGreen' || val === '12639424') return { r: 21, g: 128, b: 61, a: 1, isNone: false, hex: '#15803d', rgb: 'rgb(21, 128, 61)', label: 'clMoneyGreen (Nane Yeşili)' };

 // Hex string (#RRGGBB veya $00BBGGRR)
 if (typeof val === 'string' && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(val)) {
 const rawHex = val.slice(1);
 const clean = rawHex.length === 3? rawHex.split('').map(ch => ch + ch).join(''): rawHex;
 const r = parseInt(clean.substring(0, 2), 16) || 0;
 const g = parseInt(clean.substring(2, 4), 16) || 0;
 const b = parseInt(clean.substring(4, 6), 16) || 0;
 return { r, g, b, a: 1, isNone: false, hex: `#${clean}`, rgb: `rgb(${r}, ${g}, ${b})`, label: `rgb(${r}, ${g}, ${b})` };
 }

 if (typeof val === 'string' && (val.startsWith('$') || val.startsWith('0x'))) {
 const hexStr = val.replace(/^\$|^0x/, '').padStart(6, '0');
 const hexNum = parseInt(hexStr, 16);
 if (!isNaN(hexNum)) {
 const r = hexNum & 0xFF;
 const g = (hexNum >> 8) & 0xFF;
 const b = (hexNum >> 16) & 0xFF;
 const pad = n => n.toString(16).padStart(2, '0');
 const hex = `#${pad(r)}${pad(g)}${pad(b)}`;
 return { r, g, b, a: 1, isNone: false, hex, rgb: `rgb(${r}, ${g}, ${b})`, label: `rgb(${r}, ${g}, ${b})` };
 }
 }

 const num = parseInt(val, 10);
 if (isNaN(num)) return { r: 0, g: 0, b: 0, a: 1, isNone: false, hex: '#000000', rgb: '#000000', label: 'Geçersiz renk' };

 // Delphi Integer BGR formatındadır: Red = num & 0xFF, Green = (num >> 8) & 0xFF, Blue = (num >> 16) & 0xFF
 const r = num & 0xFF;
 const g = (num >> 8) & 0xFF;
 const b = (num >> 16) & 0xFF;
 const pad = n => n.toString(16).padStart(2, '0');
 const hex = `#${pad(r)}${pad(g)}${pad(b)}`;
 return { r, g, b, a: 1, isNone: false, hex, rgb: `rgb(${r}, ${g}, ${b})`, label: `rgb(${r}, ${g}, ${b})` };
 }

 function decodeDelphiColor(val, isBackground = true) {
 const info = delphiColorToRgb(val, isBackground);
 if (info.isNone) return isBackground? 'transparent': '#000000';
 return info.rgb;
 }

 function hexToDelphiColor(hexOrRgb) {
 if (!hexOrRgb || hexOrRgb === 'clNone' || hexOrRgb === 'transparent' || hexOrRgb === 'None') return 'clNone';
 
 // rgb(r, g, b) metni girilmişse
 const rgbMatch = String(hexOrRgb).match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
 if (rgbMatch) {
 const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
 const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
 const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
 const delphiInt = (b << 16) | (g << 8) | r;
 return String(delphiInt);
 }

 const clean = String(hexOrRgb).replace('#', '').trim();
 if (clean.length < 6) return '0';
 const r = parseInt(clean.substring(0, 2), 16) || 0;
 const g = parseInt(clean.substring(2, 4), 16) || 0;
 const b = parseInt(clean.substring(4, 6), 16) || 0;
 const delphiInt = (b << 16) | (g << 8) | r;
 return String(delphiInt);
 }

 function formatDelphiColorName(val) {
 const info = delphiColorToRgb(val, true);
 return info.label;
 }

 function formatFrameType(typ) {
 const t = parseInt(typ, 10) || 0;
 if (t === 0) return '0 (Kenarlık Yok)';
 if (t === 15) return '15 (Tüm Kenarlıklar)';
 const sides = [];
 if (t & 1) sides.push('Sol');
 if (t & 2) sides.push('Sağ');
 if (t & 4) sides.push('Üst');
 if (t & 8) sides.push('Alt');
 return `${t} (${sides.join(', ')})`;
 }

 function formatFontStyle(style) {
 const s = String(style || '0');
 if (s === '0' || s === '[]') return '0 (Normal)';
 if (s === '1' || s.includes('fsBold')) return '1 (Kalın / Bold)';
 if (s === '2' || s.includes('fsItalic')) return '2 (İtalik / Italic)';
 if (s === '3') return '3 (Kalın + İtalik)';
 if (s === '4' || s.includes('fsUnderline')) return '4 (Altı Çizili)';
 return s;
 }

 // ── FRAME (ÇERÇEVE & KENARLIK) HESAPLAYICI ──────────────────
 function getFrameBorderCss(frameTyp, frameColor = '-16777208', frameWidth = 1) {
 const typ = parseInt(frameTyp, 10) || 0;
 let color = '#000000';

 if (frameColor === '16777215' || frameColor === 'clWhite') {
 color = '#ffffff';
 } else {
 const num = parseInt(frameColor, 10);
 if (!isNaN(num) && num > 0) {
 const r = num & 0xFF, g = (num >> 8) & 0xFF, b = (num >> 16) & 0xFF;
 color = `rgb(${r}, ${g}, ${b})`;
 }
 }

 const w = Math.max(1, Math.round(frameWidth)) + 'px';
 return {
 borderLeft: (typ & 1)? `${w} solid ${color}`: 'none',
 borderRight: (typ & 2)? `${w} solid ${color}`: 'none',
 borderTop: (typ & 4)? `${w} solid ${color}`: 'none',
 borderBottom: (typ & 8)? `${w} solid ${color}`: 'none'
 };
 }

 // ── BANT TİPİ VE ETİKETİ ──────────────────────────────────
 const BAND_META = {
 TfrxReportTitle: { label: 'ReportTitle', icon: '', class: 'fr-band-reporttitle' },
 TfrxPageHeader: { label: 'PageHeader', icon: '', class: 'fr-band-pageheader' },
 TfrxHeader: { label: 'Header', icon: '', class: 'fr-band-header-type' },
 TfrxGroupHeader: { label: 'GroupHeader', icon: '', class: 'fr-band-groupheader' },
 TfrxMasterData: { label: 'MasterData', icon: '▶', class: 'fr-band-masterdata' },
 TfrxDetailData: { label: 'DetailData', icon: '▶', class: 'fr-band-detaildata' },
 TfrxSubdetailData: { label: 'SubdetailData', icon: '▶', class: 'fr-band-detaildata' },
 TfrxGroupFooter: { label: 'GroupFooter', icon: '', class: 'fr-band-groupfooter' },
 TfrxFooter: { label: 'Footer', icon: '', class: 'fr-band-footer' },
 TfrxPageFooter: { label: 'PageFooter', icon: '', class: 'fr-band-pagefooter' },
 TfrxReportSummary: { label: 'ReportSummary', icon: '', class: 'fr-band-reportsummary' },
 TfrxColumnHeader: { label: 'ColumnHeader', icon: '', class: 'fr-band-header-type' },
 TfrxOverlay: { label: 'Overlay', icon: '', class: 'fr-band-overlay' },
 TfrxPageContent: { label: 'Sayfa İçeriği', icon: '', class: 'fr-band-overlay' },
 DMPHeader: { label: 'DMPHeader', icon: '', class: 'fr-band-header-type' },
 DMPFooter: { label: 'DMPFooter', icon: '', class: 'fr-band-footer' },
 DMPMasterData: { label: 'DMPMasterData', icon: '▶', class: 'fr-band-masterdata' },
 DMPDetailData: { label: 'DMPDetailData', icon: '▶', class: 'fr-band-detaildata' }
 };

function esc(str) {
 if (!str) return '';
 return String(str)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#39;');
}

 function safeFontFamily(value, fallback = 'Arial') {
 const font = String(value || '').trim();
 return /^[\p{L}\p{N} ._-]{1,80}$/u.test(font)? font: fallback;
 }

 // Delphi Date to formatted string (Delphi float date 45954 -> DD.MM.YYYY)
 function delphiDateToStr(val) {
 if (!val) return '09.02.2024';
 const num = parseFloat(String(val).replace(',', '.'));
 if (isNaN(num) || num < 1000) return String(val);
 try {
 const ms = (num - 25569) * 86400 * 1000;
 const d = new Date(ms);
 if (!isNaN(d.getTime())) {
 const day = String(d.getDate()).padStart(2, '0');
 const mon = String(d.getMonth() + 1).padStart(2, '0');
 const year = d.getFullYear();
 return `${day}.${mon}.${year}`;
 }
 } catch {}
 return '09.02.2024';
 }

 // ── ANA RENDER MOTORU (FastReportDesignerEngine) ───────────
 function createDesigner(file, containerEl) {
 let currentZoom = 1.0;
 let currentMode = 'designer'; // 'designer' | 'preview'
 let selectedItem = null;
 let showInspector = true;
 let rightTab = 'inspector'; // 'inspector' | 'datatree'
 let inspectorSearchQuery = '';
 let inspectorTab = 'properties'; // 'properties' | 'events' | 'favorites'
 let inspectorWidth = parseInt(localStorage.getItem('frp_inspector_width') || '330', 10);

 // Canlı Tasarım Düzenleme Modu & Geri Al (Undo/Redo) Durumu
 let isDesignEditing = false;
 let undoStack = [];
 let redoStack = [];
 let initialPagesBackup = null;

 // Sayfaları hazırla
 const pages = Array.isArray(file.pages)? file.pages: [];
 const dialogPages = Array.isArray(file.dialogPages)? file.dialogPages: [];
 
 const allPages = [
...pages.map((p, i) => ({ type: 'report', data: p, id: 'page_' + i, name: p.name || `Page${i + 1}` })),
...dialogPages.map((d, i) => ({ type: 'dialog', data: d, id: 'dialog_' + i, name: d.name || `DialogPage${i + 1}` }))
 ];

 let activePageIndex = 0;

 function render() {
 if (allPages.length === 0) {
 containerEl.innerHTML = `
 <div style="padding:3rem;text-align:center;color:var(--text-muted);">
 
 <div style="font-weight:700;font-size:1.1rem;color:var(--text-secondary);">Görsel Tasarım Bilgisi Bulunamadı</div>
 <div style="font-size:.85rem;margin-top:.3rem;">Bu FRP raporunda görsel sayfa veya diyalog tanımı yer almıyor.</div>
 </div>
 `;
 return;
 }

 const activePage = allPages[activePageIndex] || allPages[0];

 containerEl.innerHTML = `
 <div class="designer-root">
 
 <!-- ÜST ARAÇ ÇUBUĞU -->
 <div class="designer-toolbar">
 
 <!-- Sayfa Sekmeleri (FastReport Code, Data, Page1, DialogPage1) -->
 <div class="designer-toolbar-group">
 <div class="designer-page-tabs">
 ${allPages.map((p, idx) => `
 <button type="button" class="designer-page-tab ${idx === activePageIndex? 'active': ''}" data-idx="${idx}">
 ${esc(p.name)}
 </button>
 `).join('')}
 </div>
 </div>

 <!-- Mod Değiştirici (Tasarımcı vs Baskı Önizleme) -->
 <div class="designer-toolbar-group">
 ${activePage.type === 'report'? `
 <div class="designer-mode-toggle">
 <button type="button" class="designer-mode-btn ${currentMode === 'designer'? 'active': ''}" id="btnModeDesigner" title="Tasarımcı Görünümü (Bantlar &amp; Izgara)">
 Tasarımcı Modu
 </button>
 <button type="button" class="designer-mode-btn ${currentMode === 'preview'? 'active': ''}" id="btnModePreview" title="Baskı Sayfası Önizleme (Temiz Çıktı)">
 Baskı Önizleme
 </button>
 </div>
 `: `
 <span style="font-size:.76rem;color:var(--text-muted);font-weight:700;background:var(--bg-raised);padding:.25rem.6rem;border-radius:6px;">
 Delphi VCL Parametre Formu
 </span>
 `}
 </div>

 <!-- DÜZENLEME & KAYIT BUTONLARI -->
 <div class="designer-toolbar-group">
 ${!isDesignEditing? `
 <button type="button" class="btn btn-sm btn-primary" id="btnStartDesignEdit" style="font-weight:700;display:inline-flex;align-items:center;gap:5px;padding:.32rem.85rem;border-radius:6px;" title="Tasarımı düzenleme moduna al">
 Tasarımı Düzenle
 </button>
 `: `
 <div class="designer-edit-bar">
 <button type="button" class="designer-palette-btn success" id="btnSaveDesignEdit" title="Değişiklikleri Kalıcı Olarak Kaydet">
 Tasarımı Kaydet
 </button>
 <button type="button" class="designer-palette-btn" id="btnCancelDesignEdit" title="Değişiklikleri İptal Et ve Geri Dön">
 İptal Et
 </button>
 <div style="width:1px;height:16px;background:var(--border);margin:0 2px;"></div>
 <button type="button" class="designer-palette-btn undo-redo" id="btnUndoDesign" title="Geri Al (Ctrl+Z)" ${undoStack.length <= 1? 'disabled': ''}>
 Geri Al
 </button>
 <button type="button" class="designer-palette-btn undo-redo" id="btnRedoDesign" title="İleri Al (Ctrl+Y)" ${redoStack.length === 0? 'disabled': ''}>
 İleri Al
 </button>
 </div>
 `}
 </div>

 <!-- GENİŞLETİLMİŞ BİLEŞEN PALETİ (YALNIZCA Düzenleme Modunda Aktif) -->
 ${(currentMode === 'designer' && isDesignEditing)? `
 <div class="designer-comp-palette">
 <button type="button" class="designer-palette-btn" id="btnToolAddMemo" title="Yeni Metin / Memo Ekle">Memo</button>
  <button type="button" class="designer-palette-btn" id="btnToolAddSysMemo" title="Sayfa No / Tarih / Saat (System Text)">SysText</button>
  <button type="button" class="designer-palette-btn" id="btnToolAddGradient" title="Yeni Gradyan Dolgu Ekle">Gradient</button>
  <button type="button" class="designer-palette-btn" id="btnToolAddSubreport" title="Yeni Alt Rapor Ekle">Subreport</button>
  <button type="button" class="designer-palette-btn" id="btnToolAddCrosstab" title="Yeni Çapraz Tablo Ekle">CrossTab</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddPicture" title="Yeni Resim / Logo Ekle">Resim</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddLine" title="Yeni Çizgi Ekle">Çizgi</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddBarcode" title="Yeni Barkod Ekle">Barkod</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddShape" title="Yeni Şekil Ekle">Şekil</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddChart" title="Yeni Grafik Ekle">Grafik</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddBand" title="Yeni Bant Ekle">Bant</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddCheckbox" title="Yeni Onay Kutusu Ekle">CheckBox</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddRadio" title="Yeni Radyo Butonu Ekle">Radio</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddEdit" title="Yeni Metin Girişi Ekle">Edit</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddDateEdit" title="Yeni Tarih Seçici Ekle">Tarih</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddCombobox" title="Yeni Açılır Liste Ekle">Combo</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddPanel" title="Yeni Panel Ekle">Panel</button>
 <button type="button" class="designer-palette-btn danger" id="btnToolDeleteSelected" title="Seçili Bileşeni Sil (Delete)">Sil</button>
 </div>
 `: ''}

 <!-- Zoom & Panel Kontrolleri -->
 <div class="designer-toolbar-group">
 <div class="designer-zoom-ctrl">
 <button type="button" class="designer-zoom-btn" id="btnZoomOut" title="Küçült">−</button>
 <span class="designer-zoom-val" id="zoomValText">${Math.round(currentZoom * 100)}%</span>
 <button type="button" class="designer-zoom-btn" id="btnZoomIn" title="Büyüt">+</button>
 <button type="button" class="designer-zoom-btn" id="btnZoomFit" title="Sayfaya Sığdır" style="margin-left:.25rem;font-size:.75rem;">Sığdır</button>
 </div>

 <!-- Sağ Panel Sekmeleri: Inspector vs Data Tree -->
 <div style="display:flex;align-items:center;background:var(--bg-raised);padding:2px;border-radius:6px;border:1px solid var(--border-light);">
 <button type="button" class="btn btn-sm ${rightTab === 'inspector' && showInspector? 'btn-primary': 'btn-ghost'}" id="btnTabInspector" style="padding:.24rem.55rem;font-size:.74rem;">
 Object Inspector
 </button>
 <button type="button" class="btn btn-sm ${rightTab === 'datatree' && showInspector? 'btn-primary': 'btn-ghost'}" id="btnTabDataTree" style="padding:.24rem.55rem;font-size:.74rem;">
 Data Tree
 </button>
 </div>
 </div>

 </div>

 <!-- ÇALIŞMA ALANI & SAHNE -->
 <div class="designer-stage-wrap">
 
 <!-- Canvas Viewport -->
 <div class="designer-canvas-viewport" id="designerViewport">
 ${activePage.type === 'report'? renderReportPageHtml(activePage.data): renderDialogPageHtml(activePage.data)}
 </div>

 <!-- SAĞ PANEL: NESNE DENETÇİSİ & DATA TREE (GENİŞLETİLEBİLİR RESIZABLE) -->
 <div class="designer-inspector ${showInspector? '': 'collapsed'}" id="designerInspector" style="width:${inspectorWidth}px;">
 
 <!-- Sürükle-Genişlet Tutamacı -->
 <div class="designer-inspector-resizer" id="inspectorResizer" title="Sürükleyerek genişliği ayarlayın"></div>

 ${rightTab === 'inspector'? `
 <!-- OBJECT INSPECTOR (Images 3, 4, 5) -->
 <div class="designer-inspector-header">
 <div class="designer-inspector-title">
 <span>Object Inspector</span>
 </div>
 <div style="display:flex;align-items:center;gap:.4rem;">
 <span class="badge badge-blue" style="font-size:.68rem;padding:.15rem.45rem;" id="inspectorCompType">
 ${selectedItem? esc(selectedItem.type || selectedItem.name): (activePage.data?.name || 'TfrxReportPage')}
 </span>
 <button type="button" class="designer-inspector-close-btn" id="btnCollapseInspector" title="Kapat">✕</button>
 </div>
 </div>

 <!-- Object Inspector Tabs (Properties, Events, Favorites) -->
 <div class="designer-inspector-subtabs">
 <button type="button" class="designer-subtab ${inspectorTab === 'properties'? 'active': ''}" data-subtab="properties">Properties</button>
 <button type="button" class="designer-subtab ${inspectorTab === 'events'? 'active': ''}" data-subtab="events">Events</button>
 <button type="button" class="designer-subtab ${inspectorTab === 'favorites'? 'active': ''}" data-subtab="favorites">Favorites</button>
 </div>

 <div class="designer-prop-search">
 <input type="text" id="propSearchInput" placeholder="Özellik ara (Property / Event)..." value="${esc(inspectorSearchQuery)}" />
 </div>

 <div class="designer-prop-table" id="propTableBody">
 ${renderObjectInspectorProperties(selectedItem || activePage.data)}
 </div>
 `: `
 <!-- DATA TREE (Images 1, 2, 3) -->
 <div class="designer-inspector-header">
 <div class="designer-inspector-title">
 <span>Data Tree (Veri Ağacı)</span>
 </div>
 <button type="button" class="designer-inspector-close-btn" id="btnCollapseInspector" title="Kapat">✕</button>
 </div>
 <div style="flex:1;overflow-y:auto;padding:.75rem.9rem;font-family:var(--font);font-size:.8rem;">
 ${renderDataTreeHtml(file)}
 </div>
 `}
 </div>

 </div>

 <!-- ALT DURUM ÇUBUĞU (FastReport Status Bar - Image 3) -->
 <div class="designer-statusbar" id="designerStatusBar">
 <div class="designer-status-cell">
 <span>Centimeters</span>
 </div>
 <div class="designer-status-cell" id="statusCoords">
 <span>X: ${selectedItem? (selectedItem.left || 0): 0}, Y: ${selectedItem? (selectedItem.top || 0): 0}</span>
 </div>
 <div class="designer-status-cell" id="statusDims">
 <span>W: ${selectedItem? (selectedItem.width || 0): 0}, H: ${selectedItem? (selectedItem.height || 0): 0}</span>
 </div>
 <div class="designer-status-cell" id="statusCompPath" style="font-weight:600;color:var(--text-primary);">
 ${renderStatusCompPath(selectedItem, activePage)}
 </div>
 </div>

 </div>
 `;

 bindEvents();
 }

 function renderStatusCompPath(item, page) {
 if (!item) return ` ${esc(page?.name || 'Page1')} [${esc(currentMode === 'designer'? 'Tasarımcı Modu': 'Baskı Önizleme')}]`;
 if (item.dataField) {
 return ` ${esc(item.name)}: ${item.dataSet? esc(item.dataSet) + '.': ''}"${esc(item.dataField)}"`;
 }
 if (item.caption || item.text) {
 const txt = (item.caption || item.text || '').slice(0, 45);
 return ` ${esc(item.name)} (${esc(item.type || 'TfrxComponent')}): "${esc(txt)}"`;
 }
 return ` ${esc(item.name)} (${esc(item.type || 'TfrxComponent')})`;
 }

 // ── DATA TREE HTML OLUŞTURUCU (Images 1, 2, 3) ────────────
 function renderDataTreeHtml(file) {
 const queries = file.queries || [];
 if (queries.length === 0) {
 return '<div style="color:var(--text-muted);font-style:italic;padding:1rem;">Veri seti (Query) bulunamadı.</div>';
 }

 return queries.map(q => {
 const fields = extractFieldsFromQuery(q, file);
 return `
 <div style="margin-bottom:.9rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:.5rem.7rem;">
 <div style="font-weight:800;color:var(--accent);display:flex;align-items:center;justify-content:space-between;gap:.35rem;margin-bottom:.4rem;padding-bottom:3px;border-bottom:1px solid rgba(37,99,235,0.25);">
 <span style="display:flex;align-items:center;gap:.35rem;font-size:.85rem;color:var(--accent);font-weight:800;font-family:var(--mono);">${esc(q.name)}</span>
 <span class="badge badge-blue" style="font-size:.68rem;background:rgba(37,99,235,0.15);color:#2563eb;font-weight:700;">${fields.length} Alan</span>
 </div>
 <div style="padding-left:.6rem;display:flex;flex-direction:column;gap:.25rem;border-left:2px solid #3b82f6;margin-left:.25rem;">
 ${fields.length > 0? fields.map(f => `
 <div class="fr-datatree-field-row"
 data-detail-action="copy-data-tree" data-query="${encodeInlineArg(q.name)}" data-field="${encodeInlineArg(f)}"
 style="display:flex;align-items:center;justify-content:space-between;gap:.4rem;color:var(--text-secondary);font-size:.76rem;font-family:var(--mono);cursor:pointer;padding:2px 4px;border-radius:4px;transition:background 0.1s;"
 title="İfadeyi kopyalamak için tıklayın: [${esc(q.name)}.&quot;${esc(f)}&quot;]">
 <div style="display:flex;align-items:center;gap:.4rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
 <span style="color:#d97706;font-weight:800;font-size:.7rem;">[A]</span>
 <span style="font-weight:600;">${esc(f)}</span>
 </div>
 <span class="fr-datatree-copy-hint" style="opacity:0.4;font-size:10px;"></span>
 </div>
 `).join(''): `
 <div style="color:var(--text-muted);font-size:.72rem;">(Sorgu tanımlı)</div>
 `}
 </div>
 </div>
 `;
 }).join('');
 }

 function extractFieldsFromQuery(query, file) {
 const fieldSet = new Set();
 
 const sql = query.sql || '';
 const selectMatch = sql.match(/SELECT\s+([\s\S]*?)\s+FROM\b/i);
 if (selectMatch) {
 const colsStr = selectMatch[1];
 const cols = colsStr.split(/,(?![^(]*\))/g);
 cols.forEach(c => {
 const colClean = c.trim().replace(/--.*$/gm, '').trim();
 if (colClean) {
 const aliasMatch = colClean.match(/(?:AS\s+)?([a-zA-Z0-9_]+)$/i);
 if (aliasMatch) {
 const name = aliasMatch[1].toUpperCase();
 if (name!== 'DISTINCT' && name!== 'ALL') fieldSet.add(name);
 }
 }
 });
 }

 (file.pages || []).forEach(p => {
 (p.bands || []).forEach(b => {
 (b.components || []).forEach(comp => {
 if ((comp.dataSet === query.name || b.dataSet === query.name) && comp.dataField) {
 fieldSet.add(comp.dataField.toUpperCase());
 }
 });
 });
 });

 return [...fieldSet].slice(0, 25);
 }

 // ── RAPOR SAYFASI HTML OLUŞTURUCU (Tam Kağıt Boyutu & Bantlar) ──
   // ── RAPOR SAYFASI HTML OLUŞTURUCU (Tam Kağıt Boyutu & Bantlar) ──
  function renderReportPageHtml(page) {
    const isLandscape = (page.orientation || '').toLowerCase().includes('landscape');
    const paperWidthMm = page.paperWidth || (isLandscape ? 297 : 210);
    const paperHeightMm = page.paperHeight || (isLandscape ? 210 : 297);
    const leftMarginMm = page.leftMargin ?? 10;
    const rightMarginMm = page.rightMargin ?? 10;
    const topMarginMm = page.topMargin ?? 10;
    const bottomMarginMm = page.bottomMargin ?? 10;

    // Standart A4 Sayfa Boyutları (1mm ≈ 3.7795px @ 96DPI)
    const PX_PER_MM = 3.779527559;
    const stdPaperWidth = Math.round(paperWidthMm * PX_PER_MM);
    const stdPaperHeight = Math.round(paperHeightMm * PX_PER_MM);

    const leftMarginPx = Math.round(leftMarginMm * PX_PER_MM);
    const rightMarginPx = Math.round(rightMarginMm * PX_PER_MM);
    const topMarginPx = Math.round(topMarginMm * PX_PER_MM);
    const bottomMarginPx = Math.round(bottomMarginMm * PX_PER_MM);

    const printableWidth = Math.max(200, stdPaperWidth - leftMarginPx - rightMarginPx);

    // Dikey ve Yatay Bantları Kesin Olarak Ayır (Dikey bantlar yatay akışta tekrarlanmasın!)
    const horizontalBands = (page.bands || []).filter(b => !(b.vertical || String(b.rawAttrs || '').includes('Vertical="True"')));
    const verticalBands = (page.bands || []).filter(b => (b.vertical || String(b.rawAttrs || '').includes('Vertical="True"')));

    let maxCompRight = printableWidth;
    let totalBandsHeight = 0;

    horizontalBands.forEach(b => {
      let maxCompBottom = b.height > 0 ? b.height : 25;
      (b.components || []).forEach(c => {
        const bottom = (c.top || 0) + (c.height || 0);
        if (bottom > maxCompBottom) maxCompBottom = bottom;
        const r = (c.left || 0) + (c.width || 0);
        if (r > maxCompRight) maxCompRight = r;
      });
      const bHeight = Math.ceil(maxCompBottom);
      totalBandsHeight += bHeight + (currentMode === 'designer' ? 22 : 0);
    });

    const finalPageWidth = Math.max(stdPaperWidth, Math.ceil(maxCompRight + leftMarginPx + rightMarginPx));
    const finalPageMinHeight = Math.max(stdPaperHeight, totalBandsHeight + topMarginPx + bottomMarginPx + 60);

    function renderResizeHandles(isSelected) {
 if (!isSelected || currentMode!== 'designer' ||!isDesignEditing) return '';
 return `
 <div class="fr-resize-handle fr-resize-nw" data-handle="nw"></div>
 <div class="fr-resize-handle fr-resize-n" data-handle="n"></div>
 <div class="fr-resize-handle fr-resize-ne" data-handle="ne"></div>
 <div class="fr-resize-handle fr-resize-e" data-handle="e"></div>
 <div class="fr-resize-handle fr-resize-se" data-handle="se"></div>
 <div class="fr-resize-handle fr-resize-s" data-handle="s"></div>
 <div class="fr-resize-handle fr-resize-sw" data-handle="sw"></div>
 <div class="fr-resize-handle fr-resize-w" data-handle="w"></div>
 `;
 }

 // YALNIZCA Yatay Bantları Yatay Akışta Çiz
 const bandsHtml = horizontalBands.map((band, bIdx) => {
 const meta = BAND_META[band.type] || { label: band.type, icon: '', class: 'fr-band-header-type' };
 let maxCompBottom = band.height > 0? band.height: 25;
 (band.components || []).forEach(c => {
 const bottom = (c.top || 0) + (c.height || 0);
 if (bottom > maxCompBottom) maxCompBottom = bottom;
 });
 const bHeight = Math.ceil(maxCompBottom);

 const componentsHtml = (band.components || []).map((comp, cIdx) => {
 const frameCss = getFrameBorderCss(comp.frameTyp, comp.frameColor, comp.frameWidth);
 const fillBg = decodeDelphiColor(comp.fillBackColor, true);
 const textColor = decodeDelphiColor(comp.fontColor, false);
 const isBold = comp.fontStyle === '1' || String(comp.fontStyle).includes('fsBold');
 const isItalic = comp.fontStyle === '2' || String(comp.fontStyle).includes('fsItalic');
 const isUnderline = comp.fontStyle === '4' || String(comp.fontStyle).includes('fsUnderline');
 
 let hAlign = 'flex-start';
 let textAlign = 'left';
 if (comp.hAlign === 'haCenter') { hAlign = 'center'; textAlign = 'center'; }
 else if (comp.hAlign === 'haRight') { hAlign = 'flex-end'; textAlign = 'right'; }

 let vAlign = 'flex-start';
 if (comp.vAlign === 'vaCenter') vAlign = 'center';
 else if (comp.vAlign === 'vaBottom') vAlign = 'flex-end';

 const isRotated90 = comp.rotation === 90;
 // SEÇİM DURUMU: YALNIZCA VE YALNIZCA Tasarımcı Modunda Aktif!
 const isSelected = (currentMode === 'designer') && selectedItem && selectedItem.name === comp.name;

 // Event Durumu (Sol üstte kırmızı ok/üçgen - Image 3)
 const hasEvent = Boolean(comp.onBeforePrint || comp.onClick || comp.onAfterPrint || comp.onPreviewClick || comp.onKeyDown || (comp.rawAttrs && /\bOn[A-Z]\w+=/i.test(comp.rawAttrs)));
 const eventTitle = hasEvent? ` [Olay/Event: ${esc(comp.onBeforePrint || comp.onClick || 'Tanımlı')}]`: '';

 // 1. Barkod Bileşeni (TfrxBarCodeView)
 if (comp.type === 'TfrxBarCodeView') {
 return `
 <div class="fr-view-item fr-barcode-view ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}"
 style="
 left:${comp.left}px;
 top:${comp.top}px;
 width:${comp.width}px;
 height:${comp.height}px;
 background:#ffffff;
 border:1px solid #000000;
 padding:2px;
 display:flex;
 flex-direction:column;
 align-items:center;
 justify-content:space-between;
 "
 title="${esc(comp.name)} [${esc(comp.barType || 'Barkod')}]: ${esc(comp.text || comp.dataField)}${eventTitle}">
 <div style="flex:1;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;">
 <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 30" style="display:block;">
 <rect x="0" y="0" width="2" height="30" fill="#000"/>
 <rect x="3" y="0" width="1" height="30" fill="#000"/>
 <rect x="5" y="0" width="3" height="30" fill="#000"/>
 <rect x="10" y="0" width="1" height="30" fill="#000"/>
 <rect x="12" y="0" width="2" height="30" fill="#000"/>
 <rect x="16" y="0" width="4" height="30" fill="#000"/>
 <rect x="22" y="0" width="1" height="30" fill="#000"/>
 <rect x="25" y="0" width="2" height="30" fill="#000"/>
 <rect x="29" y="0" width="3" height="30" fill="#000"/>
 <rect x="34" y="0" width="1" height="30" fill="#000"/>
 <rect x="37" y="0" width="2" height="30" fill="#000"/>
 <rect x="41" y="0" width="4" height="30" fill="#000"/>
 <rect x="47" y="0" width="1" height="30" fill="#000"/>
 <rect x="50" y="0" width="3" height="30" fill="#000"/>
 <rect x="55" y="0" width="2" height="30" fill="#000"/>
 <rect x="59" y="0" width="1" height="30" fill="#000"/>
 <rect x="62" y="0" width="3" height="30" fill="#000"/>
 <rect x="67" y="0" width="2" height="30" fill="#000"/>
 <rect x="71" y="0" width="4" height="30" fill="#000"/>
 <rect x="77" y="0" width="1" height="30" fill="#000"/>
 <rect x="80" y="0" width="2" height="30" fill="#000"/>
 <rect x="84" y="0" width="3" height="30" fill="#000"/>
 <rect x="89" y="0" width="1" height="30" fill="#000"/>
 <rect x="92" y="0" width="2" height="30" fill="#000"/>
 <rect x="96" y="0" width="3" height="30" fill="#000"/>
 </svg>
 </div>
 <div style="font-family:'Courier New', monospace; font-size:9px; font-weight:700; color:#000; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%;">
 ${esc(comp.text || comp.dataField || '*BARKOD*')}
 </div>
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 2. Nokta Vuruşlu Memo (TfrxDMPMemoView)
 if (comp.type === 'TfrxDMPMemoView') {
 return `
 <div class="fr-view-item ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}"
 style="
 left:${comp.left}px;
 top:${comp.top}px;
 width:${comp.width}px;
 height:${comp.height}px;
 background-color:${fillBg};
 border-left:${frameCss.borderLeft};
 border-right:${frameCss.borderRight};
 border-top:${frameCss.borderTop};
 border-bottom:${frameCss.borderBottom};
 font-family:'Courier New', monospace, sans-serif;
 font-size:${comp.fontSize || 10}px;
 font-weight:${isBold? '700': '400'};
 color:${textColor};
 text-align:${textAlign};
 "
 title="${esc(comp.name)}: ${esc(comp.text || comp.dataField)}${eventTitle}">
 <div class="fr-memo-content" style="justify-content:${hAlign}; align-items:${vAlign}; white-space:pre-wrap;">
 ${esc(comp.text || (comp.dataField? `[${comp.dataSet? comp.dataSet + '.': ''}"${comp.dataField}"]`: ''))}
 </div>
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 3. Resim / Logo (TfrxPictureView)
 if (comp.type === 'TfrxPictureView') {
 return `
 <div class="fr-view-item fr-picture-view ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}"
 style="left:${comp.left}px; top:${comp.top}px; width:${comp.width}px; height:${comp.height}px;"
 title="${esc(comp.name)} [${esc(comp.dataField || 'Logo')}]${eventTitle}">
 ️ ${esc(comp.dataField || comp.name)}
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 4. Çizgi (TfrxLineView)
 if (comp.type === 'TfrxLineView') {
 return `
 <div class="fr-view-item fr-line-view ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}"
 style="left:${comp.left}px; top:${comp.top}px; width:${comp.width}px; height:${Math.max(1, comp.height)}px; border-top:1px solid ${textColor};">
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 5. Grafik / Chart Bileşeni (TfrxChartView - ISIM_PANATES vb.)
 if (comp.type === 'TfrxChartView') {
 const isPie = (comp.seriesType || '').toLowerCase().includes('pie');
 const isBar = (comp.seriesType || '').toLowerCase().includes('bar');
 const seriesName = comp.seriesType || 'FastLineSeries';
 const dsName = comp.dataSet || comp.chartDataSet || '';
 const xLabel = comp.xField? `X: [${comp.xField}]`: '';
 const yLabel = comp.yField? `Y: [${comp.yField}]`: '';
 
 let chartSvg = '';
 if (isPie) {
 chartSvg = `
 <svg width="100%" height="100%" viewBox="0 0 240 160" preserveAspectRatio="xMidYMid meet">
 <circle cx="90" cy="80" r="60" fill="#3b82f6" />
 <path d="M 90 80 L 90 20 A 60 60 0 0 1 148 60 Z" fill="#10b981" />
 <path d="M 90 80 L 148 60 A 60 60 0 0 1 125 135 Z" fill="#f59e0b" />
 <path d="M 90 80 L 125 135 A 60 60 0 0 1 45 120 Z" fill="#ef4444" />
 <circle cx="90" cy="80" r="25" fill="#ffffff" />
 <rect x="165" y="30" width="10" height="10" rx="2" fill="#3b82f6"/>
 <text x="180" y="39" font-size="10" font-family="sans-serif" fill="#475569">Grup 1</text>
 <rect x="165" y="50" width="10" height="10" rx="2" fill="#10b981"/>
 <text x="180" y="59" font-size="10" font-family="sans-serif" fill="#475569">Grup 2</text>
 <rect x="165" y="70" width="10" height="10" rx="2" fill="#f59e0b"/>
 <text x="180" y="79" font-size="10" font-family="sans-serif" fill="#475569">Grup 3</text>
 <rect x="165" y="90" width="10" height="10" rx="2" fill="#ef4444"/>
 <text x="180" y="99" font-size="10" font-family="sans-serif" fill="#475569">Grup 4</text>
 </svg>
 `;
 } else if (isBar) {
 chartSvg = `
 <svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="none">
 <line x1="40" y1="20" x2="300" y2="20" stroke="#e2e8f0" stroke-dasharray="3,3" />
 <line x1="40" y1="60" x2="300" y2="60" stroke="#e2e8f0" stroke-dasharray="3,3" />
 <line x1="40" y1="100" x2="300" y2="100" stroke="#e2e8f0" stroke-dasharray="3,3" />
 <line x1="40" y1="140" x2="300" y2="140" stroke="#94a3b8" stroke-width="1.5" />
 <line x1="40" y1="20" x2="40" y2="140" stroke="#94a3b8" stroke-width="1.5" />
 <rect x="60" y="45" width="30" height="95" rx="3" fill="url(#barGrad1_${cIdx})" />
 <rect x="110" y="70" width="30" height="70" rx="3" fill="url(#barGrad2_${cIdx})" />
 <rect x="160" y="30" width="30" height="110" rx="3" fill="url(#barGrad1_${cIdx})" />
 <rect x="210" y="85" width="30" height="55" rx="3" fill="url(#barGrad3_${cIdx})" />
 <rect x="260" y="55" width="30" height="85" rx="3" fill="url(#barGrad2_${cIdx})" />
 <defs>
 <linearGradient id="barGrad1_${cIdx}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient>
 <linearGradient id="barGrad2_${cIdx}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#047857"/></linearGradient>
 <linearGradient id="barGrad3_${cIdx}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#b45309"/></linearGradient>
 </defs>
 <text x="75" y="155" font-size="9" text-anchor="middle" fill="#64748b">A</text>
 <text x="125" y="155" font-size="9" text-anchor="middle" fill="#64748b">B</text>
 <text x="175" y="155" font-size="9" text-anchor="middle" fill="#64748b">C</text>
 <text x="225" y="155" font-size="9" text-anchor="middle" fill="#64748b">D</text>
 <text x="275" y="155" font-size="9" text-anchor="middle" fill="#64748b">E</text>
 </svg>
 `;
 } else {
 chartSvg = `
 <svg width="100%" height="100%" viewBox="0 0 360 180" preserveAspectRatio="none">
 <defs>
 <linearGradient id="lineAreaGrad_${cIdx}" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.35"/>
 <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0"/>
 </linearGradient>
 </defs>
 <line x1="35" y1="25" x2="345" y2="25" stroke="#f1f5f9" stroke-width="1"/>
 <line x1="35" y1="65" x2="345" y2="65" stroke="#f1f5f9" stroke-width="1"/>
 <line x1="35" y1="105" x2="345" y2="105" stroke="#f1f5f9" stroke-width="1"/>
 <line x1="35" y1="145" x2="345" y2="145" stroke="#cbd5e1" stroke-width="1.5"/>
 <line x1="35" y1="25" x2="35" y2="145" stroke="#cbd5e1" stroke-width="1.5"/>
 <path d="M 45 110 Q 95 40 145 75 T 245 45 T 335 85 L 335 145 L 45 145 Z" fill="url(#lineAreaGrad_${cIdx})" />
 <path d="M 45 110 Q 95 40 145 75 T 245 45 T 335 85" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
 <circle cx="45" cy="110" r="4" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>
 <circle cx="95" cy="55" r="4" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>
 <circle cx="145" cy="75" r="4" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>
 <circle cx="195" cy="65" r="4" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>
 <circle cx="245" cy="45" r="4" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>
 <circle cx="290" cy="70" r="4" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>
 <circle cx="335" cy="85" r="4" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>
 </svg>
 `;
 }

 return `
 <div class="fr-view-item fr-chart-view ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}"
 style="
 left:${comp.left}px;
 top:${comp.top}px;
 width:${comp.width}px;
 height:${comp.height}px;
 background:#ffffff;
 border:1px solid #cbd5e1;
 border-radius:6px;
 box-shadow:0 2px 6px rgba(0,0,0,0.06);
 display:flex;
 flex-direction:column;
 overflow:hidden;
 box-sizing:border-box;
 "
 title="${esc(comp.name)} [Grafik: ${esc(seriesName)}] ${dsName? '(' + esc(dsName) + ')': ''}${eventTitle}">
 <!-- Chart Header -->
 <div class="fr-chart-header">
 <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:#1e293b;font-size:11px;">
 <span>${esc(comp.name)}</span>
 <span class="badge badge-blue" style="font-size:9.5px;padding:1px 6px;border-radius:3px;font-family:monospace;">${esc(seriesName)}</span>
 </div>
 <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:#64748b;font-family:monospace;">
 ${dsName? `<span style="background:rgba(59,130,246,0.1);color:#2563eb;padding:1px 5px;border-radius:3px;font-weight:700;">${esc(dsName)}</span>`: ''}
 ${xLabel? `<span style="background:#f1f5f9;padding:1px 4px;border-radius:2px;">${esc(xLabel)}</span>`: ''}
 ${yLabel? `<span style="background:#f1f5f9;padding:1px 4px;border-radius:2px;">${esc(yLabel)}</span>`: ''}
 </div>
 </div>
 <!-- Chart Canvas Area -->
 <div style="flex:1;width:100%;position:relative;background:#ffffff;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:6px;">
 ${chartSvg}
 </div>
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 6. Şekil Bileşeni (TfrxShapeView)
 if (comp.type === 'TfrxShapeView') {
 const isRound = (comp.shape || '').includes('Round');
 const isCircle = (comp.shape || '').includes('Circle') || (comp.shape || '').includes('Ellipse');
 const borderRadius = isCircle? '50%': (isRound? '8px': '0px');
 return `
 <div class="fr-view-item ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}"
 style="
 left:${comp.left}px;
 top:${comp.top}px;
 width:${comp.width}px;
 height:${comp.height}px;
 background-color:${fillBg};
 border:${comp.frameWidth || 1}px solid ${textColor};
 border-radius:${borderRadius};
 box-sizing:border-box;
 "
 title="${esc(comp.name)} [${esc(comp.shape || 'Şekil')}]${eventTitle}">
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 7. Standart TfrxMemoView
 return `
 <div class="fr-view-item ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}"
 style="
 left:${comp.left}px;
 top:${comp.top}px;
 width:${comp.width}px;
 height:${comp.height}px;
 background-color:${fillBg};
 border-left:${frameCss.borderLeft};
 border-right:${frameCss.borderRight};
 border-top:${frameCss.borderTop};
 border-bottom:${frameCss.borderBottom};
 font-family:${safeFontFamily(comp.fontName)}, sans-serif;
 font-size:${comp.fontSize || 10}px;
 font-weight:${isBold? '700': '400'};
 font-style:${isItalic? 'italic': 'normal'};
 text-decoration:${isUnderline? 'underline': 'none'};
 color:${textColor};
 text-align:${textAlign};
 "
 title="${esc(comp.name)}: ${esc(comp.text || comp.dataField)}${eventTitle}">
 <div class="fr-memo-content ${isRotated90? 'fr-rotated-90': ''}"
 style="justify-content:${hAlign}; align-items:${vAlign};">
 ${esc(comp.text || (comp.dataField? `[${comp.dataSet? comp.dataSet + '.': ''}"${comp.dataField}"]`: ''))}
 </div>
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }).join('');

 return `
 <div class="fr-band-container ${meta.class}" data-band-idx="${bIdx}" data-band-type="${band.type || ''}" data-band-name="${esc(band.name || '')}" style="min-height:${bHeight}px;">
 ${currentMode === 'designer'? `
 <div class="fr-band-header" data-band-idx="${bIdx}" data-band-type="${band.type || ''}" data-band-name="${esc(band.name || '')}">
 <div class="fr-band-header-left">
 <span>${meta.icon}</span>
 <span>${esc(meta.label)}: ${esc(band.name)}</span>
 </div>
 <div class="fr-band-header-right">
 ${band.dataSet? `<span class="badge-dataset-icon">${esc(band.dataSet)}</span>`: ''}
 ${band.stretched? `<span style="opacity:.8;font-size:9.5px;">[Stretched]</span>`: ''}
 </div>
 </div>
 `: ''}
 <div class="fr-band-body" data-band-idx="${bIdx}" style="min-height:${bHeight}px; height:${bHeight}px;">
 ${componentsHtml}
 </div>
 </div>
 `;
 }).join('');

 // Dikey Çapraz Bantlar (Vertical Cross-Tab Bands - Image 3) - YALNIZCA Dikey Kolon Olarak Çizilir!
 const vBandsHtml = (currentMode === 'designer' && verticalBands.length > 0)? verticalBands.map((vBand, vIdx) => {
 const origBandIdx = (page.bands || []).indexOf(vBand);
 const meta = BAND_META[vBand.type] || { label: vBand.type, icon: '▶', class: 'fr-band-masterdata' };
 const vLeft = vBand.left || 0;
 const vWidth = Math.max(18, vBand.width || 90);
 const isSelected = selectedItem === vBand || (selectedItem && selectedItem.name === vBand.name);
 return `
 <div class="fr-vertical-band-overlay ${isSelected? 'selected-band': ''}" data-band-idx="${origBandIdx}" data-vband-idx="${vIdx}" style="left:${vLeft}px; width:${vWidth}px;">
 <div class="fr-vertical-band-header ${meta.class} ${isSelected? 'selected-band': ''}" data-band-idx="${origBandIdx}" data-vband-idx="${vIdx}" style="left:0; cursor:pointer;" title="${esc(meta.label)}: ${esc(vBand.name)} ${vBand.dataSet? '(' + esc(vBand.dataSet) + ')': ''}">
 ${meta.icon} ${esc(meta.label)}: ${esc(vBand.name)} ${vBand.dataSet? '(' + esc(vBand.dataSet) + ')': ''}
 </div>
 </div>
 `;
 }).join(''): '';

 return `
 <div class="fr-report-page ${currentMode === 'designer'? 'designer-mode': 'preview-mode'}"
 id="frReportPage"
 style="
 width:${finalPageWidth}px;
 min-height:${finalPageMinHeight}px;
 transform:scale(${currentZoom});
 ">
 ${bandsHtml}
 ${vBandsHtml}
 </div>
 `;
 }

 // ── PARAMETRE DİALOG FORMU HTML OLUŞTURUCU (Images 1, 2, 4, 5) ──
 function renderDialogControlItem(ctrl, cIdx, parentOffsetLeft = 0, parentOffsetTop = 0) {
 const isSelected = selectedItem && selectedItem.name === ctrl.name;
 const fontName = safeFontFamily(ctrl.fontName, 'Segoe UI');
 const fontSize = ctrl.fontSize || 11;
 const isBold = ctrl.fontStyle === '1' || String(ctrl.fontStyle).includes('fsBold');

 const leftPos = (ctrl.left || 0) + parentOffsetLeft;
 const topPos = (ctrl.top || 0) + parentOffsetTop;

 // Event Kontrolü (DialogPage kontrollerinde kırmızı ok/üçgen - Image 3 & 4)
 const hasEvent = Boolean(ctrl.onClick || ctrl.onBeforePrint || ctrl.onChange || ctrl.onEnter || ctrl.onExit || ctrl.onKeyDown || (ctrl.rawAttrs && /\bOn[A-Z]\w+=/i.test(ctrl.rawAttrs)));
 const eventTitle = hasEvent? ` [Olay/Event: ${esc(ctrl.onClick || ctrl.onBeforePrint || ctrl.onChange || 'Tanımlı')}]`: '';

 // 1. GroupBox Kontrolü (TfrxGroupBoxControl)
 if (ctrl.type === 'TfrxGroupBoxControl') {
 let maxChildBottom = ctrl.height || 40;
 let maxChildRight = ctrl.width || 100;
 (ctrl.children || []).forEach(ch => {
 const b = (ch.top || 0) + (ch.height || 0);
 const r = (ch.left || 0) + (ch.width || 0);
 if (b > maxChildBottom) maxChildBottom = b;
 if (r > maxChildRight) maxChildRight = r;
 });
 const gbWidth = Math.max(ctrl.width || 100, Math.ceil(maxChildRight + 10));
 const gbHeight = Math.max(ctrl.height || 40, Math.ceil(maxChildBottom + 10));

 const childHtml = (ctrl.children || []).map((ch, idx) => renderDialogControlItem(ch, `${cIdx}_${idx}`, 0, 0)).join('');
 return `
 <fieldset class="fr-ctrl-item fr-ctrl-groupbox ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-ctrl-idx="${cIdx}"
 style="
 left:${leftPos}px;
 top:${topPos}px;
 width:${gbWidth}px;
 height:${gbHeight}px;
 font-family:${fontName}, Tahoma, sans-serif;
 font-size:${fontSize}px;
 "
 title="${esc(ctrl.name)}${eventTitle}">
 <legend>${esc(ctrl.caption || ctrl.name)}</legend>
 <div class="fr-ctrl-groupbox-body">
 ${childHtml}
 </div>
 </fieldset>
 `;
 }

 // 2. Panel Kontrolü (TfrxPanelControl - Düz / Bevel Taşıyıcı Kutu, Legend Yok!)
 if (ctrl.type === 'TfrxPanelControl') {
 const childHtml = (ctrl.children || []).map((ch, idx) => renderDialogControlItem(ch, `${cIdx}_${idx}`, 0, 0)).join('');
 return `
 <div class="fr-ctrl-item fr-ctrl-panel ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-ctrl-idx="${cIdx}"
 style="
 left:${leftPos}px;
 top:${topPos}px;
 width:${ctrl.width}px;
 height:${ctrl.height}px;
 font-family:${fontName}, Tahoma, sans-serif;
 font-size:${fontSize}px;
 border: 1px solid rgba(0,0,0,0.18);
 border-radius: 3px;
 background: rgba(0,0,0,0.02);
 box-sizing: border-box;
 overflow: hidden;
 "
 title="${esc(ctrl.name || 'Panel')}${eventTitle}">
 <div style="position:relative;width:100%;height:100%;">
 ${childHtml}
 </div>
 </div>
 `;
 }

 // 3. Sekmeli Sayfa Kontrolü (TfrxPageControl & TfrxTabSheet - İnteraktif Sekme Geçişi)
 if (ctrl.type === 'TfrxPageControl') {
 const tabs = (ctrl.children || []).filter(ch => ch.type === 'TfrxTabSheet');
 const tabHeadersHtml = tabs.map((tab, tIdx) => `
 <button type="button" class="fr-tab-btn ${tIdx === 0? 'active': ''}"
 data-pc-idx="${cIdx}" data-tab-idx="${tIdx}"
 data-detail-action="switch-dialog-tab" data-control-index="${cIdx}" data-tab-index="${tIdx}"
 title="${esc(tab.caption || tab.name)}">
 ${esc(tab.caption || tab.name)}
 </button>
 `).join('');

 const tabBodyHtml = tabs.map((tab, tIdx) => {
 let maxTabBottom = 100;
 (tab.children || []).forEach(ch => {
 const b = (ch.top || 0) + (ch.height || 0);
 if (b > maxTabBottom) maxTabBottom = b;
 });
 const childHtml = (tab.children || []).map((ch, idx) => renderDialogControlItem(ch, `${cIdx}_${tIdx}_${idx}`, 0, 0)).join('');
 return `
 <div class="fr-tab-body fr-tab-body-${cIdx}" id="tab_body_${cIdx}_${tIdx}"
 style="position:relative;width:100%;min-height:${maxTabBottom + 12}px;height:100%;display:${tIdx === 0? 'block': 'none'};padding:4px;box-sizing:border-box;">
 ${childHtml}
 </div>
 `;
 }).join('');

 return `
 <div class="fr-ctrl-item fr-ctrl-pagecontrol ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 id="pc_${cIdx}"
 data-ctrl-idx="${cIdx}"
 style="
 left:${leftPos}px;
 top:${topPos}px;
 width:${ctrl.width}px;
 height:${ctrl.height}px;
 font-family:${fontName}, Tahoma, sans-serif;
 font-size:${fontSize}px;
 box-sizing: border-box;
 display: flex;
 flex-direction: column;
 "
 title="${esc(ctrl.name)}${eventTitle}">
 <div class="fr-tab-headers-row">
 ${tabHeadersHtml}
 </div>
 <div class="fr-tab-sheet-panel" style="flex:1;">
 ${tabBodyHtml}
 </div>
 </div>
 `;
 }

 if (ctrl.type === 'TfrxTabSheet') {
 const childHtml = (ctrl.children || []).map((ch, idx) => renderDialogControlItem(ch, `${cIdx}_${idx}`, 0, 0)).join('');
 return `
 <div class="fr-ctrl-item fr-ctrl-tabsheet"
 style="position:relative;width:100%;height:100%;">
 ${childHtml}
 </div>
 `;
 }

 // 4. Radyo Butonu (TfrxRadioButtonControl)
 if (ctrl.type === 'TfrxRadioButtonControl') {
 return `
 <div class="fr-ctrl-item fr-ctrl-radio ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-ctrl-idx="${cIdx}"
 style="
 left:${leftPos}px;
 top:${topPos}px;
 width:${ctrl.width}px;
 height:${ctrl.height}px;
 font-family:${fontName}, Tahoma, sans-serif;
 font-size:${fontSize}px;
 display: inline-flex;
 align-items: center;
 gap: 4px;
 white-space: nowrap!important;
 overflow: visible;
 "
 title="${esc(ctrl.name)}: ${esc(ctrl.caption || ctrl.text)}${eventTitle}">
 <input type="radio" ${ctrl.checked? 'checked': ''} name="fr_radio_${parentOffsetTop || 'grp'}" disabled style="margin:0;cursor:pointer;flex-shrink:0;" />
 <span style="font-weight:${isBold? '700': '600'};font-size:11px;white-space:nowrap;">${esc(ctrl.caption || ctrl.text)}</span>
 </div>
 `;
 }

 // 5. Etiket (TfrxLabelControl)
 if (ctrl.type === 'TfrxLabelControl') {
 return `
 <div class="fr-ctrl-item fr-ctrl-label ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-ctrl-idx="${cIdx}"
 style="
 left:${leftPos}px;
 top:${topPos}px;
 width:${ctrl.width}px;
 height:${ctrl.height}px;
 font-family:${fontName}, Tahoma, sans-serif;
 font-size:${fontSize}px;
 font-weight:${isBold? '700': '600'};
 color:#000000;
 white-space: nowrap!important;
 word-break: normal!important;
 display: flex;
 align-items: center;
 "
 title="${esc(ctrl.name)}: ${esc(ctrl.caption || ctrl.text)}${eventTitle}">
 ${esc(ctrl.caption || ctrl.text)}
 </div>
 `;
 }

 // 6. Buton (TfrxButtonControl / TfrxBitBtnControl)
 if (ctrl.type === 'TfrxButtonControl' || ctrl.type === 'TfrxBitBtnControl') {
 return `
 <div class="fr-ctrl-item fr-ctrl-button ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-ctrl-idx="${cIdx}"
 style="
 left:${leftPos}px;
 top:${topPos}px;
 width:${ctrl.width}px;
 height:${ctrl.height}px;
 font-family:${fontName}, Tahoma, sans-serif;
 font-size:${fontSize}px;
 "
 title="${esc(ctrl.name)}: ${esc(ctrl.caption || 'Buton')}${eventTitle}">
 ${esc(ctrl.caption || 'Buton')}
 </div>
 `;
 }

 // 7. Tarih Seçici (TfrxDateEditControl)
 if (ctrl.type === 'TfrxDateEditControl') {
 const dateStr = delphiDateToStr(ctrl.date);
 return `
 <div class="fr-ctrl-item fr-ctrl-dateedit ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-ctrl-idx="${cIdx}"
 style="
 left:${leftPos}px;
 top:${topPos}px;
 width:${ctrl.width}px;
 height:${ctrl.height}px;
 font-family:${fontName}, Tahoma, sans-serif;
 font-size:${fontSize}px;
 "
 title="${esc(ctrl.name)}${eventTitle}">
 <span class="fr-ctrl-dateedit-val">${esc(dateStr)}</span>
 <div class="fr-ctrl-dateedit-btn" title="Tarih Seçici">▾</div>
 </div>
 `;
 }

 // 8. Onay Kutusu (TfrxCheckBoxControl)
 if (ctrl.type === 'TfrxCheckBoxControl') {
 return `
 <div class="fr-ctrl-item fr-ctrl-checkbox ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-ctrl-idx="${cIdx}"
 style="
 left:${leftPos}px;
 top:${topPos}px;
 width:${ctrl.width}px;
 height:${ctrl.height}px;
 font-family:${fontName}, Tahoma, sans-serif;
 font-size:${fontSize}px;
 display: inline-flex;
 align-items: center;
 gap: 4px;
 white-space: nowrap!important;
 "
 title="${esc(ctrl.name)}: ${esc(ctrl.caption)}${eventTitle}">
 <input type="checkbox" ${ctrl.checked? 'checked': ''} disabled style="margin:0;cursor:pointer;flex-shrink:0;" />
 <span style="font-size:11px;white-space:nowrap;">${esc(ctrl.caption)}</span>
 </div>
 `;
 }

 // 9. Açılır Liste (TfrxComboBoxControl)
 if (ctrl.type === 'TfrxComboBoxControl') {
 return `
 <div class="fr-ctrl-item fr-ctrl-combobox ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-ctrl-idx="${cIdx}"
 style="
 left:${leftPos}px;
 top:${topPos}px;
 width:${ctrl.width}px;
 height:${ctrl.height}px;
 font-family:${fontName}, Tahoma, sans-serif;
 font-size:${fontSize}px;
 "
 title="${esc(ctrl.name)}${eventTitle}">
 <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(ctrl.text || ctrl.caption || '')}</span>
 <div class="fr-ctrl-dateedit-btn" title="Aç">▾</div>
 </div>
 `;
 }

 // 10. Çoklu Seçim Listesi (TfrxDBCheckListBoxControl & ListBox)
 if (ctrl.type === 'TfrxDBCheckListBoxControl' || ctrl.type === 'TfrxListBoxControl' || ctrl.type === 'TfrxCheckListBoxControl') {
 return `
 <div class="fr-ctrl-item fr-ctrl-checklistbox ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-ctrl-idx="${cIdx}"
 style="
 left:${leftPos}px;
 top:${topPos}px;
 width:${ctrl.width}px;
 height:${ctrl.height}px;
 font-family:${fontName}, Tahoma, sans-serif;
 font-size:${fontSize}px;
 "
 title="${esc(ctrl.name)}${eventTitle}">
 <div style="color:var(--text-muted);font-size:10px;margin-bottom:4px;font-style:italic;font-weight:700;">
 ${esc(ctrl.listSource || ctrl.name)} (${esc(ctrl.listField || 'ADI')})
 </div>
 <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;">
 <input type="checkbox" checked disabled />
 <span style="font-weight:700;">[ Tümünü Seç ]</span>
 </div>
 <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;opacity:.9;">
 <input type="checkbox" checked disabled />
 <span>1 - ACİL TIP</span>
 </div>
 <div style="display:flex;align-items:center;gap:4px;margin-bottom:3px;opacity:.9;">
 <input type="checkbox" checked disabled />
 <span>2 - DAHİLİYE</span>
 </div>
 </div>
 `;
 }

 // Standart Edit Control
 return `
 <div class="fr-ctrl-item fr-ctrl-edit ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-ctrl-idx="${cIdx}"
 style="
 left:${leftPos}px;
 top:${topPos}px;
 width:${ctrl.width}px;
 height:${ctrl.height}px;
 font-family:${fontName}, Tahoma, sans-serif;
 font-size:${fontSize}px;
 "
 title="${esc(ctrl.name)}${eventTitle}">
 ${esc(ctrl.text || ctrl.caption || '')}
 </div>
 `;
 }

 function renderDialogPageHtml(dialog) {
 // Form içindeki tüm kontrollerin mutlak sınırlarını hesapla (Genişleyen/Gizlenen formlar dahil asla taşmaz)
 let maxCtrlRight = dialog.width || 360;
 let maxCtrlBottom = dialog.height || 240;

 function measureCtrl(c, pL = 0, pT = 0) {
 const r = (c.left || 0) + (c.width || 0) + pL;
 const b = (c.top || 0) + (c.height || 0) + pT;
 if (r > maxCtrlRight) maxCtrlRight = r;
 if (b > maxCtrlBottom) maxCtrlBottom = b;
 (c.children || []).forEach(ch => measureCtrl(ch, (c.left || 0) + pL, (c.top || 0) + pT));
 }

 (dialog.controls || []).forEach(c => measureCtrl(c));

 // Dialog form genişlik ve yüksekliği (Tüm kontrolleri tam kapsar)
 const dWidth = Math.max(360, Math.max(dialog.width || 360, Math.ceil(maxCtrlRight + 20)));
 const dHeight = Math.max(200, Math.max(dialog.height || 240, Math.ceil(maxCtrlBottom + 45)));
 const dialogColorVal = dialog.fillBackColor || dialog.color || '-16777188';
 const dialogBg = decodeDelphiColor(dialogColorVal, true) || '#ece9d8';

 const controlsHtml = (dialog.controls || []).map((ctrl, cIdx) => renderDialogControlItem(ctrl, cIdx)).join('');

 return `
 <div class="fr-dialog-window"
 id="frDialogWindow"
 style="
 width:${dWidth}px;
 height:${dHeight}px;
 background-color:${dialogBg};
 transform:scale(${currentZoom});
 ">
 <!-- Windows XP / 7 / 8 Style Form Titlebar -->
 <div class="fr-dialog-titlebar">
 <div class="fr-dialog-title-left">
 <span></span>
 <span>${esc(dialog.caption || dialog.name)}</span>
 </div>
 <div class="fr-dialog-buttons">
 <span class="fr-dialog-btn-sys">-</span>
 <span class="fr-dialog-btn-sys">□</span>
 <span class="fr-dialog-btn-sys" style="color:#b91c1c;">✕</span>
 </div>
 </div>
 <!-- Form Client Canvas (Hassas İnce Noktalı Izgara) -->
 <div class="fr-dialog-client" style="background-color:${dialogBg};">
 ${controlsHtml}
 </div>
 </div>
 `;
 }

 // ── NESNE DENETÇİSİ ÖZELLİK TABLOSU (Object Inspector) ─────
 function renderObjectInspectorProperties(obj) {
 if (!obj) return '<div style="padding:1rem;color:var(--text-muted);font-size:.78rem;">Seçili bileşen yok.</div>';

 let propList = [];
 const isPage = (obj.type === 'TfrxReportPage' || obj.type === 'TfrxDMPPage' || (!obj.type && obj.bands) || obj.name === 'Page1');
 const isBand = (obj.type && (BAND_META[obj.type] || obj.type.includes('Band') || obj.type.includes('Header') || obj.type.includes('Footer') || obj.type === 'TfrxMasterData' || obj.type === 'TfrxReportTitle'));

 if (inspectorTab === 'events') {
 propList = [
 { name: 'OnClick', val: obj.onClick || '', propKey: 'onClick', editable: isDesignEditing },
 { name: 'OnBeforePrint', val: obj.onBeforePrint || '', propKey: 'onBeforePrint', editable: isDesignEditing },
 { name: 'OnChange', val: obj.onChange || '', propKey: 'onChange', editable: isDesignEditing },
 { name: 'OnAfterPrint', val: obj.onAfterPrint || '', propKey: 'onAfterPrint', editable: isDesignEditing },
 { name: 'OnPreviewClick', val: obj.onPreviewClick || '', propKey: 'onPreviewClick', editable: isDesignEditing },
 { name: 'OnMasterDetail', val: obj.onMasterDetail || '', propKey: 'onMasterDetail', editable: isDesignEditing },
 { name: 'OnEnter', val: obj.onEnter || '', propKey: 'onEnter', editable: isDesignEditing },
 { name: 'OnExit', val: obj.onExit || '', propKey: 'onExit', editable: isDesignEditing },
 { name: 'OnKeyDown', val: obj.onKeyDown || '', propKey: 'onKeyDown', editable: isDesignEditing }
 ];
 } else if (isPage) {
    // RAPOR SAYFASI (PAGE1) ÖZELLİKLERİ (A4: 21x29.7cm & 1cm Kenar Boşlukları)
    const pWidth = obj.paperWidth || 210;
    const pHeight = obj.paperHeight || 297;
    const lMarg = obj.leftMargin ?? 10;
    const rMarg = obj.rightMargin ?? 10;
    const tMarg = obj.topMargin ?? 10;
    const bMarg = obj.bottomMargin ?? 10;
    const orient = obj.orientation || 'poPortrait';

    propList = [
      { name: 'Name', val: obj.name || 'Page1', propKey: 'name', editable: isDesignEditing },
      { name: 'Class', val: obj.type || 'TfrxReportPage', readOnly: true },
      { name: 'PaperWidth', val: `${(pWidth / 10).toFixed(1)} cm (${pWidth} mm)`, propKey: 'paperWidth', isNumber: true, editable: isDesignEditing },
      { name: 'PaperHeight', val: `${(pHeight / 10).toFixed(1)} cm (${pHeight} mm)`, propKey: 'paperHeight', isNumber: true, editable: isDesignEditing },
      { name: 'PaperSize', val: 'A4 (210 x 297 mm)', readOnly: true },
      { name: 'Orientation', val: orient, propKey: 'orientation', isSelect: isDesignEditing, options: ['poPortrait', 'poLandscape'] },
      { name: 'LeftMargin', val: `${(lMarg / 10).toFixed(1)} cm (${lMarg} mm)`, propKey: 'leftMargin', isNumber: true, editable: isDesignEditing },
      { name: 'RightMargin', val: `${(rMarg / 10).toFixed(1)} cm (${rMarg} mm)`, propKey: 'rightMargin', isNumber: true, editable: isDesignEditing },
      { name: 'TopMargin', val: `${(tMarg / 10).toFixed(1)} cm (${tMarg} mm)`, propKey: 'topMargin', isNumber: true, editable: isDesignEditing },
      { name: 'BottomMargin', val: `${(bMarg / 10).toFixed(1)} cm (${bMarg} mm)`, propKey: 'bottomMargin', isNumber: true, editable: isDesignEditing },
      { name: 'ColumnWidth', val: `${obj.columnWidth || 0} mm`, propKey: 'columnWidth', isNumber: true, editable: isDesignEditing },
      { name: 'Duplex', val: 'dmNone', readOnly: true },
      { name: 'Visible', val: obj.visible !== false ? 'true' : 'false', propKey: 'visible', isSelect: isDesignEditing, options: ['true', 'false'] }
    ];
  } else if (isBand) {
 // BANT NESNESİ ÖZELLİKLERİ
     const isBoldVal = (obj.fontStyle && (obj.fontStyle.includes('fsBold') || obj.fontStyle.includes('bold'))) || obj.isBold;
    const isItalicVal = (obj.fontStyle && (obj.fontStyle.includes('fsItalic') || obj.fontStyle.includes('italic'))) || obj.isItalic;
    const isUnderlineVal = (obj.fontStyle && (obj.fontStyle.includes('fsUnderline') || obj.fontStyle.includes('underline'))) || obj.isUnderline;

    propList = [
      { name: 'Name', val: obj.name || '', propKey: 'name', editable: isDesignEditing },
      { name: 'Class', val: obj.type || 'TfrxComponent', readOnly: true },
      { name: 'Left', val: obj.left ?? 0, propKey: 'left', isNumber: true, editable: isDesignEditing },
      { name: 'Top', val: obj.top ?? 0, propKey: 'top', isNumber: true, editable: isDesignEditing },
      { name: 'Width', val: obj.width ?? 0, propKey: 'width', isNumber: true, editable: isDesignEditing },
      { name: 'Height', val: obj.height ?? 0, propKey: 'height', isNumber: true, editable: isDesignEditing },
      { name: 'Align', val: obj.align || 'alNone', propKey: 'align', isSelect: isDesignEditing, options: ['alNone', 'alLeft', 'alRight', 'alTop', 'alBottom', 'alClient', 'alCustom'] },
      { name: 'Caption / Text', val: obj.caption || obj.text || '', propKey: 'text', editable: isDesignEditing },
      { name: 'DataSet', val: obj.dataSet || obj.listSource || '', propKey: 'dataSet', editable: isDesignEditing },
      { name: 'DataField', val: obj.dataField || obj.listField || '', propKey: 'dataField', editable: isDesignEditing },
      { name: 'HAlign', val: obj.hAlign || obj.alignment || 'haLeft', propKey: 'hAlign', isSelect: isDesignEditing, options: ['haLeft', 'haCenter', 'haRight', 'haBlock'] },
      { name: 'VAlign', val: obj.vAlign || 'vaTop', propKey: 'vAlign', isSelect: isDesignEditing, options: ['vaTop', 'vaCenter', 'vaBottom'] },
      { name: 'Font.Name', val: obj.fontName || 'Arial', propKey: 'fontName', isSelect: isDesignEditing, options: ['Arial', 'Segoe UI', 'Tahoma', 'Courier New', 'Times New Roman', 'Consolas', 'Roboto', 'JetBrains Mono', 'Plus Jakarta Sans'] },
      { name: 'Font.Size', val: obj.fontSize || 10, propKey: 'fontSize', isNumber: true, editable: isDesignEditing },
      { name: 'Font.Bold', val: isBoldVal ? 'true' : 'false', propKey: 'isBold', isSelect: isDesignEditing, options: ['true', 'false'] },
      { name: 'Font.Italic', val: isItalicVal ? 'true' : 'false', propKey: 'isItalic', isSelect: isDesignEditing, options: ['true', 'false'] },
      { name: 'Font.Underline', val: isUnderlineVal ? 'true' : 'false', propKey: 'isUnderline', isSelect: isDesignEditing, options: ['true', 'false'] },
      { name: 'Font.Color', rawVal: obj.fontColor, val: obj.fontColor || '-16777208', propKey: 'fontColor', isColor: true, editable: isDesignEditing },
      { name: 'Fill.BackColor', rawVal: (obj.fillBackColor || obj.color), val: obj.fillBackColor || obj.color || 'clNone', propKey: 'fillBackColor', isColor: true, editable: isDesignEditing },
      { name: 'Frame.Typ', val: obj.frameTyp || '[ftLeft, ftRight, ftTop, ftBottom]', propKey: 'frameTyp', isSelect: isDesignEditing, options: ['[ftLeft, ftRight, ftTop, ftBottom]', '[ftLeft, ftRight]', '[ftTop, ftBottom]', '[]', '[ftLeft]', '[ftRight]', '[ftTop]', '[ftBottom]'] },
      { name: 'Frame.Width', val: obj.frameWidth || 1, propKey: 'frameWidth', isNumber: true, editable: isDesignEditing },
      { name: 'Frame.Style', val: obj.frameStyle || 'fsSolid', propKey: 'frameStyle', isSelect: isDesignEditing, options: ['fsSolid', 'fsDash', 'fsDot', 'fsDashDot'] },
      { name: 'Frame.Color', rawVal: obj.frameColor, val: obj.frameColor || '-16777208', propKey: 'frameColor', isColor: true, editable: isDesignEditing },
      { name: 'StretchMode', val: obj.stretchMode || 'smDontStretch', propKey: 'stretchMode', isSelect: isDesignEditing, options: ['smDontStretch', 'smActualHeight', 'smMaxHeight'] },
      { name: 'ShiftMode', val: obj.shiftMode || 'smAlways', propKey: 'shiftMode', isSelect: isDesignEditing, options: ['smAlways', 'smDontShift', 'smWhenOverlapped'] },
      { name: 'WordWrap', val: obj.wordWrap !== false ? 'true' : 'false', propKey: 'wordWrap', isSelect: isDesignEditing, options: ['true', 'false'] },
      { name: 'AutoWidth', val: obj.autoWidth ? 'true' : 'false', propKey: 'autoWidth', isSelect: isDesignEditing, options: ['true', 'false'] },
      { name: 'AllowExpressions', val: obj.allowExpressions !== false ? 'true' : 'false', propKey: 'allowExpressions', isSelect: isDesignEditing, options: ['true', 'false'] },
      { name: 'AllowHTMLTags', val: obj.allowHTMLTags ? 'true' : 'false', propKey: 'allowHTMLTags', isSelect: isDesignEditing, options: ['true', 'false'] },
      { name: 'DisplayFormat', val: obj.formatStr || obj.displayFormat || '', propKey: 'formatStr', editable: isDesignEditing },
      { name: 'Rotation', val: String(obj.rotation || 0), propKey: 'rotation', isSelect: isDesignEditing, options: ['0', '90', '180', '270'] },
      { name: 'Visible', val: obj.visible !== false ? 'true' : 'false', propKey: 'visible', isSelect: isDesignEditing, options: ['true', 'false'] },
      { name: 'Enabled', val: obj.enabled !== false ? 'true' : 'false', propKey: 'enabled', isSelect: isDesignEditing, options: ['true', 'false'] },
      { name: 'Printable', val: obj.printable !== false ? 'true' : 'false', propKey: 'printable', isSelect: isDesignEditing, options: ['true', 'false'] }
    ];
 }

 const filtered = inspectorSearchQuery
? propList.filter(p => p.name.toLowerCase().includes(inspectorSearchQuery.toLowerCase()) || String(p.val).toLowerCase().includes(inspectorSearchQuery.toLowerCase()))
: propList;

 return filtered.map(p => {
 let inputControl = '';
 if (p.isColor) {
 const cInfo = delphiColorToRgb(p.rawVal || p.val, true);
 if (isDesignEditing && p.editable) {
 inputControl = `
 <div style="display:flex;align-items:center;gap:.35rem;width:100%;">
 <input type="color" class="designer-color-picker" data-prop="${p.propKey}" value="${cInfo.isNone? '#ffffff': cInfo.hex}" style="width:24px;height:22px;padding:0;border:1px solid var(--border);border-radius:4px;cursor:pointer;flex-shrink:0;" title="Renk Seçici" />
 <input type="text" class="designer-prop-input" data-prop="${p.propKey}" data-is-color="true" value="${cInfo.label}" style="flex:1;min-width:0;font-family:var(--mono);font-size:.76rem;padding:.2rem.4rem;" placeholder="rgb(r, g, b) veya #hex" />
 <select class="designer-color-presets" data-prop="${p.propKey}" style="max-width:85px;font-size:.72rem;padding:.15rem.25rem;">
 <option value="">Palet</option>
 <option value="clNone">Şeffaf</option>
 <option value="#bad3fe">Açık Mavi (#bad3fe)</option>
 <option value="#ffffff">Beyaz (#ffffff)</option>
 <option value="#000000">Siyah (#000000)</option>
 <option value="#dc2626">Kırmızı (#dc2626)</option>
 <option value="#16a34a">Yeşil (#16a34a)</option>
 <option value="#2563eb">Mavi (#2563eb)</option>
 <option value="#ca8a04">Sarı (#ca8a04)</option>
 <option value="#ece9d8">Form Grisi (#ece9d8)</option>
 </select>
 </div>
 `;
 } else {
 inputControl = `
 <div style="display:flex;align-items:center;gap:.4rem;">
 <span style="width:14px;height:14px;border-radius:3px;border:1px solid rgba(0,0,0,.25);background-color:${cInfo.hex};display:inline-block;flex-shrink:0;"></span>
 <span style="font-weight:700;color:var(--text-primary);font-size:.78rem;">${cInfo.label}</span>
 </div>
 `;
 }
 } else if (p.isSelect && isDesignEditing) {
 inputControl = `
 <select class="designer-prop-select" data-prop="${p.propKey}">
 ${p.options.map(opt => `<option value="${opt}" ${String(p.val) === opt? 'selected': ''}>${opt}</option>`).join('')}
 </select>
 `;
 } else if (p.editable && isDesignEditing) {
 const typeAttr = p.isNumber? 'type="number"': 'type="text"';
 inputControl = `
 <input ${typeAttr} class="designer-prop-input" data-prop="${p.propKey}" value="${esc(String(p.val))}" />
 `;
 } else {
 inputControl = `<span style="font-weight:600;color:var(--text-primary,#f8fafc);">${esc(String(p.val))}</span>`;
 }

 return `
 <div class="designer-prop-row">
 <div class="designer-prop-name" title="${esc(p.name)}">${esc(p.name)}</div>
 <div class="designer-prop-val">
 ${inputControl}
 </div>
 </div>
 `;
 }).join('');
 }

 // ── OBJECT INSPECTOR CANLI DÜZENLEME DİNLEYİCİSİ ──────────
 function bindInspectorInputs() {
 if (!isDesignEditing ||!selectedItem) return;

 const propTable = containerEl.querySelector('#propTableBody');
 if (!propTable) return;

 // 1. Text & Number Inputs
 propTable.querySelectorAll('.designer-prop-input').forEach(inp => {
 inp.addEventListener('change', () => {
 const prop = inp.dataset.prop;
 const isColor = inp.dataset.isColor === 'true';
 let val = inp.value;

 if (isColor) {
 val = hexToDelphiColor(val);
 } else if (inp.type === 'number') {
 val = parseFloat(val) || 0;
 }

 pushUndoState();
 selectedItem[prop] = val;
 if (prop === 'fillBackColor') selectedItem.color = val;
 if (prop === 'color') selectedItem.fillBackColor = val;
 renderCanvasOnly();
 updateSelection();
 pushUndoState();
 });
 });

 // 2. Select Dropdowns
 propTable.querySelectorAll('.designer-prop-select').forEach(sel => {
 sel.addEventListener('change', () => {
 const prop = sel.dataset.prop;
 let val = sel.value;
 if (val === 'true') val = true;
 else if (val === 'false') val = false;

 pushUndoState();
 selectedItem[prop] = val;
 renderCanvasOnly();
 updateSelection();
 pushUndoState();
 });
 });

 // 3. Color Pickers (<input type="color">)
 propTable.querySelectorAll('.designer-color-picker').forEach(cp => {
 cp.addEventListener('input', (e) => {
 const prop = cp.dataset.prop;
 const hex = e.target.value;
 const delphiVal = hexToDelphiColor(hex);
 selectedItem[prop] = delphiVal;
 if (prop === 'fillBackColor') selectedItem.color = delphiVal;
 if (prop === 'color') selectedItem.fillBackColor = delphiVal;
 
 const textInp = cp.parentElement.querySelector('.designer-prop-input');
 if (textInp) textInp.value = delphiColorToRgb(delphiVal).label;
 
 renderCanvasOnly();
 });

 cp.addEventListener('change', (e) => {
 pushUndoState();
 const prop = cp.dataset.prop;
 const hex = e.target.value;
 const delphiVal = hexToDelphiColor(hex);
 selectedItem[prop] = delphiVal;
 if (prop === 'fillBackColor') selectedItem.color = delphiVal;
 if (prop === 'color') selectedItem.fillBackColor = delphiVal;
 renderCanvasOnly();
 pushUndoState();
 });
 });

 // 4. Color Presets Dropdown
 propTable.querySelectorAll('.designer-color-presets').forEach(sel => {
 sel.addEventListener('change', (e) => {
 const choice = e.target.value;
 if (!choice) return;
 const prop = sel.dataset.prop;
 const delphiVal = hexToDelphiColor(choice);
 
 pushUndoState();
 selectedItem[prop] = delphiVal;
 if (prop === 'fillBackColor') selectedItem.color = delphiVal;
 if (prop === 'color') selectedItem.fillBackColor = delphiVal;

 const textInp = sel.parentElement.querySelector('.designer-prop-input');
 const cpInp = sel.parentElement.querySelector('.designer-color-picker');
 const info = delphiColorToRgb(delphiVal);
 if (textInp) textInp.value = info.label;
 if (cpInp &&!info.isNone) cpInp.value = info.hex;

 sel.value = '';
 renderCanvasOnly();
 pushUndoState();
 });
 });
 }

 // ── GERİ AL / İLERİ AL MOTORU (Undo / Redo Engine) ────────
 function pushUndoState() {
 if (!isDesignEditing) return;
 const stateStr = JSON.stringify(allPages.map(p => p.data));
 if (undoStack.length > 0 && undoStack[undoStack.length - 1] === stateStr) return;
 undoStack.push(stateStr);
 if (undoStack.length > 50) undoStack.shift();
 redoStack = [];
 updateUndoRedoButtonStates();
 }

 function undo() {
 if (!isDesignEditing || undoStack.length <= 1) return;
 const cur = undoStack.pop();
 redoStack.push(cur);
 const prevStr = undoStack[undoStack.length - 1];
 const prevData = JSON.parse(prevStr);
 allPages.forEach((p, idx) => {
 if (prevData[idx]) p.data = prevData[idx];
 });
 renderCanvasOnly();
 updateUndoRedoButtonStates();
 if (window.FrpNotify) window.FrpNotify.info('İşlem geri alındı (Undo) ↩️');
 else if (typeof toast === 'function') toast('İşlem geri alındı ↩️', 'info');
 }

 function redo() {
 if (!isDesignEditing || redoStack.length === 0) return;
 const nextStr = redoStack.pop();
 undoStack.push(nextStr);
 const nextData = JSON.parse(nextStr);
 allPages.forEach((p, idx) => {
 if (nextData[idx]) p.data = nextData[idx];
 });
 renderCanvasOnly();
 updateUndoRedoButtonStates();
 if (window.FrpNotify) window.FrpNotify.info('İşlem ileri alındı (Redo) ↪️');
 else if (typeof toast === 'function') toast('İşlem ileri alındı ↪️', 'info');
 }

 function updateUndoRedoButtonStates() {
 const uBtn = containerEl.querySelector('#btnUndoDesign');
 const rBtn = containerEl.querySelector('#btnRedoDesign');
 if (uBtn) uBtn.disabled = undoStack.length <= 1;
 if (rBtn) rBtn.disabled = redoStack.length === 0;
 }

 // ── CANLI SAHNE YENİLEME (Lightweight Canvas Re-render) ────
 function renderCanvasOnly() {
 const vp = containerEl.querySelector('#designerViewport');
 const activePage = allPages[activePageIndex];
 if (vp && activePage) {
 vp.innerHTML = activePage.type === 'report'? renderReportPageHtml(activePage.data): renderDialogPageHtml(activePage.data);
 bindCanvasInteraction();
 }
 }

 // ── BİLEŞEN EKLEME METODU (Genişletilmiş 14 Nesne Türü) ──
 function addNewComponent(type) {
 if (!isDesignEditing) return;
 const activePage = allPages[activePageIndex];
 if (!activePage) return;

 pushUndoState();

 const randomId = Math.floor(100 + Math.random() * 900);
 let newComp = null;

 if (type === 'memo') {
 newComp = {
 name: `Memo${randomId}`,
 type: 'TfrxMemoView',
 left: 60,
 top: 30,
 width: 140,
 height: 24,
 text: 'Yeni Rapor Metni',
 fontName: 'Arial',
 fontSize: 10,
 fontColor: '-16777208',
 fillBackColor: 'clNone'
 };
 } else if (type === 'picture') {
 newComp = {
 name: `Picture${randomId}`,
 type: 'TfrxPictureView',
 left: 60,
 top: 30,
 width: 100,
 height: 60,
 dataField: 'Logo'
 };
 } else if (type === 'line') {
 newComp = {
 name: `Line${randomId}`,
 type: 'TfrxLineView',
 left: 40,
 top: 30,
 width: 250,
 height: 2,
 fontColor: '-16777208'
 };
 } else if (type === 'barcode') {
 newComp = {
 name: `BarCode${randomId}`,
 type: 'TfrxBarCodeView',
 left: 60,
 top: 30,
 width: 130,
 height: 45,
 text: '1234567890',
 barType: 'bcCode128'
 };
 } else if (type === 'shape') {
 newComp = {
 name: `Shape${randomId}`,
 type: 'TfrxShapeView',
 left: 60,
 top: 30,
 width: 120,
 height: 50,
 shape: 'skRectangle',
 fillBackColor: 'clNone',
 frameWidth: 1
 };
 } else if (type === 'chart') {
 newComp = {
 name: `Chart${randomId}`,
 type: 'TfrxChartView',
 left: 60,
 top: 30,
 width: 280,
 height: 150,
 seriesType: 'FastLineSeries',
 dataSet: file.queries?.[0]?.name || ''
 };
 } else if (type === 'band') {
 if (activePage.type === 'report') {
 if (!activePage.data.bands) activePage.data.bands = [];
 const newBand = {
 name: `MasterData${activePage.data.bands.length + 1}`,
 type: 'TfrxMasterData',
 left: 0,
 top: 0,
 width: 794,
 height: 60,
 components: []
 };
 activePage.data.bands.push(newBand);
 selectedItem = newBand;
 render();
 pushUndoState();
 if (window.FrpNotify) window.FrpNotify.success(`Yeni Bant eklendi: '${newBand.name}' ➕`);
 return;
 }
 } else if (type === 'checkbox') {
 newComp = {
 name: `CheckBox${randomId}`,
 type: 'TfrxCheckBoxControl',
 left: 60,
 top: 30,
 width: 120,
 height: 20,
 caption: 'Seçenek',
 checked: false
 };
 } else if (type === 'radio') {
 newComp = {
 name: `RadioButton${randomId}`,
 type: 'TfrxRadioButtonControl',
 left: 60,
 top: 30,
 width: 120,
 height: 20,
 caption: 'Seçenek 1',
 checked: false
 };
 } else if (type === 'edit') {
 newComp = {
 name: `Edit${randomId}`,
 type: 'TfrxEditControl',
 left: 60,
 top: 30,
 width: 130,
 height: 24,
 text: ''
 };
 } else if (type === 'dateedit') {
 newComp = {
 name: `DateEdit${randomId}`,
 type: 'TfrxDateEditControl',
 left: 60,
 top: 30,
 width: 130,
 height: 24,
 date: new Date().toISOString().slice(0, 10)
 };
 } else if (type === 'combobox') {
 newComp = {
 name: `ComboBox${randomId}`,
 type: 'TfrxComboBoxControl',
 left: 60,
 top: 30,
 width: 140,
 height: 24,
 items: 'Seçenek 1\nSeçenek 2\nSeçenek 3'
 };
 } else if (type === 'panel') {
 newComp = {
 name: `Panel${randomId}`,
 type: 'TfrxPanelControl',
 left: 60,
 top: 30,
 width: 200,
 height: 100,
 caption: ''
 };
 }

 if (!newComp) return;

 if (activePage.type === 'report') {
 const bands = activePage.data.bands || [];
 if (bands.length > 0) {
 if (!bands[0].components) bands[0].components = [];
 bands[0].components.push(newComp);
 } else {
 activePage.data.bands = [{
 name: 'MasterData1',
 type: 'TfrxMasterData',
 left: 0,
 top: 0,
 width: 794,
 height: 100,
 components: [newComp]
 }];
 }
 } else {
 if (!activePage.data.controls) activePage.data.controls = [];
 activePage.data.controls.push(newComp);
 }

 selectedItem = newComp;
 render();
 pushUndoState();
 if (window.FrpNotify) window.FrpNotify.success(`'${newComp.name}' eklendi ➕`);
 else if (typeof toast === 'function') toast(`'${newComp.name}' eklendi ➕`, 'success');
 }

 // ── BİLEŞEN SİLME METODU ──────────────────────────────────
 function deleteSelectedComponent() {
 if (!isDesignEditing) return;
 if (!selectedItem) {
 if (typeof toast === 'function') toast('Silinecek bir bileşen seçilmedi.', 'info');
 return;
 }

 const activePage = allPages[activePageIndex];
 if (!activePage) return;

 pushUndoState();

 let deleted = false;
 if (activePage.type === 'report') {
 (activePage.data.bands || []).forEach(b => {
 const idx = (b.components || []).findIndex(c => c.name === selectedItem.name);
 if (idx!== -1) {
 b.components.splice(idx, 1);
 deleted = true;
 }
 });
 } else {
 const idx = (activePage.data.controls || []).findIndex(c => c.name === selectedItem.name);
 if (idx!== -1) {
 activePage.data.controls.splice(idx, 1);
 deleted = true;
 }
 }

 if (deleted) {
 const delName = selectedItem.name;
 selectedItem = null;
 render();
 pushUndoState();
 if (window.FrpNotify) window.FrpNotify.info(`'${delName}' silindi ️`);
 else if (typeof toast === 'function') toast(`'${delName}' silindi ️`, 'info');
 }
 }

 // ── SAHNE İÇİ İNTERAKTİF SÜRÜKLE / BOYUTLANDIR / DÜZENLE BAĞLAYICI ──
 function bindCanvasInteraction() {
    const vpEl = containerEl.querySelector('#designerViewport');
    if (vpEl && !vpEl._clickBound) {
      vpEl._clickBound = true;
      vpEl.addEventListener('click', (e) => {
        if (e.target.closest('.fr-view-item') || e.target.closest('.fr-ctrl-item') || e.target.closest('.fr-vertical-band-overlay')) return;
        const activePage = allPages[activePageIndex];
        if (activePage) {
          selectedItem = activePage.data;
          updateSelection();
        }
      });
    }

    containerEl.querySelectorAll('.fr-view-item,.fr-ctrl-item').forEach(el => {
 el.addEventListener('click', (e) => {
 e.stopPropagation();
 const bandIdx = parseInt(el.dataset.bandIdx, 10);
 const compIdx = parseInt(el.dataset.compIdx, 10);
 const rawIdx = el.dataset.ctrlIdx;
 const activePage = allPages[activePageIndex];

 if (activePage.type === 'report' && activePage.data.bands?.[bandIdx]?.components?.[compIdx]) {
 selectedItem = activePage.data.bands[bandIdx].components[compIdx];
 updateSelection();
 } else if (activePage.type === 'dialog' && rawIdx!== undefined) {
 if (rawIdx.includes('_')) {
 const parts = rawIdx.split('_').map(n => parseInt(n, 10));
 const parentCtrl = activePage.data.controls?.[parts[0]];
 selectedItem = parentCtrl?.children?.[parts[1]] || parentCtrl;
 } else {
 const idx = parseInt(rawIdx, 10);
 selectedItem = activePage.data.controls?.[idx];
 }
 updateSelection();
 }
 });

 // Çift Tıklama ile Metin Düzenleme (In-place Text Edit with Modern Modal)
 el.addEventListener('dblclick', async (e) => {
 e.stopPropagation();
 if (!isDesignEditing ||!selectedItem || currentMode!== 'designer') return;
 const oldText = selectedItem.text || selectedItem.caption || '';
 
 let newText = null;
 if (typeof window.showPromptModal === 'function') {
 newText = await window.showPromptModal({
 title: `"${selectedItem.name}" Metnini Düzenle`,
 message: 'Memo bileşeni metnini veya alan ifadesini düzenleyin:',
 defaultValue: oldText,
 isTextarea: true,
 badge: ''
 });
 } else {
 newText = prompt(`"${selectedItem.name}" metnini düzenleyin:`, oldText);
 }

 if (newText!== null && newText!== oldText) {
 pushUndoState();
 selectedItem.text = newText;
 selectedItem.caption = newText;
 renderCanvasOnly();
 const propTable = containerEl.querySelector('#propTableBody');
 if (propTable) {
 const activePage = allPages[activePageIndex];
 propTable.innerHTML = renderObjectInspectorProperties(selectedItem || activePage?.data);
 bindInspectorInputs();
 }
 pushUndoState();
 }
 });

 // Sürükle & Boyutlandır Başlangıcı (MouseDown)
 el.addEventListener('mousedown', (e) => {
 if (!isDesignEditing || currentMode!== 'designer' ||!selectedItem) return;
 if (e.target.closest('.designer-prop-input') || e.target.closest('.designer-prop-select')) return;

 const resizeHandle = e.target.closest('.fr-resize-handle');
 const handleType = resizeHandle? resizeHandle.dataset.handle: null;

 let isDragging =!handleType;
 let isResizing =!!handleType;

 const startX = e.clientX;
 const startY = e.clientY;
 const startLeft = selectedItem.left || 0;
 const startTop = selectedItem.top || 0;
 const startWidth = selectedItem.width || 100;
 const startHeight = selectedItem.height || 30;

 if (isDragging) el.classList.add('is-dragging');

 const onMouseMove = (moveEvt) => {
 const dx = Math.round((moveEvt.clientX - startX) / currentZoom);
 const dy = Math.round((moveEvt.clientY - startY) / currentZoom);

 if (isDragging) {
 // 4px Izgara Hizalama (Grid Snapping)
 const snapLeft = Math.round((startLeft + dx) / 4) * 4;
 const snapTop = Math.round((startTop + dy) / 4) * 4;
 selectedItem.left = Math.max(0, snapLeft);
 selectedItem.top = Math.max(0, snapTop);
 el.style.left = `${selectedItem.left}px`;
 el.style.top = `${selectedItem.top}px`;
 } else if (isResizing) {
 if (handleType.includes('e')) selectedItem.width = Math.max(12, startWidth + dx);
 if (handleType.includes('s')) selectedItem.height = Math.max(8, startHeight + dy);
 if (handleType.includes('w')) {
 const newW = Math.max(12, startWidth - dx);
 selectedItem.left = startLeft + (startWidth - newW);
 selectedItem.width = newW;
 el.style.left = `${selectedItem.left}px`;
 }
 if (handleType.includes('n')) {
 const newH = Math.max(8, startHeight - dy);
 selectedItem.top = startTop + (startHeight - newH);
 selectedItem.height = newH;
 el.style.top = `${selectedItem.top}px`;
 }
 el.style.width = `${selectedItem.width}px`;
 el.style.height = `${selectedItem.height}px`;
 }

 // Status Bar Güncelle
 const statusCoords = containerEl.querySelector('#statusCoords');
 const statusDims = containerEl.querySelector('#statusDims');
 if (statusCoords) statusCoords.innerHTML = `<span>X: ${selectedItem.left}, Y: ${selectedItem.top}</span>`;
 if (statusDims) statusDims.innerHTML = `<span>W: ${selectedItem.width}, H: ${selectedItem.height}</span>`;
 };

 const onMouseUp = () => {
 el.classList.remove('is-dragging');
 window.removeEventListener('mousemove', onMouseMove);
 window.removeEventListener('mouseup', onMouseUp);

 pushUndoState();

 // Object Inspector'ı Güncelle
 const propTable = containerEl.querySelector('#propTableBody');
 if (propTable) {
 const activePage = allPages[activePageIndex];
 propTable.innerHTML = renderObjectInspectorProperties(selectedItem || activePage?.data);
 bindInspectorInputs();
 }
 };

 window.addEventListener('mousemove', onMouseMove);
 window.addEventListener('mousemove', onMouseMove);
 window.addEventListener('mouseup', onMouseUp);
 });
 });

 // 2. Bantlara (Header, Footer, ReportTitle, MasterData, Dikey Bantlar vb.) Tıklama Dinleyicisi
 // ALL band-related elements: container, header, body, vertical overlay & header - both designer and preview mode
 containerEl.querySelectorAll('.fr-band-container,.fr-band-header,.fr-band-body,.fr-vertical-band-header,.fr-vertical-band-overlay,.fr-vband-box').forEach(bEl => {
 bEl.addEventListener('click', (e) => {
 if (e.target.closest('.fr-view-item') || e.target.closest('.fr-ctrl-item')) return;
 e.stopPropagation();
 // Resolve band idx: from self or from closest parent container
 const bandIdx = parseInt(bEl.dataset.bandIdx?? bEl.closest('[data-band-idx]')?.dataset.bandIdx, 10);
 if (isNaN(bandIdx)) return;
 const activePage = allPages[activePageIndex];
 if (activePage && activePage.type === 'report' && activePage.data.bands?.[bandIdx]) {
 selectedItem = activePage.data.bands[bandIdx];
 updateSelection();
 }
 });
 });

 // Also: clicking fr-band-body in preview mode (no fr-band-header rendered)
 // Delegate from the report page container for preview mode bands
 const reportPageEl = containerEl.querySelector('#frReportPage');
 if (reportPageEl) {
 reportPageEl.addEventListener('click', (e) => {
 if (e.target.closest('.fr-view-item') || e.target.closest('.fr-ctrl-item')) return;
 // If click lands on a band container or any of its non-item children
 const bandContainer = e.target.closest('.fr-band-container');
 if (bandContainer) {
 const bandIdx = parseInt(bandContainer.dataset.bandIdx, 10);
 if (!isNaN(bandIdx)) {
 e.stopPropagation();
 const activePage = allPages[activePageIndex];
 if (activePage && activePage.type === 'report' && activePage.data.bands?.[bandIdx]) {
 selectedItem = activePage.data.bands[bandIdx];
 updateSelection();
 }
 }
 }
 });
 }
 }

 // ── OLAYLARI BAĞLA (EVENT LISTENERS & RESIZING) ───────────
 function bindEvents() {
 // 1. Sayfa Sekmeleri Değiştirme
 containerEl.querySelectorAll('.designer-page-tab').forEach(btn => {
 btn.addEventListener('click', () => {
 activePageIndex = parseInt(btn.dataset.idx, 10) || 0;
 selectedItem = null;
 render();
 });
 });

 // 2. Mod Butonları
 const btnDesigner = containerEl.querySelector('#btnModeDesigner');
 const btnPreview = containerEl.querySelector('#btnModePreview');
 if (btnDesigner) {
 btnDesigner.addEventListener('click', () => {
 currentMode = 'designer';
 render();
 });
 }
 if (btnPreview) {
 btnPreview.addEventListener('click', () => {
 currentMode = 'preview';
 render();
 });
 }

 // 3. Düzenleme / Kaydetme / İptal Etme Butonları
 containerEl.querySelector('#btnStartDesignEdit')?.addEventListener('click', () => {
 isDesignEditing = true;
 initialPagesBackup = JSON.parse(JSON.stringify(allPages.map(p => p.data)));
 undoStack = [JSON.stringify(allPages.map(p => p.data))];
 redoStack = [];
 render();
 if (window.FrpNotify) window.FrpNotify.info('Tasarım düzenleme modu aktif. Değişiklikleri yaptıktan sonra "Tasarımı Kaydet" butonuna basınız.');
 });

 containerEl.querySelector('#btnSaveDesignEdit')?.addEventListener('click', () => {
 if (!isDesignEditing) return;
 file.pages = allPages.filter(p => p.type === 'report').map(p => p.data);
 file.dialogPages = allPages.filter(p => p.type === 'dialog').map(p => p.data);
 
 if (window.FrpStore && typeof window.FrpStore.saveFile === 'function') {
 const savedFile = window.FrpStore.saveFile(file);
 if (savedFile) Object.assign(file, savedFile);
 }

 if (window.FrpAudit) {
 window.FrpAudit.logAction({
 action: 'DESIGN_EDIT',
 target: file.name || 'Rapor',
 details: `Görsel rapor sayfası tasarımı (${file.pages.length} sayfa) düzenlendi ve kaydedildi.`
 });
 }

 isDesignEditing = false;
 undoStack = [];
 redoStack = [];
 initialPagesBackup = null;
 render();
 if (window.FrpNotify) window.FrpNotify.success('Rapor tasarımı başarıyla kaydedildi! ');
 else if (typeof toast === 'function') toast('Rapor tasarımı kaydedildi! ', 'success');
 });

 containerEl.querySelector('#btnCancelDesignEdit')?.addEventListener('click', () => {
 if (initialPagesBackup) {
 allPages.forEach((p, idx) => {
 if (initialPagesBackup[idx]) p.data = initialPagesBackup[idx];
 });
 }
 isDesignEditing = false;
 undoStack = [];
 redoStack = [];
 initialPagesBackup = null;
 render();
 if (window.FrpNotify) window.FrpNotify.info('Tasarım değişiklikleri iptal edildi. ↩️');
 });

 containerEl.querySelector('#btnUndoDesign')?.addEventListener('click', undo);
 containerEl.querySelector('#btnRedoDesign')?.addEventListener('click', redo);

 // 4. Genişletilmiş Bileşen Paleti Butonları
 containerEl.querySelector('#btnToolAddMemo')?.addEventListener('click', () => addNewComponent('memo'));
 containerEl.querySelector('#btnToolAddPicture')?.addEventListener('click', () => addNewComponent('picture'));
 containerEl.querySelector('#btnToolAddLine')?.addEventListener('click', () => addNewComponent('line'));
 containerEl.querySelector('#btnToolAddBarcode')?.addEventListener('click', () => addNewComponent('barcode'));
 containerEl.querySelector('#btnToolAddShape')?.addEventListener('click', () => addNewComponent('shape'));
 containerEl.querySelector('#btnToolAddChart')?.addEventListener('click', () => addNewComponent('chart'));
 containerEl.querySelector('#btnToolAddBand')?.addEventListener('click', () => addNewComponent('band'));
 containerEl.querySelector('#btnToolAddCheckbox')?.addEventListener('click', () => addNewComponent('checkbox'));
 containerEl.querySelector('#btnToolAddRadio')?.addEventListener('click', () => addNewComponent('radio'));
 containerEl.querySelector('#btnToolAddEdit')?.addEventListener('click', () => addNewComponent('edit'));
 containerEl.querySelector('#btnToolAddDateEdit')?.addEventListener('click', () => addNewComponent('dateedit'));
 containerEl.querySelector('#btnToolAddCombobox')?.addEventListener('click', () => addNewComponent('combobox'));
 containerEl.querySelector('#btnToolAddPanel')?.addEventListener('click', () => addNewComponent('panel'));
 containerEl.querySelector('#btnToolDeleteSelected')?.addEventListener('click', deleteSelectedComponent);

 // 5. Zoom Kontrolleri
 containerEl.querySelector('#btnZoomIn')?.addEventListener('click', () => {
 currentZoom = Math.min(2.5, Math.round((currentZoom + 0.15) * 100) / 100);
 updateZoom();
 });
 containerEl.querySelector('#btnZoomOut')?.addEventListener('click', () => {
 currentZoom = Math.max(0.3, Math.round((currentZoom - 0.15) * 100) / 100);
 updateZoom();
 });
 containerEl.querySelector('#btnZoomFit')?.addEventListener('click', () => {
 const vp = containerEl.querySelector('#designerViewport');
 const pageEl = containerEl.querySelector('#frReportPage') || containerEl.querySelector('#frDialogWindow');
 if (vp && pageEl) {
 const vpW = vp.clientWidth - 80;
 const pageW = pageEl.offsetWidth || 1046;
 currentZoom = Math.max(0.3, Math.min(1.5, Math.round((vpW / pageW) * 100) / 100));
 updateZoom();
 }
 });

 // 6. Sağ Panel Sekmeleri (Object Inspector vs Data Tree)
 containerEl.querySelector('#btnTabInspector')?.addEventListener('click', () => {
 rightTab = 'inspector';
 showInspector = true;
 render();
 });
 containerEl.querySelector('#btnTabDataTree')?.addEventListener('click', () => {
 rightTab = 'datatree';
 showInspector = true;
 render();
 });

 const insp = containerEl.querySelector('#designerInspector');
 containerEl.querySelector('#btnCollapseInspector')?.addEventListener('click', () => {
 showInspector = false;
 if (insp) insp.classList.add('collapsed');
 });

 // 7. Object Inspector Sekmeleri (Properties / Events / Favorites)
 containerEl.querySelectorAll('.designer-subtab').forEach(st => {
 st.addEventListener('click', () => {
 containerEl.querySelectorAll('.designer-subtab').forEach(b => b.classList.remove('active'));
 st.classList.add('active');
 inspectorTab = st.dataset.subtab || 'properties';
 const propTable = containerEl.querySelector('#propTableBody');
 if (propTable) {
 const activePage = allPages[activePageIndex];
 propTable.innerHTML = renderObjectInspectorProperties(selectedItem || activePage?.data);
 bindInspectorInputs();
 }
 });
 });

 // 8. Object Inspector Resizing
 const resizer = containerEl.querySelector('#inspectorResizer');
 if (resizer && insp) {
 let isResizing = false;
 let startX = 0;
 let startW = 0;

 resizer.addEventListener('mousedown', e => {
 isResizing = true;
 startX = e.clientX;
 startW = insp.offsetWidth;
 document.body.style.cursor = 'ew-resize';
 document.body.style.userSelect = 'none';
 e.preventDefault();
 });

 window.addEventListener('mousemove', e => {
 if (!isResizing) return;
 const dx = startX - e.clientX;
 const newW = Math.max(220, Math.min(650, startW + dx));
 inspectorWidth = newW;
 insp.style.width = newW + 'px';
 });

 window.addEventListener('mouseup', () => {
 if (isResizing) {
 isResizing = false;
 document.body.style.cursor = '';
 document.body.style.userSelect = '';
 localStorage.setItem('frp_inspector_width', inspectorWidth);
 }
 });
 }

 // 9. Özellik Arama Kutusu
 containerEl.querySelector('#propSearchInput')?.addEventListener('input', (e) => {
 inspectorSearchQuery = e.target.value || '';
 const propTable = containerEl.querySelector('#propTableBody');
 if (propTable) {
 const activePage = allPages[activePageIndex];
 propTable.innerHTML = renderObjectInspectorProperties(selectedItem || activePage?.data);
 bindInspectorInputs();
 }
 });

 // 10. Sahne boşluğuna tıklayınca sayfayı seç
 containerEl.querySelector('#designerViewport')?.addEventListener('click', (e) => {
 if (e.target.id === 'designerViewport' || e.target.id === 'frReportPage' || e.target.classList.contains('fr-band-box')) {
 const activePage = allPages[activePageIndex];
 selectedItem = activePage? activePage.data: null;
 updateSelection();
 }
 });

 // 11. Klavye Kısayolları (Ctrl+Z: Geri Al, Ctrl+Y: İleri Al, Delete: Sil)
 window.addEventListener('keydown', (e) => {
 if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
 
 if (isDesignEditing) {
 if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' &&!e.shiftKey) {
 e.preventDefault();
 undo();
 } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
 e.preventDefault();
 redo();
 } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItem) {
 e.preventDefault();
 deleteSelectedComponent();
 }
 }
 });

 bindCanvasInteraction();
 bindInspectorInputs();
 }

 function updateZoom() {
 const zoomText = containerEl.querySelector('#zoomValText');
 if (zoomText) zoomText.textContent = Math.round(currentZoom * 100) + '%';
 const pageEl = containerEl.querySelector('#frReportPage') || containerEl.querySelector('#frDialogWindow');
 if (pageEl) pageEl.style.transform = `scale(${currentZoom})`;
 }

 function updateSelection() {
 containerEl.querySelectorAll('.fr-view-item.selected,.fr-ctrl-item.selected,.fr-band-container.selected-band,.fr-band-header.selected-band,.fr-vertical-band-overlay.selected-band,.fr-vertical-band-header.selected-band,.fr-vband-box.selected-band').forEach(el => {
 el.classList.remove('selected', 'selected-band');
 });
 
 // YALNIZCA Tasarımcı modundaysa ve seçim varsa sınıf ekle
 if (selectedItem) {
 const isBand = (selectedItem.type && (BAND_META[selectedItem.type] || selectedItem.type.includes('Band') || selectedItem.type.includes('Header') || selectedItem.type.includes('Footer') || selectedItem.type === 'TfrxMasterData' || selectedItem.type === 'TfrxReportTitle' || selectedItem.vertical || String(selectedItem.rawAttrs || '').includes('Vertical="True"')));
 if (isBand) {
 const activePage = allPages[activePageIndex];
 const bIdx = (activePage?.data?.bands || []).indexOf(selectedItem);
 if (bIdx!== -1) {
 const targetBandEl = containerEl.querySelector(`.fr-band-container[data-band-idx="${bIdx}"]`) ||
 containerEl.querySelector(`.fr-vertical-band-header[data-band-idx="${bIdx}"]`) ||
 containerEl.querySelector(`.fr-vertical-band-overlay[data-band-idx="${bIdx}"]`) ||
 containerEl.querySelector(`.fr-vband-box[data-band-idx="${bIdx}"]`);
 if (targetBandEl) {
 targetBandEl.classList.add('selected-band');
 const overlayParent = targetBandEl.closest('.fr-vertical-band-overlay');
 if (overlayParent) overlayParent.classList.add('selected-band');
 }
 }
 } else if (currentMode === 'designer') {
 const targetEl = containerEl.querySelector(`[title*="${selectedItem.name}"]`) || containerEl.querySelector(`[data-ctrl-idx]`);
 if (targetEl) targetEl.classList.add('selected');
 }
 }

 const compTypeBadge = containerEl.querySelector('#inspectorCompType');
 if (compTypeBadge) compTypeBadge.textContent = selectedItem? (selectedItem.type || selectedItem.name || 'TfrxComponent'): 'TfrxPage';

 const propTable = containerEl.querySelector('#propTableBody');
 if (propTable) {
 const activePage = allPages[activePageIndex];
 propTable.innerHTML = renderObjectInspectorProperties(selectedItem || activePage?.data);
 bindInspectorInputs();
 }

 // Status Bar Güncellemesi (Image 3)
 const statusCoords = containerEl.querySelector('#statusCoords');
 const statusDims = containerEl.querySelector('#statusDims');
 const statusCompPath = containerEl.querySelector('#statusCompPath');
 const activePage = allPages[activePageIndex];

 if (statusCoords) statusCoords.innerHTML = `<span>X: ${selectedItem? (selectedItem.left?? 0): 0}, Y: ${selectedItem? (selectedItem.top?? 0): 0}</span>`;
 if (statusDims) statusDims.innerHTML = `<span>W: ${selectedItem? (selectedItem.width?? 0): 0}, H: ${selectedItem? (selectedItem.height?? 0): 0}</span>`;
 if (statusCompPath) statusCompPath.innerHTML = renderStatusCompPath(selectedItem, activePage);
 }

 render();
 }

 // Sekmeli Dialog Kontrolü için Canlı Sekme Değiştirici
 window.switchDialogTab = function(btnEl, pcIdx, targetTabIdx) {
 if (!btnEl) return;
 const pc = document.getElementById(`pc_${pcIdx}`) || btnEl.closest('.fr-ctrl-pagecontrol');
 if (!pc) return;

 // Sekme Butonlarını Güncelle
 const btns = pc.querySelectorAll('.fr-tab-btn');
 btns.forEach((b, idx) => {
 b.classList.toggle('active', idx === targetTabIdx);
 });

 // Sekme İçeriklerini Göster/Gizle
 const bodies = pc.querySelectorAll(`.fr-tab-body-${pcIdx}`);
 bodies.forEach((body, idx) => {
 body.style.display = (idx === targetTabIdx)? 'block': 'none';
 });
 };

 // Data Tree alanını panoya kopyalama
 window.copyDataTreeField = function(queryName, fieldName) {
 const expr = `[${queryName}."${fieldName}"]`;
 navigator.clipboard.writeText(expr).then(() => {
 if (typeof showToast === 'function') {
 showToast(`Alan kopyalandı: ${expr}`, 'success');
 } else if (typeof toast === 'function') {
 toast(`Alan kopyalandı: ${expr}`, 'success');
 }
 }).catch(() => {});
 };

 window.FastReportDesigner = {
 render: createDesigner,
 switchDialogTab: window.switchDialogTab,
 copyDataTreeField: window.copyDataTreeField
 };

})(window);
