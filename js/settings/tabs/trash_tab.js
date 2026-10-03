// Paginated trash workspace. Actions apply only to the explicit selection.
window.FrpSettingsTabs = window.FrpSettingsTabs || {};
window.FrpSettingsTabs.trash = {
  selectedTrashIds: new Set(), query: '', sort: 'newest', page: 0, pageSize: 50,
  render({escHtml}) {
    this.escHtml = escHtml;
    this.items = FrpStore.getTrash() || [];
    const existing = new Set(this.items.map(r => String(r.id)));
    this.selectedTrashIds.forEach(id => { if (!existing.has(id)) this.selectedTrashIds.delete(id); });
    return `<style>
      .trash-workspace{display:flex;flex-direction:column;gap:16px;height:100%;min-height:480px;color:var(--text-primary)}
      .trash-heading,.trash-tools,.trash-selection,.trash-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .trash-heading h2{margin:0;font-size:1.35rem;letter-spacing:-.03em}.trash-count{font-size:.85rem;background:var(--bg-raised);border:1px solid var(--border-light);border-radius:20px;padding:5px 12px}
      .trash-help{color:var(--text-muted);font-size:.82rem;line-height:1.6;margin:6px 0 0}
      .trash-tools input{flex:1;min-width:180px}.trash-tools select{background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-light);border-radius:8px;padding:9px}
      .trash-selection{padding:12px;background:var(--bg-raised);border:1px solid var(--border-light);border-radius:12px;font-size:.82rem}
      .trash-actions{display:flex;gap:8px;flex-wrap:wrap}.trash-workspace button:disabled{opacity:.45;cursor:not-allowed}
      .trash-selection label{display:flex;align-items:center;gap:8px}.trash-workspace input[type=checkbox]{width:17px;height:17px;accent-color:var(--accent,#2563eb);flex-shrink:0}
      .trash-list{flex:1 1 0;min-height:120px;border:1px solid var(--border-light);border-radius:12px;overflow-y:auto}
      .trash-item-row{display:flex;align-items:center;gap:12px;padding:14px;cursor:pointer;border-bottom:1px solid var(--border-light);margin:0}
      .trash-item-row:last-child{border-bottom:0}.trash-item-row:has(input:checked){background:var(--accent-light,rgba(37,99,235,.08))}.trash-item-row:hover{background:var(--bg-raised)}
      .trash-item-copy{flex:1;min-width:0}.trash-item-title{display:block;font-weight:700;font-size:.86rem;overflow-wrap:anywhere}.trash-item-file{display:block;color:var(--text-muted);font-size:.75rem;margin-top:4px;overflow-wrap:anywhere}
      .trash-item-date{font-size:.75rem;color:var(--text-muted);white-space:nowrap}.trash-footer{font-size:.8rem;color:var(--text-muted);padding:4px 0}.trash-empty{text-align:center;padding:64px 16px;color:var(--text-muted)}.trash-empty strong{display:block;color:var(--text-primary);font-size:1.1rem;margin-bottom:8px}
      @media(max-width:700px){.trash-item-date{display:none}.trash-actions{width:100%}.trash-tools select{max-width:100%}}
    </style><section class="trash-workspace" aria-label="Çöp kutusu">
      <header><div class="trash-heading"><h2>Çöp kutusu</h2><span class="trash-count">${this.items.length.toLocaleString('tr-TR')} rapor</span></div>
      <p class="trash-help">Raporları seçerek geri yükleyin veya kalıcı olarak silin. İşlemler anında uygulanır; ayrıca kaydetmeniz gerekmez.</p></header>
      <div class="trash-tools"><input id="trashSearchInput" class="master-search-input" type="search" aria-label="Çöp kutusunda ara" placeholder="Rapor veya dosya adı ara…" value="${escHtml(this.query)}">
      <select id="trashSort" aria-label="Sıralama"><option value="newest">Son silinenler</option><option value="oldest">İlk silinenler</option><option value="name">Rapor adı (A–Z)</option></select></div>
      <div class="trash-selection"><label><input id="trashSelectAll" type="checkbox">Bu sayfayı seç</label><span id="trashSelectedCount" role="status"></span>
      <div class="trash-actions"><button class="btn btn-sm btn-primary" id="btnRestoreSelectedTrash" type="button" disabled>Geri yükle</button><button class="btn btn-sm btn-danger" id="btnPurgeSelectedTrash" type="button" disabled>Kalıcı sil</button></div></div>
      <div class="trash-heading"><button class="btn btn-sm btn-ghost" type="button" id="trashSelectResults"></button><button class="btn btn-sm btn-ghost" type="button" id="trashClearSelection">Seçimi temizle</button></div>
      <div class="trash-list" id="trashItemsListContainer"></div>
      <footer class="trash-footer"><span id="trashRange" role="status"></span><div class="trash-actions"><button type="button" class="btn btn-sm btn-ghost" id="trashPrev">Önceki</button><button type="button" class="btn btn-sm btn-ghost" id="trashNext">Sonraki</button></div></footer>
      <p class="trash-help">Çöp kutusunu boşaltmak için aramayı temizleyip tüm sonuçları seçin, ardından “Kalıcı sil” düğmesini kullanın. Kalıcı silme geri alınamaz.</p>
    </section>`;
  },
  bind({overlay, renderModal, safeToast}) {
    const $ = selector => overlay.querySelector(selector);
    const selection = this.selectedTrashIds;
    let filtered = [], visible = [], busy = false;
    const updateSelection = () => {
      $('#trashSelectedCount').textContent = `${selection.size.toLocaleString('tr-TR')} rapor seçildi`;
      for (const id of ['#btnRestoreSelectedTrash','#btnPurgeSelectedTrash','#trashClearSelection']) $(id).disabled = busy || !selection.size;
      const count = visible.filter(r => selection.has(String(r.id))).length;
      $('#trashSelectAll').checked = visible.length > 0 && count === visible.length;
      $('#trashSelectAll').indeterminate = count > 0 && count < visible.length;
      $('#trashSelectAll').disabled = !visible.length || busy;
      overlay.querySelectorAll('.trash-item-cb').forEach(cb => { cb.checked = selection.has(cb.dataset.id); });
    };
    const draw = () => {
      const q = this.query.toLocaleLowerCase('tr-TR').trim();
      filtered = this.items.filter(r => `${r.meta?.reportName || ''} ${r.name || ''}`.toLocaleLowerCase('tr-TR').includes(q));
      filtered.sort((a,b) => this.sort === 'name' ? String(a.meta?.reportName || a.name || '').localeCompare(String(b.meta?.reportName || b.name || ''),'tr') : ((Date.parse(b.deletedAt || b.deleted_at)||0)-(Date.parse(a.deletedAt || a.deleted_at)||0)) * (this.sort === 'oldest' ? -1 : 1));
      this.page = Math.max(0,Math.min(this.page,Math.ceil(filtered.length/this.pageSize)-1));
      const start = this.page * this.pageSize;
      visible = filtered.slice(start,start+this.pageSize);
      const esc = value => this.escHtml(String(value ?? ''));
      $('#trashItemsListContainer').innerHTML = visible.length ? visible.map(r => {
        const date = new Date(r.deletedAt || r.deleted_at);
        return `<label class="trash-item-row"><input type="checkbox" class="trash-item-cb" data-id="${esc(r.id)}" aria-label="${esc(r.meta?.reportName || r.name)} seç"><span class="trash-item-copy"><span class="trash-item-title">${esc(r.meta?.reportName || r.name)}</span><span class="trash-item-file">${esc(r.name)}</span></span><time class="trash-item-date">${Number.isNaN(date.getTime()) ? 'Tarih bilinmiyor' : esc(date.toLocaleString('tr-TR',{dateStyle:'short',timeStyle:'short'}))}</time></label>`;
      }).join('') : `<div class="trash-empty"><strong>${this.items.length ? 'Sonuç bulunamadı' : 'Çöp kutusu boş'}</strong>${this.items.length ? 'Farklı bir rapor veya dosya adı arayın.' : 'Sildiğiniz raporlar burada görünür.'}</div>`;
      $('#trashRange').textContent = filtered.length ? `${start+1}–${start+visible.length} / ${filtered.length.toLocaleString('tr-TR')} rapor · Sayfa ${this.page+1} / ${Math.ceil(filtered.length/this.pageSize)}` : '0 rapor';
      $('#trashPrev').disabled = this.page === 0;
      $('#trashNext').disabled = start+visible.length >= filtered.length;
      $('#trashSelectResults').textContent = `Tüm sonuçları seç (${filtered.length.toLocaleString('tr-TR')})`;
      $('#trashSelectResults').disabled = !filtered.length;
      updateSelection();
    };
    $('#trashSort').value = this.sort;
    $('#trashSearchInput').addEventListener('input', e => { this.query=e.target.value;this.page=0;selection.clear();draw(); });
    $('#trashSort').addEventListener('change', e => { this.sort=e.target.value;this.page=0;draw(); });
    $('#trashSelectAll').addEventListener('change', e => { visible.forEach(r => e.target.checked ? selection.add(String(r.id)) : selection.delete(String(r.id)));updateSelection(); });
    $('#trashItemsListContainer').addEventListener('change', e => { if(e.target.matches('.trash-item-cb')) { e.target.checked ? selection.add(e.target.dataset.id) : selection.delete(e.target.dataset.id);updateSelection(); } });
    $('#trashSelectResults').addEventListener('click', () => { filtered.forEach(r => selection.add(String(r.id)));updateSelection(); });
    $('#trashClearSelection').addEventListener('click', () => { selection.clear();updateSelection(); });
    $('#trashPrev').addEventListener('click', () => { this.page--;draw(); });
    $('#trashNext').addEventListener('click', () => { this.page++;draw(); });
    const run = async (ids, restore) => {
      if(busy) return;
      busy=true;updateSelection();
      try {
        await (restore ? FrpStore.restoreManyFromTrash(ids) : FrpStore.purgeManyFromTrash(ids));
        selection.clear();safeToast(`${ids.length} rapor ${restore ? 'geri yüklendi' : 'kalıcı olarak silindi'}.`,'success');
      } catch(error) { safeToast(error.message || 'İşlem tamamlanamadı. Tekrar deneyin.','error'); }
      finally { busy=false;if(typeof window.refreshAll === 'function') window.refreshAll();renderModal(); }
    };
    $('#btnRestoreSelectedTrash').addEventListener('click', () => { if(selection.size) run([...selection],true); });
    $('#btnPurgeSelectedTrash').addEventListener('click', () => {
      if(!selection.size || busy) return;
      const ids = [...selection];
      window.showConfirmDialog({title:`${ids.length} rapor kalıcı olarak silinsin mi?`,message:'Yalnızca seçtiğiniz raporlar silinecek. Bu işlem geri alınamaz.',confirmText:`${ids.length} raporu kalıcı sil`,isDanger:true,onConfirm:() => run(ids,false)});
    });
    draw();
  }
};
