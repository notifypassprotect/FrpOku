/**
 * FrpOku - Shared Snippet Modal (Sorgu Kütüphanesi)
 * Tüm sayfalardan (index, detail, dashboard, compare) erişilebilir gelişmiş sorgu kütüphanesi modali.
 */

(function () {
  'use strict';

  function getStore() {
    return window.FrpStore || (typeof FrpStore !== 'undefined' ? FrpStore : null);
  }

  function getToastFn() {
    return window.showToast || window.toast || alert;
  }

  function renderSnippetsModal(options = {}) {
    const onInsert = options.onInsert || null;
    const store = getStore();
    const toast = getToastFn();

    if (!store || typeof store.getSnippets !== 'function') {
      toast('Depolama servisi yüklenemedi.', 'error');
      return;
    }

    const modalBodyHtml = `
      <div class="snippet-modal-wrap" style="display:flex;flex-direction:column;gap:.9rem;min-height:380px;">
        
        <!-- ÜST ÇUBUK: ARAMA VE YENİ EKLE BUTONU -->
        <div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;justify-content:space-between;">
          <div style="position:relative;flex:1;min-width:240px;">
            <input type="text" id="snippetSearchInput" placeholder="Sorgularda ara (başlık, rapor adı, SQL içeriği)..."
                   style="width:100%;padding:.5rem .85rem .5rem 2.2rem;border-radius:10px;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.84rem;outline:none;" />
            <span style="position:absolute;left:.75rem;top:50%;transform:translateY(-50%);font-size:.85rem;color:var(--text-muted);">🔍</span>
          </div>
          <div style="display:flex;gap:.4rem;align-items:center;">
            <button type="button" class="btn btn-sm btn-primary" id="btnToggleNewSnippetForm" style="display:flex;align-items:center;gap:.35rem;">
              <span>➕</span> <span>Yeni Sorgu Ekle</span>
            </button>
          </div>
        </div>

        <!-- YENİ / DÜZENLEME FORMU (İÇ PANEL) -->
        <div id="snippetEditorPanel" style="display:none;background:var(--bg-surface);border:1.5px solid var(--accent-light, #3b82f6);border-radius:12px;padding:1rem;flex-direction:column;gap:.75rem;box-shadow:0 8px 24px rgba(0,0,0,.12);">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong id="snippetEditorHeading" style="font-size:.9rem;color:var(--accent-bright);display:flex;align-items:center;gap:.4rem;">
              <span>✏️</span> <span>Sorgu Ekle / Düzenle</span>
            </strong>
            <button type="button" id="btnCloseSnippetEditor" class="btn btn-sm btn-ghost" style="padding:.15rem .45rem;font-size:.78rem;">✕ İptal</button>
          </div>

          <input type="hidden" id="editSnippetId" value="" />

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;">
            <div>
              <label style="font-size:.76rem;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:.25rem;">Sorgu Başlığı *</label>
              <input type="text" id="editSnippetTitle" placeholder="Örn: Hasta Protokol Detayı"
                     style="width:100%;padding:.45rem .75rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.82rem;outline:none;" />
            </div>
            <div>
              <label style="font-size:.76rem;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:.25rem;">Kaynak / Rapor Adı</label>
              <input type="text" id="editSnippetReport" placeholder="Örn: Poliklinik Raporu (veya Özel)"
                     style="width:100%;padding:.45rem .75rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-raised);color:var(--text-primary);font-size:.82rem;outline:none;" />
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.25rem;">
              <label style="font-size:.76rem;font-weight:700;color:var(--text-secondary);">SQL Metni *</label>
              <button type="button" class="btn btn-sm btn-ghost" id="btnFormatEditorSql" style="padding:.1rem .4rem;font-size:.72rem;">⚡ SQL Formatla</button>
            </div>
            <textarea id="editSnippetSql" rows="7" placeholder="SELECT * FROM ..."
                      style="width:100%;padding:.6rem .8rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-code, #0b1325);color:var(--text-code, #e2e8f0);font-family:var(--mono);font-size:.8rem;outline:none;resize:vertical;line-height:1.45;"></textarea>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:.2rem;">
            <button type="button" class="btn btn-sm btn-secondary" id="btnCancelSnippetForm">Vazgeç</button>
            <button type="button" class="btn btn-sm btn-primary" id="btnSaveSnippetForm">💾 Kütüphaneye Kaydet</button>
          </div>
        </div>

        <!-- SORGULAR LİSTESİ -->
        <div id="snippetListContainer" style="max-height:500px;overflow-y:auto;padding-right:.25rem;display:flex;flex-direction:column;gap:.75rem;">
          <!-- Dinamik doldurulacak -->
        </div>

      </div>
    `;

    return showModal({
      title: '📌 Favori SQL Sorguları Kütüphanesi',
      body: modalBodyHtml,
      confirmText: 'Kapat',
      cancelText: '',
      maxWidth: '920px',
      onOpen: (overlay) => {
        const searchInput = overlay.querySelector('#snippetSearchInput');
        const listContainer = overlay.querySelector('#snippetListContainer');
        const btnToggleNew = overlay.querySelector('#btnToggleNewSnippetForm');
        const editorPanel = overlay.querySelector('#snippetEditorPanel');
        const headingEl = overlay.querySelector('#snippetEditorHeading');
        const idInput = overlay.querySelector('#editSnippetId');
        const titleInput = overlay.querySelector('#editSnippetTitle');
        const reportInput = overlay.querySelector('#editSnippetReport');
        const sqlInput = overlay.querySelector('#editSnippetSql');
        const btnSave = overlay.querySelector('#btnSaveSnippetForm');
        const btnCancel = overlay.querySelector('#btnCancelSnippetForm');
        const btnClose = overlay.querySelector('#btnCloseSnippetEditor');
        const btnFormat = overlay.querySelector('#btnFormatEditorSql');

        function openForm(initial = {}) {
          idInput.value = initial.id || '';
          titleInput.value = initial.title || '';
          reportInput.value = initial.reportName || (initial.id ? '' : 'Özel');
          sqlInput.value = initial.sql || '';

          if (initial.id) {
            headingEl.innerHTML = '<span>✏️</span> <span>Sorguyu Düzenle</span>';
            btnSave.textContent = '💾 Değişiklikleri Kaydet';
          } else {
            headingEl.innerHTML = '<span>➕</span> <span>Yeni SQL Sorgusu Ekle</span>';
            btnSave.textContent = '💾 Kütüphaneye Ekle';
          }

          editorPanel.style.display = 'flex';
          titleInput.focus();
          editorPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        function closeForm() {
          editorPanel.style.display = 'none';
          idInput.value = '';
          titleInput.value = '';
          reportInput.value = '';
          sqlInput.value = '';
        }

        btnToggleNew?.addEventListener('click', () => {
          if (editorPanel.style.display === 'none') {
            openForm();
          } else {
            closeForm();
          }
        });

        btnCancel?.addEventListener('click', closeForm);
        btnClose?.addEventListener('click', closeForm);

        btnFormat?.addEventListener('click', () => {
          const val = sqlInput.value;
          if (val && window.Formatter && typeof window.Formatter.formatSql === 'function') {
            sqlInput.value = window.Formatter.formatSql(val);
            toast('SQL formatlandı. ⚡', 'info');
          }
        });

        btnSave?.addEventListener('click', () => {
          const id = idInput.value;
          const title = titleInput.value.trim() || 'Özel SQL Sorgusu';
          const report = reportInput.value.trim() || 'Özel';
          const sql = sqlInput.value.trim();

          if (!sql) {
            toast('SQL metni boş olamaz! Lütfen bir sorgu girin.', 'warning');
            sqlInput.focus();
            return;
          }

          if (id) {
            store.updateSnippet(id, { title, reportName: report, sql });
            toast('Sorgu kütüphanede güncellendi. ✏️', 'success');
          } else {
            store.addSnippet(title, sql, report);
            toast('Yeni sorgu kütüphaneye eklendi! 📌', 'success');
          }

          closeForm();
          refreshList();
        });

        function refreshList() {
          const snippets = store.getSnippets ? store.getSnippets() : [];
          const filter = (searchInput?.value || '').toLowerCase().trim();

          const filtered = snippets.filter(s => {
            if (!filter) return true;
            return (s.title || '').toLowerCase().includes(filter) ||
                   (s.reportName || '').toLowerCase().includes(filter) ||
                   (s.sql || '').toLowerCase().includes(filter);
          });

          if (snippets.length === 0) {
            listContainer.innerHTML = `
              <div style="text-align:center;padding:3rem 1.5rem;color:var(--text-muted);background:var(--bg-raised);border-radius:12px;border:1px dashed var(--border);">
                <div style="font-size:3rem;margin-bottom:.5rem;">📚</div>
                <div style="font-weight:700;font-size:1.05rem;color:var(--text-primary);">Henüz Kaydedilmiş Sorgu Bulunmuyor</div>
                <div style="font-size:.84rem;margin-top:.4rem;max-width:460px;margin-left:auto;margin-right:auto;line-height:1.5;">
                  Rapor detay sayfasından <strong>"📌 Kütüphaneye Ekle"</strong> butonuna basarak veya yukarıdaki <strong>"➕ Yeni Sorgu Ekle"</strong> butonunu kullanarak favori sorgularınızı ekleyebilirsiniz.
                </div>
              </div>
            `;
            return;
          }

          if (filtered.length === 0) {
            listContainer.innerHTML = `
              <div style="text-align:center;padding:2rem 1rem;color:var(--text-muted);background:var(--bg-raised);border-radius:10px;">
                🔍 "<strong>${escHtml(filter)}</strong>" aramasıyla eşleşen SQL sorgusu bulunamadı.
              </div>
            `;
            return;
          }

          listContainer.innerHTML = filtered.map(s => {
            const dateStr = s.createdAt ? new Date(s.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
            const sqlPreview = escHtml(s.sql || '');

            return `
              <div class="snippet-item" data-id="${s.id}" style="background:var(--bg-raised);border:1px solid var(--border-light);border-radius:12px;padding:.9rem;display:flex;flex-direction:column;gap:.5rem;transition:border-color .15s;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.75rem;flex-wrap:wrap;">
                  <div>
                    <div class="snippet-title" style="font-weight:700;color:var(--accent-bright);font-size:.92rem;display:flex;align-items:center;gap:.35rem;">
                      📌 ${escHtml(s.title || 'SQL Sorgusu')}
                    </div>
                    <div class="snippet-sub" style="font-size:.75rem;color:var(--text-muted);margin-top:.2rem;">
                      Kaynak Rapor: <strong style="color:var(--text-secondary);">${escHtml(s.reportName || '—')}</strong> · Kayıt: ${dateStr}
                    </div>
                  </div>
                  <div style="display:flex;gap:.35rem;flex-wrap:wrap;align-items:center;">
                    <button type="button" class="btn btn-sm btn-ghost btn-edit-snippet" style="padding:.25rem .55rem;font-size:.76rem;" data-id="${s.id}" title="Düzenle">✏️ Düzenle</button>
                    <button type="button" class="btn btn-sm btn-danger btn-delete-snippet" style="padding:.25rem .55rem;font-size:.76rem;" data-id="${s.id}" title="Sil">🗑️ Sil</button>
                  </div>
                </div>

                <div class="snippet-sql" style="font-family:var(--mono);font-size:.78rem;background:var(--bg-code, #0b1325);padding:.75rem .9rem;border-radius:8px;white-space:pre-wrap;word-break:break-word;max-height:180px;overflow-y:auto;color:var(--text-code, #e2e8f0);border:1px solid var(--border-light);line-height:1.45;">
                  ${sqlPreview}
                </div>

                <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:.15rem;flex-wrap:wrap;">
                  ${window.currentFile ? `
                    <button type="button" class="btn btn-sm btn-primary btn-add-new-query" style="padding:.3rem .75rem;font-size:.78rem;background:linear-gradient(135deg, #059669, #10b981);color:#fff;border:none;font-weight:700;" data-id="${s.id}" title="Bu sorguyu mevcut rapora yeni bir sekme/Dataset olarak ekle">➕ Rapora Yeni Sorgu Ekle</button>
                    <button type="button" class="btn btn-sm btn-secondary btn-insert-snippet" style="padding:.3rem .75rem;font-size:.78rem;" data-id="${s.id}" title="Açık olan SQL editörüne yapıştır">📥 Aktif Editöre Yapıştır</button>
                  ` : ''}
                  <button type="button" class="btn btn-sm btn-ghost btn-copy-snippet" style="padding:.3rem .75rem;font-size:.78rem;" data-id="${s.id}">📋 Panoya Kopyala</button>
                </div>
              </div>
            `;
          }).join('');

          // Etkinlik Dinleyicilerini Bağla
          listContainer.querySelectorAll('.btn-copy-snippet').forEach(btn => {
            btn.addEventListener('click', () => {
              const id = btn.getAttribute('data-id');
              const item = snippets.find(x => x.id === id);
              if (item && item.sql) {
                navigator.clipboard.writeText(item.sql).then(() => {
                  toast('SQL sorgusu panoya kopyalandı! 📋', 'success');
                });
              }
            });
          });

          listContainer.querySelectorAll('.btn-add-new-query').forEach(btn => {
            btn.addEventListener('click', () => {
              const id = btn.getAttribute('data-id');
              const item = snippets.find(x => x.id === id);
              if (!item || !item.sql) return;

              if (window.addSnippetAsNewQueryToReport) {
                const qName = window.addSnippetAsNewQueryToReport(item.title, item.sql);
                if (qName) {
                  toast(`'${item.title || qName}' sorgusu rapora yeni sekme olarak eklendi! ➕`, 'success');
                  modal.remove();
                }
              }
            });
          });

          listContainer.querySelectorAll('.btn-insert-snippet').forEach(btn => {
            btn.addEventListener('click', () => {
              const id = btn.getAttribute('data-id');
              const item = snippets.find(x => x.id === id);
              if (!item || !item.sql) return;

              if (typeof onInsert === 'function') {
                onInsert(item.sql);
                toast('SQL sorgusu editöre aktarıldı. 📥', 'success');
                modal.remove();
              } else if (window.insertSnippetToActiveEditor && window.insertSnippetToActiveEditor(item.sql)) {
                toast('SQL sorgusu aktif editöre aktarıldı. 📥', 'success');
                modal.remove();
              } else {
                navigator.clipboard.writeText(item.sql).then(() => {
                  toast('SQL panoya kopyalandı! 📋', 'info');
                });
              }
            });
          });

          listContainer.querySelectorAll('.btn-edit-snippet').forEach(btn => {
            btn.addEventListener('click', () => {
              const id = btn.getAttribute('data-id');
              const item = snippets.find(x => x.id === id);
              if (!item) return;
              openForm(item);
            });
          });

          listContainer.querySelectorAll('.btn-delete-snippet').forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = btn.getAttribute('data-id');
              const item = snippets.find(x => x.id === id);
              if (!item) return;

              const confirmDel = await showModal({
                title: '🗑️ Sorguyu Sil',
                body: `<strong>"${escHtml(item.title)}"</strong> sorgusunu kütüphaneden silmek istediğinize emin misiniz?`,
                confirmText: 'Evet, Sil',
                cancelText: 'Vazgeç',
                danger: true
              });

              if (confirmDel) {
                store.removeSnippet(id);
                toast('Sorgu kütüphaneden silindi.', 'info');
                refreshList();
              }
            });
          });
        }

        searchInput?.addEventListener('input', refreshList);
        refreshList();
      }
    });
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  window.renderSnippetsModal = renderSnippetsModal;
  window.openSnippetsModal = renderSnippetsModal;

  function bindSnippetButtons() {
    const btns = document.querySelectorAll('#btnSnippets');
    btns.forEach(btn => {
      if (!btn.getAttribute('data-snippet-bound')) {
        btn.setAttribute('data-snippet-bound', 'true');
        btn.addEventListener('click', () => {
          renderSnippetsModal();
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', bindSnippetButtons);
  setTimeout(bindSnippetButtons, 300);

})();
