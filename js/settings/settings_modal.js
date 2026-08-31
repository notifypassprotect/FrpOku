// ============================================================
//  settings_modal.js — FrpOku Ayarlar & Kullanıcı Yönetimi Orkestratörü v5
//  Tam Modüler Sekme Mimarisi (Appearance, Profile, Categories,
//  Columns, Shortcuts, Trash, Storage, Audit)
// ============================================================

function safeToast(msg, type = 'info') {
  if (typeof window.toast === 'function') {
    window.toast(msg, type);
  } else if (typeof window.showToast === 'function') {
    window.showToast(msg, type);
  } else if (window.FrpNotify && typeof window.FrpNotify[type] === 'function') {
    window.FrpNotify[type](msg);
  } else {
    console.log('[Toast]', type, msg);
  }
}
window.safeToast = safeToast;

// ── MODERN DİYALOG MOTORLARI ─────────────────────────────────
window.showConfirmDialog = function({
  title = 'İşlemi Onaylayın',
  message = '',
  confirmText = 'Evet, Onayla',
  cancelText = 'İptal',
  isDanger = false,
  onConfirm = () => {},
  onCancel = () => {}
}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '999999';

  overlay.innerHTML = `
    <div class="modal" style="max-width:450px;width:92vw;padding:1.6rem;text-align:center;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.4);border:1px solid var(--border);background:var(--bg-surface);animation:fadeIn .18s ease-out;">
      <div style="font-size:1.15rem;font-weight:800;color:var(--text-primary);margin-bottom:.4rem;">${title}</div>
      <div style="font-size:.83rem;color:var(--text-secondary);line-height:1.5;margin-bottom:1.4rem;">${message}</div>
      <div style="display:flex;align-items:center;justify-content:center;gap:.75rem;">
        <button type="button" class="btn btn-sm btn-ghost btn-cancel-confirm" style="padding:.5rem 1.25rem;font-weight:700;">
          ${cancelText}
        </button>
        <button type="button" class="btn btn-sm ${isDanger ? 'btn-danger' : 'btn-primary'} btn-ok-confirm" style="padding:.5rem 1.5rem;font-weight:800;box-shadow:${isDanger ? '0 4px 14px rgba(239,68,68,.35)' : '0 4px 14px rgba(37,99,235,.35)'};">
          ${confirmText}
        </button>
      </div>
    </div>
  `;

  overlay.querySelector('.btn-cancel-confirm').addEventListener('click', () => {
    overlay.remove();
    if (typeof onCancel === 'function') onCancel();
  });

  overlay.querySelector('.btn-ok-confirm').addEventListener('click', () => {
    overlay.remove();
    if (typeof onConfirm === 'function') onConfirm();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (typeof onCancel === 'function') onCancel();
    }
  });

  document.body.appendChild(overlay);
};

