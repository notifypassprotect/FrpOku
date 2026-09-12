/**
 * image_annotator.js — Gelişmiş Görsel Çizim, İşaretleme & Paint Editörü
 */
(function() {
  'use strict';

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function openImageAnnotator({ imageUrl, imageName = 'Görsel', onSave }) {
    const existing = document.getElementById('frpAnnotatorOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'frpAnnotatorOverlay';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px);
      z-index: 100010; display: flex; align-items: center; justify-content: center; padding: 0.75rem;
    `;

    overlay.innerHTML = `
      <div style="background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 18px; width: 96vw; max-width: 1280px; height: 92vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.5);">
        
        <!-- 1. ÜST BAŞLIK BARI -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 1.25rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc);">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(99,102,241,0.15)); color: var(--accent, #2563eb); display: flex; align-items: center; justify-content: center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <div>
              <div style="font-size: 0.96rem; font-weight: 800; color: var(--text-primary, #0f172a); display: flex; align-items: center; gap: 0.45rem;">
                <span>Görsel Paint & İşaretleme Editörü</span>
                <span id="annotatorImgDimensions" style="font-size: 0.72rem; color: var(--text-muted, #64748b); background: var(--bg-surface, #fff); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border-light, #e2e8f0);">Yükleniyor...</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted, #64748b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px;">${escHtml(imageName)}</div>
            </div>
          </div>

          <!-- Yakınlaştırma (Zoom) & Aksiyon Butonları -->
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <!-- Zoom Araçları -->
            <div style="display: flex; align-items: center; background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 8px; padding: 0.15rem 0.35rem; gap: 0.2rem;">
              <button type="button" id="btnZoomOut" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.45rem; font-size: 0.85rem;" title="Uzaklaştır">➖</button>
              <span id="annotatorZoomBadge" style="font-size: 0.75rem; font-weight: 800; min-width: 42px; text-align: center; color: var(--text-primary, #0f172a);">%100</span>
              <button type="button" id="btnZoomIn" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.45rem; font-size: 0.85rem;" title="Yakınlaştır">➕</button>
              <button type="button" id="btnZoom100" class="btn btn-sm btn-ghost" style="font-size: 0.72rem; padding: 0.2rem 0.45rem; font-weight: 700;" title="Gerçek Boyut (%100)">1:1</button>
              <button type="button" id="btnZoomFit" class="btn btn-sm btn-ghost" style="font-size: 0.72rem; padding: 0.2rem 0.45rem; font-weight: 700;" title="Ekrana Sığdır">Sığdır</button>
            </div>

            <button type="button" id="annotatorBtnDownload" class="btn btn-sm btn-secondary" style="font-size: 0.78rem; font-weight: 700;" title="Görseli İndir">⬇️ İndir</button>
            <button type="button" id="annotatorBtnCancel" class="btn btn-sm btn-ghost" style="font-size: 0.78rem;">Vazgeç</button>
            <button type="button" id="annotatorBtnSave" class="btn btn-sm btn-primary" style="font-size: 0.82rem; font-weight: 800; background: #10b981; border-color: #10b981; padding: 0.4rem 1.1rem;">Kaydet & Güncelle</button>
          </div>
        </div>

        <!-- 2. PROFESYONEL PAINT ARAÇ ÇUBUĞU (TOOLBAR) -->
        <div style="display: flex; align-items: center; gap: 0.65rem; padding: 0.5rem 1.25rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-surface, #ffffff); flex-wrap: wrap; font-size: 0.8rem;">
          
          <!-- Çizim & Şekil Araçları -->
          <div style="display: flex; align-items: center; gap: 0.25rem; background: var(--bg-card, #f8fafc); padding: 0.2rem 0.35rem; border-radius: 8px; border: 1px solid var(--border, #cbd5e1);">
            <button type="button" id="toolPan" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; font-weight: 700;" title="Kaydırma / El Aracı">✋ El</button>
            <button type="button" id="toolPen" class="btn btn-sm annotator-tool-btn active" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; font-weight: 700;" title="Serbest Çizim Kalemi">✏️ Kalem</button>
            <button type="button" id="toolHighlighter" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; font-weight: 700;" title="Fosforlu Vurgu">🖍️ Vurgu</button>
            <button type="button" id="toolLine" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; font-weight: 700;" title="Düz Çizgi">📏 Çizgi</button>
            <button type="button" id="toolArrow" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; font-weight: 700;" title="Yön Oku">➡️ Ok</button>
            <button type="button" id="toolCircle" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; font-weight: 700;" title="Çember / Daire">⭕ Daire</button>
            <button type="button" id="toolRect" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; font-weight: 700;" title="Dikdörtgen Kutu">⬛ Kutu</button>
            <button type="button" id="toolFilledRect" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; font-weight: 700;" title="Dolu Dikdörtgen">🟩 Dolu Kutu</button>
            <button type="button" id="toolText" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; font-weight: 700;" title="Yazı / Metin Ekle">🔤 Metin</button>
            <button type="button" id="toolEraser" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.5rem; font-size: 0.76rem; font-weight: 700;" title="Silgi (İşaretlemeleri Temizle)">🧽 Silgi</button>
          </div>

          <div style="width: 1px; height: 20px; background: var(--border-light, #e2e8f0);"></div>

          <!-- Renk Paleti -->
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <button type="button" class="annotator-color-dot active" data-color="#ef4444" style="background: #ef4444; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 2px var(--accent, #2563eb); cursor: pointer;" title="Kırmızı"></button>
            <button type="button" class="annotator-color-dot" data-color="#f59e0b" style="background: #f59e0b; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Turuncu"></button>
            <button type="button" class="annotator-color-dot" data-color="#10b981" style="background: #10b981; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Yeşil"></button>
            <button type="button" class="annotator-color-dot" data-color="#2563eb" style="background: #2563eb; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Mavi"></button>
            <button type="button" class="annotator-color-dot" data-color="#8b5cf6" style="background: #8b5cf6; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Mor"></button>
            <button type="button" class="annotator-color-dot" data-color="#0f172a" style="background: #0f172a; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Siyah"></button>
            <button type="button" class="annotator-color-dot" data-color="#ffffff" style="background: #ffffff; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #cbd5e1; cursor: pointer;" title="Beyaz"></button>
            <label style="display: flex; align-items: center; margin-left: 2px; cursor: pointer;" title="Özel Renk Seç">
              <input type="color" id="annotatorCustomColor" value="#ef4444" style="width: 24px; height: 24px; padding: 0; border: none; background: none; cursor: pointer;" />
            </label>
          </div>

          <div style="width: 1px; height: 20px; background: var(--border-light, #e2e8f0);"></div>

          <!-- Çizgi / Fırça Kalınlığı -->
          <div style="display: flex; align-items: center; gap: 0.25rem;">
            <button type="button" class="annotator-size-btn" data-size="2" style="padding: 0.2rem 0.45rem; font-size: 0.74rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); cursor: pointer;">2px</button>
            <button type="button" class="annotator-size-btn" data-size="4" style="padding: 0.2rem 0.45rem; font-size: 0.74rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); cursor: pointer;">4px</button>
            <button type="button" class="annotator-size-btn active" data-size="8" style="padding: 0.2rem 0.45rem; font-size: 0.74rem; border: 1px solid var(--accent, #2563eb); border-radius: 6px; background: var(--accent, #2563eb); color: #fff; font-weight: 700; cursor: pointer;">8px</button>
            <button type="button" class="annotator-size-btn" data-size="14" style="padding: 0.2rem 0.45rem; font-size: 0.74rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); cursor: pointer;">14px</button>
            <button type="button" class="annotator-size-btn" data-size="24" style="padding: 0.2rem 0.45rem; font-size: 0.74rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); cursor: pointer;">24px</button>
          </div>

          <!-- Geri / İleri & Temizleme -->
          <div style="margin-left: auto; display: flex; align-items: center; gap: 0.35rem;">
            <button type="button" id="annotatorBtnUndo" class="btn btn-sm btn-ghost" style="font-size: 0.76rem;" title="Geri Al (Ctrl+Z)">↩️ Geri</button>
            <button type="button" id="annotatorBtnRedo" class="btn btn-sm btn-ghost" style="font-size: 0.76rem;" title="Yinele (Ctrl+Y)">↪️ İleri</button>
            <button type="button" id="annotatorBtnClear" class="btn btn-sm btn-ghost" style="color: #ef4444; font-size: 0.76rem;" title="Tüm Çizimleri Temizle">🗑️ Temizle</button>
          </div>
        </div>

        <!-- 3. TUVAL (CANVAS) ÇALIŞMA ALANI & PAN GÖRÜNÜMÜ -->
        <div id="annotatorViewport" style="flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; background: #0f172a; position: relative; padding: 2rem; user-select: none;">
          <div id="annotatorCanvasWrapper" style="position: relative; display: inline-block; box-shadow: 0 20px 50px rgba(0,0,0,0.6); border-radius: 6px; overflow: hidden; background: #ffffff;">
            <canvas id="annotatorCanvas" style="display: block; cursor: crosshair;"></canvas>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('#annotatorCanvas');
    const ctx = canvas.getContext('2d');
    const viewport = overlay.querySelector('#annotatorViewport');
    const canvasWrapper = overlay.querySelector('#annotatorCanvasWrapper');
    const zoomBadge = overlay.querySelector('#annotatorZoomBadge');
    const dimBadge = overlay.querySelector('#annotatorImgDimensions');

    let currentTool = 'pen'; // pan, pen, highlighter, line, arrow, circle, rect, filledRect, text, eraser
    let currentColor = '#ef4444';
    let currentLineWidth = 8;
    let zoomLevel = 1.0;

    let isDrawing = false;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let startX = 0;
    let startY = 0;

    const undoHistory = [];
    const redoHistory = [];
    let baseImageSnapshot = null;

    // Resim yükleme
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth || img.width || 800;
      canvas.height = img.naturalHeight || img.height || 600;
      ctx.drawImage(img, 0, 0);

      dimBadge.textContent = `${canvas.width} × ${canvas.height} px`;
      baseImageSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      saveState();
      fitToViewport();
    };
    img.onerror = () => {
      dimBadge.textContent = 'Görsel yüklenemedi';
      dimBadge.style.color = '#ef4444';
      canvas.width = 800;
      canvas.height = 600;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Görsel yüklenirken bir sorun oluştu.', 50, 300);
      saveState();
    };
    img.src = imageUrl;

    function fitToViewport() {
      if (!canvas.width || !canvas.height) return;
      const vpWidth = viewport.clientWidth - 80;
      const vpHeight = viewport.clientHeight - 80;
      const scaleX = vpWidth / canvas.width;
      const scaleY = vpHeight / canvas.height;
      const fitZoom = Math.min(1.0, Math.min(scaleX, scaleY));
      setZoom(Math.max(0.2, fitZoom));
    }

    function setZoom(zoom) {
      zoomLevel = Math.max(0.15, Math.min(4.0, zoom));
      canvasWrapper.style.transform = `scale(${zoomLevel})`;
      canvasWrapper.style.transformOrigin = 'center center';
      zoomBadge.textContent = `%${Math.round(zoomLevel * 100)}`;
    }

    // Zoom Butonları
    overlay.querySelector('#btnZoomIn').addEventListener('click', () => setZoom(zoomLevel + 0.2));
    overlay.querySelector('#btnZoomOut').addEventListener('click', () => setZoom(zoomLevel - 0.2));
    overlay.querySelector('#btnZoom100').addEventListener('click', () => setZoom(1.0));
    overlay.querySelector('#btnZoomFit').addEventListener('click', fitToViewport);

    // Ctrl + MouseWheel ile Yakınlaştırma
    viewport.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        setZoom(zoomLevel + delta);
      }
    }, { passive: false });

    function saveState() {
      undoHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (undoHistory.length > 30) undoHistory.shift();
      redoHistory.length = 0; // yeni çizim yapıldığında redo temizlenir
    }

    function undo() {
      if (undoHistory.length > 1) {
        const current = undoHistory.pop();
        redoHistory.push(current);
        const prev = undoHistory[undoHistory.length - 1];
        ctx.putImageData(prev, 0, 0);
      }
    }

    function redo() {
      if (redoHistory.length > 0) {
        const next = redoHistory.pop();
        undoHistory.push(next);
        ctx.putImageData(next, 0, 0);
      }
    }

    function clearAll() {
      if (baseImageSnapshot) {
        ctx.putImageData(baseImageSnapshot, 0, 0);
        saveState();
      }
    }

    // Koordinat hesaplama (CSS zoom ölçeği hesaba katılır)
    function getCanvasCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    function drawArrow(context, fromx, fromy, tox, toy, width) {
      const headlen = Math.max(16, width * 2.8);
      const dx = tox - fromx;
      const dy = toy - fromy;
      const angle = Math.atan2(dy, dx);
      context.beginPath();
      context.moveTo(fromx, fromy);
      context.lineTo(tox, toy);
      context.stroke();

      context.beginPath();
      context.moveTo(tox, toy);
      context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
      context.moveTo(tox, toy);
      context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
      context.stroke();
    }

    // Fare Olayları
    canvas.addEventListener('mousedown', (e) => {
      if (currentTool === 'pan') {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        viewport.style.cursor = 'grabbing';
        return;
      }

      if (currentTool === 'text') {
        const pos = getCanvasCoords(e);
        const text = prompt('Görsele eklenecek metni giriniz:');
        if (text) {
          ctx.font = `bold ${Math.max(16, currentLineWidth * 3.5)}px sans-serif`;
          ctx.fillStyle = currentColor;
          ctx.fillText(text, pos.x, pos.y);
          saveState();
        }
        return;
      }

      isDrawing = true;
      const pos = getCanvasCoords(e);
      startX = pos.x;
      startY = pos.y;

      if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.strokeStyle = currentTool === 'eraser' ? '#ffffff' : currentColor;
        ctx.lineWidth = currentTool === 'eraser' ? currentLineWidth * 2 : currentLineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = currentTool === 'highlighter' ? 0.35 : 1.0;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isPanning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        viewport.scrollLeft -= dx;
        viewport.scrollTop -= dy;
        panStartX = e.clientX;
        panStartY = e.clientY;
        return;
      }

      if (!isDrawing) return;
      const pos = getCanvasCoords(e);

      if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else {
        // Canlı önizleme
        if (undoHistory.length > 0) {
          ctx.putImageData(undoHistory[undoHistory.length - 1], 0, 0);
        }
        ctx.beginPath();
        ctx.strokeStyle = currentColor;
        ctx.fillStyle = currentColor;
        ctx.lineWidth = currentLineWidth;
        ctx.globalAlpha = 1.0;

        if (currentTool === 'line') {
          ctx.moveTo(startX, startY);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        } else if (currentTool === 'arrow') {
          drawArrow(ctx, startX, startY, pos.x, pos.y, currentLineWidth);
        } else if (currentTool === 'circle') {
          const rx = Math.abs(pos.x - startX) / 2;
          const ry = Math.abs(pos.y - startY) / 2;
          const cx = Math.min(startX, pos.x) + rx;
          const cy = Math.min(startY, pos.y) + ry;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (currentTool === 'rect') {
          ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
        } else if (currentTool === 'filledRect') {
          ctx.globalAlpha = 0.55;
          ctx.fillRect(startX, startY, pos.x - startX, pos.y - startY);
          ctx.globalAlpha = 1.0;
          ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        viewport.style.cursor = 'auto';
      }
      if (isDrawing) {
        isDrawing = false;
        ctx.globalAlpha = 1.0;
        saveState();
      }
    });

    // Araç butonları
    const toolButtons = overlay.querySelectorAll('.annotator-tool-btn');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        toolButtons.forEach(b => {
          b.classList.remove('active');
          b.style.background = '';
          b.style.color = '';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--accent, #2563eb)';
        btn.style.color = '#ffffff';

        if (btn.id === 'toolPan') {
          currentTool = 'pan';
          canvas.style.cursor = 'grab';
        } else if (btn.id === 'toolPen') {
          currentTool = 'pen';
          canvas.style.cursor = 'crosshair';
        } else if (btn.id === 'toolHighlighter') {
          currentTool = 'highlighter';
          canvas.style.cursor = 'crosshair';
        } else if (btn.id === 'toolLine') {
          currentTool = 'line';
          canvas.style.cursor = 'crosshair';
        } else if (btn.id === 'toolArrow') {
          currentTool = 'arrow';
          canvas.style.cursor = 'crosshair';
        } else if (btn.id === 'toolCircle') {
          currentTool = 'circle';
          canvas.style.cursor = 'crosshair';
        } else if (btn.id === 'toolRect') {
          currentTool = 'rect';
          canvas.style.cursor = 'crosshair';
        } else if (btn.id === 'toolFilledRect') {
          currentTool = 'filledRect';
          canvas.style.cursor = 'crosshair';
        } else if (btn.id === 'toolText') {
          currentTool = 'text';
          canvas.style.cursor = 'text';
        } else if (btn.id === 'toolEraser') {
          currentTool = 'eraser';
          canvas.style.cursor = 'cell';
        }
      });
    });

    // Renk butonları
    const colorDots = overlay.querySelectorAll('.annotator-color-dot');
    colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        colorDots.forEach(d => d.style.boxShadow = '0 0 0 1px #cbd5e1');
        dot.style.boxShadow = '0 0 0 2px var(--accent, #2563eb)';
        currentColor = dot.dataset.color;
        const picker = overlay.querySelector('#annotatorCustomColor');
        if (picker) picker.value = currentColor;
      });
    });

    const customColorInput = overlay.querySelector('#annotatorCustomColor');
    if (customColorInput) {
      customColorInput.addEventListener('input', (e) => {
        currentColor = e.target.value;
        colorDots.forEach(d => d.style.boxShadow = '0 0 0 1px #cbd5e1');
      });
    }

    // Boyut butonları
    const sizeButtons = overlay.querySelectorAll('.annotator-size-btn');
    sizeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeButtons.forEach(b => {
          b.classList.remove('active');
          b.style.background = 'var(--bg-surface)';
          b.style.color = 'inherit';
          b.style.borderColor = 'var(--border)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--accent, #2563eb)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--accent, #2563eb)';
        currentLineWidth = parseInt(btn.dataset.size, 10) || 8;
      });
    });

    overlay.querySelector('#annotatorBtnUndo').addEventListener('click', undo);
    overlay.querySelector('#annotatorBtnRedo').addEventListener('click', redo);
    overlay.querySelector('#annotatorBtnClear').addEventListener('click', clearAll);

    // Kapatma
    const close = () => overlay.remove();
    overlay.querySelector('#annotatorBtnCancel').addEventListener('click', close);

    // İndirme
    overlay.querySelector('#annotatorBtnDownload').addEventListener('click', () => {
      const a = document.createElement('a');
      a.download = (imageName.replace(/\.[^/.]+$/, '')) + '_isaretli.png';
      a.href = canvas.toDataURL('image/png');
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    // Kaydetme
    overlay.querySelector('#annotatorBtnSave').addEventListener('click', () => {
      const dataUrl = canvas.toDataURL('image/png');
      if (typeof onSave === 'function') {
        onSave(dataUrl);
      }
      close();
    });
  }

  window.openImageAnnotator = openImageAnnotator;
})();
