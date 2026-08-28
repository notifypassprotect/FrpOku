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
      <div style="font-size:2.5rem;margin-bottom:.5rem;">${isDanger ? '🚨' : '❓'}</div>
      <div style="font-size:1.12rem;font-weight:800;color:var(--text-primary);margin-bottom:.4rem;">${title}</div>
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
  const doSubmit = () => {
    const val = input.value;
    overlay.remove();
    if (typeof onConfirm === 'function') onConfirm(val);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSubmit();
    }
  });

  overlay.querySelector('.btn-cancel-prompt').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.btn-ok-prompt').addEventListener('click', doSubmit);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.body.appendChild(overlay);
  setTimeout(() => input.focus(), 50);
};

// ── ANA AYARLAR PENCERESİ AÇICI (ORCHESTRATOR) ───────────────
window.openSettingsModal = function(initialTab = 'appearance') {
  document.querySelectorAll('.modal-overlay').forEach(el => el.remove());
  let activeTab = initialTab;

  const livePrefs = FrpStore.getPreferences();
  let stagedPrefs = {
    ...livePrefs,
    visibleColumns: {
      reportName: true,
      fileName: true,
      fileSize: true,
      category: true,
      guid: true,
      tags: true,
      queries: false,
      date: true,
      ...(livePrefs.visibleColumns || {})
    },
    theme: FrpStore.getTheme() || 'light'
  };

  const authUser = (typeof window.FrpAuth !== 'undefined' && window.FrpAuth.getUser) ? window.FrpAuth.getUser() : null;
  const nameParts = (authUser?.full_name || '').split(' ');
  const authFirstName = nameParts[0] || '';
  const authLastName = nameParts.slice(1).join(' ') || '';

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
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function markDirty() {
    const saveBtn = overlay.querySelector('#btnSaveAllSettingsChanges');
    if (saveBtn) {
      saveBtn.style.animation = 'pulse 1.5s infinite';
      saveBtn.innerHTML = '💾 Değişiklikleri Kaydet *';
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
      { id: 'appearance', icon: '🎨', label: 'Görünüm & Yazı Tipi' },
      { id: 'profile',    icon: '👤', label: 'Kullanıcı & Cihaz Profili' },
      { id: 'categories', icon: '🏷️', label: 'Kategoriler & Etiketler' },
      { id: 'columns',    icon: '👁️', label: 'Sütun & Tablo' },
      { id: 'shortcuts',  icon: '⌨️', label: 'Klavye Kısayolları' },
      { id: 'trash',      icon: '🗑️', label: 'Çöp Kutusu', count: trashItems.length, isTrash: true },
      { id: 'storage',    icon: '💾', label: 'Yedekleme & Depolama' },
      { id: 'audit',      icon: '📋', label: 'İşlem Geçmişi (Audit)' }
    ];

    const tabButtonsHtml = tabs.map(t => {
      const isTrashWithItems = t.isTrash && (t.count > 0);
      const countBadge = t.count !== undefined ? `
        <span class="badge ${t.count > 0 ? 'badge-red' : 'badge-gray'}" style="margin-left:auto;font-size:.68rem;padding:2px 6px;border-radius:10px;${isTrashWithItems ? 'animation:pulse 2s infinite;' : ''}">
          ${t.count}
        </span>
      ` : '';
      return `
        <button type="button" class="settings-tab-btn ${activeTab === t.id ? 'active' : ''}" data-tab="${t.id}" style="display:flex;align-items:center;gap:.6rem;width:100%;text-align:left;padding:.7rem .85rem;border-radius:10px;border:none;background:${activeTab === t.id ? 'var(--accent-light, rgba(37,99,235,0.08))' : 'transparent'};color:${activeTab === t.id ? 'var(--accent, #2563eb)' : 'var(--text-primary)'};font-weight:${activeTab === t.id ? '800' : '600'};cursor:pointer;font-size:.85rem;transition:all .15s;">
          <span style="font-size:1.05rem;">${t.icon}</span>
          <span>${t.label}</span>
          ${countBadge}
        </button>
      `;
    }).join('');

    // Sekme içeriğini ilgili modülden al
    const tabModule = window.FrpSettingsTabs && window.FrpSettingsTabs[activeTab];
    const tabContentHtml = tabModule && typeof tabModule.render === 'function'
      ? tabModule.render({ stagedPrefs, stagedProfile, escHtml, activeTab })
      : `<div style="padding:2rem;text-align:center;color:var(--text-muted);">Sekme yükleniyor...</div>`;

    overlay.innerHTML = `
      <div class="modal settings-modal-box" style="max-width:1160px;width:95vw;padding:0;overflow:hidden;display:grid;grid-template-columns:250px 1fr;height:86vh;min-height:640px;max-height:900px;border-radius:20px;box-shadow:0 28px 70px rgba(0,0,0,.45);border:1.5px solid var(--border);">
        
        <!-- Sol Sekme Çubuğu (Sidebar) -->
        <div style="background:var(--bg-raised);border-right:1px solid var(--border-light);padding:1.25rem 1rem;display:flex;flex-direction:column;gap:.4rem;">
          <div style="font-weight:800;font-size:.95rem;color:var(--text-primary);margin-bottom:.75rem;display:flex;align-items:center;gap:.4rem;">
            ⚙️ Ayarlar & Yönetim
          </div>
          <div style="display:flex;flex-direction:column;gap:.3rem;flex:1;overflow-y:auto;">
            ${tabButtonsHtml}
          </div>
        </div>

        <!-- Sağ Ana İçerik Alanı -->
        <div style="display:flex;flex-direction:column;min-height:0;background:var(--bg-surface);">
          
          <div style="flex:1;padding:1.5rem;overflow-y:auto;" id="settingsTabContentArea">
            ${tabContentHtml}
          </div>

          <!-- Alt İşlem ve Kaydetme Kontrol Barı -->
          <div style="background:var(--bg-raised);border-top:1px solid var(--border-light);padding:.85rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;">
            <button type="button" class="btn btn-sm btn-ghost" id="btnResetToFactoryPrefs" style="color:var(--text-muted);font-weight:700;font-size:.78rem;">
              🔄 Fabrika Ayarlarına Dön
            </button>
            <div style="display:flex;align-items:center;gap:.65rem;">
              <button type="button" class="btn btn-sm btn-ghost" id="btnCloseSettingsModal" style="font-weight:700;">
                Kapat
              </button>
              <button type="button" class="btn btn-sm btn-primary" id="btnSaveAllSettingsChanges" style="font-weight:800;padding:.5rem 1.4rem;box-shadow:0 4px 14px rgba(37,99,235,.35);">
                💾 Tüm Değişiklikleri Kaydet
              </button>
            </div>
          </div>

        </div>

      </div>
    `;

    // Sekme Değiştirme Butonları
    overlay.querySelectorAll('.settings-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        captureProfileInputs();
        activeTab = e.currentTarget.dataset.tab;
        renderModal();
      });
    });

    // Kapatma Butonu
    overlay.querySelector('#btnCloseSettingsModal')?.addEventListener('click', () => overlay.remove());

    // Fabrika Ayarlarına Dön
    overlay.querySelector('#btnResetToFactoryPrefs')?.addEventListener('click', () => {
      window.showConfirmDialog({
        title: 'Fabrika Ayarlarına Sıfırla',
        message: 'Tüm arayüz, tipografi, tema ve sütun ayarlarınızı varsayılana sıfırlamak istediğinize emin misiniz?',
        confirmText: 'Evet, Sıfırla',
        isDanger: true,
        onConfirm: () => {
          stagedPrefs = {
            fontFamily: 'inter',
            fontSize: 'normal',
            density: 'normal',
            codeFont: 'jetbrains',
            visibleColumns: {
              reportName: true,
              fileName: true,
              fileSize: true,
              category: true,
              guid: true,
              tags: true,
              queries: false,
              date: true
            },
            pageSize: 50,
            theme: 'light'
          };
          FrpStore.setPreferences(stagedPrefs);
          safeToast('Ayarlar varsayılana sıfırlandı.', 'info');
          if (typeof window.refreshAll === 'function') window.refreshAll();
          renderModal();
        }
      });
    });

    // Tümünü Kaydet Butonu
    overlay.querySelector('#btnSaveAllSettingsChanges')?.addEventListener('click', async () => {
      const saveBtn = overlay.querySelector('#btnSaveAllSettingsChanges');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Kaydediliyor... ⏳';
      }

      try {
        captureProfileInputs();

        // E-Posta format kontrolü
        const email = (stagedProfile.email || '').trim().toLowerCase();
        if (email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/.test(email)) {
          safeToast('⚠️ Lütfen geçerli bir e-posta adresi giriniz.', 'warning');
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Tüm Değişiklikleri Kaydet';
          }
          return;
        }

        // Bulut Senkronizasyonu
        const authUser = (typeof window.FrpAuth !== 'undefined' && window.FrpAuth.getUser) ? window.FrpAuth.getUser() : null;
        if (authUser && authUser.id && activeTab === 'profile') {
          try {
            const fullName = `${stagedProfile.firstName || ''} ${stagedProfile.lastName || ''}`.trim();
            const res = await fetch('/api/auth/update-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: authUser.id,
                fullName: fullName || authUser.full_name,
                username: stagedProfile.username || authUser.username,
                email: email || authUser.email,
                phone: stagedProfile.phone || authUser.phone,
                department: stagedProfile.department || authUser.department
              })
            });
            const data = await res.json();
            if (data && data.success && data.user) {
              window.FrpAuth.updateSession(data.user);
            }
          } catch {}
        }

        FrpStore.setUserProfile(stagedProfile);
        FrpStore.setPreferences(stagedPrefs);
        if (stagedPrefs.theme) FrpStore.setTheme(stagedPrefs.theme);
        if (typeof FrpStore.applyPreferences === 'function') FrpStore.applyPreferences();

        safeToast('Tüm ayarlar başarıyla kaydedildi! 💾', 'success');
        if (typeof window.refreshAll === 'function') window.refreshAll();
        if (typeof window.updateStats === 'function') window.updateStats();
        if (typeof window.FrpAuth?.updateNavbarUserBadge === 'function') window.FrpAuth.updateNavbarUserBadge();
      } catch (err) {
        console.error('Settings save error:', err);
        safeToast('Ayarlar kaydedilirken hata: ' + err.message, 'error');
      } finally {
        overlay.remove();
      }
    });

    // Aktif sekmenin event listener'larını bağla
    if (tabModule && typeof tabModule.bind === 'function') {
      tabModule.bind({
        overlay,
        stagedPrefs,
        stagedProfile,
        markDirty,
        safeToast,
        renderModal,
        setActiveTab: (t) => { activeTab = t; renderModal(); }
      });
    }
  }

  renderModal();
  document.body.appendChild(overlay);
};
