// Internal navigation keeps the durable upload queue and explains the hand-off.
(() => {
  let dialogOpen = false;
  window.FrpNavigate = function(path) {
    const target = new URL(path,location.href);
    if (target.origin !== location.origin) { location.href=target.href;return; }
    const status = window.FrpStore?.getSyncStatus?.() || {};
    if (!status.pending && !window.FrpImportActive) { location.href=target.href;return; }
    if (dialogOpen) return;
    dialogOpen=true;
    const close = () => { dialogOpen=false; };
    if (window.FrpImportActive) {
      window.showConfirmDialog({title:'Dosyalar hâlâ hazırlanıyor',message:'Seçtiğiniz dosyalar henüz yerel kuyruğa alınmadı. Rapor hazırlama işlemi bitince detaylara geçebilirsiniz.',confirmText:'Bu sayfada kal',cancelText:'Kapat',onConfirm:close,onCancel:close});
      return;
    }
    window.showConfirmDialog({
      title:'Yükleme sürerken devam edebilirsiniz',
      message:`${Number(status.pending).toLocaleString('tr-TR')} raporun bulut kaydı bekliyor. Yerel kuyruk kaydedildikten sonra yeni sayfa açılacak; aktarım orada kaldığı yerden devam edecek.`,
      confirmText:'Kaydet ve sayfayı aç',cancelText:'Burada kal',
      onCancel:close,
      onConfirm:async () => {
        try {
          await window.FrpStore.prepareForNavigation();
          location.href=target.href;
        } catch(error) {
          close();
          window.showConfirmDialog({title:'Sayfadan henüz ayrılamıyoruz',message:'Yerel aktarım kuyruğu kaydedilemedi. Sayfayı açık tutun ve tarayıcı depolama alanını kontrol edin.',confirmText:'Anladım',cancelText:'Kapat'});
        }
      }
    });
  };
  document.addEventListener('click',event => {
    if(event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link=event.target.closest?.('a[href]');
    if(!link || link.download || link.target === '_blank') return;
    const target=new URL(link.href,location.href);
    if(target.origin !== location.origin || !/\/(index|detail|dashboard|compare)\.html$/.test(target.pathname)) return;
    if(!window.FrpImportActive && !window.FrpStore?.getSyncStatus?.().pending) return;
    event.preventDefault();event.stopImmediatePropagation();window.FrpNavigate(target.href);
  },true);

  const panel=document.createElement('aside');
  panel.setAttribute('aria-label','Bulut aktarımı');
  panel.style.cssText='position:fixed;bottom:16px;right:16px;width:min(360px,calc(100vw - 32px));box-sizing:border-box;padding:14px 16px;background:var(--bg-surface,#fff);color:var(--text-primary,#17253b);border:1px solid var(--border-light,#dce3ed);border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.12);z-index:900;font-size:12px;line-height:1.5';
  panel.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong data-title>Bulut aktarımı sürüyor</strong><button type="button" data-toggle aria-expanded="true" style="border:0;background:transparent;color:inherit;cursor:pointer;font-size:11px">Küçült</button></div><span data-count style="display:block;margin:4px 0"></span><progress aria-label="Buluta kaydedilen raporlar" style="width:100%;height:6px;accent-color:var(--green,#059669)"></progress><div data-help style="color:var(--text-muted,#607088);margin-top:6px">Raporları açabilirsiniz. Sayfa geçişinde aktarım yeni sayfada devam eder.</div>';
  panel.hidden=true;document.body.appendChild(panel);
  panel.querySelector('[data-toggle]').addEventListener('click',event => {
    const expanded=event.target.getAttribute('aria-expanded') === 'true';
    event.target.setAttribute('aria-expanded',String(!expanded));
    event.target.textContent=expanded ? 'Göster' : 'Küçült';
    panel.querySelector('[data-help]').hidden=expanded;
  });
  function render() {
    const state=window.FrpStore?.getSyncStatus?.();
    panel.hidden=!state?.pending;
    if(panel.hidden) return;
    panel.querySelector('[data-title]').textContent=state.errors || state.conflicts ? 'Bazı kayıtlar için işlem gerekiyor' : navigator.onLine === false ? 'Bağlantı bekleniyor' : 'Bulut aktarımı sürüyor';
    panel.querySelector('[data-count]').textContent=`${state.completed || 0} / ${state.total || state.pending} kaydedildi · ${state.pending} bekliyor`;
    const bar=panel.querySelector('progress');bar.max=state.total || state.pending;bar.value=state.completed || 0;
    panel.querySelector('[data-help]').textContent=state.errors || state.conflicts ? 'Kaydedilemeyen raporlar yerel kuyrukta korunuyor. Liste ekranındaki kayıt durumunu kontrol edin.' : 'Raporları açabilirsiniz. Bu sekmeyi kapatırsanız aktarım durur; aynı tarayıcıda yeniden açınca devam eder.';
  }
  window.addEventListener('frp:sync-status',render);
  window.addEventListener('online',render);window.addEventListener('offline',render);
  window.FrpStoreReady?.then(render);render();
})();
