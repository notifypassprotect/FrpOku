/**
 * rich_note_editor.js — Word Benzeri Gelişmiş Rapor Notu, Medya & Ek Yönetim Modalı
 */
(function() {
  'use strict';

  function escHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatFileSize(bytes) {
    if (!bytes || isNaN(bytes)) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = Number(bytes);
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return size.toFixed(1) + ' ' + units[i];
  }

  // Güvenli kimlik doğrulamalı medya/dosya URL'i üretici (Blob veya token parametresi)
  async function getAuthenticatedMediaUrl(rawUrl) {
    if (!rawUrl) return '';
    if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;

    const token = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function')
      ? window.FrpAuth.getAuthHeaders()?.Authorization?.replace(/^Bearer\s+/i, '')
      : (localStorage.getItem('frpoku_auth_token') || sessionStorage.getItem('frpoku_auth_token') || '');

    try {
      const fetchUrl = token ? (rawUrl + (rawUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token)) : rawUrl;
      const headers = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {};
      const res = await fetch(fetchUrl, { headers });
      if (res.ok) {
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
    } catch {}

    return token ? (rawUrl + (rawUrl.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token)) : rawUrl;
  }

  // Güvenli dosya indirme
  async function downloadAttachment(att) {
    try {
      if (typeof window.toast === 'function') window.toast(`"${att.name}" indiriliyor...`, 'info');
      const blobUrl = await getAuthenticatedMediaUrl(att.url);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = att.name || 'dosya';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => {
        if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
      }, 30000);
    } catch {
      window.open(att.url, '_blank');
    }
  }

  // Modern Tehlike & Onay Modalı
  function showModernConfirmDialog({ title, message, confirmText = 'Evet, Sil', cancelText = 'Vazgeç', isDanger = true, onConfirm }) {
    const existing = document.getElementById('frpModernConfirmOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'frpModernConfirmOverlay';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(8px);
      z-index: 200050; display: flex; align-items: center; justify-content: center; padding: 1rem; animation: fadeIn .15s ease-out;
    `;

    overlay.innerHTML = `
      <div class="modal" style="max-width: 440px; width: 92vw; padding: 1.6rem; border-radius: 18px; background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); box-shadow: 0 25px 60px rgba(0,0,0,0.4);">
        <div style="display: flex; align-items: center; gap: 0.85rem; margin-bottom: 0.9rem;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: ${isDanger ? '#fee2e2' : 'rgba(37,99,235,0.1)'}; color: ${isDanger ? '#ef4444' : 'var(--accent,#2563eb)'}; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
            ${isDanger ? '⚠️' : 'ℹ️'}
          </div>
          <div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary, #0f172a);">${escHtml(title)}</div>
            ${isDanger ? `<div style="font-size: 0.76rem; color: #ef4444; font-weight: 700;">Bu işlem geri alınamaz</div>` : ''}
          </div>
        </div>
        <div style="font-size: 0.88rem; color: var(--text-secondary, #475569); line-height: 1.6; margin-bottom: 1.5rem;">
          ${message}
        </div>
        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.65rem;">
          <button type="button" id="btnModernCancel" class="btn btn-sm btn-ghost" style="padding: 0.5rem 1.1rem; font-weight: 700;">${escHtml(cancelText)}</button>
          <button type="button" id="btnModernConfirm" class="btn btn-sm" style="padding: 0.5rem 1.4rem; font-weight: 800; background: ${isDanger ? '#ef4444' : 'var(--accent,#2563eb)'}; color: #ffffff; border: none; border-radius: 8px;">${escHtml(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const closeDialog = () => overlay.remove();
    overlay.querySelector('#btnModernCancel').addEventListener('click', closeDialog);
    overlay.querySelector('#btnModernConfirm').addEventListener('click', () => {
      closeDialog();
      if (typeof onConfirm === 'function') onConfirm();
    });
  }

  // Modern Dosya Önizleme Modalı (Resimler için Zoom/Pan Motoru ve PDF'ler için)
  async function openAttachmentPreview(att) {
    const existing = document.getElementById('frpAttPreviewOverlay');
    if (existing) existing.remove();

    const isPdf = (att.type || '').includes('pdf') || (att.name || '').toLowerCase().endsWith('.pdf');
    const isImage = (att.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.name || '');

    const overlay = document.createElement('div');
    overlay.id = 'frpAttPreviewOverlay';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(10px);
      z-index: 100020; display: flex; align-items: center; justify-content: center; padding: 1.25rem;
    `;

    overlay.innerHTML = `
      <div style="background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 18px; width: 94vw; max-width: 1050px; height: 88vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 65px rgba(0,0,0,0.5);">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc); flex-wrap: wrap; gap: 0.5rem;">
          <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-primary, #0f172a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 45vw;">
            ${escHtml(att.name)} <span style="font-size: 0.76rem; color: var(--text-muted, #64748b); font-weight: 500;">(${formatFileSize(att.size)})</span>
          </div>
          
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${isImage ? `
              <!-- Zoom & Görsel Kontrolleri -->
              <div style="display: flex; align-items: center; background: var(--bg-surface, #fff); border: 1px solid var(--border, #cbd5e1); border-radius: 8px; padding: 0.15rem 0.35rem; gap: 0.2rem;">
                <button type="button" id="btnPrevZoomOut" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.45rem; font-size: 0.85rem;" title="Uzaklaştır">➖</button>
                <span id="prevZoomBadge" style="font-size: 0.75rem; font-weight: 800; min-width: 44px; text-align: center; color: var(--text-primary, #0f172a);">%100</span>
                <button type="button" id="btnPrevZoomIn" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.45rem; font-size: 0.85rem;" title="Yakınlaştır">➕</button>
                <button type="button" id="btnPrevZoom100" class="btn btn-sm btn-ghost" style="font-size: 0.72rem; padding: 0.2rem 0.4rem; font-weight: 700;" title="Gerçek Boyut (%100)">1:1</button>
                <button type="button" id="btnPrevZoomFit" class="btn btn-sm btn-ghost" style="font-size: 0.72rem; padding: 0.2rem 0.45rem; font-weight: 700;" title="Ekrana Sığdır">Sığdır</button>
                <button type="button" id="btnPrevRotate" class="btn btn-sm btn-ghost" style="font-size: 0.74rem; padding: 0.2rem 0.4rem;" title="90° Döndür">↷</button>
              </div>
            ` : ''}

            <button type="button" id="btnAttDownloadAction" class="btn btn-sm btn-primary" style="padding: 0.4rem 0.95rem; font-size: 0.82rem; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
              <span>⬇️ İndir</span>
            </button>
            <button type="button" id="btnAttPreviewClose" style="width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--border, #cbd5e1); background: var(--bg-surface, #ffffff); color: var(--text-muted, #64748b); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0;" title="Kapat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <div id="attPreviewBody" style="flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; background: #0b1120; padding: 1.5rem; position: relative;">
          <div style="color: #94a3b8; font-size: 0.9rem; font-weight: 600;">Belge hazırlanıyor...</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('#btnAttPreviewClose').addEventListener('click', close);
    overlay.querySelector('#btnAttDownloadAction').addEventListener('click', () => downloadAttachment(att));

    let isMouseDownOnBackdrop = false;
    overlay.addEventListener('mousedown', (e) => {
      isMouseDownOnBackdrop = (e.target === overlay);
    });
    overlay.addEventListener('mouseup', (e) => {
      if (isMouseDownOnBackdrop && e.target === overlay) {
        close();
      }
      isMouseDownOnBackdrop = false;
    });

    const previewBody = overlay.querySelector('#attPreviewBody');
    const mediaUrl = await getAuthenticatedMediaUrl(att.url);

    if (isImage) {
      previewBody.innerHTML = `
        <div id="prevImgContainer" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; overflow: auto; cursor: grab; user-select: none;">
          <img id="prevImgElement" src="${mediaUrl}" alt="${escHtml(att.name)}" style="transform-origin: center center; transition: transform 0.08s ease-out; image-rendering: high-quality; box-shadow: 0 15px 45px rgba(0,0,0,0.65); border-radius: 6px; max-width: 100%; max-height: 100%; object-fit: contain;" />
        </div>
      `;

      const imgEl = previewBody.querySelector('#prevImgElement');
      const container = previewBody.querySelector('#prevImgContainer');
      const zoomBadge = overlay.querySelector('#prevZoomBadge');

      let currentZoom = 1.0;
      let currentRotation = 0;
      let isPanning = false;
      let startX = 0, startY = 0;
      let scrollLeft = 0, scrollTop = 0;

      function updateImgTransform() {
        imgEl.style.transform = `scale(${currentZoom}) rotate(${currentRotation}deg)`;
        if (zoomBadge) zoomBadge.textContent = `%${Math.round(currentZoom * 100)}`;
      }

      function setPreviewZoom(val) {
        currentZoom = Math.max(0.15, Math.min(5.0, val));
        updateImgTransform();
      }

      function fitPreviewToScreen() {
        currentZoom = 1.0;
        currentRotation = 0;
        imgEl.style.maxWidth = '100%';
        imgEl.style.maxHeight = '100%';
        updateImgTransform();
      }

      overlay.querySelector('#btnPrevZoomIn')?.addEventListener('click', () => {
        imgEl.style.maxWidth = 'none';
        imgEl.style.maxHeight = 'none';
        setPreviewZoom(currentZoom + 0.25);
      });

      overlay.querySelector('#btnPrevZoomOut')?.addEventListener('click', () => {
        setPreviewZoom(currentZoom - 0.25);
      });

      overlay.querySelector('#btnPrevZoom100')?.addEventListener('click', () => {
        imgEl.style.maxWidth = 'none';
        imgEl.style.maxHeight = 'none';
        setPreviewZoom(1.0);
      });

      overlay.querySelector('#btnPrevZoomFit')?.addEventListener('click', fitPreviewToScreen);

      overlay.querySelector('#btnPrevRotate')?.addEventListener('click', () => {
        currentRotation = (currentRotation + 90) % 360;
        updateImgTransform();
      });

      // Mouse Wheel Zoom
      container.addEventListener('wheel', (e) => {
        e.preventDefault();
        imgEl.style.maxWidth = 'none';
        imgEl.style.maxHeight = 'none';
        const delta = e.deltaY < 0 ? 0.15 : -0.15;
        setPreviewZoom(currentZoom + delta);
      }, { passive: false });

      // Mouse Drag Panning
      container.addEventListener('mousedown', (e) => {
        if (e.target === container || e.target === imgEl) {
          isPanning = true;
          container.style.cursor = 'grabbing';
          startX = e.clientX;
          startY = e.clientY;
          scrollLeft = container.scrollLeft;
          scrollTop = container.scrollTop;
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        container.scrollLeft = scrollLeft - dx;
        container.scrollTop = scrollTop - dy;
      });

      window.addEventListener('mouseup', () => {
        if (isPanning) {
          isPanning = false;
          container.style.cursor = 'grab';
        }
      });

    } else if (isPdf) {
      previewBody.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; flex-direction: column; background: #1e293b; border-radius: 8px; overflow: hidden;">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.85rem; background: #0f172a; border-bottom: 1px solid #334155; color: #f8fafc; font-size: 0.8rem;">
            <div style="font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
              <span style="color: #ef4444;">📄</span>
              <span>${escHtml(att.name)}</span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <a href="${mediaUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-secondary" style="padding: 0.25rem 0.65rem; font-size: 0.74rem; text-decoration: none;">↗️ Yeni Sekmede Aç</a>
              <button type="button" id="btnPreviewDirectDownload" class="btn btn-sm btn-primary" style="padding: 0.25rem 0.65rem; font-size: 0.74rem;">⬇️ İndir</button>
            </div>
          </div>
          <div style="flex: 1; position: relative;">
            <object data="${mediaUrl}" type="application/pdf" style="width: 100%; height: 100%; border: none;">
              <iframe src="${mediaUrl}" style="width: 100%; height: 100%; border: none; background: #ffffff;">
                <div style="text-align: center; padding: 3rem; color: #cbd5e1;">
                  <p>Tarayıcınız PDF önizlemeyi doğrudan görüntüleyemiyor.</p>
                  <a href="${mediaUrl}" target="_blank" class="btn btn-primary" style="margin-top: 1rem;">PDF Dosyasını Aç / İndir</a>
                </div>
              </iframe>
            </object>
          </div>
        </div>
      `;
      previewBody.querySelector('#btnPreviewDirectDownload')?.addEventListener('click', () => downloadAttachment(att));
    } else {
      previewBody.innerHTML = `
        <div style="text-align: center; color: #94a3b8; padding: 2.5rem 1rem;">
          <div style="font-size: 3.5rem; margin-bottom: 1rem;">📄</div>
          <div style="font-size: 1.15rem; font-weight: 800; color: #ffffff; margin-bottom: 0.5rem;">Bu dosya türü için doğrudan önizleme desteklenmiyor.</div>
          <div style="font-size: 0.88rem; margin-bottom: 1.5rem;">Dosyayı bilgisayarınıza indirerek görüntüleyebilirsiniz.</div>
          <button type="button" id="btnDownloadUnsupported" class="btn btn-primary" style="padding: 0.55rem 1.4rem; font-weight: 700;">⬇️ Dosyayı İndir</button>
        </div>
      `;
      previewBody.querySelector('#btnDownloadUnsupported')?.addEventListener('click', () => downloadAttachment(att));
    }
  }

  // Modern Link Ekleme / Düzenleme Modalı
  function showModernLinkModal({ initialUrl = '', initialText = '', onSave }) {
    const existing = document.getElementById('frpModernLinkOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'frpModernLinkOverlay';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
      z-index: 200060; display: flex; align-items: center; justify-content: center; padding: 1rem;
    `;

    overlay.innerHTML = `
      <div class="modal" style="max-width: 480px; width: 94vw; padding: 1.5rem; border-radius: 18px; background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); box-shadow: 0 25px 60px rgba(0,0,0,0.4);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-primary, #0f172a); display: flex; align-items: center; gap: 0.5rem;">
            <span>🔗</span>
            <span>${initialUrl ? 'Bağlantıyı Düzenle' : 'Bağlantı (Link) Ekle'}</span>
          </div>
          <button type="button" id="btnLinkModalClose" class="btn btn-sm btn-ghost" style="padding: 0.2rem 0.5rem; font-size: 1rem;">✕</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary, #475569); margin-bottom: 0.35rem;">
              Web / Belge Adresi (URL) *
            </label>
            <input type="text" id="inputModalLinkUrl" value="${escHtml(initialUrl)}" placeholder="https://ornek.com/dosya veya www.google.com" style="width: 100%; padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid var(--border, #cbd5e1); font-size: 0.88rem; background: var(--bg-card, #f8fafc); color: var(--text-primary, #0f172a);" />
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary, #475569); margin-bottom: 0.35rem;">
              Görüntülenecek Metin
            </label>
            <input type="text" id="inputModalLinkText" value="${escHtml(initialText)}" placeholder="Örn: İlgili Rapor / Sözleşme Belgesi" style="width: 100%; padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid var(--border, #cbd5e1); font-size: 0.88rem; background: var(--bg-card, #f8fafc); color: var(--text-primary, #0f172a);" />
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 0.25rem;">
            <label style="display: flex; align-items: center; gap: 0.45rem; font-size: 0.82rem; color: var(--text-secondary, #475569); cursor: pointer;">
              <input type="checkbox" id="chkModalLinkTarget" checked style="accent-color: var(--accent, #2563eb);" />
              <span>Yeni sekmede açılsın (target="_blank")</span>
            </label>
            <button type="button" id="btnModalLinkTest" class="btn btn-sm btn-ghost" style="font-size: 0.76rem; color: var(--accent, #2563eb); font-weight: 700;">↗️ Test Et</button>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 0.65rem;">
          <button type="button" id="btnModalLinkCancel" class="btn btn-sm btn-ghost" style="padding: 0.5rem 1.1rem; font-weight: 700;">Vazgeç</button>
          <button type="button" id="btnModalLinkApply" class="btn btn-sm btn-primary" style="padding: 0.5rem 1.4rem; font-weight: 800;">${initialUrl ? 'Güncelle' : 'Ekle'}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeDialog = () => overlay.remove();
    overlay.querySelector('#btnLinkModalClose').addEventListener('click', closeDialog);
    overlay.querySelector('#btnModalLinkCancel').addEventListener('click', closeDialog);

    const inputUrl = overlay.querySelector('#inputModalLinkUrl');
    const inputText = overlay.querySelector('#inputModalLinkText');
    const chkTarget = overlay.querySelector('#chkModalLinkTarget');

    inputUrl.focus();

    overlay.querySelector('#btnModalLinkTest').addEventListener('click', () => {
      let raw = inputUrl.value.trim();
      if (!raw) return;
      if (!/^https?:\/\//i.test(raw) && !raw.startsWith('/') && !raw.startsWith('mailto:')) {
        raw = 'https://' + raw;
      }
      window.open(raw, '_blank');
    });

    overlay.querySelector('#btnModalLinkApply').addEventListener('click', () => {
      let raw = inputUrl.value.trim();
      if (!raw) {
        inputUrl.focus();
        return;
      }
      if (!/^https?:\/\//i.test(raw) && !raw.startsWith('/') && !raw.startsWith('mailto:')) {
        raw = 'https://' + raw;
      }
      const text = inputText.value.trim() || raw;
      const targetBlank = chkTarget.checked;
      closeDialog();
      if (typeof onSave === 'function') onSave({ url: raw, text, targetBlank });
    });
  }

  async function openRichNoteModal(fileId) {
    if (!fileId) return;
    const file = (window.FrpStore && window.FrpStore.getById ? window.FrpStore.getById(fileId) : null);
    if (!file) return;

    const reportName = file.meta?.reportName || file.name || 'Rapor';
    let currentNoteHtml = file.noteHtml || file.note_html || '';
    let currentNoteText = file.userNote || file.user_note || '';
    if (!currentNoteHtml && currentNoteText) {
      currentNoteHtml = `<p>${escHtml(currentNoteText).replace(/\n/g, '<br>')}</p>`;
    }

    let attachments = Array.isArray(file.attachments) ? [...file.attachments] :
      (Array.isArray(file.noteAttachments) ? [...file.noteAttachments] :
      (Array.isArray(file.note_attachments) ? [...file.note_attachments] : []));

    const existing = document.getElementById('frpRichNoteModalOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'frpRichNoteModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(6px);
      z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    `;

    overlay.innerHTML = `
      <div class="modal" style="width: 95vw; max-width: 1240px; height: 90vh; max-height: 980px; background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.35); display: flex; flex-direction: column; overflow: hidden;">
        
        <!-- MODAL BAŞLIĞI -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.95rem 1.6rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc);">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(99,102,241,0.15)); color: var(--accent, #2563eb); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div>
              <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary, #0f172a); display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span>Rapor Zengin Notu & Belgeler</span>
                <span style="font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 9999px; background: rgba(37,99,235,0.12); color: var(--accent, #2563eb);">Word Modu & Ekler</span>
              </div>
              <div style="font-size: 0.82rem; color: var(--text-muted, #64748b); max-width: 600px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px;">
                ${escHtml(reportName)}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <span id="noteSaveStatus" style="font-size: 0.8rem; color: var(--text-muted, #64748b); font-weight: 600;"></span>
            <button type="button" id="btnRichNoteClose" style="width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border, #cbd5e1); background: var(--bg-surface, #ffffff); color: var(--text-muted, #64748b); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; padding: 0;" title="Pencereyi Kapat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        <!-- WORD BENZERİ GELİŞMİŞ ARAÇ ÇUBUĞU (RIBBON TOOLBAR) -->
        <div class="rich-editor-toolbar" style="display: flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.2rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-surface, #ffffff); flex-wrap: wrap;">
          
          <!-- Geri Al / Yinele -->
          <div style="display: flex; align-items: center; gap: 0.15rem;">
            <button type="button" id="tbUndo" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.45rem; font-size: 0.85rem;" title="Geri Al (Ctrl+Z)">↩️</button>
            <button type="button" id="tbRedo" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.45rem; font-size: 0.85rem;" title="Yinele (Ctrl+Y)">↪️</button>
          </div>

          <div style="width: 1px; height: 20px; background: var(--border-light, #e2e8f0); margin: 0 0.15rem;"></div>

          <!-- 25+ Yazı Tipi & Başlık & Boyut & Satır Aralığı -->
          <div style="display: flex; align-items: center; gap: 0.3rem; flex-wrap: wrap;">
            <select id="tbFontName" style="padding: 0.3rem 0.45rem; border-radius: 7px; border: 1px solid var(--border, #cbd5e1); font-size: 0.78rem; background: var(--bg-card); color: var(--text-primary); cursor: pointer; max-width: 140px;" title="Yazı Tipi">
              <option value="inherit">Yazı Tipi</option>
              <optgroup label="Modern Sans-Serif">
                <option value="Inter, sans-serif">Inter</option>
                <option value="Roboto, sans-serif">Roboto</option>
                <option value="'Open Sans', sans-serif">Open Sans</option>
                <option value="Montserrat, sans-serif">Montserrat</option>
                <option value="Poppins, sans-serif">Poppins</option>
                <option value="Lato, sans-serif">Lato</option>
                <option value="Nunito, sans-serif">Nunito</option>
                <option value="Ubuntu, sans-serif">Ubuntu</option>
                <option value="Raleway, sans-serif">Raleway</option>
                <option value="Cabin, sans-serif">Cabin</option>
                <option value="Arial, sans-serif">Arial</option>
                <option value="'Segoe UI', sans-serif">Segoe UI</option>
                <option value="Tahoma, sans-serif">Tahoma</option>
                <option value="Verdana, sans-serif">Verdana</option>
                <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                <option value="'Century Gothic', sans-serif">Century Gothic</option>
              </optgroup>
              <optgroup label="Serif & Kurumsal">
                <option value="Georgia, serif">Georgia</option>
                <option value="Garamond, serif">Garamond</option>
                <option value="'Times New Roman', serif">Times New Roman</option>
                <option value="'Playfair Display', serif">Playfair Display</option>
                <option value="Merriweather, serif">Merriweather</option>
                <option value="Palatino, serif">Palatino</option>
              </optgroup>
              <optgroup label="Yazılımcı / Monospace & Özel">
                <option value="Consolas, monospace">Consolas</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="'Fira Code', monospace">Fira Code</option>
                <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                <option value="Impact, sans-serif">Impact</option>
                <option value="Oswald, sans-serif">Oswald</option>
              </optgroup>
            </select>

            <select id="tbFormatBlock" style="padding: 0.3rem 0.45rem; border-radius: 7px; border: 1px solid var(--border, #cbd5e1); font-size: 0.78rem; background: var(--bg-card); color: var(--text-primary); cursor: pointer; font-weight: 600;" title="Stil">
              <option value="p">Normal Metin</option>
              <option value="h1">Başlık 1</option>
              <option value="h2">Başlık 2</option>
              <option value="h3">Başlık 3</option>
              <option value="pre">Kod Bloğu</option>
              <option value="blockquote">Alıntı</option>
            </select>

            <!-- Elle Düzenlenebilir Yazı Boyutu & Adım Butonları -->
            <div style="display: flex; align-items: center; border: 1px solid var(--border, #cbd5e1); border-radius: 7px; background: var(--bg-card); overflow: hidden;" title="Yazı Boyutu (px)">
              <input type="number" id="tbFontSizeNum" min="6" max="144" value="14" style="width: 42px; padding: 0.28rem 0.25rem; border: none; background: transparent; font-size: 0.78rem; text-align: center; color: var(--text-primary); font-weight: 700; outline: none;" />
              <span style="font-size: 0.68rem; color: var(--text-muted, #64748b); padding-right: 3px;">px</span>
              <div style="display: flex; flex-direction: column; border-left: 1px solid var(--border-light, #e2e8f0);">
                <button type="button" id="tbFontSizeInc" style="border: none; background: none; font-size: 0.55rem; padding: 1px 4px; line-height: 1; cursor: pointer; color: var(--text-secondary);" title="Büyüt">▲</button>
                <button type="button" id="tbFontSizeDec" style="border: none; background: none; font-size: 0.55rem; padding: 1px 4px; line-height: 1; cursor: pointer; color: var(--text-secondary);" title="Küçült">▼</button>
              </div>
            </div>

            <select id="tbLineHeight" style="padding: 0.3rem 0.45rem; border-radius: 7px; border: 1px solid var(--border, #cbd5e1); font-size: 0.78rem; background: var(--bg-card); color: var(--text-primary); cursor: pointer;" title="Satır Aralığı (Line Height)">
              <option value="1.75">Satır: 1.75</option>
              <option value="1.0">1.0 Sıkışık</option>
              <option value="1.15">1.15 Standart</option>
              <option value="1.5">1.5 Geniş</option>
              <option value="2.0">2.0 Çift</option>
            </select>
          </div>

          <div style="width: 1px; height: 20px; background: var(--border-light, #e2e8f0); margin: 0 0.15rem;"></div>

          <!-- Temel Biçimlendirme & Alt/Üst Simge -->
          <div style="display: flex; align-items: center; gap: 0.15rem;">
            <button type="button" id="tbBold" class="btn btn-sm btn-ghost" style="font-weight: 800; min-width: 26px; padding: 0.25rem 0.4rem;" title="Kalın (Ctrl+B)">B</button>
            <button type="button" id="tbItalic" class="btn btn-sm btn-ghost" style="font-style: italic; min-width: 26px; padding: 0.25rem 0.4rem;" title="İtalik (Ctrl+I)">I</button>
            <button type="button" id="tbUnderline" class="btn btn-sm btn-ghost" style="text-decoration: underline; min-width: 26px; padding: 0.25rem 0.4rem;" title="Altı Çizili (Ctrl+U)">U</button>
            <button type="button" id="tbStrike" class="btn btn-sm btn-ghost" style="text-decoration: line-through; min-width: 26px; padding: 0.25rem 0.4rem;" title="Üstü Çizili">S</button>
            <button type="button" id="tbSub" class="btn btn-sm btn-ghost" style="min-width: 26px; padding: 0.25rem 0.4rem; font-size: 0.75rem;" title="Alt Simge (x₂)">x₂</button>
            <button type="button" id="tbSup" class="btn btn-sm btn-ghost" style="min-width: 26px; padding: 0.25rem 0.4rem; font-size: 0.75rem;" title="Üst Simge (x²)">x²</button>
          </div>

          <div style="width: 1px; height: 20px; background: var(--border-light, #e2e8f0); margin: 0 0.15rem;"></div>

          <!-- Renk ve Vurgu -->
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <label style="display: flex; align-items: center; gap: 0.2rem; cursor: pointer;" title="Metin Rengi">
              <span style="font-size: 0.85rem; font-weight: 800; color: #ef4444;">A</span>
              <input type="color" id="tbTextColor" value="#0f172a" style="width: 22px; height: 22px; padding: 0; border: none; background: none; cursor: pointer;" />
            </label>
            <label style="display: flex; align-items: center; gap: 0.2rem; cursor: pointer;" title="Arka Plan Vurgu Rengi">
              <span style="font-size: 0.8rem; background: #fef08a; padding: 0 3px; border-radius: 3px; font-weight: 800; color: #0f172a;">H</span>
              <input type="color" id="tbBgColor" value="#fef08a" style="width: 22px; height: 22px; padding: 0; border: none; background: none; cursor: pointer;" />
            </label>
          </div>

          <div style="width: 1px; height: 20px; background: var(--border-light, #e2e8f0); margin: 0 0.15rem;"></div>

          <!-- Listeler ve Hizalama -->
          <div style="display: flex; align-items: center; gap: 0.15rem;">
            <button type="button" id="tbUl" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.4rem;" title="Madde İmli Liste">• Liste</button>
            <button type="button" id="tbOl" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.4rem;" title="Numaralı Liste">1. Liste</button>
            <button type="button" id="tbAlignLeft" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.35rem;" title="Sola Hizala">⇤</button>
            <button type="button" id="tbAlignCenter" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.35rem;" title="Ortala">≡</button>
            <button type="button" id="tbAlignRight" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.35rem;" title="Sağa Hizala">⇥</button>
            <button type="button" id="tbAlignJustify" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.35rem;" title="İki Yana Yasla">☵</button>
          </div>

          <div style="width: 1px; height: 20px; background: var(--border-light, #e2e8f0); margin: 0 0.15rem;"></div>

          <!-- Vurgu Kutusu, Tablo, Link, Çizgi, Temizle -->
          <div style="display: flex; align-items: center; gap: 0.2rem;">
            <select id="tbCallout" style="padding: 0.3rem 0.45rem; border-radius: 7px; border: 1px solid var(--border, #cbd5e1); font-size: 0.78rem; background: var(--bg-card); color: var(--text-primary); cursor: pointer;" title="Vurgu Kutusu Ekle">
              <option value="">💡 Vurgu Kutusu</option>
              <option value="info">ℹ️ Bilgi Kutusu</option>
              <option value="warning">⚠️ Uyarı Kutusu</option>
              <option value="success">✅ Başarı Kutusu</option>
              <option value="danger">❌ Kritik Hata</option>
            </select>
            <button type="button" id="tbTable" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.4rem;" title="Tablo Ekle">▦ Tablo</button>
            <button type="button" id="tbLink" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.4rem;" title="Bağlantı (Link) Ekle">🔗 Link</button>
            <button type="button" id="tbHr" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.4rem;" title="Yatay Çizgi Ekle">― Çizgi</button>
            <button type="button" id="tbClearFormat" class="btn btn-sm btn-ghost" style="padding: 0.25rem 0.4rem; color: #ef4444;" title="Biçimlendirmeyi Temizle">🧹</button>
          </div>

          <!-- Medya & Ek Ekleme Butonları -->
          <div style="margin-left: auto; display: flex; align-items: center; gap: 0.5rem;">
            <input type="file" id="inputAttachFile" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" style="display: none;" />
            <button type="button" id="btnAddAttachment" class="btn btn-sm" style="background: rgba(37,99,235,0.1); color: var(--accent, #2563eb); border: 1px solid rgba(37,99,235,0.25); font-weight: 700; display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.85rem;">
              <span>📎 Dosya / Belge Ekle</span>
            </button>
          </div>
        </div>

        <!-- ORTA ALAN: BELGE DÜZENLEYİCİ CANVAS & EKLER ÇEKMECESİ -->
        <div style="flex: 1; display: flex; overflow: hidden; position: relative;">
          
          <!-- EDİTÖR ÇALIŞMA ALANI -->
          <div style="flex: 1; overflow-y: auto; padding: 2rem 3rem; background: var(--bg-card, #f8fafc); display: flex; justify-content: center;">
            <div id="richNoteContent" contenteditable="true" style="width: 100%; max-width: 850px; min-height: 500px; background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 12px; padding: 2rem 2.5rem; outline: none; font-family: inherit; font-size: 0.95rem; line-height: 1.75; color: var(--text-primary, #0f172a); box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
              ${currentNoteHtml || '<p>Bu rapora ait detaylı notları, açıklamaları ve belgeleri buraya ekleyebilirsiniz...</p>'}
            </div>
          </div>

          <!-- SAĞ EKLER BÖLÜMÜ (ATTACHMENT TRAY) -->
          <div id="richNoteAttachmentsSidebar" style="width: 320px; border-left: 1px solid var(--border-light, #e2e8f0); background: var(--bg-surface, #ffffff); display: flex; flex-direction: column; overflow: hidden;">
            <div style="padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc); display: flex; align-items: center; justify-content: space-between;">
              <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-primary, #0f172a); display: flex; align-items: center; gap: 0.4rem;">
                <span>📎 Ekli Belgeler & Resimler</span>
                <span id="attCountBadge" style="font-size: 0.72rem; font-weight: 800; background: var(--bg-raised, #e2e8f0); padding: 1px 6px; border-radius: 9999px;">${attachments.length}</span>
              </div>
            </div>

            <!-- EKLER LİSTESİ -->
            <div id="richNoteAttachmentsList" style="flex: 1; overflow-y: auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem;">
              <!-- Dinamik olarak doldurulur -->
            </div>

            <!-- SÜRÜKLE BIRAK BİLGİLENDİRMESİ -->
            <div style="padding: 0.75rem; border-top: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc); font-size: 0.75rem; color: var(--text-muted, #64748b); text-align: center;">
              💡 Resimleri doğrudan <strong>Ctrl+V</strong> ile yapıştırabilir veya bu alana sürükleyebilirsiniz.
            </div>
          </div>
        </div>

        <!-- 3. ALT EYLEM ÇUBUĞU (FOOTER ACTIONS) -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1.6rem; border-top: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc);">
          <div style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.8rem; color: var(--text-muted, #64748b);">
            <span id="richNoteSaveStatus">Tüm değişiklikler otomatik taslağa alınır.</span>
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <button type="button" id="btnRichNoteDelete" class="btn btn-sm btn-ghost" style="color: #ef4444; font-weight: 700;">
              🗑️ Notu Sil
            </button>
            <button type="button" id="btnRichNoteCancel" class="btn btn-sm btn-secondary">Kapat</button>
            <button type="button" id="btnRichNoteSave" class="btn btn-sm btn-primary" style="font-weight: 800; padding: 0.5rem 1.5rem;">
              Kaydet & Eşitle
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const editor = overlay.querySelector('#richNoteContent');
    const attachmentsList = overlay.querySelector('#richNoteAttachmentsList');
    const attCountBadge = overlay.querySelector('#attCountBadge');
    const fileInput = overlay.querySelector('#inputAttachFile');
    const saveStatus = overlay.querySelector('#richNoteSaveStatus');

    // ── GÜVENLİ PENCERE KAPATMA (MOUSE SÜRÜKLEME KORUMASI) ──
    // Metin seçimi sırasında farenin dışarı kayması pencereyi ASLA kapatmaz!
    const close = () => overlay.remove();
    overlay.querySelector('#btnRichNoteClose').addEventListener('click', close);
    overlay.querySelector('#btnRichNoteCancel').addEventListener('click', close);

    let isMouseDownOnBackdrop = false;
    overlay.addEventListener('mousedown', (e) => {
      isMouseDownOnBackdrop = (e.target === overlay);
    });
    overlay.addEventListener('mouseup', (e) => {
      if (isMouseDownOnBackdrop && e.target === overlay) {
        close();
      }
      isMouseDownOnBackdrop = false;
    });

    function renderAttachments() {
      attCountBadge.textContent = attachments.length;
      if (attachments.length === 0) {
        attachmentsList.innerHTML = `
          <div style="text-align: center; color: var(--text-muted, #64748b); padding: 3rem 1rem; font-size: 0.82rem;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.6;">📁</div>
            Henüz eklenmiş dosya veya resim yok.
          </div>
        `;
        return;
      }

      attachmentsList.innerHTML = '';
      attachments.forEach((att, idx) => {
        const isImage = (att.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.name || '');
        const isPdf = (att.type === 'application/pdf') || /\.pdf$/i.test(att.name || '');
        const token = (window.FrpAuth && typeof window.FrpAuth.getToken === 'function') ? window.FrpAuth.getToken() : '';
        const authUrl = (att.url.startsWith('data:') || att.url.startsWith('blob:') || !token)
          ? att.url
          : `${att.url}${att.url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;

        const card = document.createElement('div');
        card.style.cssText = `
          background: var(--bg-card, #f8fafc); border: 1px solid var(--border, #cbd5e1); border-radius: 10px;
          padding: 0.65rem; display: flex; flex-direction: column; gap: 0.45rem; transition: border-color 0.15s;
        `;

        const badgeWrap = document.createElement('div');
        badgeWrap.style.cssText = 'width: 38px; height: 38px; border-radius: 7px; overflow: hidden; background: #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';

        if (isImage) {
          const img = document.createElement('img');
          img.src = authUrl;
          img.alt = att.name;
          img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
          img.addEventListener('error', () => {
            badgeWrap.innerHTML = '<span style="font-size:1.2rem;">🖼️</span>';
          });
          badgeWrap.appendChild(img);
        } else if (isPdf) {
          badgeWrap.innerHTML = `
            <div style="width: 100%; height: 100%; background: #fee2e2; color: #dc2626; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 900; border: 1px solid #fecaca; line-height: 1;">
              <span style="font-size: 0.8rem;">📄</span>
              <span style="font-size: 0.58rem; letter-spacing: 0.5px; margin-top: 1px;">PDF</span>
            </div>
          `;
        } else {
          badgeWrap.innerHTML = `
            <div style="width: 100%; height: 100%; background: #e0f2fe; color: #0284c7; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800; font-size: 0.6rem;">
              <span>DOC</span>
            </div>
          `;
        }

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; align-items: center; gap: 0.6rem;';
        topRow.appendChild(badgeWrap);

        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'flex: 1; min-width: 0;';
        infoDiv.innerHTML = `
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary, #0f172a); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escHtml(att.name)}">
            ${escHtml(att.name)}
          </div>
          <div style="font-size: 0.7rem; color: var(--text-muted, #64748b);">
            ${formatFileSize(att.size)}
          </div>
        `;
        topRow.appendChild(infoDiv);
        card.appendChild(topRow);

        const actRow = document.createElement('div');
        actRow.style.cssText = 'display: flex; align-items: center; gap: 0.35rem; justify-content: flex-end; padding-top: 0.35rem; border-top: 1px dashed var(--border-light, #e2e8f0);';
        actRow.innerHTML = `
          ${isImage ? `
            <button type="button" class="btn btn-sm btn-ghost btn-att-annotate" data-idx="${idx}" style="font-size: 0.72rem; padding: 0.2rem 0.45rem; color: var(--accent, #2563eb); font-weight: 700;" title="Görsel üzerine daire, ok ve çizim yap">✏️ İşaretle</button>
          ` : ''}
          <button type="button" class="btn btn-sm btn-ghost btn-att-preview" data-idx="${idx}" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;" title="Önizle">👁️ Önizle</button>
          <button type="button" class="btn btn-sm btn-ghost btn-att-download" data-idx="${idx}" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;" title="İndir">⬇️ İndir</button>
          <button type="button" class="btn btn-sm btn-ghost btn-att-delete" data-idx="${idx}" style="font-size: 0.72rem; padding: 0.2rem 0.45rem; color: #ef4444;" title="Sil">✕</button>
        `;
        card.appendChild(actRow);

        // Buton olayları
        const btnAnnotate = card.querySelector('.btn-att-annotate');
        if (btnAnnotate) {
          btnAnnotate.addEventListener('click', async () => {
            if (typeof window.openImageAnnotator === 'function') {
              const fullImageUrl = await getAuthenticatedMediaUrl(att.url);
              window.openImageAnnotator({
                imageUrl: fullImageUrl,
                imageName: att.name,
                onSave: (annotatedDataUrl) => {
                  attachments[idx] = {
                    ...attachments[idx],
                    url: annotatedDataUrl,
                    name: (att.name.replace(/\.[^/.]+$/, '')) + '_isaretli.png'
                  };
                  renderAttachments();
                  if (typeof window.toast === 'function') window.toast('Görsel üzerindeki işaretlemeler kaydedildi.', 'success');
                }
              });
            }
          });
        }

        const btnPreview = card.querySelector('.btn-att-preview');
        if (btnPreview) {
          btnPreview.addEventListener('click', () => openAttachmentPreview(att));
        }

        const btnDownload = card.querySelector('.btn-att-download');
        if (btnDownload) {
          btnDownload.addEventListener('click', () => downloadAttachment(att));
        }

        const btnDelete = card.querySelector('.btn-att-delete');
        if (btnDelete) {
          btnDelete.addEventListener('click', () => {
            showModernConfirmDialog({
              title: 'Eki Sil',
              message: `"${att.name}" dosyasını rapordan kaldırmak istediğinize emin misiniz?`,
              confirmText: 'Eki Kaldır',
              isDanger: true,
              onConfirm: () => {
                attachments.splice(idx, 1);
                renderAttachments();
                if (typeof window.toast === 'function') window.toast('Ek kaldırıldı.', 'info');
              }
            });
          });
        }

        attachmentsList.appendChild(card);
      });
    }

    renderAttachments();

    // Word Araç Çubuğu Komutları
    function formatDoc(cmd, value = null) {
      document.execCommand(cmd, false, value);
      editor.focus();
    }

    overlay.querySelector('#tbFontName')?.addEventListener('change', (e) => {
      formatDoc('fontName', e.target.value);
    });

    overlay.querySelector('#tbFormatBlock')?.addEventListener('change', (e) => {
      formatDoc('formatBlock', e.target.value);
    });

    function applyPixelFontSize(sizePx) {
      document.execCommand('fontSize', false, '7');
      const fontElements = editor.querySelectorAll('font[size="7"]');
      fontElements.forEach(el => {
        el.removeAttribute('size');
        el.style.fontSize = sizePx;
      });
      editor.focus();
    }

    const fontSizeInput = overlay.querySelector('#tbFontSizeNum');
    if (fontSizeInput) {
      fontSizeInput.addEventListener('change', () => {
        let val = parseInt(fontSizeInput.value, 10);
        if (isNaN(val) || val < 6) val = 6;
        if (val > 144) val = 144;
        fontSizeInput.value = val;
        applyPixelFontSize(val + 'px');
      });

      overlay.querySelector('#tbFontSizeInc')?.addEventListener('click', () => {
        let val = (parseInt(fontSizeInput.value, 10) || 14) + 1;
        if (val > 144) val = 144;
        fontSizeInput.value = val;
        applyPixelFontSize(val + 'px');
      });

      overlay.querySelector('#tbFontSizeDec')?.addEventListener('click', () => {
        let val = (parseInt(fontSizeInput.value, 10) || 14) - 1;
        if (val < 6) val = 6;
        fontSizeInput.value = val;
        applyPixelFontSize(val + 'px');
      });
    }

    overlay.querySelector('#tbLineHeight')?.addEventListener('change', (e) => {
      editor.style.lineHeight = e.target.value;
    });

    overlay.querySelector('#tbUndo')?.addEventListener('click', () => formatDoc('undo'));
    overlay.querySelector('#tbRedo')?.addEventListener('click', () => formatDoc('redo'));

    overlay.querySelector('#tbBold')?.addEventListener('click', () => formatDoc('bold'));
    overlay.querySelector('#tbItalic')?.addEventListener('click', () => formatDoc('italic'));
    overlay.querySelector('#tbUnderline')?.addEventListener('click', () => formatDoc('underline'));
    overlay.querySelector('#tbStrike')?.addEventListener('click', () => formatDoc('strikeThrough'));
    overlay.querySelector('#tbSub')?.addEventListener('click', () => formatDoc('subscript'));
    overlay.querySelector('#tbSup')?.addEventListener('click', () => formatDoc('superscript'));

    overlay.querySelector('#tbCallout')?.addEventListener('change', (e) => {
      const type = e.target.value;
      if (!type) return;
      e.target.value = '';
      const calloutStyles = {
        info: { bg: '#eff6ff', border: '#3b82f6', icon: 'ℹ️', title: 'Bilgi Notu', text: '#1e40af' },
        warning: { bg: '#fffbeb', border: '#f59e0b', icon: '⚠️', title: 'Dikkat / Uyarı', text: '#92400e' },
        success: { bg: '#ecfdf5', border: '#10b981', icon: '✅', title: 'Başarılı / Onay', text: '#065f46' },
        danger: { bg: '#fef2f2', border: '#ef4444', icon: '❌', title: 'Kritik Durum', text: '#991b1b' }
      };
      const style = calloutStyles[type] || calloutStyles.info;
      const html = `
        <div style="background: ${style.bg}; border-left: 4px solid ${style.border}; border-radius: 8px; padding: 0.85rem 1.1rem; margin: 1rem 0; color: ${style.text}; font-size: 0.92rem;">
          <div style="font-weight: 800; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.35rem;">
            <span>${style.icon}</span> <span>${style.title}</span>
          </div>
          <div>Buraya açıklamayı ve önemli detayları girin...</div>
        </div>
        <p><br></p>
      `;
      formatDoc('insertHTML', html);
    });

    overlay.querySelector('#tbTextColor')?.addEventListener('change', (e) => formatDoc('foreColor', e.target.value));
    overlay.querySelector('#tbBgColor')?.addEventListener('change', (e) => formatDoc('hiliteColor', e.target.value));

    overlay.querySelector('#tbUl')?.addEventListener('click', () => formatDoc('insertUnorderedList'));
    overlay.querySelector('#tbOl')?.addEventListener('click', () => formatDoc('insertOrderedList'));
    overlay.querySelector('#tbAlignLeft')?.addEventListener('click', () => formatDoc('justifyLeft'));
    overlay.querySelector('#tbAlignCenter')?.addEventListener('click', () => formatDoc('justifyCenter'));
    overlay.querySelector('#tbAlignRight')?.addEventListener('click', () => formatDoc('justifyRight'));
    overlay.querySelector('#tbAlignJustify')?.addEventListener('click', () => formatDoc('justifyFull'));
    overlay.querySelector('#tbClearFormat')?.addEventListener('click', () => formatDoc('removeFormat'));
    overlay.querySelector('#tbHr')?.addEventListener('click', () => formatDoc('insertHorizontalRule'));

    overlay.querySelector('#tbTable').addEventListener('click', () => {
      const tableHtml = `
        <table style="width: 100%; border-collapse: collapse; margin: 1rem 0; border: 1px solid var(--border, #cbd5e1);">
          <thead>
            <tr style="background: var(--bg-card, #f1f5f9);">
              <th style="border: 1px solid var(--border, #cbd5e1); padding: 0.5rem 0.75rem; text-align: left;">Sütun 1</th>
              <th style="border: 1px solid var(--border, #cbd5e1); padding: 0.5rem 0.75rem; text-align: left;">Sütun 2</th>
              <th style="border: 1px solid var(--border, #cbd5e1); padding: 0.5rem 0.75rem; text-align: left;">Açıklama</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid var(--border, #cbd5e1); padding: 0.5rem 0.75rem;">Veri 1</td>
              <td style="border: 1px solid var(--border, #cbd5e1); padding: 0.5rem 0.75rem;">Veri 2</td>
              <td style="border: 1px solid var(--border, #cbd5e1); padding: 0.5rem 0.75rem;">Detay</td>
            </tr>
          </tbody>
        </table>
        <p><br></p>
      `;
      formatDoc('insertHTML', tableHtml);
    });

    // Modern Link Modalı & Editör İçi Tıklanabilir Bağlantı Çubuğu
    let savedRange = null;
    function saveSelection() {
      const sel = window.getSelection();
      if (sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
    }
    function restoreSelection() {
      if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
      }
    }

    overlay.querySelector('#tbLink').addEventListener('click', () => {
      saveSelection();
      const sel = window.getSelection();
      const selectedText = sel ? sel.toString().trim() : '';

      showModernLinkModal({
        initialUrl: '',
        initialText: selectedText,
        onSave: ({ url, text, targetBlank }) => {
          restoreSelection();
          editor.focus();
          const targetAttr = targetBlank ? ' target="_blank" rel="noopener noreferrer"' : '';
          const linkHtml = `<a href="${escHtml(url)}"${targetAttr} style="color: #2563eb; text-decoration: underline; font-weight: 600;">${escHtml(text)}</a>`;
          document.execCommand('insertHTML', false, linkHtml);
        }
      });
    });

    // Editör İçi Link Araç Çubuğu (Linke tıklandığında Aç / Düzenle / Kaldır popover'ı)
    let activeLinkTooltip = null;
    function removeLinkTooltip() {
      if (activeLinkTooltip) {
        activeLinkTooltip.remove();
        activeLinkTooltip = null;
      }
    }

    editor.addEventListener('click', (e) => {
      const linkEl = e.target.closest('a');
      removeLinkTooltip();
      if (!linkEl) return;

      e.preventDefault(); // Editör içinde doğrudan sayfa yenilenmesini engeller

      const rect = linkEl.getBoundingClientRect();
      const tip = document.createElement('div');
      tip.id = 'frpEditorLinkTooltip';
      tip.style.cssText = `
        position: fixed; top: ${rect.top - 42}px; left: ${Math.max(10, rect.left)}px;
        z-index: 200050; display: flex; align-items: center; gap: 0.35rem;
        background: #0f172a; color: #ffffff; padding: 0.35rem 0.65rem; border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.4); font-size: 0.76rem; font-weight: 600;
        animation: fadeIn 0.15s ease-out;
      `;

      const hrefDisplay = linkEl.getAttribute('href') || '';
      tip.innerHTML = `
        <span style="color: #93c5fd; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">🔗 ${escHtml(hrefDisplay)}</span>
        <button type="button" id="btnTipOpen" class="btn btn-sm" style="padding: 0.15rem 0.45rem; font-size: 0.72rem; background: #2563eb; color: #ffffff; border: none; border-radius: 4px; cursor: pointer;">↗️ Aç</button>
        <button type="button" id="btnTipEdit" class="btn btn-sm btn-ghost" style="padding: 0.15rem 0.45rem; font-size: 0.72rem; color: #f8fafc; cursor: pointer;">✏️ Düzenle</button>
        <button type="button" id="btnTipRemove" class="btn btn-sm btn-ghost" style="padding: 0.15rem 0.45rem; font-size: 0.72rem; color: #ef4444; cursor: pointer;">🗑️ Kaldır</button>
      `;

      document.body.appendChild(tip);
      activeLinkTooltip = tip;

      tip.querySelector('#btnTipOpen').addEventListener('click', (ev) => {
        ev.stopPropagation();
        window.open(linkEl.href, '_blank', 'noopener,noreferrer');
        removeLinkTooltip();
      });

      tip.querySelector('#btnTipEdit').addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeLinkTooltip();
        showModernLinkModal({
          initialUrl: linkEl.getAttribute('href') || '',
          initialText: linkEl.textContent || '',
          onSave: ({ url, text, targetBlank }) => {
            linkEl.setAttribute('href', url);
            linkEl.textContent = text;
            if (targetBlank) {
              linkEl.setAttribute('target', '_blank');
              linkEl.setAttribute('rel', 'noopener noreferrer');
            } else {
              linkEl.removeAttribute('target');
              linkEl.removeAttribute('rel');
            }
          }
        });
      });

      tip.querySelector('#btnTipRemove').addEventListener('click', (ev) => {
        ev.stopPropagation();
        linkEl.replaceWith(document.createTextNode(linkEl.textContent));
        removeLinkTooltip();
      });
    });

    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || !sel.anchorNode || !editor.contains(sel.anchorNode)) {
        removeLinkTooltip();
      }
    });

    overlay.addEventListener('mousedown', (e) => {
      if (activeLinkTooltip && !activeLinkTooltip.contains(e.target) && !e.target.closest('a')) {
        removeLinkTooltip();
      }
    });

    // Dosya Ekleme İşleyicisi
    const btnAddAttachment = overlay.querySelector('#btnAddAttachment');
    btnAddAttachment.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      const files = Array.from(fileInput.files || []);
      for (const f of files) {
        await processUploadedFile(f);
      }
      fileInput.value = '';
    });

    async function processUploadedFile(fileObj) {
      if (fileObj.size > 15 * 1024 * 1024) {
        if (typeof window.toast === 'function') window.toast(`${fileObj.name} dosyası 15 MB sınırını aşıyor.`, 'error');
        return;
      }

      saveStatus.textContent = 'Dosya yükleniyor...';

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const base64Data = ev.target.result;
        try {
          const authHeaders = window.FrpAuth && window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' };
          const res = await fetch(`/api/reports/${encodeURIComponent(fileId)}/attachments`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              filename: fileObj.name,
              mimeType: fileObj.type,
              base64Data
            })
          });
          const data = await res.json();
          if (data && data.success && data.attachment) {
            attachments.push(data.attachment);
          } else {
            attachments.push({
              id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              name: fileObj.name,
              size: fileObj.size,
              type: fileObj.type,
              url: base64Data,
              uploadedAt: new Date().toISOString()
            });
          }
        } catch {
          attachments.push({
            id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            name: fileObj.name,
            size: fileObj.size,
            type: fileObj.type,
            url: base64Data,
            uploadedAt: new Date().toISOString()
          });
        }
        renderAttachments();
        saveStatus.textContent = '';
      };
      reader.readAsDataURL(fileObj);
    }

    // Pano Görsel Yapıştırma (Ctrl+V)
    editor.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            await processUploadedFile(new File([blob], `ekran_goruntusu_${Date.now()}.png`, { type: blob.type }));
          }
        }
      }
    });

    // Modern "Tüm Notu Sil" Butonu
    const btnDelete = overlay.querySelector('#btnRichNoteDelete');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        showModernConfirmDialog({
          title: 'Tüm Notu ve Belgeleri Sil',
          message: 'Bu rapora ait tüm zengin metin notları ve ekli belgeler <strong>kalıcı olarak silinecektir</strong>. Bu işlem geri alınamaz.',
          confirmText: 'Evet, Kalıcı Olarak Sil',
          isDanger: true,
          onConfirm: async () => {
            saveStatus.textContent = 'Siliniyor...';
            try {
              await fetch(`/api/reports/${encodeURIComponent(fileId)}/note`, {
                method: 'PATCH',
                headers: window.FrpAuth ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userNote: '', noteHtml: '', attachments: [] })
              });
            } catch {}

            if (window.FrpStore && typeof window.FrpStore.updateNote === 'function') {
              await window.FrpStore.updateNote(fileId, '', { noteHtml: '', attachments: [] });
            }

            if (typeof window.toast === 'function') window.toast('Rapor notları ve ekleri silindi.', 'info');
            if (typeof window.refreshAll === 'function') window.refreshAll();
            close();
          }
        });
      });
    }

    // Kaydet ve Eşitle
    const btnSave = overlay.querySelector('#btnRichNoteSave');
    btnSave.addEventListener('click', async () => {
      btnSave.disabled = true;
      btnSave.textContent = 'Kaydediliyor...';
      saveStatus.textContent = 'Buluta kaydediliyor...';

      const noteHtml = editor.innerHTML;
      const plainText = editor.innerText.trim();

      try {
        const authHeaders = window.FrpAuth && window.FrpAuth.getAuthHeaders ? window.FrpAuth.getAuthHeaders() : { 'Content-Type': 'application/json' };
        await fetch(`/api/reports/${encodeURIComponent(fileId)}/note`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({
            userNote: plainText,
            noteHtml,
            attachments
          })
        });
      } catch (err) {
        console.warn('Sunucu not güncelleme hatası:', err);
      }

      if (window.FrpStore && typeof window.FrpStore.updateNote === 'function') {
        await window.FrpStore.updateNote(fileId, plainText, { noteHtml, attachments });
      }

      if (typeof window.toast === 'function') {
        window.toast('Rapor zengin notu ve belgeleri başarıyla kaydedildi.', 'success');
      }
      if (typeof window.refreshAll === 'function') window.refreshAll();

      close();
    });
  }

  window.FrpRichNoteEditor = {
    open: openRichNoteModal
  };

  if (!window.FrpListModals) window.FrpListModals = {};
  window.FrpListModals.openReportNoteModal = openRichNoteModal;
  window.openReportNoteModal = openRichNoteModal;
})();
