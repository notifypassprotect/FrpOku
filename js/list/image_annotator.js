/**
 * image_annotator.js — Görsel Üzerinde Çizim, Daire ve İşaretleme Aracı (Canvas Annotator)
 */
(function() {
  'use strict';

  function openImageAnnotator({ imageUrl, imageName = 'Görsel', onSave }) {
    const existing = document.getElementById('frpAnnotatorOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'frpAnnotatorOverlay';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
      z-index: 100010; display: flex; align-items: center; justify-content: center; padding: 1rem;
    `;

    overlay.innerHTML = `
      <div style="background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; width: 95vw; max-width: 1000px; height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.4);">
        <!-- ÜST ÇUBUK -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc);">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(37,99,235,0.1); color: var(--accent, #2563eb); display: flex; align-items: center; justify-content: center;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <div>
              <div style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary, #0f172a);">Görsel Üzerine İşaretleme & Çizim</div>
              <div style="font-size: 0.75rem; color: var(--text-muted, #64748b);">${imageName}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button type="button" id="annotatorBtnCancel" class="btn btn-sm btn-ghost" style="padding: 0.4rem 0.9rem;">İptal</button>
            <button type="button" id="annotatorBtnSave" class="btn btn-sm btn-primary" style="padding: 0.4rem 1.2rem; font-weight: 700; background: #10b981; border-color: #10b981;">İşaretlemeyi Kaydet</button>
          </div>
        </div>

        <!-- ARAÇ ÇUBUĞU (TOOLBAR) -->
        <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 1.25rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-surface, #ffffff); flex-wrap: wrap;">
          <!-- Çizim Modu -->
          <div style="display: flex; align-items: center; gap: 0.3rem; background: var(--bg-card, #f8fafc); padding: 0.25rem; border-radius: 8px; border: 1px solid var(--border, #cbd5e1);">
            <button type="button" id="toolPen" class="btn btn-sm annotator-tool-btn active" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; font-weight: 700;" title="Serbest Kalem">✏️ Kalem</button>
            <button type="button" id="toolCircle" class="btn btn-sm annotator-tool-btn" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; font-weight: 700;" title="Yuvarlak / Daire İçine Al">⭕ Daire</button>
            <button type="button" id="toolRect" class="btn btn-sm annotator-tool-btn" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; font-weight: 700;" title="Dikdörtgen">⬛ Kutu</button>
            <button type="button" id="toolArrow" class="btn btn-sm annotator-tool-btn" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; font-weight: 700;" title="Ok İşareti">➡️ Ok</button>
            <button type="button" id="toolHighlighter" class="btn btn-sm annotator-tool-btn" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; font-weight: 700;" title="Fosforlu Vurgulayıcı">🖍️ Vurgu</button>
          </div>

          <!-- Renk Paleti -->
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <button type="button" class="annotator-color-dot active" data-color="#ef4444" style="background: #ef4444; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Kırmızı"></button>
            <button type="button" class="annotator-color-dot" data-color="#facc15" style="background: #facc15; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Sarı"></button>
            <button type="button" class="annotator-color-dot" data-color="#10b981" style="background: #10b981; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Yeşil"></button>
            <button type="button" class="annotator-color-dot" data-color="#2563eb" style="background: #2563eb; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Mavi"></button>
            <button type="button" class="annotator-color-dot" data-color="#ffffff" style="background: #ffffff; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #cbd5e1; cursor: pointer;" title="Beyaz"></button>
            <button type="button" class="annotator-color-dot" data-color="#0f172a" style="background: #0f172a; width: 22px; height: 22px; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 0 0 1px #cbd5e1; cursor: pointer;" title="Siyah"></button>
          </div>

          <!-- Kalınlık -->
          <div style="display: flex; align-items: center; gap: 0.3rem;">
            <button type="button" class="annotator-size-btn" data-size="3" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); cursor: pointer;">İnce</button>
            <button type="button" class="annotator-size-btn active" data-size="6" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border: 1px solid var(--accent, #2563eb); border-radius: 6px; background: var(--accent, #2563eb); color: #fff; font-weight: 700; cursor: pointer;">Orta</button>
            <button type="button" class="annotator-size-btn" data-size="12" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-surface); cursor: pointer;">Kalın</button>
          </div>

          <div style="margin-left: auto; display: flex; align-items: center; gap: 0.4rem;">
            <button type="button" id="annotatorBtnUndo" class="btn btn-sm btn-ghost" style="font-size: 0.78rem;">↩️ Geri Al</button>
            <button type="button" id="annotatorBtnClear" class="btn btn-sm btn-ghost" style="color: #ef4444; font-size: 0.78rem;">Temizle</button>
          </div>
        </div>

        <!-- CANVAS ALANI -->
        <div id="annotatorCanvasContainer" style="flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; background: #0b0f19; position: relative; padding: 1.5rem;">
          <canvas id="annotatorCanvas" style="max-width: 100%; max-height: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.5); cursor: crosshair; background: #ffffff;"></canvas>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('#annotatorCanvas');
    const ctx = canvas.getContext('2d');
    let currentTool = 'pen'; // pen, circle, rect, arrow, highlighter
    let currentColor = '#ef4444';
    let currentLineWidth = 6;

    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    const history = []; // Canvas snapshot history for undo

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      ctx.drawImage(img, 0, 0);
      saveState();
    };
    img.src = imageUrl;

    function saveState() {
      history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (history.length > 25) history.shift();
    }

    function undo() {
      if (history.length > 1) {
        history.pop();
        const prev = history[history.length - 1];
        ctx.putImageData(prev, 0, 0);
      }
    }

    function clearCanvas() {
      if (history.length > 0) {
        const base = history[0];
        history.length = 1;
        ctx.putImageData(base, 0, 0);
      }
    }

    // Koordinat hesaplama (canvas scale oranını dikkate alır)
    function getCanvasCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    // Çizim olayları
    canvas.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const pos = getCanvasCoords(e);
      startX = pos.x;
      startY = pos.y;

      if (currentTool === 'pen' || currentTool === 'highlighter') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentLineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = currentTool === 'highlighter' ? 0.4 : 1.0;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const pos = getCanvasCoords(e);

      if (currentTool === 'pen' || currentTool === 'highlighter') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else {
        // Canlı önizleme için son snapshot'ı geri yükle
        if (history.length > 0) {
          ctx.putImageData(history[history.length - 1], 0, 0);
        }
        ctx.beginPath();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentLineWidth;
        ctx.globalAlpha = 1.0;

        if (currentTool === 'circle') {
          // Elips / Daire çizimi
          const rx = Math.abs(pos.x - startX) / 2;
          const ry = Math.abs(pos.y - startY) / 2;
          const cx = Math.min(startX, pos.x) + rx;
          const cy = Math.min(startY, pos.y) + ry;
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (currentTool === 'rect') {
          ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
        } else if (currentTool === 'arrow') {
          drawArrow(ctx, startX, startY, pos.x, pos.y, currentLineWidth);
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDrawing) {
        isDrawing = false;
        ctx.globalAlpha = 1.0;
        saveState();
      }
    });

    function drawArrow(context, fromx, fromy, tox, toy, width) {
      const headlen = Math.max(16, width * 3);
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

        if (btn.id === 'toolPen') currentTool = 'pen';
        else if (btn.id === 'toolCircle') currentTool = 'circle';
        else if (btn.id === 'toolRect') currentTool = 'rect';
        else if (btn.id === 'toolArrow') currentTool = 'arrow';
        else if (btn.id === 'toolHighlighter') currentTool = 'highlighter';
      });
    });

    // Renk butonları
    const colorDots = overlay.querySelectorAll('.annotator-color-dot');
    colorDots.forEach(dot => {
      dot.addEventListener('click', () => {
        colorDots.forEach(d => d.style.boxShadow = '0 0 0 1px #cbd5e1');
        dot.style.boxShadow = '0 0 0 3px var(--accent, #2563eb)';
        currentColor = dot.dataset.color;
      });
    });

    // Kalınlık butonları
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
        currentLineWidth = parseInt(btn.dataset.size, 10) || 6;
      });
    });

    overlay.querySelector('#annotatorBtnUndo').addEventListener('click', undo);
    overlay.querySelector('#annotatorBtnClear').addEventListener('click', clearCanvas);

    const close = () => overlay.remove();
    overlay.querySelector('#annotatorBtnCancel').addEventListener('click', close);

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
