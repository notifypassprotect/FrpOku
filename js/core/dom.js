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
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
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
