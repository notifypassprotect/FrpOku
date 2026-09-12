/**
 * image_annotator.js — Gelişmiş Görsel Çizim, İşaretleme & Paint Pro Editörü
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
      <div style="background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 18px; width: 97vw; max-width: 1340px; height: 93vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.5);">
        
        <!-- 1. ÜST BAŞLIK BARI -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 1.25rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc);">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 34px; height: 34px; border-radius: 9px; background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(99,102,241,0.15)); color: var(--accent, #2563eb); display: flex; align-items: center; justify-content: center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <div>
              <div style="font-size: 0.96rem; font-weight: 800; color: var(--text-primary, #0f172a); display: flex; align-items: center; gap: 0.45rem;">
                <span>Görsel Paint Pro & İşaretleme Editörü</span>
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
        <div style="display: flex; align-items: center; gap: 0.55rem; padding: 0.5rem 1.1rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-surface, #ffffff); flex-wrap: wrap; font-size: 0.8rem;">
          
          <!-- Çizim, İşaretleme & Şekil Araçları -->
          <div style="display: flex; align-items: center; gap: 0.2rem; background: var(--bg-card, #f8fafc); padding: 0.2rem 0.35rem; border-radius: 8px; border: 1px solid var(--border, #cbd5e1);">
            <button type="button" id="toolPan" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Kaydırma / El Aracı">✋ El</button>
            <button type="button" id="toolPen" class="btn btn-sm annotator-tool-btn active" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Serbest Çizim Kalemi">✏️ Kalem</button>
            <button type="button" id="toolHighlighter" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Fosforlu Vurgu">🖍️ Vurgu</button>
            <button type="button" id="toolLine" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Düz Çizgi">📏 Çizgi</button>
            <button type="button" id="toolArrow" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Yön Oku">➡️ Ok</button>
            <button type="button" id="toolDoubleArrow" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Çift Yönlü Ok">↔️ Çift Ok</button>
            <button type="button" id="toolCircle" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Çember / Daire">⭕ Daire</button>
            <button type="button" id="toolRect" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Dikdörtgen Kutu">⬛ Kutu</button>
            <button type="button" id="toolFilledRect" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Dolu Dikdörtgen">🟩 Dolu Kutu</button>
            <button type="button" id="toolStar" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Yıldız">⭐ Yıldız</button>
            <button type="button" id="toolCallout" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Konuşma Balonu">💬 Balon</button>
            <button type="button" id="toolText" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Yazı / Metin Ekle">🔤 Metin</button>
            <button type="button" id="toolStep" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700; color: #2563eb;" title="Adım Rozeti Ekle (1, 2, 3...)">🔢 Adım <span id="annotatorStepNum">①</span></button>
            <button type="button" id="toolMosaic" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700; color: #7c3aed;" title="Hassas Bilgileri Sansürle (Mozaik / Blur)">🔲 Sansür</button>
            <button type="button" id="toolCrop" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700; color: #ea580c;" title="Alanı Seçip Kırp">✂️ Kırp</button>
            <button type="button" id="toolEraser" class="btn btn-sm annotator-tool-btn" style="padding: 0.25rem 0.45rem; font-size: 0.75rem; font-weight: 700;" title="Silgi">🧽 Silgi</button>
          </div>

          <div style="width: 1px; height: 20px; background: var(--border-light, #e2e8f0);"></div>

          <!-- Döndürme, Aynalama & Filtreler -->
          <div style="display: flex; align-items: center; gap: 0.2rem;">
            <button type="button" id="btnRotateRight" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.4rem;" title="90° Sağa Döndür">↷ 90°</button>
            <button type="button" id="btnRotateLeft" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.4rem;" title="90° Sola Döndür">↶ 90°</button>
            <button type="button" id="btnFlipH" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.4rem;" title="Yatay Aynala">🪞 Yatay</button>
            <button type="button" id="btnFlipV" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.4rem;" title="Dikey Aynala">🪞 Dikey</button>
            
            <select id="selFilter" style="padding: 0.25rem 0.45rem; font-size: 0.74rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-surface); cursor: pointer;" title="Görsel Filtresi">
              <option value="none">Filtre: Normal</option>
              <option value="brightness">✨ Aydınlık</option>
              <option value="contrast">🌓 Kontrast</option>
              <option value="grayscale">⬛ Siyah-Beyaz</option>
              <option value="invert">🔄 Negatif</option>
            </select>
          </div>

          <div style="width: 1px; height: 20px; background: var(--border-light, #e2e8f0);"></div>

          <!-- Renk Paleti -->
          <div style="display: flex; align-items: center; gap: 0.3rem;">
            <button type="button" class="annotator-color-dot active" data-color="#ef4444" style="background: #ef4444; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 2px var(--accent, #2563eb); cursor: pointer;" title="Kırmızı"></button>
            <button type="button" class="annotator-color-dot" data-color="#f59e0b" style="background: #f59e0b; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Turuncu"></button>
            <button type="button" class="annotator-color-dot" data-color="#10b981" style="background: #10b981; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Yeşil"></button>
            <button type="button" class="annotator-color-dot" data-color="#2563eb" style="background: #2563eb; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Mavi"></button>
            <button type="button" class="annotator-color-dot" data-color="#8b5cf6" style="background: #8b5cf6; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Mor"></button>
            <button type="button" class="annotator-color-dot" data-color="#0f172a" style="background: #0f172a; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Siyah"></button>
            <button type="button" class="annotator-color-dot" data-color="#ffffff" style="background: #ffffff; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #cbd5e1; cursor: pointer;" title="Beyaz"></button>
            <label style="display: flex; align-items: center; margin-left: 1px; cursor: pointer;" title="Özel Renk Seç">
              <input type="color" id="annotatorCustomColor" value="#ef4444" style="width: 22px; height: 22px; padding: 0; border: none; background: none; cursor: pointer;" />
            </label>
          </div>

          <div style="width: 1px; height: 20px; background: var(--border-light, #e2e8f0);"></div>

          <!-- Çizgi / Fırça Kalınlığı -->
          <div style="display: flex; align-items: center; gap: 0.2rem;">
            <button type="button" class="annotator-size-btn" data-size="2" style="padding: 0.2rem 0.4rem; font-size: 0.72rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); cursor: pointer;">2px</button>
            <button type="button" class="annotator-size-btn" data-size="4" style="padding: 0.2rem 0.4rem; font-size: 0.72rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); cursor: pointer;">4px</button>
            <button type="button" class="annotator-size-btn active" data-size="8" style="padding: 0.2rem 0.4rem; font-size: 0.72rem; border: 1px solid var(--accent, #2563eb); border-radius: 6px; background: var(--accent, #2563eb); color: #fff; font-weight: 700; cursor: pointer;">8px</button>
            <button type="button" class="annotator-size-btn" data-size="14" style="padding: 0.2rem 0.4rem; font-size: 0.72rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); cursor: pointer;">14px</button>
            <button type="button" class="annotator-size-btn" data-size="24" style="padding: 0.2rem 0.4rem; font-size: 0.72rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); cursor: pointer;">24px</button>
          </div>

          <!-- Geçmiş Butonları -->
          <div style="margin-left: auto; display: flex; align-items: center; gap: 0.25rem;">
            <button type="button" id="annotatorBtnUndo" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.45rem; font-size: 0.76rem;" title="Geri Al (Ctrl+Z)">↩️ Geri Al</button>
            <button type="button" id="annotatorBtnRedo" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.45rem; font-size: 0.76rem;" title="Yinele (Ctrl+Y)">↪️ Yinele</button>
            <button type="button" id="annotatorBtnClear" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.45rem; font-size: 0.76rem; color: #ef4444;" title="Çizimleri Sıfırla">🗑️ Temizle</button>
          </div>
        </div>

        <!-- 3. TUVAL ÇALIŞMA ALANI (VIEWPORT) -->
        <div id="annotatorViewport" style="flex: 1; overflow: auto; background: #0f172a; display: flex; align-items: center; justify-content: center; position: relative; cursor: crosshair; user-select: none;">
          <div id="annotatorCanvasWrapper" style="display: inline-block; box-shadow: 0 10px 40px rgba(0,0,0,0.6); transition: transform 0.05s ease-out; position: relative;">
            <canvas id="annotatorCanvas" style="display: block; background: #ffffff;"></canvas>
            <canvas id="annotatorOverlayCanvas" style="position: absolute; inset: 0; pointer-events: none;"></canvas>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('#annotatorCanvas');
    const overlayCanvas = overlay.querySelector('#annotatorOverlayCanvas');
    const ctx = canvas.getContext('2d');
    const oCtx = overlayCanvas.getContext('2d');
    const viewport = overlay.querySelector('#annotatorViewport');
    const canvasWrapper = overlay.querySelector('#annotatorCanvasWrapper');
    const dimBadge = overlay.querySelector('#annotatorImgDimensions');
    const zoomBadge = overlay.querySelector('#annotatorZoomBadge');
    const stepNumBadge = overlay.querySelector('#annotatorStepNum');

    let activeTool = 'pen';
    let currentColor = '#ef4444';
    let currentLineWidth = 8;
    let zoomLevel = 1.0;
    let stepCount = 1;

    let isDrawing = false;
    let isPanning = false;
    let panStartX = 0;
    let panStartY = 0;
    let panScrollLeft = 0;
    let panScrollTop = 0;

    let startX = 0;
    let startY = 0;

    const undoHistory = [];
    const redoHistory = [];

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 600;
      overlayCanvas.width = canvas.width;
      overlayCanvas.height = canvas.height;

      ctx.drawImage(img, 0, 0);

      dimBadge.textContent = `${canvas.width} × ${canvas.height} px`;
      saveState();
      fitToViewport();
    };
    img.onerror = () => {
      dimBadge.textContent = 'Görsel yüklenemedi';
      dimBadge.style.color = '#ef4444';
      canvas.width = 800;
      canvas.height = 600;
      overlayCanvas.width = 800;
      overlayCanvas.height = 600;
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
      setZoom(Math.max(0.15, fitZoom));
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
      redoHistory.length = 0;
    }

    function undo() {
      if (undoHistory.length > 1) {
        const current = undoHistory.pop();
        redoHistory.push(current);
        const prev = undoHistory[undoHistory.length - 1];
        if (canvas.width !== prev.width || canvas.height !== prev.height) {
          canvas.width = prev.width;
          canvas.height = prev.height;
          overlayCanvas.width = prev.width;
          overlayCanvas.height = prev.height;
          dimBadge.textContent = `${canvas.width} × ${canvas.height} px`;
        }
        ctx.putImageData(prev, 0, 0);
      }
    }

    function redo() {
      if (redoHistory.length > 0) {
        const next = redoHistory.pop();
        undoHistory.push(next);
        if (canvas.width !== next.width || canvas.height !== next.height) {
          canvas.width = next.width;
          canvas.height = next.height;
          overlayCanvas.width = next.width;
          overlayCanvas.height = next.height;
          dimBadge.textContent = `${canvas.width} × ${canvas.height} px`;
        }
        ctx.putImageData(next, 0, 0);
      }
    }

    function clearAll() {
      if (undoHistory.length > 0) {
        const first = undoHistory[0];
        canvas.width = first.width;
        canvas.height = first.height;
        overlayCanvas.width = first.width;
        overlayCanvas.height = first.height;
        ctx.putImageData(first, 0, 0);
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

    // DÖNDÜRME (ROTATE)
    function rotateCanvas(degrees) {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (degrees === 90 || degrees === 270) {
        tempCanvas.width = canvas.height;
        tempCanvas.height = canvas.width;
      } else {
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
      }
      tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tempCtx.rotate((degrees * Math.PI) / 180);
      tempCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

      canvas.width = tempCanvas.width;
      canvas.height = tempCanvas.height;
      overlayCanvas.width = canvas.width;
      overlayCanvas.height = canvas.height;
      ctx.drawImage(tempCanvas, 0, 0);
      dimBadge.textContent = `${canvas.width} × ${canvas.height} px`;
      saveState();
      fitToViewport();
    }

    // AYNALAMA (FLIP)
    function flipCanvas(horizontal = true) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      if (horizontal) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(0, canvas.height);
        ctx.scale(1, -1);
      }
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
      saveState();
    }

    // SANSÜRLEME / MOZAİKLEME (PIXELATE)
    function pixelateRegion(x, y, w, h, blockSize = 12) {
      const rx = Math.max(0, Math.min(x, canvas.width - 1));
      const ry = Math.max(0, Math.min(y, canvas.height - 1));
      const rw = Math.min(w, canvas.width - rx);
      const rh = Math.min(h, canvas.height - ry);
      if (rw <= 0 || rh <= 0) return;

      const imgData = ctx.getImageData(rx, ry, rw, rh);
      const d = imgData.data;
      for (let py = 0; py < rh; py += blockSize) {
        for (let px = 0; px < rw; px += blockSize) {
          const pIndex = (py * rw + px) * 4;
          const r = d[pIndex];
          const g = d[pIndex + 1];
          const b = d[pIndex + 2];
          for (let by = 0; by < blockSize && py + by < rh; by++) {
            for (let bx = 0; bx < blockSize && px + bx < rw; bx++) {
              const idx = ((py + by) * rw + (px + bx)) * 4;
              d[idx] = r;
              d[idx + 1] = g;
              d[idx + 2] = b;
            }
          }
        }
      }
      ctx.putImageData(imgData, rx, ry);
    }

    // KIRPMA (CROP)
    function cropToRegion(x, y, w, h) {
      const rx = Math.round(Math.max(0, Math.min(x, canvas.width - 1)));
      const ry = Math.round(Math.max(0, Math.min(y, canvas.height - 1)));
      const rw = Math.round(Math.min(w, canvas.width - rx));
      const rh = Math.round(Math.min(h, canvas.height - ry));
      if (rw < 10 || rh < 10) return;

      const croppedData = ctx.getImageData(rx, ry, rw, rh);
      canvas.width = rw;
      canvas.height = rh;
      overlayCanvas.width = rw;
      overlayCanvas.height = rh;
      ctx.putImageData(croppedData, 0, 0);
      dimBadge.textContent = `${rw} × ${rh} px`;
      saveState();
      fitToViewport();
      setActiveTool('pen');
    }

    // OK ÇİZİMİ
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
      context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
      context.closePath();
      context.fillStyle = context.strokeStyle;
      context.fill();
    }

    // ÇİFT YÖNLÜ OK
    function drawDoubleArrow(context, fromx, fromy, tox, toy, width) {
      drawArrow(context, fromx, fromy, tox, toy, width);
      drawArrow(context, tox, toy, fromx, fromy, width);
    }

    // YILDIZ ÇİZİMİ
    function drawStar(context, cx, cy, spikes, outerRadius, innerRadius) {
      let rot = (Math.PI / 2) * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;
      context.beginPath();
      context.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        context.lineTo(x, y);
        rot += step;
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        context.lineTo(x, y);
        rot += step;
      }
      context.lineTo(cx, cy - outerRadius);
      context.closePath();
      context.stroke();
    }

    // KONUŞMA BALONU
    function drawCallout(context, x, y, w, h) {
      const r = 12;
      context.beginPath();
      context.moveTo(x + r, y);
      context.lineTo(x + w - r, y);
      context.quadraticCurveTo(x + w, y, x + w, y + r);
      context.lineTo(x + w, y + h - r);
      context.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      context.lineTo(x + 40, y + h);
      context.lineTo(x + 20, y + h + 20); // kuyruk
      context.lineTo(x + 25, y + h);
      context.lineTo(x + r, y + h);
      context.quadraticCurveTo(x, y + h, x, y + h - r);
      context.lineTo(x, y + r);
      context.quadraticCurveTo(x, y, x + r, y);
      context.closePath();
      context.stroke();
    }

    // ADIM ROZETİ (①, ②, ③...)
    function stampStepBadge(cx, cy) {
      const radius = 18;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = currentColor;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(stepCount), cx, cy + 1);
      ctx.restore();

      stepCount++;
      stepNumBadge.textContent = `(${stepCount})`;
      saveState();
    }

    // FİLTRE UYGULAMA
    overlay.querySelector('#selFilter').addEventListener('change', (e) => {
      const filter = e.target.value;
      if (filter === 'none') return;
      
      const filterMap = {
        brightness: 'brightness(125%)',
        contrast: 'contrast(135%)',
        grayscale: 'grayscale(100%)',
        invert: 'invert(100%)'
      };

      const filterVal = filterMap[filter];
      if (filterVal) {
        const temp = document.createElement('canvas');
        temp.width = canvas.width;
        temp.height = canvas.height;
        const tctx = temp.getContext('2d');
        tctx.drawImage(canvas, 0, 0);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.filter = filterVal;
        ctx.drawImage(temp, 0, 0);
        ctx.restore();
        ctx.filter = 'none';
        saveState();
      }
      e.target.value = 'none';
    });

    // Buton Eylemleri: Döndür & Aynala
    overlay.querySelector('#btnRotateRight').addEventListener('click', () => rotateCanvas(90));
    overlay.querySelector('#btnRotateLeft').addEventListener('click', () => rotateCanvas(270));
    overlay.querySelector('#btnFlipH').addEventListener('click', () => flipCanvas(true));
    overlay.querySelector('#btnFlipV').addEventListener('click', () => flipCanvas(false));

    // FARE ÇİZİM ETKİLEŞİMİ
    viewport.addEventListener('mousedown', (e) => {
      if (activeTool === 'pan') {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        panScrollLeft = viewport.scrollLeft;
        panScrollTop = viewport.scrollTop;
        viewport.style.cursor = 'grabbing';
        return;
      }

      const { x, y } = getCanvasCoords(e);
      startX = x;
      startY = y;

      if (activeTool === 'step') {
        stampStepBadge(x, y);
        return;
      }

      if (activeTool === 'text') {
        const text = window.prompt('Görsel üzerine eklenecek metni girin:');
        if (text) {
          ctx.save();
          ctx.fillStyle = currentColor;
          ctx.font = `bold ${Math.max(16, currentLineWidth * 2.8)}px sans-serif`;
          ctx.fillText(text, x, y);
          ctx.restore();
          saveState();
        }
        return;
      }

      isDrawing = true;

      if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        if (activeTool === 'highlighter') {
          ctx.strokeStyle = currentColor;
          ctx.globalAlpha = 0.4;
          ctx.lineWidth = Math.max(14, currentLineWidth * 2);
        } else if (activeTool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.lineWidth = currentLineWidth * 2.5;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = currentColor;
          ctx.globalAlpha = 1.0;
          ctx.lineWidth = currentLineWidth;
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    });

    viewport.addEventListener('mousemove', (e) => {
      if (isPanning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        viewport.scrollLeft = panScrollLeft - dx;
        viewport.scrollTop = panScrollTop - dy;
        return;
      }

      if (!isDrawing) return;
      const { x, y } = getCanvasCoords(e);

      if (activeTool === 'pen' || activeTool === 'highlighter' || activeTool === 'eraser') {
        ctx.lineTo(x, y);
        ctx.stroke();
        return;
      }

      // Önizleme Çizimi (Overlay Canvas)
      oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      oCtx.save();
      oCtx.lineWidth = currentLineWidth;
      oCtx.strokeStyle = currentColor;
      oCtx.fillStyle = currentColor;
      oCtx.lineCap = 'round';
      oCtx.lineJoin = 'round';

      const w = x - startX;
      const h = y - startY;

      if (activeTool === 'line') {
        oCtx.beginPath();
        oCtx.moveTo(startX, startY);
        oCtx.lineTo(x, y);
        oCtx.stroke();
      } else if (activeTool === 'arrow') {
        drawArrow(oCtx, startX, startY, x, y, currentLineWidth);
      } else if (activeTool === 'doubleArrow') {
        drawDoubleArrow(oCtx, startX, startY, x, y, currentLineWidth);
      } else if (activeTool === 'circle') {
        oCtx.beginPath();
        oCtx.arc(startX, startY, Math.sqrt(w * w + h * h), 0, Math.PI * 2);
        oCtx.stroke();
      } else if (activeTool === 'rect') {
        oCtx.strokeRect(startX, startY, w, h);
      } else if (activeTool === 'filledRect') {
        oCtx.fillRect(startX, startY, w, h);
      } else if (activeTool === 'star') {
        const radius = Math.sqrt(w * w + h * h);
        drawStar(oCtx, startX, startY, 5, radius, radius * 0.5);
      } else if (activeTool === 'callout') {
        drawCallout(oCtx, startX, startY, w, h);
      } else if (activeTool === 'crop' || activeTool === 'mosaic') {
        oCtx.strokeStyle = activeTool === 'crop' ? '#ea580c' : '#7c3aed';
        oCtx.lineWidth = 2;
        oCtx.setLineDash([6, 6]);
        oCtx.strokeRect(startX, startY, w, h);
        oCtx.fillStyle = activeTool === 'crop' ? 'rgba(234, 88, 12, 0.15)' : 'rgba(124, 58, 237, 0.2)';
        oCtx.fillRect(startX, startY, w, h);
      }
      oCtx.restore();
    });

    const endDrawing = (e) => {
      if (isPanning) {
        isPanning = false;
        viewport.style.cursor = activeTool === 'pan' ? 'grab' : 'crosshair';
      }

      if (!isDrawing) return;
      isDrawing = false;
      oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

      const { x, y } = getCanvasCoords(e);
      const w = x - startX;
      const h = y - startY;

      ctx.save();
      ctx.lineWidth = currentLineWidth;
      ctx.strokeStyle = currentColor;
      ctx.fillStyle = currentColor;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (activeTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else if (activeTool === 'arrow') {
        drawArrow(ctx, startX, startY, x, y, currentLineWidth);
      } else if (activeTool === 'doubleArrow') {
        drawDoubleArrow(ctx, startX, startY, x, y, currentLineWidth);
      } else if (activeTool === 'circle') {
        ctx.beginPath();
        ctx.arc(startX, startY, Math.sqrt(w * w + h * h), 0, Math.PI * 2);
        ctx.stroke();
      } else if (activeTool === 'rect') {
        ctx.strokeRect(startX, startY, w, h);
      } else if (activeTool === 'filledRect') {
        ctx.fillRect(startX, startY, w, h);
      } else if (activeTool === 'star') {
        const radius = Math.sqrt(w * w + h * h);
        drawStar(ctx, startX, startY, 5, radius, radius * 0.5);
      } else if (activeTool === 'callout') {
        drawCallout(ctx, startX, startY, w, h);
      } else if (activeTool === 'mosaic') {
        const rx = Math.min(startX, x);
        const ry = Math.min(startY, y);
        const rw = Math.abs(w);
        const rh = Math.abs(h);
        pixelateRegion(rx, ry, rw, rh, 12);
      } else if (activeTool === 'crop') {
        const rx = Math.min(startX, x);
        const ry = Math.min(startY, y);
        const rw = Math.abs(w);
        const rh = Math.abs(h);
        cropToRegion(rx, ry, rw, rh);
      }

      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;
      saveState();
    };

    viewport.addEventListener('mouseup', endDrawing);
    viewport.addEventListener('mouseleave', endDrawing);

    // Araç Seçimi
    function setActiveTool(tool) {
      activeTool = tool;
      overlay.querySelectorAll('.annotator-tool-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = overlay.querySelector(`#tool${tool.charAt(0).toUpperCase() + tool.slice(1)}`);
      if (activeBtn) activeBtn.classList.add('active');

      if (tool === 'pan') {
        viewport.style.cursor = 'grab';
      } else if (tool === 'crop') {
        viewport.style.cursor = 'cell';
      } else {
        viewport.style.cursor = 'crosshair';
      }
    }

    const toolMap = {
      toolPan: 'pan',
      toolPen: 'pen',
      toolHighlighter: 'highlighter',
      toolLine: 'line',
      toolArrow: 'arrow',
      toolDoubleArrow: 'doubleArrow',
      toolCircle: 'circle',
      toolRect: 'rect',
      toolFilledRect: 'filledRect',
      toolStar: 'star',
      toolCallout: 'callout',
      toolText: 'text',
      toolStep: 'step',
      toolMosaic: 'mosaic',
      toolCrop: 'crop',
      toolEraser: 'eraser'
    };

    Object.entries(toolMap).forEach(([btnId, toolName]) => {
      overlay.querySelector(`#${btnId}`)?.addEventListener('click', () => setActiveTool(toolName));
    });

    // Renk Seçimi
    overlay.querySelectorAll('.annotator-color-dot').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.annotator-color-dot').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentColor = btn.dataset.color;
      });
    });

    overlay.querySelector('#annotatorCustomColor').addEventListener('input', (e) => {
      currentColor = e.target.value;
      overlay.querySelectorAll('.annotator-color-dot').forEach(b => b.classList.remove('active'));
    });

    // Kalınlık Seçimi
    overlay.querySelectorAll('.annotator-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.annotator-size-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'var(--bg-surface)';
          b.style.color = 'inherit';
          b.style.borderColor = 'var(--border)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--accent, #2563eb)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--accent, #2563eb)';
        currentLineWidth = parseInt(btn.dataset.size, 10);
      });
    });

    // Geçmiş Butonları
    overlay.querySelector('#annotatorBtnUndo').addEventListener('click', undo);
    overlay.querySelector('#annotatorBtnRedo').addEventListener('click', redo);
    overlay.querySelector('#annotatorBtnClear').addEventListener('click', clearAll);

    // Kapat / Vazgeç Butonu
    const closeAnnotator = () => overlay.remove();
    overlay.querySelector('#annotatorBtnCancel').addEventListener('click', closeAnnotator);

    // Doğrudan İndirme (PNG)
    overlay.querySelector('#annotatorBtnDownload').addEventListener('click', () => {
      try {
        const link = document.createElement('a');
        link.download = (imageName.replace(/\.[^/.]+$/, '')) + '_paint.png';
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (err) {
        alert('Görsel indirilemedi.');
      }
    });

    // Kaydet ve Kapat
    overlay.querySelector('#annotatorBtnSave').addEventListener('click', () => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        if (typeof onSave === 'function') {
          onSave(dataUrl);
        }
        closeAnnotator();
      } catch (err) {
        alert('İşaretlenmiş görsel kaydedilemedi.');
      }
    });
  }

  window.openImageAnnotator = openImageAnnotator;
})();