window.showPromptDialog = function({
  title = 'Bilgi Girin',
  message = '',
  defaultValue = '',
  placeholder = '',
  confirmText = 'Kaydet',
  cancelText = 'İptal',
  onConfirm = (val) => {}
}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '999999';

  overlay.innerHTML = `
    <div class="modal" style="max-width:440px;width:90vw;padding:1.5rem;text-align:left;border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.4);border:1px solid var(--border);background:var(--bg-surface);animation:fadeIn .18s ease-out;">
      <div style="font-size:1.08rem;font-weight:800;color:var(--text-primary);margin-bottom:.3rem;">${title}</div>
      ${message ? `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.8rem;">${message}</div>` : ''}
      <div style="margin-bottom:1.2rem;">
        <input type="text" id="customPromptInput" class="master-search-input" style="width:100%;font-size:.88rem;" value="${defaultValue}" placeholder="${placeholder}" />
      </div>
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:.65rem;">
        <button type="button" class="btn btn-sm btn-ghost btn-cancel-prompt" style="padding:.45rem 1rem;font-weight:700;">
          ${cancelText}
        </button>
        <button type="button" class="btn btn-sm btn-primary btn-ok-prompt" style="padding:.45rem 1.35rem;font-weight:800;">
          ${confirmText}
        </button>
      </div>
    </div>
  `;

  const input = overlay.querySelector('#customPromptInput');
  const btnOk = overlay.querySelector('.btn-ok-prompt');
  const btnCancel = overlay.querySelector('.btn-cancel-prompt');

  const doSubmit = () => {
    const val = input ? input.value.trim() : '';
    overlay.remove();
    if (typeof onConfirm === 'function') onConfirm(val);
  };

  btnOk.addEventListener('click', doSubmit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSubmit(); });
  btnCancel.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.body.appendChild(overlay);
  setTimeout(() => input?.focus(), 80);
};

// ── AYARLAR ANA MODALI ──────────────────────────────────────
window.openSettingsModal = function(initialTab = 'appearance') {
  let activeTab = initialTab;

  const authUser = window.FrpAuth?.getUser();
  const authNameParts = (authUser?.name || '').trim().split(' ');
  const authFirstName = authNameParts[0] || '';
  const authLastName = authNameParts.slice(1).join(' ') || '';

  let stagedPrefs = {
    ...FrpStore.getPreferences(),
    visibleColumns: { ...(FrpStore.getPreferences().visibleColumns || {}) },
    columnOrder: [...(FrpStore.getPreferences().columnOrder || [
      'reportName', 'fileName', 'fileSize', 'category', 'guid', 'tags', 'queries', 'date', 'lastModified'
    ])]
  };

  const liveProfile = FrpStore.getUserProfile();
  let stagedProfile = {
    ...liveProfile,
    firstName: liveProfile.firstName || authFirstName,
    lastName: liveProfile.lastName || authLastName,
    username: authUser?.username || liveProfile.username || '',
    phone: authUser?.phone || liveProfile.phone || '',
    email: authUser?.email || liveProfile.email || '',
    department: authUser?.department || liveProfile.department || ''
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.zIndex = '99999';

  function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function markDirty() {
    const saveBtn = overlay.querySelector('#btnSaveAllSettingsChanges');
    if (saveBtn) {
      saveBtn.style.animation = 'pulse 1.5s infinite';
      saveBtn.innerHTML = 'Değişiklikleri Kaydet *';
    }
  }

  function captureProfileInputs() {
    const fName = overlay.querySelector('#profFirstName')?.value;
    const lName = overlay.querySelector('#profLastName')?.value;
    const uName = overlay.querySelector('#profUsername')?.value;
    const email = overlay.querySelector('#profEmail')?.value;

    if (fName !== undefined) stagedProfile.firstName = fName.trim();
    if (lName !== undefined) stagedProfile.lastName = lName.trim();
    if (uName !== undefined) stagedProfile.username = uName.trim();
    if (email !== undefined) stagedProfile.email = email.trim();
  }

  function renderModal() {
    const trashItems = FrpStore.getTrash() || [];

    const tabs = [
      { id: 'appearance', label: 'Görünüm & Yazı Tipi' },
      { id: 'profile',    label: 'Kullanıcı & Cihaz Profili' },
      { id: 'categories', label: 'Kategoriler & Etiketler' },
      { id: 'columns',    label: 'Sütun & Tablo' },
      { id: 'shortcuts',  label: 'Klavye Kısayolları' },
      { id: 'trash',      label: 'Çöp Kutusu', count: trashItems.length, isTrash: true },
      { id: 'storage',    label: 'Yedekleme & Depolama' },
      { id: 'audit',      label: 'Denetim Günlüğü (Audit)' }
    ];

    const tabButtonsHtml = tabs.map(t => {
      const isTrashWithItems = t.isTrash && (t.count > 0);
      const countBadge = t.count !== undefined ? `
        <span class="badge ${t.count > 0 ? 'badge-red' : 'badge-gray'}" style="margin-left:auto;font-size:.68rem;padding:2px 6px;border-radius:10px;${isTrashWithItems ? 'animation:pulse 2s infinite;' : ''}">
          ${t.count}
        </span>
      ` : '';
      return `
        <button type="button" class="settings-tab-btn ${activeTab === t.id ? 'active' : ''}" data-tab="${t.id}" style="display:flex;align-items:center;width:100%;text-align:left;padding:.75rem .95rem;border-radius:10px;border:none;background:${activeTab === t.id ? 'var(--accent-light, rgba(37,99,235,0.08))' : 'transparent'};color:${activeTab === t.id ? 'var(--accent, #2563eb)' : 'var(--text-primary)'};font-weight:${activeTab === t.id ? '800' : '600'};cursor:pointer;font-size:.86rem;transition:all .15s;">
          <span>${t.label}</span>
          ${countBadge}
        </button>
      `;
    }).join('');

    const tabModule = window.FrpSettingsTabs && window.FrpSettingsTabs[activeTab];
    const tabContentHtml = tabModule && typeof tabModule.render === 'function'
      ? tabModule.render({ stagedPrefs, stagedProfile, escHtml, activeTab })
      : `<div style="padding:2rem;text-align:center;color:var(--text-muted);">Sekme yükleniyor...</div>`;

    overlay.innerHTML = `
      <div class="modal settings-modal-box" style="max-width:1200px;width:96vw;padding:0;overflow:hidden;display:grid;grid-template-columns:260px 1fr;height:88vh;min-height:640px;max-height:920px;border-radius:20px;box-shadow:0 28px 70px rgba(0,0,0,.45);border:1.5px solid var(--border);">
        
        <!-- Sol Sekme Çubuğu (Sidebar) -->
        <div style="background:var(--bg-raised);border-right:1px solid var(--border-light);padding:1.25rem 1rem;display:flex;flex-direction:column;gap:.4rem;">
          <div style="font-weight:900;font-size:1.02rem;color:var(--text-primary);margin-bottom:.85rem;padding-left:.35rem;letter-spacing:-.2px;">
            Ayarlar & Yönetim
          </div>
          <div style="display:flex;flex-direction:column;gap:.3rem;flex:1;overflow-y:auto;">
            ${tabButtonsHtml}
          </div>
        </div>

        <!-- Sağ Ana İçerik Alanı -->
        <div style="display:flex;flex-direction:column;min-height:0;background:var(--bg-surface);overflow:hidden;">
          
          <div style="flex:1;padding:1.75rem 2rem;overflow-y:auto;overflow-x:hidden;" id="settingsTabContentArea">
            ${tabContentHtml}
          </div>

          <!-- Alt İşlem ve Kaydetme Kontrol Barı -->
          <div style="background:var(--bg-raised);border-top:1px solid var(--border-light);padding:.85rem 1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;">
            <button type="button" class="btn btn-sm btn-ghost" id="btnResetToFactoryPrefs" style="color:var(--text-muted);font-weight:700;font-size:.8rem;">
              Fabrika Ayarlarına Sıfırla
            </button>
            <div style="display:flex;align-items:center;gap:.6rem;">
              <button type="button" class="btn btn-sm btn-ghost" id="btnCancelSettingsModal" style="font-weight:700;">
                İptal
              </button>
              <button type="button" class="btn btn-sm btn-primary" id="btnSaveAllSettingsChanges" style="font-weight:800;padding:.5rem 1.35rem;box-shadow:0 4px 14px rgba(37,99,235,0.35);">
                Değişiklikleri Kaydet
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    bindTabEvents();
  }

  function bindTabEvents() {
    overlay.querySelectorAll('.settings-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        captureProfileInputs();
        const tab = btn.dataset.tab;
        if (tab === 'audit') {
          if (typeof window.openAuditLogModal === 'function') {
            window.openAuditLogModal();
            return;
          }
        }
        activeTab = tab;
        renderModal();
      });
    });

    overlay.querySelector('#btnCancelSettingsModal')?.addEventListener('click', () => overlay.remove());

    overlay.querySelector('#btnResetToFactoryPrefs')?.addEventListener('click', () => {
      window.showConfirmDialog({
        title: 'Fabrika Ayarlarına Dön',
        message: 'Tüm kişisel görünüm, sütun sırası ve sayfalama ayarlarınız varsayılana döndürülecektir.',
        confirmText: 'Sıfırla',
        isDanger: true,
        onConfirm: () => {
          FrpStore.setPreferences({
            fontFamily: 'Inter',
            codeFontFamily: 'Consolas',
            codeFontSize: 13,
            pageSize: 50,
            visibleColumns: {
              reportName: true, fileName: true, fileSize: true, category: true,
              guid: true, tags: true, queries: false, date: true, lastModified: true
            },
            columnOrder: ['reportName', 'fileName', 'fileSize', 'category', 'guid', 'tags', 'queries', 'date', 'lastModified']
          });
          safeToast('Ayarlar fabrika ayarlarına sıfırlandı.', 'success');
          overlay.remove();
          if (typeof refreshAll === 'function') refreshAll();
        }
      });
    });

    overlay.querySelector('#btnSaveAllSettingsChanges')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      try {
        captureProfileInputs();

        btn.disabled = true;
        btn.innerHTML = `<span>Kaydediliyor...</span>`;

        FrpStore.setPreferences(stagedPrefs);
        FrpStore.applyPreferences();
        if (typeof FrpStore.setUserProfile === 'function') {
          FrpStore.setUserProfile(stagedProfile);
        }

        if (window.FrpAudit?.logAction) {
          window.FrpAudit.logAction({
            action: 'SETTINGS_UPDATE',
            target: 'Kullanıcı Ayarları',
            details: 'Görünüm, font, yoğunluk ve genel tercihler güncellendi.'
          }).catch(() => {});
        }

        if (window.FrpAuth?.updateProfile) {
          Promise.race([
            window.FrpAuth.updateProfile({
              name: `${stagedProfile.firstName || ''} ${stagedProfile.lastName || ''}`.trim(),
              phone: stagedProfile.phone,
              department: stagedProfile.department
            }),
            new Promise(res => setTimeout(res, 800))
          ]).catch(() => {});
        }

        btn.innerHTML = `<span style="display:flex;align-items:center;gap:.35rem;"><span>✓</span><span>Kaydedildi</span></span>`;
        btn.style.background = 'linear-gradient(135deg, #059669, #10b981)';

        safeToast('Değişiklikler başarıyla kaydedildi.', 'success');
      } catch (err) {
        console.error('Settings save error:', err);
        safeToast('Ayarlar yerel olarak kaydedildi.', 'success');
      } finally {
        setTimeout(() => {
          overlay.remove();
          if (typeof window.refreshAll === 'function') window.refreshAll();
        }, 300);
      }
    });

    const tabModule = window.FrpSettingsTabs && window.FrpSettingsTabs[activeTab];
    if (tabModule && typeof tabModule.bind === 'function') {
      tabModule.bind({ overlay, stagedPrefs, stagedProfile, markDirty, escHtml, safeToast, renderModal });
    }
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      captureProfileInputs();
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
  renderModal();
};
