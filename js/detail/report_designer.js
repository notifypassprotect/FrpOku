// ============================================================
// report_designer.js — FastReport Görsel Tasarım & Önizleme Motoru (v3.3)
// FastReport FRP/XML Rapor Sayfaları ve Parametre Formları Çizici
// ============================================================

(function(window) {
 'use strict';

 // ── DELPHI RENK DÖNÜŞTÜRÜCÜ & ETİKETLEYİCİ (BGR <-> RGB/HEX) ─────────────────
 function delphiColorToRgb(val, isBackground = true) {
 val = String(val ?? '').trim();
 if (!val || val === 'clNone' || val === 'None' || val === '-1' || val === '536870911') {
 return { r: 255, g: 255, b: 255, a: 0, isNone: true, hex: '#ffffff', rgb: 'clNone', label: 'clNone (Şeffaf)' };
 }
 if (val === 'clWindowText' || val === '0' || val === 'clBlack') {
 return { r: 0, g: 0, b: 0, a: 1, isNone: false, hex: '#000000', rgb: 'rgb(0, 0, 0)', label: 'clWindowText (Siyah)' };
 }
 if (val === '16777215' || val === 'clWhite' || val === 'clWindow') {
 return { r: 255, g: 255, b: 255, a: 1, isNone: false, hex: '#ffffff', rgb: 'rgb(255, 255, 255)', label: 'clWhite (Beyaz)' };
 }
 if (val === 'clBtnFace') {
 return { r: 236, g: 233, b: 216, a: 1, isNone: false, hex: '#ece9d8', rgb: 'rgb(236, 233, 216)', label: 'clBtnFace (Form Grisi)' };
 }
 const systemColorNames = {
 clScrollBar: 0, clBackground: 1, clActiveCaption: 2, clInactiveCaption: 3,
 clMenu: 4, clWindow: 5, clWindowFrame: 6, clMenuText: 7, clWindowText: 8,
 clCaptionText: 9, clActiveBorder: 10, clInactiveBorder: 11, clAppWorkSpace: 12,
 clHighlight: 13, clHighlightText: 14, clBtnFace: 15, clBtnShadow: 16,
 clGrayText: 17, clBtnText: 18, clInactiveCaptionText: 19, clBtnHighlight: 20,
 cl3DDkShadow: 21, cl3DLight: 22, clInfoText: 23, clInfoBk: 24,
 clHotLight: 26, clGradientActiveCaption: 27, clGradientInactiveCaption: 28,
 clMenuHighlight: 29, clMenuBar: 30
 };
 const systemColors = {
 0: ['#c8c8c8', 'clScrollBar'], 1: ['#1f2937', 'clBackground'], 2: ['#0a64ad', 'clActiveCaption'],
 3: ['#bfcdde', 'clInactiveCaption'], 4: ['#f0f0f0', 'clMenu'], 5: ['#ffffff', 'clWindow'],
 6: ['#646464', 'clWindowFrame'], 7: ['#000000', 'clMenuText'], 8: ['#000000', 'clWindowText'],
 9: ['#ffffff', 'clCaptionText'], 10: ['#b4b4b4', 'clActiveBorder'], 11: ['#f4f7fc', 'clInactiveBorder'],
 12: ['#ababab', 'clAppWorkSpace'], 13: ['#3399ff', 'clHighlight'], 14: ['#ffffff', 'clHighlightText'],
 15: ['#f0f0f0', 'clBtnFace'], 16: ['#a0a0a0', 'clBtnShadow'], 17: ['#6d6d6d', 'clGrayText'],
 18: ['#000000', 'clBtnText'], 19: ['#434e54', 'clInactiveCaptionText'], 20: ['#ffffff', 'clBtnHighlight'],
 21: ['#696969', 'cl3DDkShadow'], 22: ['#e3e3e3', 'cl3DLight'], 23: ['#000000', 'clInfoText'],
 24: ['#ffffe1', 'clInfoBk'], 26: ['#0066cc', 'clHotLight'], 27: ['#b9d1ea', 'clGradientActiveCaption'],
 28: ['#d7e4f2', 'clGradientInactiveCaption'], 29: ['#3399ff', 'clMenuHighlight'], 30: ['#f0f0f0', 'clMenuBar']
 };
 const namedSystemIndex = Object.prototype.hasOwnProperty.call(systemColorNames, val) ? systemColorNames[val] : null;
 const numericColor = /^-?\d+$/.test(val) ? Number(val) : NaN;
 const unsignedColor = Number.isInteger(numericColor) ? (numericColor >>> 0) : 0;
 const encodedSystemIndex = (unsignedColor >>> 24) === 0xff
 ? (unsignedColor & 0xff)
 : (Number.isInteger(numericColor) && numericColor > 0 && numericColor <= 30 ? numericColor : null);
 const systemIndex = namedSystemIndex ?? encodedSystemIndex;
 if (systemIndex !== null) {
 const entry = systemColors[systemIndex] || [isBackground ? '#f0f0f0' : '#000000', `SystemColor(${systemIndex})`];
 const r = parseInt(entry[0].slice(1, 3), 16);
 const g = parseInt(entry[0].slice(3, 5), 16);
 const b = parseInt(entry[0].slice(5, 7), 16);
 return { r, g, b, a: 1, isNone: false, hex: entry[0], rgb: `rgb(${r}, ${g}, ${b})`, label: entry[1] };
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
 TfrxColumnFooter: { label: 'ColumnFooter', icon: '', class: 'fr-band-footer' },
 TfrxChild: { label: 'Child', icon: '↳', class: 'fr-band-overlay' },
 TfrxData: { label: 'Data', icon: '▶', class: 'fr-band-masterdata' },
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

  // ── FASTREPORT VCL BARKOD & QR KOD SVG ÇİZİCİ ─────────────
  function renderBarcodeSvg(barType, rawText, width, height, showText, strokeColor, bgColor, isQr, isPdf417) {
    const text = String(rawText || '').trim() || (isQr ? 'https://fast-report.com' : '1234567890');
    strokeColor = strokeColor || '#000000';
    bgColor = (bgColor && bgColor !== 'transparent') ? bgColor : '#ffffff';

    if (isQr) {
      const matrixSize = 21;
      const padding = 2;
      const totalUnits = matrixSize + (padding * 2);
      const unitSize = Math.max(1, Math.min(width, height) / totalUnits);
      const offsetX = (width - (totalUnits * unitSize)) / 2;
      const offsetY = (height - (totalUnits * unitSize)) / 2;

      function isFinderPattern(r, c) {
        if ((r >= 0 && r < 7 && c >= 0 && c < 7) ||
            (r >= 0 && r < 7 && c >= 14 && c < 21) ||
            (r >= 14 && r < 21 && c >= 0 && c < 7)) {
          const inCorner = (r < 7 && c < 7) ? [r, c] : (r < 7 ? [r, c - 14] : [r - 14, c]);
          const lr = inCorner[0], lc = inCorner[1];
          if (lr === 0 || lr === 6 || lc === 0 || lc === 6) return true;
          if (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4) return true;
          return false;
        }
        return null;
      }

      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
      }

      const rects = [];
      for (let r = 0; r < matrixSize; r++) {
        for (let c = 0; c < matrixSize; c++) {
          const finder = isFinderPattern(r, c);
          let isDark = false;
          if (finder !== null) {
            isDark = finder;
          } else if (r === 6 || c === 6) {
            isDark = ((r + c) % 2 === 0);
          } else {
            const bit = Math.abs(Math.sin((r * 29) + (c * 17) + hash) * 10000) % 1;
            isDark = bit > 0.48;
          }
          if (isDark) {
            const x = offsetX + ((c + padding) * unitSize);
            const y = offsetY + ((r + padding) * unitSize);
            rects.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.ceil(unitSize)}" height="${Math.ceil(unitSize)}" fill="${strokeColor}" />`);
          }
        }
      }

      return `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">
          <rect width="${width}" height="${height}" fill="${bgColor}" />
          ${rects.join('')}
        </svg>
      `;
    }

    if (isPdf417) {
      const rows = 12;
      const cols = 35;
      const rowHeight = Math.max(2, (height - (showText ? 14 : 4)) / rows);
      const colWidth = Math.max(1, (width - 16) / cols);
      const rects = [];
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
      }
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let isDark = false;
          if (c < 3) isDark = (c !== 1);
          else if (c >= cols - 3) isDark = (c !== cols - 2);
          else isDark = (Math.abs(Math.sin((r * 31) + (c * 19) + hash) * 1000) % 1) > 0.5;

          if (isDark) {
            const x = 8 + (c * colWidth);
            const y = 4 + (r * rowHeight);
            rects.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.ceil(colWidth)}" height="${Math.ceil(rowHeight)}" fill="${strokeColor}" />`);
          }
        }
      }
      return `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges">
          <rect width="${width}" height="${height}" fill="${bgColor}" />
          ${rects.join('')}
          ${showText ? `<text x="${width / 2}" y="${height - 2}" text-anchor="middle" font-family="'Courier New', monospace" font-size="8.5" font-weight="700" fill="${strokeColor}">${esc(text.slice(0, 30))}</text>` : ''}
        </svg>
      `;
    }

    // 1D Barcode (Code128, EAN13, Code39, UPCA vb.)
    const textH = showText ? 12 : 0;
    const barH = Math.max(8, height - textH - 6);
    const quietZone = Math.max(4, width * 0.04);
    const usableW = width - (quietZone * 2);

    const barModules = [2, 1, 2];
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
      seed = ((seed << 5) - seed) + text.charCodeAt(i);
      seed |= 0;
    }
    const pseudoRand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const charCount = Math.max(6, Math.min(24, text.length * 2));
    for (let i = 0; i < charCount; i++) {
      const barW = Math.floor(pseudoRand() * 3) + 1;
      const spaceW = Math.floor(pseudoRand() * 3) + 1;
      barModules.push(barW, spaceW);
    }
    barModules.push(2, 1, 2);

    const totalModuleUnits = barModules.reduce((acc, v) => acc + v, 0);
    const unitScale = Math.max(0.5, usableW / totalModuleUnits);

    const barRects = [];
    let curX = quietZone;
    let isBar = true;
    for (const mod of barModules) {
      const w = mod * unitScale;
      if (isBar) {
        barRects.push(`<rect x="${curX.toFixed(1)}" y="4" width="${Math.max(1, w).toFixed(1)}" height="${barH.toFixed(1)}" fill="${strokeColor}" />`);
      }
      curX += w;
      isBar = !isBar;
    }

    return `
      <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges">
        <rect width="${width}" height="${height}" fill="${bgColor}" />
        ${barRects.join('')}
        ${showText ? `<text x="${width / 2}" y="${height - 2}" text-anchor="middle" font-family="'Courier New', monospace, sans-serif" font-size="9" font-weight="700" fill="${strokeColor}">${esc(text)}</text>` : ''}
      </svg>
    `;
  }

  // ── FASTREPORT DELPHI HEX RESİM AKIŞI DÖNÜŞTÜRÜCÜ ─────────
  function decodeDelphiPictureHex(hexStr) {
    if (!hexStr || typeof hexStr !== 'string') return null;
    let cleanHex = hexStr.replace(/\s+/g, '');
    if (cleanHex.length < 16) return null;
    if (cleanHex.startsWith('data:image/')) return hexStr.trim();

    const upper = cleanHex.toUpperCase();
    let mimeType = 'image/png';
    let dataStartIndex = -1;

    const pngIdx = upper.indexOf('89504E47');
    const jpgIdx = upper.indexOf('FFD8FF');
    const bmpIdx = upper.indexOf('424D');
    const gifIdx = upper.indexOf('47494638');

    if (pngIdx !== -1 && (jpgIdx === -1 || pngIdx <= jpgIdx)) {
      mimeType = 'image/png';
      dataStartIndex = pngIdx;
    } else if (jpgIdx !== -1) {
      mimeType = 'image/jpeg';
      dataStartIndex = jpgIdx;
    } else if (bmpIdx !== -1) {
      mimeType = 'image/bmp';
      dataStartIndex = bmpIdx;
    } else if (gifIdx !== -1) {
      mimeType = 'image/gif';
      dataStartIndex = gifIdx;
    } else {
      dataStartIndex = 0;
      mimeType = 'image/bmp';
    }

    try {
      const payloadHex = cleanHex.slice(dataStartIndex);
      const byteLen = Math.floor(payloadHex.length / 2);
      const bytes = new Uint8Array(byteLen);
      for (let i = 0; i < byteLen; i++) {
        bytes[i] = parseInt(payloadHex.substr(i * 2, 2), 16);
      }

      let binary = '';
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      return `data:${mimeType};base64,${base64}`;
    } catch {
      return null;
    }
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
 let showRulers = true; // Cetveller Açık / Kapalı
 let gridSnapStep = 4; // 1 (serbest) | 4 | 8 px manyetik ızgara adımı
 let selectedItem = null;
 let selectedItems = [];
 let showInspector = !window.matchMedia('(max-width: 768px)').matches;
 let rightTab = 'inspector'; // 'inspector' | 'datatree'
 let inspectorSearchQuery = '';
 let inspectorTab = 'properties'; // 'properties' | 'events' | 'favorites'
 let inspectorWidth = parseInt(localStorage.getItem('frp_inspector_width') || '330', 10);

 // Canlı Tasarım Düzenleme Modu & Geri Al (Undo/Redo) Durumu (Tasarımcıda daima aktif)
 let isDesignEditing = true;
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

 if (allPages.length > 0) {
   initialPagesBackup = JSON.parse(JSON.stringify(allPages.map(p => p.data)));
   undoStack = [JSON.stringify(allPages.map(p => p.data))];
 }

 let activePageIndex = 0;

  // ── CETVEL (RULER) SVG ÇİZİCİLERİ ─────────────────────────
  function renderRulerTopSvg(widthPx, zoom) {
    const PX_PER_MM = 3.779527559;
    const mmPx = PX_PER_MM * zoom;
    const cmPx = 10 * mmPx;
    const maxCm = Math.ceil(widthPx / cmPx) + 6;
    const ticks = [];

    for (let cm = 0; cm <= maxCm; cm++) {
      const cmX = cm * cmPx;
      ticks.push(`<line x1="${cmX.toFixed(1)}" y1="12" x2="${cmX.toFixed(1)}" y2="24" stroke="#94a3b8" stroke-width="1"/>`);
      ticks.push(`<text x="${(cmX + 2).toFixed(1)}" y="10" font-size="8" font-family="monospace" font-weight="700" fill="#64748b">${cm}</text>`);

      for (let mm = 1; mm < 10; mm++) {
        const mmX = cmX + (mm * mmPx);
        const tickH = mm === 5 ? 7 : 4;
        ticks.push(`<line x1="${mmX.toFixed(1)}" y1="${24 - tickH}" x2="${mmX.toFixed(1)}" y2="24" stroke="#cbd5e1" stroke-width="0.8"/>`);
      }
    }

    return `
      <svg width="${Math.max(widthPx * zoom + 300, 2200)}" height="24" style="display:block;" shape-rendering="crispEdges">
        ${ticks.join('')}
      </svg>
    `;
  }

  function renderRulerLeftSvg(heightPx, zoom) {
    const PX_PER_MM = 3.779527559;
    const mmPx = PX_PER_MM * zoom;
    const cmPx = 10 * mmPx;
    const maxCm = Math.ceil(heightPx / cmPx) + 6;
    const ticks = [];

    for (let cm = 0; cm <= maxCm; cm++) {
      const cmY = cm * cmPx;
      ticks.push(`<line x1="12" y1="${cmY.toFixed(1)}" x2="24" y2="${cmY.toFixed(1)}" stroke="#94a3b8" stroke-width="1"/>`);
      ticks.push(`<text x="2" y="${(cmY + 9).toFixed(1)}" font-size="8" font-family="monospace" font-weight="700" fill="#64748b">${cm}</text>`);

      for (let mm = 1; mm < 10; mm++) {
        const mmY = cmY + (mm * mmPx);
        const tickW = mm === 5 ? 7 : 4;
        ticks.push(`<line x1="${24 - tickW}" y1="${mmY.toFixed(1)}" x2="24" y2="${mmY.toFixed(1)}" stroke="#cbd5e1" stroke-width="0.8"/>`);
      }
    }

    return `
      <svg width="24" height="${Math.max(heightPx * zoom + 300, 2600)}" style="display:block;" shape-rendering="crispEdges">
        ${ticks.join('')}
      </svg>
    `;
  }

  function updateRulerTracker(left, width, top, height) {
    if (!showRulers) return;
    const trackTop = containerEl.querySelector('#rulerTrackTop');
    const trackLeft = containerEl.querySelector('#rulerTrackLeft');
    if (!trackTop || !trackLeft) return;

    if (left !== undefined && width !== undefined) {
      trackTop.style.display = 'block';
      trackTop.style.left = `${Math.round(left * currentZoom)}px`;
      trackTop.style.width = `${Math.max(4, Math.round(width * currentZoom))}px`;
    } else {
      trackTop.style.display = 'none';
    }

    if (top !== undefined && height !== undefined) {
      trackLeft.style.display = 'block';
      trackLeft.style.top = `${Math.round(top * currentZoom)}px`;
      trackLeft.style.height = `${Math.max(4, Math.round(height * currentZoom))}px`;
    } else {
      trackLeft.style.display = 'none';
    }
  }

  function renderSmartGuides(guideX, guideY) {
    const pageEl = containerEl.querySelector('#frReportPage') || containerEl.querySelector('#frDialogWindow');
    if (!pageEl) return;
    let layer = pageEl.querySelector('.fr-smart-guides-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'fr-smart-guides-layer';
      pageEl.appendChild(layer);
    }
    let html = '';
    if (guideX !== null && guideX !== undefined) {
      html += `<div class="fr-smart-guide-line vertical" style="left:${guideX}px;"></div>`;
    }
    if (guideY !== null && guideY !== undefined) {
      html += `<div class="fr-smart-guide-line horizontal" style="top:${guideY}px;"></div>`;
    }
    layer.innerHTML = html;
  }

  function clearSmartGuides() {
    const layer = containerEl.querySelector('.fr-smart-guides-layer');
    if (layer) layer.innerHTML = '';
  }

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
 <button type="button" class="designer-palette-btn" id="btnToolAddQRCode" title="Yeni QR Kod Ekle">QR Kod</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddShape" title="Yeni Şekil Ekle">Şekil</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddChart" title="Yeni Grafik Ekle">Grafik</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddBand" title="Yeni Bant Ekle">Bant</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddCheckbox" title="Yeni Onay Kutusu Ekle">CheckBox</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddRadio" title="Yeni Radyo Butonu Ekle">Radio</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddEdit" title="Yeni Metin Girişi Ekle">Edit</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddDateEdit" title="Yeni Tarih Seçici Ekle">Tarih</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddCombobox" title="Yeni Açılır Liste Ekle">Combo</button>
 <button type="button" class="designer-palette-btn" id="btnToolAddPanel" title="Yeni Panel Ekle">Panel</button>
 <button type="button" class="designer-palette-btn" id="btnDuplicateSelected" title="Seçili Bileşeni Çoğalt (Ctrl+D)">📋 Çoğalt</button>
 <button type="button" class="designer-palette-btn" id="btnBringToFront" title="En Öne Getir">🔼 Öne</button>
 <button type="button" class="designer-palette-btn" id="btnSendToBack" title="En Arkaya Gönder">🔽 Arkaya</button>
 <button type="button" class="designer-palette-btn danger" id="btnToolDeleteSelected" title="Seçili Bileşeni Sil (Delete)">Sil</button>
 </div>

 <div class="fr-multi-align-bar" id="frMultiAlignBar" style="${(selectedItems && selectedItems.length > 1) ? 'display:flex;' : 'display:none;'}">
 <span class="fr-align-badge" id="frAlignBadge">${selectedItems ? selectedItems.length : 0} Seçili</span>
 <button type="button" class="fr-align-btn" id="btnAlignLeft" title="Sola Hizala">⬅ Sol</button>
 <button type="button" class="fr-align-btn" id="btnAlignCenter" title="Yatay Ortala">↔ Orta</button>
 <button type="button" class="fr-align-btn" id="btnAlignRight" title="Sağa Hizala">➡ Sağ</button>
 <div class="fr-align-sep"></div>
 <button type="button" class="fr-align-btn" id="btnAlignTop" title="Üste Hizala">⬆ Üst</button>
 <button type="button" class="fr-align-btn" id="btnAlignMiddle" title="Düşey Ortala">↕ Dikey</button>
 <button type="button" class="fr-align-btn" id="btnAlignBottom" title="Alta Hizala">⬇ Alt</button>
 <div class="fr-align-sep"></div>
 <button type="button" class="fr-align-btn" id="btnDistributeH" title="Yatayda Eşit Dağıt">⬌ Dağıt</button>
 <button type="button" class="fr-align-btn" id="btnDistributeV" title="Dikeyde Eşit Dağıt">⬍ Dağıt</button>
 <div class="fr-align-sep"></div>
 <button type="button" class="fr-align-btn" id="btnMultiDuplicate" title="Seçilileri Çoğalt">📋 Çoğalt</button>
 <button type="button" class="fr-align-btn" id="btnMultiFront" title="Seçilileri En Öne Getir">🔼 Öne</button>
 <button type="button" class="fr-align-btn" id="btnMultiBack" title="Seçilileri En Arkaya Gönder">🔽 Arkaya</button>
 <div class="fr-align-sep"></div>
 <button type="button" class="fr-align-btn danger" id="btnDeleteMulti" title="Tüm Seçilileri Sil">🗑️ Sil</button>
 </div>
 `: ''}

 <!-- Zoom & Panel Kontrolleri -->
 <div class="designer-toolbar-group">
 <div class="designer-zoom-ctrl">
 <button type="button" class="designer-zoom-btn" id="btnZoomOut" title="Küçült">−</button>
 <span class="designer-zoom-val" id="zoomValText">${Math.round(currentZoom * 100)}%</span>
 <button type="button" class="designer-zoom-btn" id="btnZoomIn" title="Büyüt">+</button>
 <button type="button" class="designer-zoom-btn" id="btnZoomFit" title="Sayfaya Sığdır" style="margin-left:.25rem;font-size:.75rem;">Sığdır</button>
 <button type="button" class="designer-zoom-btn ${showRulers ? 'active' : ''}" id="btnToggleRulers" title="Cetvelleri Göster / Gizle" style="margin-left:.25rem;font-size:.75rem;padding:0 6px;">📏 Cetvel</button>
 <button type="button" class="designer-zoom-btn ${gridSnapStep > 1 ? 'active' : ''}" id="btnToggleGridSnap" title="Manyetik Izgara Adımı" style="margin-left:.25rem;font-size:.75rem;padding:0 6px;">🧲 Izgara: ${gridSnapStep > 1 ? gridSnapStep + 'px' : 'Kapalı'}</button>
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
 
 <div class="designer-canvas-area ${showRulers ? 'has-rulers' : ''}" id="designerCanvasArea">
 ${showRulers ? `
 <div class="designer-ruler-corner">cm</div>
 <div class="designer-ruler-top" id="designerRulerTop">
 <div class="ruler-track-top" id="rulerTrackTop"></div>
 ${renderRulerTopSvg(1400, currentZoom)}
 </div>
 <div class="designer-ruler-left" id="designerRulerLeft">
 <div class="ruler-track-left" id="rulerTrackLeft"></div>
 ${renderRulerLeftSvg(1800, currentZoom)}
 </div>
 ` : ''}
 <!-- Canvas Viewport -->
 <div class="designer-canvas-viewport" id="designerViewport">
 ${activePage.type === 'report'? renderReportPageHtml(activePage.data): renderDialogPageHtml(activePage.data)}
 </div>
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
 if (!isSelected || currentMode !== 'designer') return '';
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
 const fillIsClear = /^(?:bsClear|clear)$/i.test(String(comp.fillStyle || '')) || comp.fillBackColor === 'clNone';
 const fillBg = fillIsClear ? 'transparent' : decodeDelphiColor(comp.fillBackColor, true);
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
 const isSelected = (currentMode === 'designer') && (
   (selectedItem && selectedItem.name === comp.name) ||
   (selectedItems && selectedItems.some(si => si.name === comp.name))
 );

 // Event Durumu (Sol üstte kırmızı ok/üçgen - Image 3)
 const hasEvent = Boolean(comp.onBeforePrint || comp.onClick || comp.onAfterPrint || comp.onPreviewClick || comp.onKeyDown || (comp.rawAttrs && /\bOn[A-Z]\w+=/i.test(comp.rawAttrs)));
 const eventTitle = hasEvent? ` [Olay/Event: ${esc(comp.onBeforePrint || comp.onClick || 'Tanımlı')}]`: '';

 // 1. Barkod Bileşeni (TfrxBarCodeView)
 if (comp.type === 'TfrxBarCodeView') {
 return `
 <div class="fr-view-item fr-barcode-view ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
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
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
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
 const rawPic = comp.picture || comp.pictureData || comp.data || '';
 const imgUrl = decodeDelphiPictureHex(rawPic);
 const objectFit = comp.keepAspectRatio !== false && comp.keepAspectRatio !== 'false' ? 'contain' : (comp.stretched ? 'fill' : 'scale-down');
 const objectPosition = comp.center ? 'center' : 'left top';
 const label = comp.dataField || comp.fileLink || comp.name || 'Logo';
 const binding = comp.dataSet ? `${comp.dataSet}.${comp.dataField || ''}` : (comp.fileLink ? comp.fileLink : '');

 let contentHtml = '';
 if (imgUrl) {
 contentHtml = `<img class="fr-picture-img" src="${imgUrl}" style="object-fit:${objectFit};object-position:${objectPosition};" alt="${esc(label)}" />`;
 } else {
 contentHtml = `
 <div class="fr-picture-placeholder">
 <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
 <rect x="3" y="3" width="18" height="18" rx="3"/>
 <circle cx="8.5" cy="8.5" r="1.5"/>
 <polyline points="21 15 16 10 5 21"/>
 </svg>
 <span class="fr-picture-title">${esc(label)}</span>
 ${binding ? `<span class="fr-picture-sub">${esc(binding)}</span>` : ''}
 </div>
 `;
 }

 return `
 <div class="fr-view-item fr-picture-view ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
 style="
 left:${comp.left}px; top:${comp.top}px; width:${comp.width}px; height:${comp.height}px;
 border:${comp.frameWidth || 1}px ${isSelected ? 'solid var(--accent, #2563eb)' : 'dashed #94a3b8'};
 background-color:${fillBg === 'transparent' ? 'rgba(248, 250, 252, 0.9)' : fillBg};
 "
 title="${esc(comp.name)} [Resim: ${esc(label)}]${eventTitle}">
 ${contentHtml}
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 4. Çizgi (TfrxLineView)
 if (comp.type === 'TfrxLineView') {
 return `
 <div class="fr-view-item fr-line-view ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
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
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
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

 // 6. Şekil Bileşeni (TfrxShapeView - Tüm FastReport VCL Şekilleri)
 if (comp.type === 'TfrxShapeView') {
 const shapeType = String(comp.shape || 'skRectangle').toLowerCase();
 const isRound = shapeType.includes('round');
 const isCircle = shapeType.includes('circle') || shapeType.includes('ellipse');
 const isTriangle = shapeType.includes('triangle');
 const isDiamond = shapeType.includes('diamond');
 const isDiag1 = shapeType.includes('diagonal1');
 const isDiag2 = shapeType.includes('diagonal2');
 const fWidth = Math.max(1, comp.frameWidth || 1);
 const w = comp.width || 60;
 const h = comp.height || 60;

 let shapeInnerHtml = '';
 let shapeInlineStyle = `left:${comp.left}px; top:${comp.top}px; width:${w}px; height:${h}px; box-sizing:border-box;`;

 if (isTriangle) {
 shapeInnerHtml = `
 <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible;">
 <polygon points="${w/2},${fWidth/2} ${w - fWidth/2},${h - fWidth/2} ${fWidth/2},${h - fWidth/2}" fill="${fillBg}" stroke="${textColor}" stroke-width="${fWidth}" />
 </svg>
 `;
 } else if (isDiamond) {
 shapeInnerHtml = `
 <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible;">
 <polygon points="${w/2},${fWidth/2} ${w - fWidth/2},${h/2} ${w/2},${h - fWidth/2} ${fWidth/2},${h/2}" fill="${fillBg}" stroke="${textColor}" stroke-width="${fWidth}" />
 </svg>
 `;
 } else if (isDiag1) {
 shapeInnerHtml = `
 <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" style="display:block;">
 <line x1="0" y1="0" x2="${w}" y2="${h}" stroke="${textColor}" stroke-width="${fWidth}" />
 </svg>
 `;
 } else if (isDiag2) {
 shapeInnerHtml = `
 <svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" style="display:block;">
 <line x1="0" y1="${h}" x2="${w}" y2="0" stroke="${textColor}" stroke-width="${fWidth}" />
 </svg>
 `;
 } else {
 const borderRadius = isCircle? '50%': (isRound? '8px': '0px');
 shapeInlineStyle += ` background-color:${fillBg}; border:${fWidth}px solid ${textColor}; border-radius:${borderRadius};`;
 }

 return `
 <div class="fr-view-item ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
 style="${shapeInlineStyle}"
 title="${esc(comp.name)} [${esc(comp.shape || 'Şekil')}]${eventTitle}">
 ${shapeInnerHtml}
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 7. Onay Kutusu (TfrxCheckBoxView - FastReport VCL)
 if (comp.type === 'TfrxCheckBoxView') {
 const isChecked = comp.checked === true || comp.checked === 'true' || comp.checked === '1';
 const checkStyle = String(comp.checkStyle || 'csCheck');
 const symbol = isChecked? (checkStyle === 'csCross'? '✕': (checkStyle === 'csPlus'? '+': '✓')): '';
 const checkColor = decodeDelphiColor(comp.checkColor || 'clBlack', false);
 return `
 <div class="fr-view-item fr-checkbox-view ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
 style="
 left:${comp.left}px; top:${comp.top}px; width:${comp.width}px; height:${comp.height}px;
 background-color:${fillBg}; border:${comp.frameWidth || 1}px solid ${textColor}; border-radius:3px;
 display:flex; align-items:center; justify-content:center; box-sizing:border-box;
 font-weight:900; font-size:${Math.max(10, Math.min(comp.width, comp.height) * 0.7)}px; color:${checkColor};
 "
 title="${esc(comp.name)} [TfrxCheckBoxView: ${isChecked? 'İşaretli': 'Boş'}]${eventTitle}">
 <span>${symbol}</span>
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 8. Gradyan Dolgu Nesnesi (TfrxGradientView - FastReport VCL)
 if (comp.type === 'TfrxGradientView') {
 const beginColor = decodeDelphiColor(comp.beginColor || 'clWhite', true);
 const endColor = decodeDelphiColor(comp.endColor || 'clSkyBlue', true);
 const style = String(comp.style || 'gsVertical');
 const gradDirection = style.includes('Horizontal')? 'to right': 'to bottom';
 return `
 <div class="fr-view-item fr-gradient-view ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
 style="
 left:${comp.left}px; top:${comp.top}px; width:${comp.width}px; height:${comp.height}px;
 background: linear-gradient(${gradDirection}, ${beginColor}, ${endColor});
 border:${comp.frameWidth || 1}px solid ${textColor}; box-sizing:border-box;
 "
 title="${esc(comp.name)} [TfrxGradientView: ${esc(style)}]${eventTitle}">
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 9. Alt Rapor Bileşeni (TfrxSubreport - FastReport VCL)
 if (comp.type === 'TfrxSubreport') {
 return `
 <div class="fr-view-item fr-subreport-view ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
 style="
 left:${comp.left}px; top:${comp.top}px; width:${comp.width}px; height:${comp.height}px;
 background: rgba(37,99,235,0.06); border: 1.5px dashed var(--accent, #2563eb); border-radius: 4px;
 display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 10px; font-weight: 700; color: var(--accent, #2563eb);
 box-sizing: border-box;
 "
 title="${esc(comp.name)} [Alt Rapor: ${esc(comp.subreportPage || 'Sayfa')}]${eventTitle}">
 <span>📑</span> <span>[Subreport: ${esc(comp.subreportPage || comp.name)}]</span>
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 10. Çapraz Tablo (TfrxCrossView / TfrxDBCrossView - FastReport VCL)
 if (comp.type === 'TfrxCrossView' || comp.type === 'TfrxDBCrossView') {
 return `
 <div class="fr-view-item fr-cross-view ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
 style="
 left:${comp.left}px; top:${comp.top}px; width:${comp.width}px; height:${comp.height}px;
 background:#ffffff; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box; overflow:hidden;
 display:flex; flex-direction:column;
 "
 title="${esc(comp.name)} [Çapraz Tablo: ${esc(comp.type)}]${eventTitle}">
 <div style="background:#f1f5f9; padding:2px 6px; font-size:9px; font-weight:700; color:#475569; border-bottom:1px solid #cbd5e1; display:flex; align-items:center; gap:4px;">
 <span>▦</span> <span>${esc(comp.name)} [Cross-Tab]</span>
 </div>
 <div style="flex:1; display:grid; grid-template-columns:1fr 1fr 1fr; grid-template-rows:1fr 1fr; gap:1px; background:#e2e8f0; padding:1px; font-size:8.5px; text-align:center;">
 <div style="background:#f8fafc; font-weight:700; display:flex; align-items:center; justify-content:center;">Başlık</div>
 <div style="background:#f8fafc; font-weight:700; display:flex; align-items:center; justify-content:center;">Kolon 1</div>
 <div style="background:#f8fafc; font-weight:700; display:flex; align-items:center; justify-content:center;">Toplam</div>
 <div style="background:#ffffff; display:flex; align-items:center; justify-content:center;">Satır 1</div>
 <div style="background:#ffffff; display:flex; align-items:center; justify-content:center;">[Veri]</div>
 <div style="background:#f8fafc; font-weight:700; display:flex; align-items:center; justify-content:center;">[∑]</div>
 </div>
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 11. Sistem Metni (TfrxSysMemoView - FastReport VCL)
 if (comp.type === 'TfrxSysMemoView') {
 const sysText = comp.text || comp.dataField || '[PAGE#]';
 return `
 <div class="fr-view-item fr-sysmemo-view ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
 style="
 left:${comp.left}px; top:${comp.top}px; width:${comp.width}px; height:${comp.height}px;
 background-color:${fillBg}; border-left:${frameCss.borderLeft}; border-right:${frameCss.borderRight};
 border-top:${frameCss.borderTop}; border-bottom:${frameCss.borderBottom};
 font-family:${safeFontFamily(comp.fontName)}, sans-serif; font-size:${comp.fontSize || 10}px;
 font-weight:${isBold? '700': '400'}; color:${textColor}; text-align:${textAlign};
 box-sizing:border-box;
 "
 title="${esc(comp.name)} [TfrxSysMemoView: ${esc(sysText)}]${eventTitle}">
 <div class="fr-memo-content" style="justify-content:${hAlign}; align-items:${vAlign};">
 <span style="background:rgba(99,102,241,0.1);color:#4f46e5;padding:0 3px;border-radius:2px;font-weight:700;">⚙️ ${esc(sysText)}</span>
 </div>
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 12. Barkod / Karekod Bileşeni (TfrxBarCodeView, TfrxQRCodeView, TfrxBarcode2DView - FastReport VCL)
 if (comp.type === 'TfrxBarCodeView' || comp.type === 'TfrxQRCodeView' || comp.type === 'TfrxBarcode2DView') {
 const barType = String(comp.barType || comp.type || 'bcCode128');
 const isQr = barType.toLowerCase().includes('qr') || comp.type === 'TfrxQRCodeView';
 const isPdf417 = barType.toLowerCase().includes('pdf417');
 const barText = comp.text || comp.expression || comp.dataField || (isQr ? 'https://fast-report.com' : '1234567890');
 const showText = comp.showText !== false && comp.showText !== 'False' && !isQr;
 const w = Math.max(20, comp.width || (isQr ? 75 : 130));
 const h = Math.max(16, comp.height || (isQr ? 75 : 45));
 const barSvg = renderBarcodeSvg(barType, barText, w, h, showText, textColor, fillBg, isQr, isPdf417);

 return `
 <div class="fr-view-item fr-barcode-view ${hasEvent ? 'fr-has-event' : ''} ${isSelected ? 'selected' : ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
 style="
 left:${comp.left}px; top:${comp.top}px; width:${w}px; height:${h}px;
 background-color:${fillBg === 'transparent' ? '#ffffff' : fillBg};
 border:${comp.frameWidth || 1}px solid ${isSelected ? 'var(--accent, #2563eb)' : '#cbd5e1'};
 border-radius:3px; box-sizing:border-box; overflow:hidden; display:flex; align-items:center; justify-content:center;
 "
 title="${esc(comp.name)} [${isQr ? 'QR Kod' : 'Barkod'}: ${esc(barType)}] ${esc(barText)}${eventTitle}">
 ${barSvg}
 ${renderResizeHandles(isSelected)}
 </div>
 `;
 }

 // 7. Standart TfrxMemoView
 return `
 <div class="fr-view-item ${hasEvent? 'fr-has-event': ''} ${isSelected? 'selected': ''}"
 data-band-idx="${bIdx}" data-comp-idx="${cIdx}" data-comp-name="${esc(comp.name || '')}"
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
 <div class="fr-smart-guides-layer" id="frSmartGuidesLayer"></div>
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
 const isDialogPage = obj.type === 'TfrxDialogPage' || Array.isArray(obj.controls);
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
  } else if (isDialogPage) {
    propList = [
      { name: 'Name', val: obj.name || 'DialogPage1', propKey: 'name', editable: isDesignEditing },
      { name: 'Class', val: 'TfrxDialogPage', readOnly: true },
      { name: 'Caption', val: obj.caption || '', propKey: 'caption', editable: isDesignEditing },
      { name: 'Left', val: obj.left ?? 0, propKey: 'left', isNumber: true, editable: isDesignEditing },
      { name: 'Top', val: obj.top ?? 0, propKey: 'top', isNumber: true, editable: isDesignEditing },
      { name: 'Width', val: obj.width ?? 360, propKey: 'width', isNumber: true, editable: isDesignEditing },
      { name: 'Height', val: obj.height ?? 240, propKey: 'height', isNumber: true, editable: isDesignEditing },
      { name: 'Position', val: obj.position || 'poScreenCenter', propKey: 'position', readOnly: true },
      { name: 'Color', rawVal: obj.color, val: obj.color || 'clBtnFace', propKey: 'color', isColor: true, editable: isDesignEditing },
      { name: 'Controls', val: String((obj.controls || []).length), readOnly: true }
    ];
  } else {
    // BANT, MEMO (TfrxMemoView), VE DİĞER BİLEŞENLERİN TÜM DELPHI ÖZELLİKLERİ
    const isBoldVal = (obj.fontStyle && (obj.fontStyle.includes('fsBold') || obj.fontStyle.includes('bold'))) || obj.isBold;
    const isItalicVal = (obj.fontStyle && (obj.fontStyle.includes('fsItalic') || obj.fontStyle.includes('italic'))) || obj.isItalic;
    const isUnderlineVal = (obj.fontStyle && (obj.fontStyle.includes('fsUnderline') || obj.fontStyle.includes('underline'))) || obj.isUnderline;
    const rawTextVal = obj.caption !== undefined ? obj.caption : (obj.text !== undefined ? obj.text : (Array.isArray(obj.memo) ? obj.memo.join('\n') : (obj.memo || '')));

    propList = [
      { name: 'Name', val: obj.name || '', propKey: 'name', editable: isDesignEditing },
      { name: 'Class', val: obj.type || (obj.bands ? 'TfrxReportPage' : 'TfrxMemoView'), readOnly: true },
      { name: 'Left', val: obj.left ?? 0, propKey: 'left', isNumber: true, editable: isDesignEditing },
      { name: 'Top', val: obj.top ?? 0, propKey: 'top', isNumber: true, editable: isDesignEditing },
      { name: 'Width', val: obj.width ?? 0, propKey: 'width', isNumber: true, editable: isDesignEditing },
      { name: 'Height', val: obj.height ?? 0, propKey: 'height', isNumber: true, editable: isDesignEditing },
      { name: 'Align', val: obj.align || 'alNone', propKey: 'align', isSelect: isDesignEditing, options: ['alNone', 'alLeft', 'alRight', 'alTop', 'alBottom', 'alClient', 'alCustom'] },
      { name: 'Caption / Text', val: rawTextVal, propKey: 'text', editable: isDesignEditing },
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
      { name: 'Fill.BackColor', rawVal: (/^(?:bsClear|clear)$/i.test(String(obj.fillStyle || '')) ? 'clNone' : (obj.fillBackColor || obj.color)), val: /^(?:bsClear|clear)$/i.test(String(obj.fillStyle || '')) ? 'clNone' : (obj.fillBackColor || obj.color || 'clNone'), propKey: 'fillBackColor', isColor: true, editable: isDesignEditing },
      { name: 'Fill.Style', val: obj.fillStyle || 'bsSolid', propKey: 'fillStyle', isSelect: isDesignEditing, options: ['bsSolid', 'bsClear', 'bsHorizontal', 'bsVertical', 'bsFDiagonal', 'bsBDiagonal', 'bsCross', 'bsDiagCross'] },
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

    if (obj.type === 'TfrxPictureView') {
      propList.push(
        { name: 'Picture.File', val: obj.picture || obj.file || obj.fileLink || '', propKey: 'picture', editable: isDesignEditing },
        { name: 'FileLink', val: obj.fileLink || '', propKey: 'fileLink', editable: isDesignEditing },
        { name: 'KeepAspectRatio', val: obj.keepAspectRatio !== false ? 'true' : 'false', propKey: 'keepAspectRatio', isSelect: isDesignEditing, options: ['true', 'false'] },
        { name: 'Stretched', val: obj.stretched ? 'true' : 'false', propKey: 'stretched', isSelect: isDesignEditing, options: ['true', 'false'] },
        { name: 'Center', val: obj.center ? 'true' : 'false', propKey: 'center', isSelect: isDesignEditing, options: ['true', 'false'] }
      );
    } else if (obj.type === 'TfrxBarCodeView' || obj.type === 'TfrxQRCodeView' || obj.type === 'TfrxBarcode2DView') {
      propList.push(
        { name: 'BarType', val: obj.barType || (obj.type === 'TfrxQRCodeView' ? 'bcQR' : 'bcCode128'), propKey: 'barType', isSelect: isDesignEditing, options: ['bcCode128', 'bcCode128A', 'bcCode128B', 'bcCode128C', 'bcCode39', 'bcEAN13', 'bcEAN8', 'bcUPCA', 'bcQR', 'bcPDF417', 'bcCode93', 'bcMSI', 'bcCodabar'] },
        { name: 'Expression', val: obj.expression || obj.text || '', propKey: 'expression', editable: isDesignEditing },
        { name: 'ShowText', val: obj.showText !== false ? 'true' : 'false', propKey: 'showText', isSelect: isDesignEditing, options: ['true', 'false'] },
        { name: 'Zoom', val: obj.zoom || 1, propKey: 'zoom', isNumber: true, editable: isDesignEditing }
      );
    } else if (obj.type === 'TfrxShapeView') {
      propList.push(
        { name: 'Shape', val: obj.shape || 'skRectangle', propKey: 'shape', isSelect: isDesignEditing, options: ['skRectangle', 'skRoundRectangle', 'skEllipse', 'skTriangle', 'skDiamond'] }
      );
    }
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
				if (prop === 'text' || prop === 'caption') {
					selectedItem.text = val;
					selectedItem.caption = val;
					selectedItem.memo = val;
				}
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

 // ── BİLEŞEN EKLEME METODU (Genişletilmiş 18 Nesne Türü) ──
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
 } else if (type === 'sysmemo') {
 newComp = {
 name: `SysMemo${randomId}`,
 type: 'TfrxSysMemoView',
 left: 60,
 top: 30,
 width: 150,
 height: 24,
 text: '[Page#] / [TotalPages#]',
 fontName: 'Arial',
 fontSize: 9,
 fontColor: '-16777208',
 fillBackColor: 'clNone'
 };
 } else if (type === 'gradient') {
 newComp = {
 name: `Gradient${randomId}`,
 type: 'TfrxGradientView',
 left: 60,
 top: 30,
 width: 180,
 height: 60,
 text: 'Gradyan Alanı',
 startColor: '16777215',
 endColor: '12632256',
 gradientStyle: 'gsHorizontal'
 };
 } else if (type === 'subreport') {
 newComp = {
 name: `Subreport${randomId}`,
 type: 'TfrxSubreport',
 left: 60,
 top: 30,
 width: 220,
 height: 80,
 text: 'Alt Rapor',
 pageName: ''
 };
 } else if (type === 'crosstab') {
 newComp = {
 name: `CrossTab${randomId}`,
 type: 'TfrxCrossView',
 left: 60,
 top: 30,
 width: 280,
 height: 130,
 text: 'Çapraz Tablo',
 dataSet: file.queries?.[0]?.name || '',
 rowFields: '',
 columnFields: '',
 cellFields: ''
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
 width: 140,
 height: 50,
 text: '1234567890',
 barType: 'bcCode128',
 showText: true
 };
 } else if (type === 'qrcode') {
 newComp = {
 name: `QRCode${randomId}`,
 type: 'TfrxBarCodeView',
 left: 60,
 top: 30,
 width: 75,
 height: 75,
 text: 'https://fast-report.com',
 barType: 'bcQR',
 showText: false
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
 if (window.FrpNotify) window.FrpNotify.success(`Yeni Bant eklendi: '${newBand.name}'`);
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
 if (window.FrpNotify) window.FrpNotify.success(`'${newComp.name}' eklendi`);
 else if (typeof toast === 'function') toast(`'${newComp.name}' eklendi`, 'success');
 }

 // ── BİLEŞEN SİLME METODU ──────────────────────────────────
 function deleteSelectedComponent() {
 if (!isDesignEditing) return;
 if (selectedItems && selectedItems.length > 1) {
   deleteMultiSelected();
   return;
 }
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
 selectedItems = [];
 render();
 pushUndoState();
 if (window.FrpNotify) window.FrpNotify.info(`'${delName}' silindi ️`);
 else if (typeof toast === 'function') toast(`'${delName}' silindi ️`, 'info');
 }
 }

 function deleteMultiSelected() {
   if (!isDesignEditing || !selectedItems || selectedItems.length === 0) return;
   const activePage = allPages[activePageIndex];
   if (!activePage) return;
   pushUndoState();

   const namesToDelete = new Set(selectedItems.map(c => c.name).filter(Boolean));
   let deletedCount = 0;

   if (activePage.type === 'report') {
     (activePage.data.bands || []).forEach(b => {
       if (!b.components) return;
       const initialLen = b.components.length;
       b.components = b.components.filter(c => !namesToDelete.has(c.name));
       deletedCount += (initialLen - b.components.length);
     });
   } else {
     if (activePage.data.controls) {
       const initialLen = activePage.data.controls.length;
       activePage.data.controls = activePage.data.controls.filter(c => !namesToDelete.has(c.name));
       deletedCount += (initialLen - activePage.data.controls.length);
     }
   }

   selectedItems = [];
   selectedItem = null;
   render();
   pushUndoState();
   if (window.FrpNotify) window.FrpNotify.info(`${deletedCount} bileşen silindi 🗑️`);
   else if (typeof toast === 'function') toast(`${deletedCount} bileşen silindi 🗑️`, 'info');
 }

 function alignSelected(type) {
   if (!isDesignEditing || !selectedItems || selectedItems.length < 2) return;
   pushUndoState();

   if (type === 'left') {
     const minLeft = Math.min(...selectedItems.map(c => Number(c.left) || 0));
     selectedItems.forEach(c => { c.left = minLeft; });
   } else if (type === 'center') {
     const minLeft = Math.min(...selectedItems.map(c => Number(c.left) || 0));
     const maxRight = Math.max(...selectedItems.map(c => (Number(c.left) || 0) + (Number(c.width) || 0)));
     const midX = (minLeft + maxRight) / 2;
     selectedItems.forEach(c => {
       const w = Number(c.width) || 0;
       c.left = Math.round(midX - w / 2);
     });
   } else if (type === 'right') {
     const maxRight = Math.max(...selectedItems.map(c => (Number(c.left) || 0) + (Number(c.width) || 0)));
     selectedItems.forEach(c => {
       const w = Number(c.width) || 0;
       c.left = maxRight - w;
     });
   } else if (type === 'top') {
     const minTop = Math.min(...selectedItems.map(c => Number(c.top) || 0));
     selectedItems.forEach(c => { c.top = minTop; });
   } else if (type === 'middle') {
     const minTop = Math.min(...selectedItems.map(c => Number(c.top) || 0));
     const maxBottom = Math.max(...selectedItems.map(c => (Number(c.top) || 0) + (Number(c.height) || 0)));
     const midY = (minTop + maxBottom) / 2;
     selectedItems.forEach(c => {
       const h = Number(c.height) || 0;
       c.top = Math.round(midY - h / 2);
     });
   } else if (type === 'bottom') {
     const maxBottom = Math.max(...selectedItems.map(c => (Number(c.top) || 0) + (Number(c.height) || 0)));
     selectedItems.forEach(c => {
       const h = Number(c.height) || 0;
       c.top = maxBottom - h;
     });
   } else if (type === 'distributeH') {
     if (selectedItems.length >= 3) {
       const sorted = [...selectedItems].sort((a, b) => (Number(a.left) || 0) - (Number(b.left) || 0));
       const first = sorted[0];
       const last = sorted[sorted.length - 1];
       const startX = Number(first.left) || 0;
       const totalSpan = (Number(last.left) || 0) + (Number(last.width) || 0) - startX;
       const totalItemsWidth = sorted.reduce((sum, c) => sum + (Number(c.width) || 0), 0);
       const freeSpace = Math.max(0, totalSpan - totalItemsWidth);
       const gap = freeSpace / (sorted.length - 1);
       let curX = startX;
       sorted.forEach(c => {
         c.left = Math.round(curX);
         curX += (Number(c.width) || 0) + gap;
       });
     }
   } else if (type === 'distributeV') {
     if (selectedItems.length >= 3) {
       const sorted = [...selectedItems].sort((a, b) => (Number(a.top) || 0) - (Number(b.top) || 0));
       const first = sorted[0];
       const last = sorted[sorted.length - 1];
       const startY = Number(first.top) || 0;
       const totalSpan = (Number(last.top) || 0) + (Number(last.height) || 0) - startY;
       const totalItemsHeight = sorted.reduce((sum, c) => sum + (Number(c.height) || 0), 0);
       const freeSpace = Math.max(0, totalSpan - totalItemsHeight);
       const gap = freeSpace / (sorted.length - 1);
       let curY = startY;
       sorted.forEach(c => {
         c.top = Math.round(curY);
         curY += (Number(c.height) || 0) + gap;
       });
     }
   }

   render();
   pushUndoState();
   if (window.FrpNotify) window.FrpNotify.info('Seçili bileşenler hizalandı');
   else if (typeof toast === 'function') toast('Seçili bileşenler hizalandı', 'info');
 }

 // ── BİLEŞEN ÇOĞALTMA (DUPLICATE) ──
 function duplicateSelected() {
   if (!isDesignEditing) isDesignEditing = true;
   const activePage = allPages[activePageIndex];
   if (!activePage) return;

   const targets = (selectedItems && selectedItems.length > 0) ? [...selectedItems] : (selectedItem ? [selectedItem] : []);
   if (targets.length === 0) {
     if (window.FrpNotify) window.FrpNotify.info('Çoğaltmak için bir veya daha fazla bileşen seçin.');
     return;
   }

   pushUndoState();
   const newItems = [];

   targets.forEach(orig => {
     if (!orig || !orig.name) return;
     const clone = JSON.parse(JSON.stringify(orig));
     const randSuffix = Math.floor(100 + Math.random() * 900);
     const baseName = (orig.name || 'Comp').replace(/\d+$/, '');
     clone.name = `${baseName}_Copy${randSuffix}`;
     const offset = (gridSnapStep && gridSnapStep > 1) ? Math.max(gridSnapStep, 8) : 10;
     clone.left = (clone.left || 0) + offset;
     clone.top = (clone.top || 0) + offset;

     if (activePage.type === 'report') {
       let placed = false;
       (activePage.data.bands || []).forEach(b => {
         if (!placed && (b.components || []).some(c => c.name === orig.name)) {
           b.components.push(clone);
           placed = true;
         }
       });
       if (!placed && activePage.data.bands && activePage.data.bands.length > 0) {
         activePage.data.bands[0].components = activePage.data.bands[0].components || [];
         activePage.data.bands[0].components.push(clone);
       }
     } else {
       activePage.data.controls = activePage.data.controls || [];
       activePage.data.controls.push(clone);
     }
     newItems.push(clone);
   });

   if (newItems.length > 0) {
     selectedItems = newItems;
     selectedItem = newItems[newItems.length - 1];
     render();
     updateSelection();
     pushUndoState();
     if (window.FrpNotify) window.FrpNotify.success(`${newItems.length} bileşen çoğaltıldı.`);
     else if (typeof toast === 'function') toast(`${newItems.length} bileşen çoğaltıldı.`, 'success');
   }
 }

 // ── Z-ORDER DÜZENLEME (Öne / Arkaya) ──
 function changeZOrder(direction) {
   if (!isDesignEditing) isDesignEditing = true;
   const activePage = allPages[activePageIndex];
   if (!activePage) return;

   const targets = (selectedItems && selectedItems.length > 0) ? selectedItems : (selectedItem ? [selectedItem] : []);
   if (targets.length === 0) return;

   pushUndoState();

   if (activePage.type === 'report') {
     (activePage.data.bands || []).forEach(b => {
       if (!b.components || b.components.length <= 1) return;
       targets.forEach(t => {
         const idx = b.components.findIndex(c => c.name === t.name);
         if (idx !== -1) {
           const [item] = b.components.splice(idx, 1);
           if (direction === 'front') {
             b.components.push(item);
           } else {
             b.components.unshift(item);
           }
         }
       });
     });
   } else {
     if (activePage.data.controls && activePage.data.controls.length > 1) {
       targets.forEach(t => {
         const idx = activePage.data.controls.findIndex(c => c.name === t.name);
         if (idx !== -1) {
           const [item] = activePage.data.controls.splice(idx, 1);
           if (direction === 'front') {
             activePage.data.controls.push(item);
           } else {
             activePage.data.controls.unshift(item);
           }
         }
       });
     }
   }

   render();
   updateSelection();
   pushUndoState();
   const label = direction === 'front' ? 'öne getirildi' : 'arkaya gönderildi';
   if (window.FrpNotify) window.FrpNotify.info(`Bileşen(ler) en ${label}.`);
 }

 function getCompFromElement(el) {
   if (!el) return null;
   const activePage = allPages[activePageIndex];
   if (!activePage) return null;
   const bandIdx = parseInt(el.dataset.bandIdx, 10);
   const compIdx = parseInt(el.dataset.compIdx, 10);
   const rawIdx = el.dataset.ctrlIdx;

   if (activePage.type === 'report' && !isNaN(bandIdx) && !isNaN(compIdx)) {
     return activePage.data.bands?.[bandIdx]?.components?.[compIdx] || null;
   } else if (activePage.type === 'dialog' && rawIdx !== undefined) {
     if (rawIdx.includes('_')) {
       const parts = rawIdx.split('_').map(n => parseInt(n, 10));
       const parentCtrl = activePage.data.controls?.[parts[0]];
       return parentCtrl?.children?.[parts[1]] || parentCtrl || null;
     } else {
       const idx = parseInt(rawIdx, 10);
       return activePage.data.controls?.[idx] || null;
     }
   }
   return null;
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
          selectedItems = [];
          updateSelection();
        }
      });
      vpEl.addEventListener('scroll', () => {
        const rTop = containerEl.querySelector('#designerRulerTop');
        const rLeft = containerEl.querySelector('#designerRulerLeft');
        if (rTop) rTop.scrollLeft = vpEl.scrollLeft;
        if (rLeft) rLeft.scrollTop = vpEl.scrollTop;
      });

      // ── LASSO SEÇİMİ (MARQUEE SELECTION) ──
      let isLassoing = false;
      let lassoStartX = 0;
      let lassoStartY = 0;
      let lassoBox = null;

      vpEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.fr-view-item') || e.target.closest('.fr-ctrl-item') || e.target.closest('.fr-resize-handle') || e.target.closest('.fr-vertical-band-header') || e.target.closest('.designer-inspector')) return;

        const vpRect = vpEl.getBoundingClientRect();
        lassoStartX = e.clientX;
        lassoStartY = e.clientY;
        isLassoing = true;

        lassoBox = document.createElement('div');
        lassoBox.className = 'fr-lasso-marquee';
        lassoBox.id = 'frLassoMarquee';
        lassoBox.style.left = `${(e.clientX - vpRect.left + vpEl.scrollLeft)}px`;
        lassoBox.style.top = `${(e.clientY - vpRect.top + vpEl.scrollTop)}px`;
        lassoBox.style.width = '0px';
        lassoBox.style.height = '0px';
        vpEl.appendChild(lassoBox);

        const onLassoMove = (moveEvt) => {
          if (!isLassoing || !lassoBox) return;
          const curVpRect = vpEl.getBoundingClientRect();
          const minX = Math.min(lassoStartX, moveEvt.clientX);
          const maxX = Math.max(lassoStartX, moveEvt.clientX);
          const minY = Math.min(lassoStartY, moveEvt.clientY);
          const maxY = Math.max(lassoStartY, moveEvt.clientY);

          lassoBox.style.left = `${(minX - curVpRect.left + vpEl.scrollLeft)}px`;
          lassoBox.style.top = `${(minY - curVpRect.top + vpEl.scrollTop)}px`;
          lassoBox.style.width = `${(maxX - minX)}px`;
          lassoBox.style.height = `${(maxY - minY)}px`;

          if ((maxX - minX) > 6 || (maxY - minY) > 6) {
            const matched = [];
            containerEl.querySelectorAll('.fr-view-item, .fr-ctrl-item').forEach(cEl => {
              const cRect = cEl.getBoundingClientRect();
              const overlaps = !(
                cRect.right < minX ||
                cRect.left > maxX ||
                cRect.bottom < minY ||
                cRect.top > maxY
              );
              if (overlaps) {
                const compObj = getCompFromElement(cEl);
                if (compObj && !matched.includes(compObj)) {
                  matched.push(compObj);
                }
              }
            });

            if (matched.length > 0) {
              selectedItems = matched;
              selectedItem = matched[0];
              updateSelection();
            }
          }
        };

        const onLassoUp = () => {
          isLassoing = false;
          if (lassoBox) {
            lassoBox.remove();
            lassoBox = null;
          }
          window.removeEventListener('mousemove', onLassoMove);
          window.removeEventListener('mouseup', onLassoUp);
        };

        window.addEventListener('mousemove', onLassoMove);
        window.addEventListener('mouseup', onLassoUp);
      });
    }

    containerEl.querySelectorAll('.fr-view-item,.fr-ctrl-item').forEach(el => {
 el.addEventListener('click', (e) => {
 e.stopPropagation();
 const compObj = getCompFromElement(el);
 if (!compObj) return;

 if (e.shiftKey || e.ctrlKey || e.metaKey) {
   const idx = selectedItems.indexOf(compObj);
   if (idx !== -1) {
     selectedItems.splice(idx, 1);
     selectedItem = selectedItems[selectedItems.length - 1] || null;
   } else {
     selectedItems.push(compObj);
     selectedItem = compObj;
   }
 } else {
   selectedItems = [compObj];
   selectedItem = compObj;
 }
 updateSelection();
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
      } else if (typeof window.showPromptDialog === 'function') {
        newText = await new Promise(resolve => {
          window.showPromptDialog({
            title: `"${selectedItem.name}" Metnini Düzenle`,
            message: 'Memo bileşeni metnini veya alan ifadesini düzenleyin:',
            defaultValue: oldText,
            onConfirm: resolve,
            onCancel: () => resolve(oldText)
          });
        });
      } else {
        const res = window.prompt('Memo bileşeni metnini veya alan ifadesini düzenleyin:', oldText);
        newText = res !== null ? res : oldText;
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
 if (currentMode !== 'designer') return;
 if (e.button !== 0) return;
 if (window._isReportLockedByOther) {
   if (window.FrpNotify) window.FrpNotify.warning(`Bu rapor şu anda ${window._reportLockHolderName || 'başka bir kullanıcı'} tarafından düzenleniyor. Salt-okunur moddasınız.`);
   return;
 }
 if (e.target.closest('.designer-prop-input') || e.target.closest('.designer-prop-select')) return;

 // Otomatik Seçim Senkronizasyonu
 const targetComp = getCompFromElement(el);
 if (targetComp) {
   if (!selectedItems.includes(targetComp)) {
     selectedItem = targetComp;
     selectedItems = [targetComp];
     updateSelection();
   } else {
     selectedItem = targetComp;
   }
 }

 if (!selectedItem) return;

 // Tarayıcının varsayılan metin seçimi veya HTML5 sürüklemesini engelle
 e.preventDefault();
 e.stopPropagation();

 // Tasarım Düzenleme Modunu Otomatik Başlat
 if (!isDesignEditing) {
 isDesignEditing = true;
 initialPagesBackup = JSON.parse(JSON.stringify(allPages.map(p => p.data)));
 undoStack = [JSON.stringify(allPages.map(p => p.data))];
 redoStack = [];
 const btnSave = containerEl.querySelector('#btnSaveDesignEdit');
 const btnCancel = containerEl.querySelector('#btnCancelDesignEdit');
 if (btnSave) btnSave.style.display = 'inline-flex';
 if (btnCancel) btnCancel.style.display = 'inline-flex';
 }

 const resizeHandle = e.target.closest('.fr-resize-handle');
 const handleType = resizeHandle ? resizeHandle.dataset.handle : null;

 let isDragging = !handleType;
 let isResizing = !!handleType;

 // Cursor & Seçim Kilidi
 document.body.style.userSelect = 'none';
 document.body.style.webkitUserSelect = 'none';
 if (isResizing && resizeHandle) {
   const cur = window.getComputedStyle(resizeHandle).cursor;
   document.body.style.cursor = cur || 'se-resize';
 } else if (isDragging) {
   document.body.style.cursor = 'move';
 }

 const isMultiDrag = isDragging && selectedItems.length > 1 && selectedItems.includes(selectedItem);
 const multiStartPos = isMultiDrag ? selectedItems.map(c => ({
   comp: c,
   left: c.left || 0,
   top: c.top || 0,
   el: (c.name ? containerEl.querySelector(`[data-comp-name="${c.name}"]`) : null)
 })) : [];

 const startX = e.clientX;
 const startY = e.clientY;
 const startLeft = selectedItem.left || 0;
 const startTop = selectedItem.top || 0;
 const startWidth = selectedItem.width || 100;
 const startHeight = selectedItem.height || 30;

 if (isDragging) el.classList.add('is-dragging');

 // Canlı Koordinat HUD Göstergesi
 let hud = document.getElementById('frCanvasHudTooltip');
 if (!hud) {
 hud = document.createElement('div');
 hud.id = 'frCanvasHudTooltip';
 hud.style.cssText = 'position:fixed;z-index:9999999;pointer-events:none;background:rgba(15,23,42,0.92);color:#38bdf8;padding:4px 8px;border-radius:6px;font-size:11px;font-family:monospace;font-weight:700;box-shadow:0 4px 14px rgba(0,0,0,0.3);border:1px solid rgba(56,189,248,0.35);backdrop-filter:blur(6px);transform:translate(14px,14px);display:none;';
 document.body.appendChild(hud);
 }
 hud.style.display = 'block';
 hud.textContent = isMultiDrag ? `${selectedItems.length} bileşen taşınıyor` : `X: ${selectedItem.left} Y: ${selectedItem.top} | ${selectedItem.width}×${selectedItem.height}`;
 hud.style.left = `${e.clientX}px`;
 hud.style.top = `${e.clientY}px`;

 // Komşu Bileşenleri Topla (Smart Snapping için)
 const siblingComps = [];
 const bandIdx = parseInt(el.dataset.bandIdx, 10);
 if (activePage?.type === 'report' && !isNaN(bandIdx)) {
 const b = activePage.data.bands?.[bandIdx];
 (b?.components || []).forEach(c => {
 if (c !== selectedItem && c.name !== selectedItem.name) siblingComps.push(c);
 });
 } else if (activePage?.type === 'dialog') {
 (activePage.data.controls || []).forEach(c => {
 if (c !== selectedItem && c.name !== selectedItem.name) siblingComps.push(c);
 });
 }

 const onMouseMove = (moveEvt) => {
 const dx = Math.round((moveEvt.clientX - startX) / currentZoom);
 const dy = Math.round((moveEvt.clientY - startY) / currentZoom);
 const snapStep = (gridSnapStep && gridSnapStep > 1) ? gridSnapStep : 1;

 if (isDragging) {
 if (isMultiDrag) {
   multiStartPos.forEach(p => {
     const rawL = p.left + dx;
     const rawT = p.top + dy;
     p.comp.left = Math.max(0, snapStep > 1 ? Math.round(rawL / snapStep) * snapStep : rawL);
     p.comp.top = Math.max(0, snapStep > 1 ? Math.round(rawT / snapStep) * snapStep : rawT);
     if (p.el) {
       p.el.style.left = `${p.comp.left}px`;
       p.el.style.top = `${p.comp.top}px`;
     }
   });
   updateRulerTracker(selectedItem.left, selectedItem.width, selectedItem.top, selectedItem.height);
 } else {
 let targetLeft = startLeft + dx;
 let targetTop = startTop + dy;
 const curW = selectedItem.width || 100;
 const curH = selectedItem.height || 30;

 let snappedLeft = Math.max(0, snapStep > 1 ? Math.round(targetLeft / snapStep) * snapStep : targetLeft);
 let snappedTop = Math.max(0, snapStep > 1 ? Math.round(targetTop / snapStep) * snapStep : targetTop);
 let activeGuideX = null;
 let activeGuideY = null;
 const SNAP_THRESH = 6;

 if (siblingComps.length > 0) {
 for (const sib of siblingComps) {
 const sLeft = sib.left || 0;
 const sTop = sib.top || 0;
 const sW = sib.width || 100;
 const sH = sib.height || 30;

 if (activeGuideX === null) {
 if (Math.abs(targetLeft - sLeft) <= SNAP_THRESH) {
 snappedLeft = sLeft;
 activeGuideX = sLeft;
 } else if (Math.abs((targetLeft + curW) - (sLeft + sW)) <= SNAP_THRESH) {
 snappedLeft = sLeft + sW - curW;
 activeGuideX = sLeft + sW;
 } else if (Math.abs((targetLeft + curW / 2) - (sLeft + sW / 2)) <= SNAP_THRESH) {
 snappedLeft = Math.round(sLeft + sW / 2 - curW / 2);
 activeGuideX = Math.round(sLeft + sW / 2);
 } else if (Math.abs(targetLeft - (sLeft + sW)) <= SNAP_THRESH) {
 snappedLeft = sLeft + sW;
 activeGuideX = sLeft + sW;
 } else if (Math.abs((targetLeft + curW) - sLeft) <= SNAP_THRESH) {
 snappedLeft = sLeft - curW;
 activeGuideX = sLeft;
 }
 }

 if (activeGuideY === null) {
 if (Math.abs(targetTop - sTop) <= SNAP_THRESH) {
 snappedTop = sTop;
 activeGuideY = sTop;
 } else if (Math.abs((targetTop + curH) - (sTop + sH)) <= SNAP_THRESH) {
 snappedTop = sTop + sH - curH;
 activeGuideY = sTop + sH;
 } else if (Math.abs((targetTop + curH / 2) - (sTop + sH / 2)) <= SNAP_THRESH) {
 snappedTop = Math.round(sTop + sH / 2 - curH / 2);
 activeGuideY = Math.round(sTop + sH / 2);
 } else if (Math.abs(targetTop - (sTop + sH)) <= SNAP_THRESH) {
 snappedTop = sTop + sH;
 activeGuideY = sTop + sH;
 } else if (Math.abs((targetTop + curH) - sTop) <= SNAP_THRESH) {
 snappedTop = sTop - curH;
 activeGuideY = sTop;
 }
 }
 }
 }

 selectedItem.left = Math.max(0, snappedLeft);
 selectedItem.top = Math.max(0, snappedTop);
 el.style.left = `${selectedItem.left}px`;
 el.style.top = `${selectedItem.top}px`;

 renderSmartGuides(activeGuideX, activeGuideY);
 updateRulerTracker(selectedItem.left, selectedItem.width, selectedItem.top, selectedItem.height);
 }
 } else if (isResizing) {
 const rSnap = (gridSnapStep && gridSnapStep > 1) ? gridSnapStep : 2;
 if (handleType.includes('e')) selectedItem.width = Math.max(12, Math.round((startWidth + dx) / rSnap) * rSnap);
 if (handleType.includes('s')) selectedItem.height = Math.max(8, Math.round((startHeight + dy) / rSnap) * rSnap);
 if (handleType.includes('w')) {
 const newW = Math.max(12, Math.round((startWidth - dx) / rSnap) * rSnap);
 selectedItem.left = Math.max(0, startLeft + (startWidth - newW));
 selectedItem.width = newW;
 el.style.left = `${selectedItem.left}px`;
 }
 if (handleType.includes('n')) {
 const newH = Math.max(8, Math.round((startHeight - dy) / rSnap) * rSnap);
 selectedItem.top = Math.max(0, startTop + (startHeight - newH));
 selectedItem.height = newH;
 el.style.top = `${selectedItem.top}px`;
 }
 el.style.width = `${selectedItem.width}px`;
 el.style.height = `${selectedItem.height}px`;
 updateRulerTracker(selectedItem.left, selectedItem.width, selectedItem.top, selectedItem.height);
 }

 // Canlı HUD ve Status Bar Güncellemesi
 if (hud) {
 hud.style.left = `${moveEvt.clientX}px`;
 hud.style.top = `${moveEvt.clientY}px`;
 hud.textContent = isDragging 
 ? `X: ${selectedItem.left} Y: ${selectedItem.top}` 
 : `W: ${selectedItem.width} H: ${selectedItem.height} (${selectedItem.left}, ${selectedItem.top})`;
 }

 const statusCoords = containerEl.querySelector('#statusCoords');
 const statusDims = containerEl.querySelector('#statusDims');
 if (statusCoords) statusCoords.innerHTML = `<span>X: ${selectedItem.left}, Y: ${selectedItem.top}</span>`;
 if (statusDims) statusDims.innerHTML = `<span>W: ${selectedItem.width}, H: ${selectedItem.height}</span>`;
 };

 const onMouseUp = () => {
 el.classList.remove('is-dragging');
 document.body.style.userSelect = '';
 document.body.style.webkitUserSelect = '';
 document.body.style.cursor = '';
 if (hud) hud.style.display = 'none';
 clearSmartGuides();
 updateRulerTracker(selectedItem.left, selectedItem.width, selectedItem.top, selectedItem.height);
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
 isDesignEditing = true;
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
 if (window._isReportLockedByOther) {
   if (window.FrpNotify) window.FrpNotify.warning(`Bu rapor şu anda ${window._reportLockHolderName || 'başka bir kullanıcı'} tarafından düzenleniyor. Tasarım düzenleme kilitlidir.`);
   return;
 }
 isDesignEditing = true;
 initialPagesBackup = JSON.parse(JSON.stringify(allPages.map(p => p.data)));
 undoStack = [JSON.stringify(allPages.map(p => p.data))];
 redoStack = [];
 render();
 if (window.FrpNotify) window.FrpNotify.info('Tasarım düzenleme modu aktif. Değişiklikleri yaptıktan sonra "Tasarımı Kaydet" butonuna basınız.');
 });

 containerEl.querySelector('#btnSaveDesignEdit')?.addEventListener('click', () => {
 if (!isDesignEditing) return;
 if (window._isReportLockedByOther) {
   if (window.FrpNotify) window.FrpNotify.warning(`Bu rapor şu anda ${window._reportLockHolderName || 'başka bir kullanıcı'} tarafından düzenleniyor. Değişiklikler kaydedilemez.`);
   return;
 }
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
 containerEl.querySelector('#btnToolAddSysMemo')?.addEventListener('click', () => addNewComponent('sysmemo'));
 containerEl.querySelector('#btnToolAddGradient')?.addEventListener('click', () => addNewComponent('gradient'));
 containerEl.querySelector('#btnToolAddSubreport')?.addEventListener('click', () => addNewComponent('subreport'));
 containerEl.querySelector('#btnToolAddCrosstab')?.addEventListener('click', () => addNewComponent('crosstab'));
 containerEl.querySelector('#btnToolAddPicture')?.addEventListener('click', () => addNewComponent('picture'));
 containerEl.querySelector('#btnToolAddLine')?.addEventListener('click', () => addNewComponent('line'));
 containerEl.querySelector('#btnToolAddBarcode')?.addEventListener('click', () => addNewComponent('barcode'));
 containerEl.querySelector('#btnToolAddQRCode')?.addEventListener('click', () => addNewComponent('qrcode'));
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
 containerEl.querySelector('#btnDuplicateSelected')?.addEventListener('click', duplicateSelected);
 containerEl.querySelector('#btnBringToFront')?.addEventListener('click', () => changeZOrder('front'));
 containerEl.querySelector('#btnSendToBack')?.addEventListener('click', () => changeZOrder('back'));
 containerEl.querySelector('#btnMultiDuplicate')?.addEventListener('click', duplicateSelected);
 containerEl.querySelector('#btnMultiFront')?.addEventListener('click', () => changeZOrder('front'));
 containerEl.querySelector('#btnMultiBack')?.addEventListener('click', () => changeZOrder('back'));
 containerEl.querySelector('#btnToggleGridSnap')?.addEventListener('click', () => {
   gridSnapStep = gridSnapStep === 0 ? 4 : (gridSnapStep === 4 ? 8 : (gridSnapStep === 8 ? 12 : 0));
   const btn = containerEl.querySelector('#btnToggleGridSnap');
   if (btn) {
     btn.textContent = `🧲 Izgara: ${gridSnapStep > 1 ? gridSnapStep + 'px' : 'Kapalı'}`;
     btn.classList.toggle('active', gridSnapStep > 1);
   }
   if (window.FrpNotify) window.FrpNotify.info(`Manyetik ızgara: ${gridSnapStep > 1 ? gridSnapStep + 'px adımı aktif' : 'Kapalı'}`);
 });

 // Multi-Align Araç Çubuğu Butonları
 containerEl.querySelector('#btnAlignLeft')?.addEventListener('click', () => alignSelected('left'));
 containerEl.querySelector('#btnAlignCenter')?.addEventListener('click', () => alignSelected('center'));
 containerEl.querySelector('#btnAlignRight')?.addEventListener('click', () => alignSelected('right'));
 containerEl.querySelector('#btnAlignTop')?.addEventListener('click', () => alignSelected('top'));
 containerEl.querySelector('#btnAlignMiddle')?.addEventListener('click', () => alignSelected('middle'));
 containerEl.querySelector('#btnAlignBottom')?.addEventListener('click', () => alignSelected('bottom'));
 containerEl.querySelector('#btnDistributeH')?.addEventListener('click', () => alignSelected('distributeH'));
 containerEl.querySelector('#btnDistributeV')?.addEventListener('click', () => alignSelected('distributeV'));
 containerEl.querySelector('#btnDeleteMulti')?.addEventListener('click', () => deleteMultiSelected());

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

 containerEl.querySelector('#btnToggleRulers')?.addEventListener('click', () => {
 showRulers = !showRulers;
 render();
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
 containerEl.querySelector('#btnTabInspector')?.classList.remove('btn-primary');
 containerEl.querySelector('#btnTabDataTree')?.classList.remove('btn-primary');
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

 const onInspectorMove = e => {
 if (!isResizing) return;
 const dx = startX - e.clientX;
 const newW = Math.max(220, Math.min(650, startW + dx));
 inspectorWidth = newW;
 insp.style.width = newW + 'px';
 };

 const stopInspectorResize = () => {
 if (!isResizing) return;
 isResizing = false;
 document.body.style.cursor = '';
 document.body.style.userSelect = '';
 localStorage.setItem('frp_inspector_width', inspectorWidth);
 window.removeEventListener('mousemove', onInspectorMove);
 window.removeEventListener('mouseup', stopInspectorResize);
 };

 resizer.addEventListener('mousedown', e => {
 isResizing = true;
 startX = e.clientX;
 startW = insp.offsetWidth;
 document.body.style.cursor = 'ew-resize';
 document.body.style.userSelect = 'none';
 window.addEventListener('mousemove', onInspectorMove);
 window.addEventListener('mouseup', stopInspectorResize);
 e.preventDefault();
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
 selectedItems = [];
 updateSelection();
 }
 });

 // 11. Klavye Kısayolları (Ctrl+Z, Ctrl+Y, Ctrl+D, Delete, Yön Tuşları ile İnce Kaydırma)
 window.addEventListener('keydown', (e) => {
 if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
 if (currentMode !== 'designer') return;
 
 if (isDesignEditing) {
 if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
 e.preventDefault();
 undo();
 } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
 e.preventDefault();
 redo();
 } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
 e.preventDefault();
 duplicateSelected();
 } else if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedItem || (selectedItems && selectedItems.length > 0))) {
 e.preventDefault();
 deleteSelectedComponent();
 } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
   const targets = (selectedItems && selectedItems.length > 0) ? selectedItems : (selectedItem ? [selectedItem] : []);
   if (targets.length > 0) {
     e.preventDefault();
     const step = e.shiftKey ? 8 : ((gridSnapStep && gridSnapStep > 1) ? gridSnapStep : 1);
     targets.forEach(c => {
       if (e.key === 'ArrowUp') c.top = Math.max(0, (c.top || 0) - step);
       if (e.key === 'ArrowDown') c.top = Math.max(0, (c.top || 0) + step);
       if (e.key === 'ArrowLeft') c.left = Math.max(0, (c.left || 0) - step);
       if (e.key === 'ArrowRight') c.left = Math.max(0, (c.left || 0) + step);
       const domEl = (c.name ? containerEl.querySelector(`[data-comp-name="${c.name}"]`) : null);
       if (domEl) {
         domEl.style.left = `${c.left}px`;
         domEl.style.top = `${c.top}px`;
       }
     });
     if (selectedItem) {
       updateRulerTracker(selectedItem.left, selectedItem.width, selectedItem.top, selectedItem.height);
     }
     const statusCoords = containerEl.querySelector('#statusCoords');
     if (statusCoords && selectedItem) {
       statusCoords.innerHTML = `<span>X: ${selectedItem.left}, Y: ${selectedItem.top}</span>`;
     }
     pushUndoState();
   }
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
  containerEl.querySelectorAll('.fr-resize-handle').forEach(h => h.remove());
  el.classList.remove('selected', 'selected-band');
 });
 
 if (selectedItems && selectedItems.length > 0) {
   selectedItems.forEach(item => {
     const targetEl = (item.name ? containerEl.querySelector(`[data-comp-name="${item.name}"]`) : null) ||
                      containerEl.querySelector(`[title*="${item.name}"]`);
     if (targetEl) {
       targetEl.classList.add('selected');
     }
   });
   if (selectedItems.length === 1 && currentMode === 'designer') {
     const item = selectedItems[0];
     const targetEl = (item.name ? containerEl.querySelector(`[data-comp-name="${item.name}"]`) : null) ||
                      containerEl.querySelector(`[title*="${item.name}"]`);
     if (targetEl) {
       ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
         const h = document.createElement('div');
         h.className = `fr-resize-handle fr-resize-${pos}`;
         h.dataset.handle = pos;
         targetEl.appendChild(h);
       });
     }
   }
 } else if (selectedItem) {
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
 const targetEl = (selectedItem.name ? containerEl.querySelector(`[data-comp-name="${selectedItem.name}"]`) : null) ||
 containerEl.querySelector(`[title*="${selectedItem.name}"]`) ||
 containerEl.querySelector(`[data-ctrl-idx]`);
 if (targetEl) {
   targetEl.classList.add('selected');
   ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
     const h = document.createElement('div');
     h.className = `fr-resize-handle fr-resize-${pos}`;
     h.dataset.handle = pos;
     targetEl.appendChild(h);
   });
 }
 }
 }

 const alignBar = containerEl.querySelector('#frMultiAlignBar');
 const alignBadge = containerEl.querySelector('#frAlignBadge');
 if (alignBar) {
   if (selectedItems && selectedItems.length > 1 && currentMode === 'designer' && isDesignEditing) {
     alignBar.style.display = 'flex';
     if (alignBadge) alignBadge.textContent = `${selectedItems.length} Seçili`;
   } else {
     alignBar.style.display = 'none';
   }
 }

 const compTypeBadge = containerEl.querySelector('#inspectorCompType');
 if (compTypeBadge) {
   if (selectedItems && selectedItems.length > 1) {
     compTypeBadge.textContent = `${selectedItems.length} Bileşen (Çoklu Seçim)`;
   } else {
     compTypeBadge.textContent = selectedItem? (selectedItem.type || selectedItem.name || 'TfrxComponent'): 'TfrxPage';
   }
 }

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
 updateRulerTracker(selectedItem?.left, selectedItem?.width, selectedItem?.top, selectedItem?.height);
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
 decodeColor: decodeDelphiColor,
 switchDialogTab: window.switchDialogTab,
 copyDataTreeField: window.copyDataTreeField
 };

})(window);
