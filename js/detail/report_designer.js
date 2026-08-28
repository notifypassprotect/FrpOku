// ============================================================
//  report_designer.js — FastReport Görsel Tasarım & Önizleme Motoru (v3.3)
//  FastReport FRP/XML Rapor Sayfaları ve Parametre Formları Çizici
// ============================================================

(function(window) {
  'use strict';

  // ── DELPHI RENK DÖNÜŞTÜRÜCÜ & ETİKETLEYİCİ ─────────────────
  function decodeDelphiColor(val, isBackground = true) {
    if (!val || val === 'clNone' || val === 'None' || val === '-1' || val === '536870911') {
      return isBackground ? 'transparent' : '#000000';
    }
    if (val === '-16777208' || val === 'clWindowText') {
      return isBackground ? 'transparent' : '#000000';
    }
    if (val === '0' || val === 'clBlack') {
      return isBackground ? 'transparent' : '#000000';
    }
    if (val === '16777215' || val === 'clWhite' || val === '-16777211' || val === 'clWindow') {
      return '#ffffff';
    }
    if (val === '-16777201' || val === 'clBtnFace') {
      return isBackground ? '#ece9d8' : '#000000';
    }
    if (val === '-16777188' || val === 'clMenuHighlight') {
      return isBackground ? '#5bc0de' : '#000000'; // Sky Cyan (Image 4)
    }
    if (val === 'clRed' || val === '255') return isBackground ? '#fca5a5' : '#dc2626';
    if (val === 'clYellow' || val === '65535') return isBackground ? '#fef08a' : '#ca8a04';
    if (val === 'clGreen' || val === '65280') return isBackground ? '#bbf7d0' : '#16a34a';
    if (val === 'clBlue' || val === '16711680') return isBackground ? '#bfdbfe' : '#2563eb';
    if (val === 'clSkyBlue' || val === '15780518') return isBackground ? '#e0f2fe' : '#0284c7';
    if (val === 'clMoneyGreen' || val === '12639424') return isBackground ? '#dcfce7' : '#15803d';

    // Hex string ($00RRGGBB / 0x00BBGGRR)
    if (typeof val === 'string' && (val.startsWith('$') || val.startsWith('0x'))) {
      const hex = val.replace(/^\$|^0x/, '').padStart(6, '0');
      const hexNum = parseInt(hex, 16);
      if (!isNaN(hexNum)) {
        const r = hexNum & 0xFF;
        const g = (hexNum >> 8) & 0xFF;
        const b = (hexNum >> 16) & 0xFF;
        return `rgb(${r}, ${g}, ${b})`;
      }
    }

    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) return isBackground ? 'transparent' : '#000000';

    // Delphi integer BGR formatındadır
    const r = num & 0xFF;
    const g = (num >> 8) & 0xFF;
    const b = (num >> 16) & 0xFF;
    return `rgb(${r}, ${g}, ${b})`;
  }

  function formatDelphiColorName(val) {
    if (!val || val === 'clNone' || val === 'None' || val === '536870911' || val === '-1') return 'clNone (Şeffaf / Yok)';
    if (val === '-16777208' || val === 'clWindowText') return 'clWindowText (Siyah / #000000)';
    if (val === '-16777211' || val === 'clWindow' || val === '16777215' || val === 'clWhite') return 'clWhite (Beyaz / #ffffff)';
    if (val === '-16777201' || val === '-16777188' || val === 'clBtnFace') return 'clBtnFace (Form Grisi / #ece9d8)';
    if (val === '0' || val === 'clBlack') return 'clBlack (Siyah / #000000)';
    if (val === 'clRed' || val === '255') return 'clRed (Kırmızı)';
    if (val === 'clYellow' || val === '65535') return 'clYellow (Sarı)';
    if (val === 'clBlue' || val === '16711680') return 'clBlue (Mavi)';
    if (val === 'clGreen' || val === '65280') return 'clGreen (Yeşil)';
    if (val === 'clSkyBlue' || val === '15780518') return 'clSkyBlue (Gök Mavisi)';
    
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      const r = num & 0xFF;
      const g = (num >> 8) & 0xFF;
      const b = (num >> 16) & 0xFF;
      return `RGB(${r}, ${g}, ${b}) [${val}]`;
    }
    return String(val);
  }

  function formatFrameType(typ) {
    const t = parseInt(typ, 10) || 0;
    if (t === 0) return '0 (Kenarlık Yok)';
    if (t === 15) return '15 (Tüm Kenarlıklar 🔲)';
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
      borderLeft: (typ & 1) ? `${w} solid ${color}` : 'none',
      borderRight: (typ & 2) ? `${w} solid ${color}` : 'none',
      borderTop: (typ & 4) ? `${w} solid ${color}` : 'none',
      borderBottom: (typ & 8) ? `${w} solid ${color}` : 'none'
    };
  }

  // ── BANT TİPİ VE ETİKETİ ──────────────────────────────────
  const BAND_META = {
    TfrxReportTitle:   { label: 'ReportTitle', icon: '📐', class: 'fr-band-reporttitle' },
    TfrxPageHeader:    { label: 'PageHeader', icon: '📐', class: 'fr-band-pageheader' },
    TfrxHeader:        { label: 'Header', icon: '📐', class: 'fr-band-header-type' },
    TfrxGroupHeader:   { label: 'GroupHeader', icon: '📐', class: 'fr-band-groupheader' },
    TfrxMasterData:    { label: 'MasterData', icon: '▶', class: 'fr-band-masterdata' },
    TfrxDetailData:    { label: 'DetailData', icon: '▶', class: 'fr-band-detaildata' },
    TfrxSubdetailData: { label: 'SubdetailData', icon: '▶', class: 'fr-band-detaildata' },
    TfrxGroupFooter:   { label: 'GroupFooter', icon: '📐', class: 'fr-band-groupfooter' },
    TfrxFooter:        { label: 'Footer', icon: '📐', class: 'fr-band-footer' },
    TfrxPageFooter:    { label: 'PageFooter', icon: '📐', class: 'fr-band-pagefooter' },
    TfrxReportSummary: { label: 'ReportSummary', icon: '📐', class: 'fr-band-reportsummary' },
    TfrxColumnHeader:  { label: 'ColumnHeader', icon: '📐', class: 'fr-band-header-type' },
    TfrxOverlay:       { label: 'Overlay', icon: '📄', class: 'fr-band-overlay' },
    TfrxPageContent:   { label: 'Sayfa İçeriği', icon: '📄', class: 'fr-band-overlay' },
    DMPHeader:         { label: 'DMPHeader', icon: '📐', class: 'fr-band-header-type' },
    DMPFooter:         { label: 'DMPFooter', icon: '📐', class: 'fr-band-footer' },
    DMPMasterData:     { label: 'DMPMasterData', icon: '▶', class: 'fr-band-masterdata' },
    DMPDetailData:     { label: 'DMPDetailData', icon: '▶', class: 'fr-band-detaildata' }
  };

  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

    // Sayfaları hazırla
    const pages = Array.isArray(file.pages) ? file.pages : [];
    const dialogPages = Array.isArray(file.dialogPages) ? file.dialogPages : [];
    
    const allPages = [
      ...pages.map((p, i) => ({ type: 'report', data: p, id: 'page_' + i, name: p.name || `Page${i + 1}` })),
      ...dialogPages.map((d, i) => ({ type: 'dialog', data: d, id: 'dialog_' + i, name: d.name || `DialogPage${i + 1}` }))
    ];

    let activePageIndex = 0;

    function render() {
      if (allPages.length === 0) {
        containerEl.innerHTML = `
          <div style="padding:3rem;text-align:center;color:var(--text-muted);">
            <div style="font-size:2.5rem;margin-bottom:.5rem;">📐</div>
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
                  <button type="button" class="designer-page-tab ${idx === activePageIndex ? 'active' : ''}" data-idx="${idx}">
                    ${p.type === 'dialog' ? '🖼️' : '📄'} ${esc(p.name)}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Mod Değiştirici (Tasarımcı vs Baskı Önizleme) -->
            <div class="designer-toolbar-group">
              ${activePage.type === 'report' ? `
                <div class="designer-mode-toggle">
                  <button type="button" class="designer-mode-btn ${currentMode === 'designer' ? 'active' : ''}" id="btnModeDesigner" title="Tasarımcı Görünümü (Bantlar &amp; Izgara &amp; Seçim Kutuları)">
                    📐 Tasarımcı Modu
                  </button>
                  <button type="button" class="designer-mode-btn ${currentMode === 'preview' ? 'active' : ''}" id="btnModePreview" title="Baskı Sayfası Önizleme (Temiz Çıktı - Çerçeveler Gizli)">
                    👁️ Baskı Önizleme
                  </button>
                </div>
              ` : `
                <span style="font-size:.76rem;color:var(--text-muted);font-weight:700;background:rgba(255,255,255,.06);padding:.25rem .6rem;border-radius:6px;">
                  🖼️ Delphi VCL Parametre Formu
                </span>
              `}
            </div>

            <!-- Zoom & Panel Kontrolleri -->
            <div class="designer-toolbar-group">
              <div class="designer-zoom-ctrl">
                <button type="button" class="designer-zoom-btn" id="btnZoomOut" title="Küçült">−</button>
                <span class="designer-zoom-val" id="zoomValText">${Math.round(currentZoom * 100)}%</span>
                <button type="button" class="designer-zoom-btn" id="btnZoomIn" title="Büyüt">+</button>
                <button type="button" class="designer-zoom-btn" id="btnZoomFit" title="Sayfaya Sığdır" style="margin-left:.25rem;font-size:.75rem;">↔ Sığdır</button>
              </div>

              <!-- Sağ Panel Sekmeleri: Inspector vs Data Tree (Images 1, 2, 3) -->
              <div style="display:flex;align-items:center;background:var(--bg-raised);padding:2px;border-radius:6px;border:1px solid var(--border-light);">
                <button type="button" class="btn btn-sm ${rightTab === 'inspector' && showInspector ? 'btn-primary' : 'btn-ghost'}" id="btnTabInspector" style="padding:.24rem .55rem;font-size:.74rem;">
                  🔍 Object Inspector
                </button>
                <button type="button" class="btn btn-sm ${rightTab === 'datatree' && showInspector ? 'btn-primary' : 'btn-ghost'}" id="btnTabDataTree" style="padding:.24rem .55rem;font-size:.74rem;">
                  🗄️ Data Tree
                </button>
              </div>
            </div>

          </div>

          <!-- ÇALIŞMA ALANI & SAHNE -->
          <div class="designer-stage-wrap">
            
            <!-- Canvas Viewport -->
            <div class="designer-canvas-viewport" id="designerViewport">
              ${activePage.type === 'report' ? renderReportPageHtml(activePage.data) : renderDialogPageHtml(activePage.data)}
            </div>

            <!-- SAĞ PANEL: NESNE DENETÇİSİ & DATA TREE (GENİŞLETİLEBİLİR RESIZABLE) -->
            <div class="designer-inspector ${showInspector ? '' : 'collapsed'}" id="designerInspector" style="width:${inspectorWidth}px;">
              
              <!-- Sürükle-Genişlet Tutamacı -->
              <div class="designer-inspector-resizer" id="inspectorResizer" title="Sürükleyerek genişliği ayarlayın"></div>

              ${rightTab === 'inspector' ? `
                <!-- OBJECT INSPECTOR (Images 3, 4, 5) -->
                <div class="designer-inspector-header">
                  <div class="designer-inspector-title">
                    <span>Object Inspector</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:.4rem;">
                    <span class="badge badge-blue" style="font-size:.68rem;padding:.15rem .45rem;" id="inspectorCompType">
                      ${selectedItem ? esc(selectedItem.type || selectedItem.name) : (activePage.data?.name || 'TfrxReportPage')}
                    </span>
                    <button type="button" class="designer-inspector-close-btn" id="btnCollapseInspector" title="Kapat">✕</button>
                  </div>
                </div>

                <!-- Object Inspector Tabs (Properties, Events, Favorites) -->
                <div class="designer-inspector-subtabs">
                  <button type="button" class="designer-subtab ${inspectorTab === 'properties' ? 'active' : ''}" data-subtab="properties">Properties</button>
                  <button type="button" class="designer-subtab ${inspectorTab === 'events' ? 'active' : ''}" data-subtab="events">Events</button>
                  <button type="button" class="designer-subtab ${inspectorTab === 'favorites' ? 'active' : ''}" data-subtab="favorites">Favorites</button>
                </div>

                <div class="designer-prop-search">
                  <input type="text" id="propSearchInput" placeholder="Özellik ara (Property / Event)..." value="${esc(inspectorSearchQuery)}" />
                </div>

                <div class="designer-prop-table" id="propTableBody">
                  ${renderObjectInspectorProperties(selectedItem || activePage.data)}
                </div>
              ` : `
                <!-- DATA TREE (Images 1, 2, 3) -->
                <div class="designer-inspector-header">
                  <div class="designer-inspector-title">
                    <span>Data Tree (Veri Ağacı)</span>
                  </div>
                  <button type="button" class="designer-inspector-close-btn" id="btnCollapseInspector" title="Kapat">✕</button>
                </div>
                <div style="flex:1;overflow-y:auto;padding:.75rem .9rem;font-family:var(--font);font-size:.8rem;">
                  ${renderDataTreeHtml(file)}
                </div>
              `}
            </div>

          </div>

          <!-- ALT DURUM ÇUBUĞU (FastReport Status Bar - Image 3) -->
          <div class="designer-statusbar" id="designerStatusBar">
            <div class="designer-status-cell">
              <span>📏 Centimeters</span>
            </div>
            <div class="designer-status-cell" id="statusCoords">
              <span>X: ${selectedItem ? (selectedItem.left || 0) : 0}, Y: ${selectedItem ? (selectedItem.top || 0) : 0}</span>
            </div>
            <div class="designer-status-cell" id="statusDims">
              <span>W: ${selectedItem ? (selectedItem.width || 0) : 0}, H: ${selectedItem ? (selectedItem.height || 0) : 0}</span>
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
      if (!item) return `📄 ${esc(page?.name || 'Page1')} [${esc(currentMode === 'designer' ? 'Tasarımcı Modu' : 'Baskı Önizleme')}]`;
      if (item.dataField) {
        return `📋 ${esc(item.name)}: ${item.dataSet ? esc(item.dataSet) + '.' : ''}"${esc(item.dataField)}"`;
      }
      if (item.caption || item.text) {
        const txt = (item.caption || item.text || '').slice(0, 45);
        return `📋 ${esc(item.name)} (${esc(item.type || 'TfrxComponent')}): "${esc(txt)}"`;
      }
      return `📋 ${esc(item.name)} (${esc(item.type || 'TfrxComponent')})`;
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
          <div style="margin-bottom:.9rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:.5rem .7rem;">
            <div style="font-weight:800;color:#2563eb;display:flex;align-items:center;justify-content:space-between;gap:.35rem;margin-bottom:.4rem;padding-bottom:3px;border-bottom:1px solid rgba(37,99,235,0.25);">
              <span style="display:flex;align-items:center;gap:.35rem;font-size:.85rem;color:#2563eb;font-weight:800;font-family:var(--mono);">🗄️ ${esc(q.name)}</span>
              <span class="badge badge-blue" style="font-size:.68rem;background:rgba(37,99,235,0.15);color:#2563eb;font-weight:700;">${fields.length} Alan</span>
            </div>
            <div style="padding-left:.6rem;display:flex;flex-direction:column;gap:.25rem;border-left:2px solid #3b82f6;margin-left:.25rem;">
              ${fields.length > 0 ? fields.map(f => `
                <div class="fr-datatree-field-row"
                     onclick="window.copyDataTreeField && window.copyDataTreeField('${esc(q.name)}', '${esc(f)}')"
                     style="display:flex;align-items:center;justify-content:space-between;gap:.4rem;color:var(--text-secondary);font-size:.76rem;font-family:var(--mono);cursor:pointer;padding:2px 4px;border-radius:4px;transition:background 0.1s;"
                     title="İfadeyi kopyalamak için tıklayın: [${esc(q.name)}.&quot;${esc(f)}&quot;]">
                  <div style="display:flex;align-items:center;gap:.4rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                    <span style="color:#d97706;font-weight:800;font-size:.7rem;">[A]</span>
                    <span style="font-weight:600;">${esc(f)}</span>
                  </div>
                  <span class="fr-datatree-copy-hint" style="opacity:0.4;font-size:10px;">📋</span>
                </div>
              `).join('') : `
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
              if (name !== 'DISTINCT' && name !== 'ALL') fieldSet.add(name);
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
    function renderReportPageHtml(page) {
      const isLandscape = (page.orientation || '').toLowerCase().includes('landscape');
      
      // Standart A4 Sayfa Boyutları (1mm ≈ 3.78px)
      // A4 Portrait: 210 x 297 mm -> ~794 x 1123 px
      // A4 Landscape: 297 x 210 mm -> ~1123 x 794 px
      const stdPaperWidth = isLandscape ? 1123 : 794;
      const stdPaperHeight = isLandscape ? 794 : 1123;

      // Özel PaperWidth veya geniş tablolar varsa sayfayı genişlet (Asla taşma/kesilme yapmaz)
      let maxCompRight = stdPaperWidth;
      let totalBandsHeight = 0;

      // Dikey ve Yatay Bantları Kesin Olarak Ayır (Dikey bantlar yatay akışta tekrarlanmasın!)
      const horizontalBands = (page.bands || []).filter(b => !(b.vertical || String(b.rawAttrs || '').includes('Vertical="True"')));
      const verticalBands = (page.bands || []).filter(b => (b.vertical || String(b.rawAttrs || '').includes('Vertical="True"')));

      horizontalBands.forEach(b => {
        let maxCompBottom = b.height > 0 ? b.height : 25;
        (b.components || []).forEach(c => {
          const bottom = (c.top || 0) + (c.height || 0);
          if (bottom > maxCompBottom) maxCompBottom = bottom;
        });
        const bHeight = Math.ceil(maxCompBottom);
        totalBandsHeight += bHeight + (currentMode === 'designer' ? 22 : 0);
      });

      (page.bands || []).forEach(b => {
        if (b.width > maxCompRight) maxCompRight = b.width;
        (b.components || []).forEach(c => {
          const r = (c.left || 0) + (c.width || 0);
          if (r > maxCompRight) maxCompRight = r;
        });
      });

      const finalPageWidth = Math.max(stdPaperWidth, Math.ceil(maxCompRight + 120));
      const finalPageMinHeight = Math.max(stdPaperHeight, totalBandsHeight + 250);

      // YALNIZCA Yatay Bantları Yatay Akışta Çiz
      const bandsHtml = horizontalBands.map((band, bIdx) => {
        const meta = BAND_META[band.type] || { label: band.type, icon: '📐', class: 'fr-band-header-type' };
        let maxCompBottom = band.height > 0 ? band.height : 25;
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
          const eventTitle = hasEvent ? ` [Olay/Event: ${comp.onBeforePrint || comp.onClick || 'Tanımlı'}]` : '';

          // 1. Barkod Bileşeni (TfrxBarCodeView)
          if (comp.type === 'TfrxBarCodeView') {
            return `
              <div class="fr-view-item fr-barcode-view ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
              </div>
            `;
          }

          // 2. Nokta Vuruşlu Memo (TfrxDMPMemoView)
          if (comp.type === 'TfrxDMPMemoView') {
            return `
              <div class="fr-view-item ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
                     font-weight:${isBold ? '700' : '400'};
                     color:${textColor};
                     text-align:${textAlign};
                   "
                   title="${esc(comp.name)}: ${esc(comp.text || comp.dataField)}${eventTitle}">
                <div class="fr-memo-content" style="justify-content:${hAlign}; align-items:${vAlign}; white-space:pre-wrap;">
                  ${esc(comp.text || (comp.dataField ? `[${comp.dataSet ? comp.dataSet + '.' : ''}"${comp.dataField}"]` : ''))}
                </div>
              </div>
            `;
          }

          // 3. Resim / Logo (TfrxPictureView)
          if (comp.type === 'TfrxPictureView') {
            return `
              <div class="fr-view-item fr-picture-view ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
                   data-band-idx="${bIdx}" data-comp-idx="${cIdx}"
                   style="left:${comp.left}px; top:${comp.top}px; width:${comp.width}px; height:${comp.height}px;"
                   title="${esc(comp.name)} [${esc(comp.dataField || 'Logo')}]${eventTitle}">
                🖼️ ${esc(comp.dataField || comp.name)}
              </div>
            `;
          }

          // 4. Çizgi (TfrxLineView)
          if (comp.type === 'TfrxLineView') {
            return `
              <div class="fr-view-item fr-line-view ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
                   data-band-idx="${bIdx}" data-comp-idx="${cIdx}"
                   style="left:${comp.left}px; top:${comp.top}px; width:${comp.width}px; height:${Math.max(1, comp.height)}px; border-top:1px solid ${textColor};">
              </div>
            `;
          }

          // 5. Grafik / Chart Bileşeni (TfrxChartView - ISIM_PANATES vb.)
          if (comp.type === 'TfrxChartView') {
            const isPie = (comp.seriesType || '').toLowerCase().includes('pie');
            const isBar = (comp.seriesType || '').toLowerCase().includes('bar');
            const seriesName = comp.seriesType || 'FastLineSeries';
            const dsName = comp.dataSet || comp.chartDataSet || '';
            const xLabel = comp.xField ? `X: [${comp.xField}]` : '';
            const yLabel = comp.yField ? `Y: [${comp.yField}]` : '';
            
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
              <div class="fr-view-item fr-chart-view ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
                   title="${esc(comp.name)} [Grafik: ${esc(seriesName)}] ${dsName ? '🗄️ ' + esc(dsName) : ''}${eventTitle}">
                <!-- Chart Header -->
                <div class="fr-chart-header">
                  <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:#1e293b;font-size:11px;">
                    <span style="font-size:13px;">📊</span>
                    <span>${esc(comp.name)}</span>
                    <span class="badge badge-blue" style="font-size:9.5px;padding:1px 6px;border-radius:3px;font-family:monospace;">${esc(seriesName)}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;font-size:10px;color:#64748b;font-family:monospace;">
                    ${dsName ? `<span style="background:rgba(59,130,246,0.1);color:#2563eb;padding:1px 5px;border-radius:3px;font-weight:700;">🗄️ ${esc(dsName)}</span>` : ''}
                    ${xLabel ? `<span style="background:#f1f5f9;padding:1px 4px;border-radius:2px;">${esc(xLabel)}</span>` : ''}
                    ${yLabel ? `<span style="background:#f1f5f9;padding:1px 4px;border-radius:2px;">${esc(yLabel)}</span>` : ''}
                  </div>
                </div>
                <!-- Chart Canvas Area -->
                <div style="flex:1;width:100%;position:relative;background:#ffffff;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:6px;">
                  ${chartSvg}
                </div>
              </div>
            `;
          }

          // 6. Şekil Bileşeni (TfrxShapeView)
          if (comp.type === 'TfrxShapeView') {
            const isRound = (comp.shape || '').includes('Round');
            const isCircle = (comp.shape || '').includes('Circle') || (comp.shape || '').includes('Ellipse');
            const borderRadius = isCircle ? '50%' : (isRound ? '8px' : '0px');
            return `
              <div class="fr-view-item ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
              </div>
            `;
          }

          // 7. Standart TfrxMemoView
          return `
            <div class="fr-view-item ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
                   font-family:${comp.fontName || 'Arial'}, sans-serif;
                   font-size:${comp.fontSize || 10}px;
                   font-weight:${isBold ? '700' : '400'};
                   font-style:${isItalic ? 'italic' : 'normal'};
                   text-decoration:${isUnderline ? 'underline' : 'none'};
                   color:${textColor};
                   text-align:${textAlign};
                 "
                 title="${esc(comp.name)}: ${esc(comp.text || comp.dataField)}${eventTitle}">
              <div class="fr-memo-content ${isRotated90 ? 'fr-rotated-90' : ''}"
                   style="justify-content:${hAlign}; align-items:${vAlign};">
                ${esc(comp.text || (comp.dataField ? `[${comp.dataSet ? comp.dataSet + '.' : ''}"${comp.dataField}"]` : ''))}
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="fr-band-container ${meta.class}" style="min-height:${bHeight}px;">
            ${currentMode === 'designer' ? `
              <div class="fr-band-header">
                <div class="fr-band-header-left">
                  <span>${meta.icon}</span>
                  <span>${esc(meta.label)}: ${esc(band.name)}</span>
                </div>
                <div class="fr-band-header-right">
                  ${band.dataSet ? `<span class="badge-dataset-icon">🗄️ ${esc(band.dataSet)}</span>` : ''}
                  ${band.stretched ? `<span style="opacity:.8;font-size:9.5px;">[Stretched]</span>` : ''}
                </div>
              </div>
            ` : ''}
            <div class="fr-band-body" style="min-height:${bHeight}px; height:${bHeight}px;">
              ${componentsHtml}
            </div>
          </div>
        `;
      }).join('');

      // Dikey Çapraz Bantlar (Vertical Cross-Tab Bands - Image 3) - YALNIZCA Dikey Kolon Olarak Çizilir!
      const vBandsHtml = (currentMode === 'designer' && verticalBands.length > 0) ? verticalBands.map(vBand => {
        const meta = BAND_META[vBand.type] || { label: vBand.type, icon: '▶', class: 'fr-band-masterdata' };
        const vLeft = vBand.left || 0;
        const vWidth = Math.max(18, vBand.width || 90);
        return `
          <div class="fr-vertical-band-overlay" style="left:${vLeft}px; width:${vWidth}px;">
            <div class="fr-vertical-band-header ${meta.class}" style="left:0;" title="${esc(meta.label)}: ${esc(vBand.name)} ${vBand.dataSet ? '(' + esc(vBand.dataSet) + ')' : ''}">
              ${meta.icon} ${esc(meta.label)}: ${esc(vBand.name)} ${vBand.dataSet ? '🗄️ ' + esc(vBand.dataSet) : ''}
            </div>
          </div>
        `;
      }).join('') : '';

      return `
        <div class="fr-report-page ${currentMode === 'designer' ? 'designer-mode' : 'preview-mode'}"
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
      const fontName = ctrl.fontName || 'Segoe UI';
      const fontSize = ctrl.fontSize || 11;
      const isBold = ctrl.fontStyle === '1' || String(ctrl.fontStyle).includes('fsBold');

      const leftPos = (ctrl.left || 0) + parentOffsetLeft;
      const topPos = (ctrl.top || 0) + parentOffsetTop;

      // Event Kontrolü (DialogPage kontrollerinde kırmızı ok/üçgen - Image 3 & 4)
      const hasEvent = Boolean(ctrl.onClick || ctrl.onBeforePrint || ctrl.onChange || ctrl.onEnter || ctrl.onExit || ctrl.onKeyDown || (ctrl.rawAttrs && /\bOn[A-Z]\w+=/i.test(ctrl.rawAttrs)));
      const eventTitle = hasEvent ? ` [Olay/Event: ${ctrl.onClick || ctrl.onBeforePrint || ctrl.onChange || 'Tanımlı'}]` : '';

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
          <fieldset class="fr-ctrl-item fr-ctrl-groupbox ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
          <div class="fr-ctrl-item fr-ctrl-panel ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
          <button type="button" class="fr-tab-btn ${tIdx === 0 ? 'active' : ''}"
                  data-pc-idx="${cIdx}" data-tab-idx="${tIdx}"
                  onclick="window.switchDialogTab && window.switchDialogTab(this, '${cIdx}', ${tIdx})"
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
                 style="position:relative;width:100%;min-height:${maxTabBottom + 12}px;height:100%;display:${tIdx === 0 ? 'block' : 'none'};padding:4px;box-sizing:border-box;">
              ${childHtml}
            </div>
          `;
        }).join('');

        return `
          <div class="fr-ctrl-item fr-ctrl-pagecontrol ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
          <div class="fr-ctrl-item fr-ctrl-radio ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
                 white-space: nowrap !important;
                 overflow: visible;
               "
               title="${esc(ctrl.name)}: ${esc(ctrl.caption || ctrl.text)}${eventTitle}">
            <input type="radio" ${ctrl.checked ? 'checked' : ''} name="fr_radio_${parentOffsetTop || 'grp'}" disabled style="margin:0;cursor:pointer;flex-shrink:0;" />
            <span style="font-weight:${isBold ? '700' : '600'};font-size:11px;white-space:nowrap;">${esc(ctrl.caption || ctrl.text)}</span>
          </div>
        `;
      }

      // 5. Etiket (TfrxLabelControl)
      if (ctrl.type === 'TfrxLabelControl') {
        return `
          <div class="fr-ctrl-item fr-ctrl-label ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
               data-ctrl-idx="${cIdx}"
               style="
                 left:${leftPos}px;
                 top:${topPos}px;
                 width:${ctrl.width}px;
                 height:${ctrl.height}px;
                 font-family:${fontName}, Tahoma, sans-serif;
                 font-size:${fontSize}px;
                 font-weight:${isBold ? '700' : '600'};
                 color:#000000;
                 white-space: nowrap !important;
                 word-break: normal !important;
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
          <div class="fr-ctrl-item fr-ctrl-button ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
          <div class="fr-ctrl-item fr-ctrl-dateedit ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
            <div class="fr-ctrl-dateedit-btn" title="Tarih Seçici">📅 ▾</div>
          </div>
        `;
      }

      // 8. Onay Kutusu (TfrxCheckBoxControl)
      if (ctrl.type === 'TfrxCheckBoxControl') {
        return `
          <div class="fr-ctrl-item fr-ctrl-checkbox ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
                 white-space: nowrap !important;
               "
               title="${esc(ctrl.name)}: ${esc(ctrl.caption)}${eventTitle}">
            <input type="checkbox" ${ctrl.checked ? 'checked' : ''} disabled style="margin:0;cursor:pointer;flex-shrink:0;" />
            <span style="font-size:11px;white-space:nowrap;">${esc(ctrl.caption)}</span>
          </div>
        `;
      }

      // 9. Açılır Liste (TfrxComboBoxControl)
      if (ctrl.type === 'TfrxComboBoxControl') {
        return `
          <div class="fr-ctrl-item fr-ctrl-combobox ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
          <div class="fr-ctrl-item fr-ctrl-checklistbox ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
            <div style="color:#475569;font-size:10px;margin-bottom:4px;font-style:italic;font-weight:700;">
              🗄️ ${esc(ctrl.listSource || ctrl.name)} (${esc(ctrl.listField || 'ADI')})
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
        <div class="fr-ctrl-item fr-ctrl-edit ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
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
      const dialogColorVal = dialog.color || '-16777188';
      const dialogBg = decodeDelphiColor(dialogColorVal, true) || '#5bc0de';

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
              <span>📋</span>
              <span>${esc(dialog.caption || dialog.name)}</span>
            </div>
            <div class="fr-dialog-buttons">
              <span class="fr-dialog-btn-sys">🗕</span>
              <span class="fr-dialog-btn-sys">🗖</span>
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
      if (!obj) return '<div style="padding:1rem;color:var(--text-muted);">Seçili bileşen yok.</div>';

      let propList = [];

      if (inspectorTab === 'events') {
        propList = [
          { name: 'OnClick', val: obj.onClick || '—' },
          { name: 'OnBeforePrint', val: obj.onBeforePrint || '—' },
          { name: 'OnChange', val: obj.onChange || '—' },
          { name: 'OnAfterPrint', val: obj.onAfterPrint || '—' },
          { name: 'OnPreviewClick', val: obj.onPreviewClick || '—' },
          { name: 'OnEnter', val: obj.onEnter || '—' },
          { name: 'OnExit', val: obj.onExit || '—' },
          { name: 'OnKeyDown', val: obj.onKeyDown || '—' }
        ];
      } else if (inspectorTab === 'favorites') {
        propList = [
          { name: 'Name', val: obj.name || '—' },
          { name: 'Caption / Text', val: obj.caption || obj.text || '—' },
          { name: 'DataSet', val: obj.dataSet || obj.listSource || '—' },
          { name: 'DataField', val: obj.dataField || obj.listField || '—' },
          { name: 'Font.Color', rawVal: obj.fontColor, val: formatDelphiColorName(obj.fontColor), isColor: true },
          { name: 'Frame.Color', rawVal: obj.frameColor, val: formatDelphiColorName(obj.frameColor), isColor: true },
          { name: 'OnClick', val: obj.onClick || '—' },
          { name: 'OnBeforePrint', val: obj.onBeforePrint || '—' },
          { name: 'Visible', val: obj.visible !== false ? 'True' : 'False' }
        ];
      } else {
        // Standart Properties Tab (Images 3, 4, 5)
        propList = [
          { name: 'Name', val: obj.name || '—' },
          { name: 'Class', val: obj.type || 'TfrxComponent' },
          { name: 'Left', val: obj.left ?? '0' },
          { name: 'Top', val: obj.top ?? '0' },
          { name: 'Width', val: obj.width ?? '0' },
          { name: 'Height', val: obj.height ?? '0' },
          { name: 'Caption / Text', val: obj.caption || obj.text || '—' },
          { name: 'DataSet', val: obj.dataSet || obj.listSource || '—' },
          { name: 'DataField', val: obj.dataField || obj.listField || '—' },
          { name: 'DisplayFormat', val: obj.displayFormat || '—' },
          { name: 'Font.Name', val: obj.fontName || 'Arial' },
          { name: 'Font.Size', val: obj.fontSize || '10' },
          { name: 'Font.Color', rawVal: obj.fontColor, val: formatDelphiColorName(obj.fontColor), isColor: true, isText: true },
          { name: 'Font.Style', val: formatFontStyle(obj.fontStyle) },
          { name: 'Fill.BackColor', rawVal: (obj.fillBackColor || obj.color), val: formatDelphiColorName(obj.fillBackColor || obj.color), isColor: true },
          { name: 'Frame.Typ', val: formatFrameType(obj.frameTyp) },
          { name: 'Frame.Color', rawVal: obj.frameColor, val: formatDelphiColorName(obj.frameColor), isColor: true },
          { name: 'Frame.Width', val: obj.frameWidth ?? '1' },
          { name: 'Align', val: obj.align || 'baNone' },
          { name: 'HAlign', val: obj.hAlign || 'haLeft' },
          { name: 'VAlign', val: obj.vAlign || 'vaTop' },
          { name: 'Rotation', val: obj.rotation ?? '0' },
          { name: 'ShiftMode', val: obj.shiftMode || 'smAlways' },
          { name: 'StretchMode', val: obj.stretchMode || 'smDontStretch' },
          { name: 'AllowExpressions', val: obj.allowExpressions !== false ? 'True' : 'False' },
          { name: 'AutoWidth', val: obj.autoWidth ? 'True' : 'False' },
          { name: 'OnClick', val: obj.onClick || '—' },
          { name: 'OnBeforePrint', val: obj.onBeforePrint || '—' },
          { name: 'Visible', val: obj.visible !== false ? 'True' : 'False' },
          { name: 'Enabled', val: obj.enabled !== false ? 'True' : 'False' },
          { name: 'ModalResult', val: obj.modalResult || '0' }
        ];
      }

      const filtered = inspectorSearchQuery
        ? propList.filter(p => p.name.toLowerCase().includes(inspectorSearchQuery.toLowerCase()) || String(p.val).toLowerCase().includes(inspectorSearchQuery.toLowerCase()))
        : propList;

      return filtered.map(p => {
        let colorSwatch = '';
        if (p.isColor || p.name.includes('Color')) {
          const rawColor = p.rawVal !== undefined ? p.rawVal : p.val;
          const isText = !!p.isText;
          const hexCol = decodeDelphiColor(rawColor, !isText);
          const isTransparent = !rawColor || rawColor === 'clNone' || rawColor === '536870911' || rawColor === '-1';

          if (isTransparent) {
            colorSwatch = `<span style="display:inline-block;width:12px;height:12px;border-radius:2px;border:1px dashed #94a3b8;background:transparent;margin-right:6px;vertical-align:middle;flex-shrink:0;" title="Şeffaf"></span>`;
          } else {
            colorSwatch = `<span style="display:inline-block;width:12px;height:12px;border-radius:2px;border:1px solid rgba(0,0,0,0.35);box-shadow:inset 0 0 0 1px rgba(255,255,255,0.4);background-color:${hexCol};margin-right:6px;vertical-align:middle;flex-shrink:0;" title="${esc(hexCol)}"></span>`;
          }
        }
        return `
          <div class="designer-prop-row">
            <div class="designer-prop-name" title="${esc(p.name)}">${esc(p.name)}</div>
            <div class="designer-prop-val" title="${esc(String(p.val))}">
              <span style="display:flex;align-items:center;">${colorSwatch}${esc(String(p.val))}</span>
            </div>
          </div>
        `;
      }).join('');
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

      // 3. Zoom Kontrolleri
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

      // 4. Sağ Panel Sekmeleri (Object Inspector vs Data Tree)
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

      // 5. Object Inspector Sekmeleri (Properties / Events / Favorites)
      containerEl.querySelectorAll('.designer-subtab').forEach(st => {
        st.addEventListener('click', () => {
          containerEl.querySelectorAll('.designer-subtab').forEach(b => b.classList.remove('active'));
          st.classList.add('active');
          inspectorTab = st.dataset.subtab || 'properties';
          const propTable = containerEl.querySelector('#propTableBody');
          if (propTable) {
            const activePage = allPages[activePageIndex];
            propTable.innerHTML = renderObjectInspectorProperties(selectedItem || activePage?.data);
          }
        });
      });

      // 6. Object Inspector Resizing (Sürükleyerek Genişletme/Daraltma)
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

      // 7. Özellik Arama Kutusu
      containerEl.querySelector('#propSearchInput')?.addEventListener('input', (e) => {
        inspectorSearchQuery = e.target.value || '';
        const propTable = containerEl.querySelector('#propTableBody');
        if (propTable) {
          const activePage = allPages[activePageIndex];
          propTable.innerHTML = renderObjectInspectorProperties(selectedItem || activePage?.data);
        }
      });

      // 8. Rapor Sayfası Elemanlarına Tıklama (Selection & Inspection)
      containerEl.querySelectorAll('.fr-view-item').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const bandIdx = parseInt(el.dataset.bandIdx, 10);
          const compIdx = parseInt(el.dataset.compIdx, 10);
          const activePage = allPages[activePageIndex];
          if (activePage && activePage.data.bands?.[bandIdx]?.components?.[compIdx]) {
            selectedItem = activePage.data.bands[bandIdx].components[compIdx];
            updateSelection();
          }
        });
      });

      // 9. Dialog Form Elemanlarına Tıklama
      containerEl.querySelectorAll('.fr-ctrl-item').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const rawIdx = el.dataset.ctrlIdx;
          const activePage = allPages[activePageIndex];
          if (activePage && rawIdx !== undefined) {
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
      });

      // Sahne boşluğuna tıklayınca sayfayı seç
      containerEl.querySelector('#designerViewport')?.addEventListener('click', () => {
        const activePage = allPages[activePageIndex];
        selectedItem = activePage ? activePage.data : null;
        updateSelection();
      });
    }

    function updateZoom() {
      const zoomText = containerEl.querySelector('#zoomValText');
      if (zoomText) zoomText.textContent = Math.round(currentZoom * 100) + '%';
      const pageEl = containerEl.querySelector('#frReportPage') || containerEl.querySelector('#frDialogWindow');
      if (pageEl) pageEl.style.transform = `scale(${currentZoom})`;
    }

    function updateSelection() {
      containerEl.querySelectorAll('.fr-view-item.selected, .fr-ctrl-item.selected').forEach(el => el.classList.remove('selected'));
      
      // YALNIZCA Tasarımcı modundaysa seçim sınıfını ekle
      if (selectedItem && currentMode === 'designer') {
        const targetEl = containerEl.querySelector(`[title*="${selectedItem.name}"]`) || containerEl.querySelector(`[data-ctrl-idx]`);
        if (targetEl) targetEl.classList.add('selected');
      }

      const compTypeBadge = containerEl.querySelector('#inspectorCompType');
      if (compTypeBadge) compTypeBadge.textContent = selectedItem ? (selectedItem.type || selectedItem.name || 'TfrxComponent') : 'TfrxPage';

      const propTable = containerEl.querySelector('#propTableBody');
      if (propTable) {
        const activePage = allPages[activePageIndex];
        propTable.innerHTML = renderObjectInspectorProperties(selectedItem || activePage?.data);
      }

      // Status Bar Güncellemesi (Image 3)
      const statusCoords = containerEl.querySelector('#statusCoords');
      const statusDims = containerEl.querySelector('#statusDims');
      const statusCompPath = containerEl.querySelector('#statusCompPath');
      const activePage = allPages[activePageIndex];

      if (statusCoords) statusCoords.innerHTML = `<span>X: ${selectedItem ? (selectedItem.left ?? 0) : 0}, Y: ${selectedItem ? (selectedItem.top ?? 0) : 0}</span>`;
      if (statusDims) statusDims.innerHTML = `<span>W: ${selectedItem ? (selectedItem.width ?? 0) : 0}, H: ${selectedItem ? (selectedItem.height ?? 0) : 0}</span>`;
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
      body.style.display = (idx === targetTabIdx) ? 'block' : 'none';
    });
  };

  // Data Tree alanını panoya kopyalama
  window.copyDataTreeField = function(queryName, fieldName) {
    const expr = `[${queryName}."${fieldName}"]`;
    navigator.clipboard.writeText(expr).then(() => {
      if (typeof showToast === 'function') {
        showToast(`📋 Alan kopyalandı: ${expr}`, 'success');
      } else if (typeof toast === 'function') {
        toast(`📋 Alan kopyalandı: ${expr}`, 'success');
      }
    }).catch(() => {});
  };

  window.FastReportDesigner = {
    render: createDesigner,
    switchDialogTab: window.switchDialogTab,
    copyDataTreeField: window.copyDataTreeField
  };

})(window);
