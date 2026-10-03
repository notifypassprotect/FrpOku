/* Shared progress surface for long, confirmed destructive operations. */
(function () {
  window.FrpBulkProgress = {
    create(title, total) {
      const previous = document.activeElement;
      const dialog = document.createElement('dialog');
      dialog.className = 'fr-bulk-progress';
      dialog.setAttribute('aria-label', title);
      dialog.style.cssText = 'margin:auto;width:min(460px,92vw);padding:24px;border:1px solid var(--border,#ccd5e0);border-radius:14px;background:var(--bg-surface,#fff);color:var(--text-primary,#172033);box-shadow:0 20px 70px #0004;font:14px/1.6 var(--font,sans-serif)';
      dialog.innerHTML = '<h2 style="font-size:17px;margin:0 0 12px" data-title></h2><strong data-count style="display:block;font-size:28px;margin-bottom:12px"></strong><progress aria-label="Tamamlanan işlemler" style="width:100%;height:14px"></progress><p data-phase style="margin:12px 0 4px;overflow-wrap:anywhere"></p><p data-summary role="status" aria-live="polite" style="font-size:12px;margin:4px 0 16px"></p><button type="button" class="btn btn-primary" data-close disabled>Kapat</button>';
      dialog.querySelector('[data-title]').textContent = title;
      const counter = dialog.querySelector('[data-count]');
      const bar = dialog.querySelector('progress');
      const phase = dialog.querySelector('[data-phase]');
      const summary = dialog.querySelector('[data-summary]');
      const close = dialog.querySelector('[data-close]');
      let finished = false;
      dialog.addEventListener('cancel', event => { if (!finished) event.preventDefault(); });
      close.onclick = () => { dialog.close(); dialog.remove(); if(previous?.isConnected) previous.focus(); };
      document.body.appendChild(dialog);
      dialog.showModal();
      const update = state => {
        counter.textContent = `${state.completed} / ${total}`;
        bar.max = Math.max(1, total); bar.value = state.completed;
        phase.textContent = state.phase || 'Raporlar işleniyor…';
        summary.textContent = `${state.succeeded} başarılı · ${state.failed} başarısız`;
      };
      update({ completed:0, succeeded:0, failed:0, phase:'İşlem hazırlanıyor…' });
      return {
        update,
        finish(message, error) {
          finished = true;
          phase.textContent = message;
          dialog.querySelector('[data-title]').textContent = error ? 'İşlem tamamlanamadı' : 'İşlem tamamlandı';
          close.disabled = false;
          close.focus();
        }
      };
    }
  };
})();
