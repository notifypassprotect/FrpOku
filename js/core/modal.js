function escModalHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showModal({
  title,
  body,
  confirmText = 'Evet',
  cancelText = 'İptal',
  danger = false,
  maxWidth = '540px',
  onOpen = null,
  onConfirm = null,
  closeOnBackdrop = true,
  buttons = null
}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    let actionsHtml = '';
    if (Array.isArray(buttons) && buttons.length > 0) {
      actionsHtml = buttons.map((b, idx) => {
        const cls = b.className || (idx === 0 ? 'btn-primary' : 'btn-secondary');
        return `<button type="button" class="btn btn-sm ${cls}" data-modal-btn="${idx}">${escModalHtml(b.text)}</button>`;
      }).join(' ');
    } else {
      actionsHtml = `
        ${cancelText ? `<button type="button" class="btn btn-sm modal-cancel-btn" id="modalCancel">${escModalHtml(cancelText)}</button>` : ''}
        ${confirmText ? `<button type="button" class="btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'} modal-confirm-btn" id="modalConfirm">${escModalHtml(confirmText)}</button>` : ''}
      `;
    }

    overlay.innerHTML = `
      <div class="modal" style="max-width:${maxWidth};">
        <div class="modal-title">${title}</div>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          ${actionsHtml}
        </div>
      </div>`;
    document.body.appendChild(overlay);

    if (typeof onOpen === 'function') {
      requestAnimationFrame(() => onOpen(overlay));
    }

    // Buton dinleyicileri
    if (Array.isArray(buttons) && buttons.length > 0) {
      overlay.querySelectorAll('[data-modal-btn]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idx = parseInt(btn.getAttribute('data-modal-btn'), 10);
          const btnDef = buttons[idx];
          if (btnDef && typeof btnDef.onClick === 'function') {
            const shouldClose = await btnDef.onClick(overlay);
            if (shouldClose === false) return;
          }
          overlay.remove();
          resolve(btnDef ? btnDef.value : null);
        });
      });
    } else {
      const confirmBtn = overlay.querySelector('#modalConfirm');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          if (typeof onConfirm === 'function') {
            const canClose = await onConfirm(overlay);
            if (canClose === false) return;
          }
          overlay.remove();
          resolve(true);
        });
      }

      const cancelBtn = overlay.querySelector('#modalCancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          overlay.remove();
          resolve(false);
        });
      }
    }

    // Dışarı tıklama (Backdrop) - Sadece doğrudan arkaplanda başlayıp biten tıklamalarda kapat
    let isMouseDownOnBackdrop = false;
    overlay.addEventListener('mousedown', e => {
      isMouseDownOnBackdrop = (e.target === overlay);
    });
    overlay.addEventListener('mouseup', e => {
      if (isMouseDownOnBackdrop && e.target === overlay && closeOnBackdrop) {
        overlay.remove();
        resolve(false);
      }
      isMouseDownOnBackdrop = false;
    });

    // ESC Tuşu ile Güvenli Kapatma
    const onKeydown = (e) => {
      if (e.key === 'Escape' && document.body.contains(overlay)) {
        document.removeEventListener('keydown', onKeydown);
        overlay.remove();
        resolve(false);
      }
    };
    document.addEventListener('keydown', onKeydown);
  });
}

function showChoiceModal({ title, body, buttons = [], maxWidth = '540px', onOpen = null }) {
  return showModal({
    title,
    body,
    buttons,
    maxWidth,
    onOpen,
    closeOnBackdrop: true
  });
}

function showPromptModal({
  title = 'Bilgi Girişi',
  message = '',
  defaultValue = '',
  placeholder = '',
  confirmText = 'Tamam',
  cancelText = 'İptal',
  inputType = 'text',
  isTextarea = false,
  badge = '✏️',
  maxWidth = '460px'
}) {
  return new Promise(resolve => {
    const inputId = 'prompt_inp_' + Date.now();
    const inputHtml = isTextarea
      ? `<textarea id="${inputId}" class="master-search-input" style="width:100%;min-height:90px;padding:8px 12px;border-radius:8px;font-size:13px;resize:vertical;font-family:var(--font);box-sizing:border-box;" placeholder="${escModalHtml(placeholder)}">${escModalHtml(defaultValue)}</textarea>`
      : `<input type="${inputType}" id="${inputId}" class="master-search-input" style="width:100%;padding:8px 12px;border-radius:8px;font-size:13px;font-family:var(--font);box-sizing:border-box;" value="${escModalHtml(defaultValue)}" placeholder="${escModalHtml(placeholder)}" />`;

    const bodyHtml = `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${message ? `<div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">${message}</div>` : ''}
        <div>${inputHtml}</div>
      </div>
    `;

    showModal({
      title: `${badge ? `<span style="margin-right:6px;">${badge}</span>` : ''}${title}`,
      body: bodyHtml,
      confirmText,
      cancelText,
      maxWidth,
      onOpen: (overlay) => {
        const inp = overlay.querySelector(`#${inputId}`);
        if (inp) {
          inp.focus();
          if (inp.select) inp.select();
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !isTextarea) {
              e.preventDefault();
              overlay.querySelector('#modalConfirm')?.click();
            }
          });
        }
      },
      onConfirm: (overlay) => {
        const inp = overlay.querySelector(`#${inputId}`);
        resolve(inp ? inp.value.trim() : null);
        return true;
      }
    }).then(res => {
      if (res === false) resolve(null);
    });
  });
}

window.showModal = showModal;
window.showChoiceModal = showChoiceModal;
window.showPromptModal = showPromptModal;