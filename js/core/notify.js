/**
 * FrpOku - Akıllı ve Modern Çok Katmanlı Bildirim Motoru (Toast Notification System)
 * Seviyeler: info (ℹ️), success (✅), warning (⚠️), error (❌), security (🚨)
 */

(function () {
  'use strict';

  let container = null;

  function ensureContainer() {
    if (!container || !document.body.contains(container)) {
      container = document.querySelector('.frp-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'frp-toast-container';
        document.body.appendChild(container);
      }
    }
    return container;
  }

  const ICONS = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    security: '🚨'
  };

  const DEFAULT_TITLES = {
    info: 'Bilgilendirme',
    success: 'İşlem Başarılı',
    warning: 'Uyarı ve Dikkat',
    error: 'Hata Meydana Geldi',
    security: 'Güvenlik Uyarısı'
  };

  function show({ type = 'info', title, message, duration = 4500, showProgress = true }) {
    const parent = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `frp-toast frp-toast-${type}`;

    const icon = ICONS[type] || ICONS.info;
    const toastTitle = title || DEFAULT_TITLES[type] || 'Bildirim';

    toast.innerHTML = `
      <div class="frp-toast-icon">${icon}</div>
      <div class="frp-toast-content">
        <div class="frp-toast-title">${escapeHtml(toastTitle)}</div>
        <div class="frp-toast-msg">${escapeHtml(message || '')}</div>
      </div>
      <button class="frp-toast-close" title="Kapat" aria-label="Kapat">&times;</button>
      ${showProgress && duration > 0 ? `<div class="frp-toast-progress" style="animation-duration: ${duration}ms;"></div>` : ''}
    `;

    function closeToast() {
      if (toast.classList.contains('toast-hiding')) return;
      toast.classList.add('toast-hiding');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 220);
    }

    const closeBtn = toast.querySelector('.frp-toast-close');
    closeBtn.addEventListener('click', closeToast);

    let timer = null;
    if (duration > 0) {
      timer = setTimeout(closeToast, duration);
    }

    // Hover duraklatma
    toast.addEventListener('mouseenter', () => {
      if (timer) clearTimeout(timer);
      const prog = toast.querySelector('.frp-toast-progress');
      if (prog) prog.style.animationPlayState = 'paused';
    });

    toast.addEventListener('mouseleave', () => {
      if (duration > 0) {
        timer = setTimeout(closeToast, 2000);
        const prog = toast.querySelector('.frp-toast-progress');
        if (prog) prog.style.animationPlayState = 'running';
      }
    });

    parent.appendChild(toast);
    return toast;
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.FrpNotify = {
    show,
    info: (message, title, duration) => show({ type: 'info', message, title, duration }),
    success: (message, title, duration) => show({ type: 'success', message, title, duration }),
    warn: (message, title, duration) => show({ type: 'warning', message, title, duration: duration || 5500 }),
    error: (message, title, duration) => show({ type: 'error', message, title, duration: duration || 6500 }),
    security: (message, title, duration) => show({ type: 'security', message, title, duration: duration || 8000 })
  };

  // Eski toast çağrıları için global köprü
  window.showToast = function (msg, type = 'info') {
    if (type === 'error' || type === 'danger') {
      window.FrpNotify.error(msg);
    } else if (type === 'warn' || type === 'warning') {
      window.FrpNotify.warn(msg);
    } else if (type === 'success') {
      window.FrpNotify.success(msg);
    } else {
      window.FrpNotify.info(msg);
    }
  };
})();
