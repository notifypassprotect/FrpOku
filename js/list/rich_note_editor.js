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

  // Dosya Önizleme Modalı (Resimler ve PDF'ler için)
  function openAttachmentPreview(att) {
    const existing = document.getElementById('frpAttPreviewOverlay');
    if (existing) existing.remove();

    const isPdf = (att.type || '').includes('pdf') || (att.name || '').toLowerCase().endsWith('.pdf');
    const isImage = (att.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.name || '');

    const overlay = document.createElement('div');
    overlay.id = 'frpAttPreviewOverlay';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
      z-index: 100020; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    `;

    overlay.innerHTML = `
      <div style="background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 16px; width: 90vw; max-width: 960px; height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.4);">
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc);">
          <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-primary, #0f172a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70vw;">
            ${escHtml(att.name)} (${formatFileSize(att.size)})
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <a href="${att.url}" download="${escHtml(att.name)}" class="btn btn-sm btn-primary" style="padding: 0.35rem 0.9rem; font-size: 0.8rem; text-decoration: none; font-weight: 700;">⬇️ İndir</a>
            <button type="button" id="btnAttPreviewClose" class="btn btn-sm btn-ghost" style="font-size: 1.2rem; width: 32px; height: 32px; padding: 0;">✕</button>
          </div>
        </div>
        <div style="flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; background: #0f172a; padding: 1rem;">
          ${isImage ? `
            <img src="${att.url}" alt="${escHtml(att.name)}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);" />
          ` : (isPdf ? `
            <iframe src="${att.url}" style="width: 100%; height: 100%; border: none; border-radius: 8px; background: #ffffff;"></iframe>
          ` : `
            <div style="text-align: center; color: #94a3b8; padding: 2rem;">
              <div style="font-size: 3rem; margin-bottom: 1rem;">📄</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: #ffffff; margin-bottom: 0.5rem;">Bu dosya türü için doğrudan önizleme desteklenmiyor.</div>
              <div>Dosyayı bilgisayarınıza indirerek görüntüleyebilirsiniz.</div>
              <div style="margin-top: 1.5rem;">
                <a href="${att.url}" download="${escHtml(att.name)}" class="btn btn-primary" style="text-decoration: none;">⬇️ Dosyayı İndir</a>
              </div>
            </div>
          `)}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('#btnAttPreviewClose').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
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
      <div class="modal" style="width: 94vw; max-width: 1200px; height: 88vh; max-height: 950px; background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 20px; box-shadow: 0 25px 60px rgba(0,0,0,0.35); display: flex; flex-direction: column; overflow: hidden;">
        
        <!-- MODAL BAŞLIĞI -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.5rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc);">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(99,102,241,0.15)); color: var(--accent, #2563eb); display: flex; align-items: center; justify-content: center;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div>
              <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary, #0f172a); display: flex; align-items: center; gap: 0.5rem;">
                <span>Rapor Zengin Notu & Belgeler</span>
                <span style="font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 9999px; background: rgba(37,99,235,0.12); color: var(--accent, #2563eb);">Word Modu & Ekler</span>
              </div>
              <div style="font-size: 0.82rem; color: var(--text-muted, #64748b); max-width: 600px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escHtml(reportName)}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span id="noteSaveStatus" style="font-size: 0.78rem; color: var(--text-muted, #64748b); font-weight: 600;"></span>
            <button type="button" id="btnRichNoteClose" class="btn btn-sm btn-ghost" style="font-size: 1.3rem; width: 36px; height: 36px; padding: 0; border-radius: 50%;">✕</button>
          </div>
        </div>

        <!-- WORD BENZERİ ARAÇ ÇUBUĞU (RIBBON TOOLBAR) -->
        <div class="rich-editor-toolbar" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.25rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-surface, #ffffff); flex-wrap: wrap;">
          
          <!-- Metin Boyutu / Başlık Dropdown -->
          <select id="tbFormatBlock" style="padding: 0.35rem 0.6rem; border-radius: 8px; border: 1px solid var(--border, #cbd5e1); font-size: 0.82rem; background: var(--bg-card); color: var(--text-primary); cursor: pointer; font-weight: 600;">
            <option value="p">Normal Metin</option>
            <option value="h1">Başlık 1 (Büyük)</option>
            <option value="h2">Başlık 2 (Orta)</option>
            <option value="h3">Başlık 3 (Küçük)</option>
            <option value="pre">Kod Bloğu</option>
            <option value="blockquote">Alıntı Bloğu</option>
          </select>

          <div style="width: 1px; height: 22px; background: var(--border-light, #e2e8f0); margin: 0 0.2rem;"></div>

          <!-- Temel Biçimlendirme -->
          <div style="display: flex; align-items: center; gap: 0.2rem;">
            <button type="button" id="tbBold" class="btn btn-sm btn-ghost" style="font-weight: 800; min-width: 32px;" title="Kalın (Ctrl+B)">B</button>
            <button type="button" id="tbItalic" class="btn btn-sm btn-ghost" style="font-style: italic; min-width: 32px;" title="İtalik (Ctrl+I)">I</button>
            <button type="button" id="tbUnderline" class="btn btn-sm btn-ghost" style="text-decoration: underline; min-width: 32px;" title="Altı Çizili (Ctrl+U)">U</button>
            <button type="button" id="tbStrike" class="btn btn-sm btn-ghost" style="text-decoration: line-through; min-width: 32px;" title="Üstü Çizili">S</button>
          </div>

          <div style="width: 1px; height: 22px; background: var(--border-light, #e2e8f0); margin: 0 0.2rem;"></div>

          <!-- Renk ve Vurgu -->
          <div style="display: flex; align-items: center; gap: 0.3rem;">
            <label style="display: flex; align-items: center; gap: 0.2rem; cursor: pointer;" title="Metin Rengi">
              <span style="font-size: 0.82rem; font-weight: 700; color: #ef4444;">A</span>
              <input type="color" id="tbTextColor" value="#0f172a" style="width: 24px; height: 24px; padding: 0; border: none; background: none; cursor: pointer;" />
            </label>
            <label style="display: flex; align-items: center; gap: 0.2rem; cursor: pointer;" title="Arka Plan Vurgu Rengi">
              <span style="font-size: 0.82rem; background: #fef08a; padding: 0 3px; border-radius: 3px; font-weight: 700; color: #0f172a;">H</span>
              <input type="color" id="tbBgColor" value="#fef08a" style="width: 24px; height: 24px; padding: 0; border: none; background: none; cursor: pointer;" />
            </label>
          </div>

          <div style="width: 1px; height: 22px; background: var(--border-light, #e2e8f0); margin: 0 0.2rem;"></div>

          <!-- Listeler ve Hizalama -->
          <div style="display: flex; align-items: center; gap: 0.2rem;">
            <button type="button" id="tbUl" class="btn btn-sm btn-ghost" title="Madde İmli Liste">• Liste</button>
            <button type="button" id="tbOl" class="btn btn-sm btn-ghost" title="Numaralı Liste">1. Liste</button>
            <button type="button" id="tbAlignLeft" class="btn btn-sm btn-ghost" title="Sola Hizala">⇤</button>
            <button type="button" id="tbAlignCenter" class="btn btn-sm btn-ghost" title="Ortala">≡</button>
            <button type="button" id="tbAlignRight" class="btn btn-sm btn-ghost" title="Sağa Hizala">⇥</button>
          </div>

          <div style="width: 1px; height: 22px; background: var(--border-light, #e2e8f0); margin: 0 0.2rem;"></div>

          <!-- Tablo ve Bağlantı -->
          <div style="display: flex; align-items: center; gap: 0.3rem;">
            <button type="button" id="tbTable" class="btn btn-sm btn-ghost" title="Tablo Ekle">▦ Tablo</button>
            <button type="button" id="tbLink" class="btn btn-sm btn-ghost" title="Bağlantı (Link) Ekle">🔗 Link</button>
          </div>

          <!-- Medya & Ek Ekleme Butonları -->
          <div style="margin-left: auto; display: flex; align-items: center; gap: 0.5rem;">
            <input type="file" id="inputAttachFile" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" style="display: none;" />
            <button type="button" id="btnAddAttachment" class="btn btn-sm" style="background: rgba(37,99,235,0.1); color: var(--accent, #2563eb); border: 1px solid rgba(37,99,235,0.25); font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
              <span>📎 Dosya / Belge Ekle (PDF, Resim vb.)</span>
            </button>
          </div>
        </div>

        <!-- ORTA ALAN: BELGE DÜZENLEYİCİ CANVAS & EKLER ÇEKMECESİ -->
        <div style="flex: 1; display: flex; overflow: hidden; position: relative;">
          
          <!-- EDİTÖR ÇALIŞMA ALANI -->
          <div style="flex: 1; overflow-y: auto; padding: 2rem 3rem; background: var(--bg-card, #f8fafc); display: flex; justify-content: center;">
            <div id="richNoteContent" contenteditable="true" style="width: 100%; max-width: 850px; min-height: 480px; background: var(--bg-surface, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 12px; padding: 2rem 2.5rem; outline: none; font-family: inherit; font-size: 0.95rem; line-height: 1.7; color: var(--text-primary, #0f172a); box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
              ${currentNoteHtml || '<p>Bu rapora ait detaylı notları, açıklamaları ve resimleri buraya ekleyebilirsiniz...</p>'}
            </div>
          </div>

          <!-- SAĞ / ALT EKLER BÖLÜMÜ (ATTACHMENT TRAY) -->
          <div id="richNoteAttachmentsSidebar" style="width: 320px; border-left: 1px solid var(--border-light, #e2e8f0); background: var(--bg-surface, #ffffff); display: flex; flex-direction: column; overflow: hidden;">
            <div style="padding: 0.85rem 1rem; border-bottom: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc); display: flex; align-items: center; justify-content: space-between;">
              <div style="font-size: 0.88rem; font-weight: 800; color: var(--text-primary, #0f172a); display: flex; align-items: center; gap: 0.4rem;">
                <span>📎 Ekli Belgeler & Resimler</span>
                <span id="attCountBadge" style="font-size: 0.72rem; font-weight: 800; background: var(--bg-raised, #e2e8f0); padding: 1px 6px; border-radius: 9999px;">${attachments.length}</span>
              </div>
            </div>

            <!-- EKLER LİSTESİ -->
            <div id="richNoteAttachmentsList" style="flex: 1; overflow-y: auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem;">
              <!-- Javascript ile dinamik doldurulur -->
            </div>

            <!-- SÜRÜKLE BIRAK BİLGİLENDİRMESİ -->
            <div style="padding: 0.75rem; border-top: 1px solid var(--border-light, #e2e8f0); background: var(--bg-card, #f8fafc); font-size: 0.75rem; color: var(--text-muted, #64748b); text-align: center;">
              💡 Resimleri doğrudan <strong>Ctrl+V</strong> ile yapıştırabilir veya bu alana sürükleyip bırakabilirsiniz.
            </div>
          </div>
        </div>

        <!-- FOOTER (KAYDET, SİL, KAPAT BUTONLARI) -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1.5rem; border-top: 1px solid var(--border-light, #e2e8f0); background: var(--bg-surface, #ffffff);">
          <div>
            ${currentNoteText ? `
              <button type="button" id="btnRichNoteDelete" class="btn btn-sm btn-ghost" style="color: #ef4444; font-weight: 700;">Tüm Notu Sil</button>
            ` : ''}
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <button type="button" id="btnRichNoteCancel" class="btn btn-sm btn-ghost" style="padding: 0.5rem 1.2rem;">Kapat</button>
            <button type="button" id="btnRichNoteSave" class="btn btn-sm btn-primary" style="padding: 0.5rem 1.8rem; font-weight: 700; font-size: 0.9rem; background: #2563eb;">Kaydet & Eşitle</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const editor = overlay.querySelector('#richNoteContent');
    const attachmentsList = overlay.querySelector('#richNoteAttachmentsList');
    const attCountBadge = overlay.querySelector('#attCountBadge');
    const fileInput = overlay.querySelector('#inputAttachFile');
    const saveStatus = overlay.querySelector('#noteSaveStatus');

    function renderAttachments() {
      attCountBadge.textContent = attachments.length;
      if (attachments.length === 0) {
        attachmentsList.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted, #64748b); font-size: 0.8rem;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;">📁</div>
            Henüz eklenmiş dosya veya resim yok.
          </div>
        `;
        return;
      }

      attachmentsList.innerHTML = '';
      attachments.forEach((att, idx) => {
        const isImage = (att.type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.name || '');
        const card = document.createElement('div');
        card.style.cssText = `
          background: var(--bg-card, #f8fafc); border: 1px solid var(--border, #cbd5e1); border-radius: 10px;
          padding: 0.65rem; display: flex; flex-direction: column; gap: 0.45rem; transition: border-color 0.15s;
        `;

        card.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div style="width: 36px; height: 36px; border-radius: 6px; overflow: hidden; background: #e2e8f0; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${isImage ? `<img src="${att.url}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size: 1.2rem;">📄</span>`}
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary, #0f172a); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escHtml(att.name)}">
                ${escHtml(att.name)}
              </div>
              <div style="font-size: 0.7rem; color: var(--text-muted, #64748b);">
                ${formatFileSize(att.size)}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.35rem; justify-content: flex-end; padding-top: 0.35rem; border-top: 1px dashed var(--border-light, #e2e8f0);">
            ${isImage ? `
              <button type="button" class="btn btn-sm btn-ghost btn-att-annotate" data-idx="${idx}" style="font-size: 0.72rem; padding: 0.2rem 0.45rem; color: var(--accent, #2563eb); font-weight: 700;" title="Görsel üzerine daire, ok ve çizim yap">✏️ İşaretle</button>
            ` : ''}
            <button type="button" class="btn btn-sm btn-ghost btn-att-preview" data-idx="${idx}" style="font-size: 0.72rem; padding: 0.2rem 0.45rem;" title="Önizle">👁️ Önizle</button>
            <a href="${att.url}" download="${escHtml(att.name)}" class="btn btn-sm btn-ghost" style="font-size: 0.72rem; padding: 0.2rem 0.45rem; text-decoration: none;" title="İndir">⬇️ İndir</a>
            <button type="button" class="btn btn-sm btn-ghost btn-att-delete" data-idx="${idx}" style="font-size: 0.72rem; padding: 0.2rem 0.45rem; color: #ef4444;" title="Sil">✕</button>
          </div>
        `;

        // Buton olayları
        const btnAnnotate = card.querySelector('.btn-att-annotate');
        if (btnAnnotate) {
          btnAnnotate.addEventListener('click', () => {
            if (typeof window.openImageAnnotator === 'function') {
              window.openImageAnnotator({
                imageUrl: att.url,
                imageName: att.name,
                onSave: (annotatedDataUrl) => {
                  // İşaretlenmiş yeni görseli ek olarak güncelle
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

        const btnDelete = card.querySelector('.btn-att-delete');
        if (btnDelete) {
          btnDelete.addEventListener('click', () => {
            attachments.splice(idx, 1);
            renderAttachments();
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

    overlay.querySelector('#tbFormatBlock').addEventListener('change', (e) => {
      formatDoc('formatBlock', e.target.value);
    });

    overlay.querySelector('#tbBold').addEventListener('click', () => formatDoc('bold'));
    overlay.querySelector('#tbItalic').addEventListener('click', () => formatDoc('italic'));
    overlay.querySelector('#tbUnderline').addEventListener('click', () => formatDoc('underline'));
    overlay.querySelector('#tbStrike').addEventListener('click', () => formatDoc('strikeThrough'));

    overlay.querySelector('#tbTextColor').addEventListener('change', (e) => formatDoc('foreColor', e.target.value));
    overlay.querySelector('#tbBgColor').addEventListener('change', (e) => formatDoc('hiliteColor', e.target.value));

    overlay.querySelector('#tbUl').addEventListener('click', () => formatDoc('insertUnorderedList'));
    overlay.querySelector('#tbOl').addEventListener('click', () => formatDoc('insertOrderedList'));
    overlay.querySelector('#tbAlignLeft').addEventListener('click', () => formatDoc('justifyLeft'));
    overlay.querySelector('#tbAlignCenter').addEventListener('click', () => formatDoc('justifyCenter'));
    overlay.querySelector('#tbAlignRight').addEventListener('click', () => formatDoc('justifyRight'));

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

    overlay.querySelector('#tbLink').addEventListener('click', () => {
      const url = prompt('Bağlantı adresi (URL) giriniz:');
      if (url) formatDoc('createLink', url);
    });

    // Dosya Ekleme İşleyicisi (Ek yükleme & base64 okuma)
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
        alert(`${fileObj.name} dosyası 15 MB sınırını aşıyor.`);
        return;
      }

      saveStatus.textContent = 'Dosya yükleniyor...';

      // Dosyayı sunucuya yüklemeyi dene
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
            // Sunucu yoksa veya hata verirse yerel dataUrl olarak ekle
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

    const close = () => overlay.remove();
    overlay.querySelector('#btnRichNoteClose').addEventListener('click', close);
    overlay.querySelector('#btnRichNoteCancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Not Silme
    const btnDelete = overlay.querySelector('#btnRichNoteDelete');
    if (btnDelete) {
      btnDelete.addEventListener('click', async () => {
        if (confirm('Bu rapora ait tüm not ve ekleri silmek istediğinize emin misiniz?')) {
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

          if (typeof window.toast === 'function') window.toast('Rapor notları silindi.', 'info');
          if (typeof window.refreshAll === 'function') window.refreshAll();
          close();
        }
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
        // 1. Sunucu API rotasını güncelle
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

      // 2. Yerel Depoyu ve İstemci Durumunu Güncelle
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

  // Mevcut modal çağrısını yeni zengin editöre yönlendir
  if (!window.FrpListModals) window.FrpListModals = {};
  window.FrpListModals.openReportNoteModal = openRichNoteModal;
  window.openReportNoteModal = openRichNoteModal;
})();
