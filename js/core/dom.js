function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function esc(value) {
  return escHtml(value);
}

// Inline event handler içinde yalnızca geriye dönük şablonlar için kullanılır.
// encodeURIComponent tek tırnağı kodlamadığı için onu da açıkça dönüştürür.
function encodeInlineArg(value) {
  return encodeURIComponent(String(value ?? '')).replace(/'/g, '%27');
}

function ensureToastElement() {
  let toast = document.getElementById('toastDetail');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastDetail';
    document.body.appendChild(toast);
  }
  return toast;
}

function showToast(message, type = 'info', duration = 3500) {
  const toast = ensureToastElement();
  const icons = { success: '', error: '', warning: '', info: '' };
  toast.className = '';
  toast.classList.add(type);
  toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${escHtml(message)}</span>`;
  requestAnimationFrame(() => toast.classList.add('show'));
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

window.escHtml = escHtml;
window.esc = esc;
window.encodeInlineArg = encodeInlineArg;
window.showToast = showToast;
// Note: window.toast is NOT set here - list.js defines function toast() for the list page
// detail.js/app.js pages use showToast() directly

// İşlevi anlaşılır metin taşıyan butonlara uygulama genelinde tutarlı renk dili kazandırır.
// Açıkça atanmış btn-primary / btn-danger sınıflarına dokunmaz; dinamik modalları da izler.
(function initSemanticButtonTones() {
  const toneClasses = ['action-tone-success', 'action-tone-danger', 'action-tone-create', 'action-tone-edit', 'action-tone-info', 'action-tone-neutral'];
  const normalize = value => String(value || '').toLocaleLowerCase('tr-TR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function inferTone(button) {
    if (!(button instanceof HTMLElement) || button.matches('[data-button-tone="none"], .btn-danger, .btn-success')) return '';
    const explicit = button.dataset.buttonTone;
    if (explicit && explicit !== 'auto') return explicit;
    const source = normalize([
      button.id, button.name, button.title, button.getAttribute('aria-label'), button.textContent,
      button.dataset.action, button.dataset.detailAction
    ].filter(Boolean).join(' '));
    if (!source.trim()) return '';
    if (/(sil|delete|remove|kaldir|cop|sifirla|reset|purge|cikis|logout|vazgec)/.test(source)) return 'danger';
    if (/(kaydet|save|onayla|confirm|uygula|tamamla|geri yukle|restore)/.test(source)) return 'success';
    if (/(ekle|yeni|olustur|upload|yukle|paylas|share|indir|download|ice aktar|kopyala)/.test(source)) return 'create';
    if (/(duzenle|edit|format|bicim|yeniden adlandir|degistir|kompakt|tek satir|buyuk harf)/.test(source)) return 'edit';
    if (/(gecmis|history|denetim|audit|analiz|analysis|test|kontrol|detay|bilgi|incele)/.test(source)) return 'info';
    if (/(iptal|cancel|kapat|close|geri|back|goruntule|preview)/.test(source)) return 'neutral';
    return '';
  }

  function colorButton(button) {
    if (!(button instanceof HTMLElement) || !button.matches('button, [role="button"]')) return;
    toneClasses.forEach(className => button.classList.remove(className));
    const tone = inferTone(button);
    if (tone) button.classList.add(`action-tone-${tone}`);
  }

  function colorTree(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;
    colorButton(root);
    root.querySelectorAll?.('button, [role="button"]').forEach(colorButton);
  }

  const start = () => {
    if (!document || !document.body) return;
    colorTree(document.body);
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(colorTree)))
        .observe(document.body, { childList: true, subtree: true });
    }
  };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})();
