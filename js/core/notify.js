/**
 * FrpOku - Akıllı ve Modern Çok Katmanlı Bildirim Motoru (Toast Notification System)
 * Seviyeler: info, success, warning, error, security
 */

(function () {
 'use strict';

 let container = null;

 function ensureContainer() {
 if (!container ||!document.body.contains(container)) {
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
 info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
 success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
 warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
 error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
 security: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'
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
 ${showProgress && duration > 0? `<div class="frp-toast-progress" style="animation-duration: ${duration}ms;"></div>`: ''}
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

 function showUndoToast({ title = 'Güncelleme Yapıldı', message, undoText = '↩️ Geri Al', onUndo, duration = 8000 }) {
 const parent = ensureContainer();
 const toast = document.createElement('div');
 toast.className = 'frp-toast frp-toast-info frp-toast-undo';

 toast.innerHTML = `
 <div class="frp-toast-icon">ℹ️</div>
 <div class="frp-toast-content" style="flex:1;">
 <div class="frp-toast-title">${escapeHtml(title)}</div>
 <div class="frp-toast-msg">${escapeHtml(message || '')}</div>
 </div>
 <button type="button" class="btn btn-xs btn-primary frp-toast-undo-btn" style="padding:4px 10px;font-weight:700;font-size:11.5px;border-radius:6px;margin:0 6px;white-space:nowrap;">${escapeHtml(undoText)}</button>
 <button class="frp-toast-close" title="Kapat" aria-label="Kapat">&times;</button>
 <div class="frp-toast-progress" style="animation-duration: ${duration}ms;"></div>
 `;

 function closeToast() {
 if (toast.classList.contains('toast-hiding')) return;
 toast.classList.add('toast-hiding');
 setTimeout(() => {
 if (toast.parentNode) toast.parentNode.removeChild(toast);
 }, 220);
 }

 toast.querySelector('.frp-toast-close').addEventListener('click', closeToast);
 toast.querySelector('.frp-toast-undo-btn').addEventListener('click', async () => {
 closeToast();
 if (typeof onUndo === 'function') {
 try {
 await onUndo();
 } catch (err) {
 console.error('Undo error:', err);
 }
 }
 });

 let timer = setTimeout(closeToast, duration);

 toast.addEventListener('mouseenter', () => {
 if (timer) clearTimeout(timer);
 const prog = toast.querySelector('.frp-toast-progress');
 if (prog) prog.style.animationPlayState = 'paused';
 });

 toast.addEventListener('mouseleave', () => {
 timer = setTimeout(closeToast, 2500);
 const prog = toast.querySelector('.frp-toast-progress');
 if (prog) prog.style.animationPlayState = 'running';
 });

 parent.appendChild(toast);
 return toast;
 }

 function escapeHtml(str) {
 if (typeof str!== 'string') return String(str || '');
 return str
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#39;');
 }

 window.FrpNotify = {
 show,
 showUndoToast,
 info: (message, title, duration) => show({ type: 'info', message, title, duration }),
 success: (message, title, duration) => show({ type: 'success', message, title, duration }),
 warn: (message, title, duration) => show({ type: 'warning', message, title, duration: duration || 5500 }),
 error: (message, title, duration) => show({ type: 'error', message, title, duration: duration || 6500 }),
 security: (message, title, duration) => show({ type: 'security', message, title, duration: duration || 8000 })
 };

 window.showUndoToast = showUndoToast;

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
