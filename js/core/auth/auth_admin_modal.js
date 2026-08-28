// ============================================================
//  auth_admin_modal.js — Ultra-Modern Kayıt Onay & Kullanıcı Yönetimi Paneli
// ============================================================

(function () {
  'use strict';

  const SUPABASE_REST_URL = 'https://wxlmbpognkjlwyksmosd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ASaLwO7-3T7nRqneM0GW6g_8cgCNzQJ';

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatRelativeTime(isoDate) {
    if (!isoDate) return 'Bilinmiyor';
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
      if (diffSec < 60) return 'Az önce';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dk önce`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} saat önce`;
      return `${Math.floor(diffSec / 86400)} gün önce`;
    } catch {
      return 'Yakın zamanda';
    }
  }

  function showAdminCustomPrompt({ title, message, defaultValue = '', placeholder = '', confirmText = 'Tamam', cancelText = 'İptal', onConfirm }) {
    const existing = document.getElementById('adminPromptOverlay');
    if (existing) existing.remove();

    const promptOverlay = document.createElement('div');
    promptOverlay.id = 'adminPromptOverlay';
    promptOverlay.className = 'modal-overlay';
    promptOverlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px);
      z-index: 200000; display: flex; align-items: center; justify-content: center; padding: 1rem; animation: fadeIn .15s ease-out;
    `;

    promptOverlay.innerHTML = `
      <div class="modal" style="max-width:440px;width:92vw;padding:1.6rem;border-radius:18px;box-shadow:0 24px 60px rgba(0,0,0,.5);border:1px solid var(--border,#cbd5e1);background:var(--bg-surface,#ffffff);">
        <div style="font-size:1.15rem;font-weight:900;color:var(--text-primary,#0f172a);margin-bottom:.4rem;">${title}</div>
        <div style="font-size:.84rem;color:var(--text-secondary,#475569);line-height:1.5;margin-bottom:1.2rem;">${message}</div>
        <div style="margin-bottom:1.4rem;">
          <input type="text" id="adminPromptInput" class="master-search-input" value="${escHtml(defaultValue)}" placeholder="${escHtml(placeholder)}" style="width:100%;font-size:.92rem;padding:.55rem .85rem;" />
        </div>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:.75rem;">
          <button type="button" class="btn btn-sm btn-ghost" id="btnAdminPromptCancel" style="padding:.5rem 1.1rem;font-weight:700;">${cancelText}</button>
          <button type="button" class="btn btn-sm btn-primary" id="btnAdminPromptConfirm" style="padding:.5rem 1.4rem;font-weight:800;">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(promptOverlay);
    const input = promptOverlay.querySelector('#adminPromptInput');
    setTimeout(() => { if (input) { input.focus(); input.select(); } }, 60);

    const close = () => promptOverlay.remove();
    promptOverlay.querySelector('#btnAdminPromptCancel').onclick = close;
    promptOverlay.onclick = (e) => { if (e.target === promptOverlay) close(); };

    const doConfirm = () => {
      const val = input.value.trim();
      close();
      if (typeof onConfirm === 'function') onConfirm(val);
    };

    promptOverlay.querySelector('#btnAdminPromptConfirm').onclick = doConfirm;
    input.onkeydown = (e) => { if (e.key === 'Enter') doConfirm(); if (e.key === 'Escape') close(); };
  }

  async function showAdminApprovalModal(initialTab = 'pending') {
    const existing = document.getElementById('adminApprovalModalOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'adminApprovalModalOverlay';
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px);
      z-index: 100000; display: flex; align-items: center; justify-content: center;
      padding: 1rem; animation: fadeIn .2s ease-out;
    `;

    overlay.innerHTML = `
      <div class="admin-modal-wrap" style="color:var(--text-primary, #0f172a);">
        <!-- Başlık Barı -->
        <div class="admin-modal-header">
          <div style="display:flex;align-items:center;gap:.75rem;">
            <div style="width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg, #f59e0b, #ef4444);display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:#fff;box-shadow:0 4px 12px rgba(245,158,11,0.35);">
              👑
            </div>
            <div>
              <div style="font-size:1.15rem;font-weight:900;letter-spacing:-.01em;">Kullanıcı & Kayıt Onay Yönetimi</div>
              <div style="font-size:.78rem;color:var(--text-muted, #64748b);">Kurumsal Kullanıcı Başvuruları & Yetkilendirme</div>
            </div>
          </div>
          <button type="button" id="btnAdminModalClose" class="btn btn-sm btn-ghost" style="font-size:1.2rem;width:36px;height:36px;border-radius:50%;padding:0;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>

        <!-- Sekmeler -->
        <div class="admin-modal-tabs">
          <button type="button" id="tabAdminPending" class="admin-tab-btn ${initialTab === 'pending' ? 'active' : ''}">
            <span>🔔 Onay Bekleyenler</span>
            <span id="adminPendingTabBadge" class="badge badge-red" style="font-size:.72rem;padding:.15rem .45rem;">...</span>
          </button>
          <button type="button" id="tabAdminAll" class="admin-tab-btn ${initialTab === 'all' ? 'active' : ''}">
            <span>👥 Tüm Kullanıcılar</span>
            <span id="adminAllTabBadge" class="badge badge-blue" style="font-size:.72rem;padding:.15rem .45rem;">...</span>
          </button>
        </div>

        <!-- İçerik Alanı -->
        <div class="admin-modal-body" id="adminModalBody">
          <div style="text-align:center;padding:3rem;color:var(--text-muted,#64748b);">
            <div class="splash-spinner" style="margin-bottom:1rem;"></div>
            <div>Kullanıcı listesi yükleniyor...</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#btnAdminModalClose');
    closeBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const tabPending = overlay.querySelector('#tabAdminPending');
    const tabAll = overlay.querySelector('#tabAdminAll');

    tabPending.onclick = () => {
      tabPending.classList.add('active');
      tabAll.classList.remove('active');
      renderPendingTab();
    };

    tabAll.onclick = () => {
      tabAll.classList.add('active');
      tabPending.classList.remove('active');
      renderAllUsersTab();
    };

    // ── Sekme 1: Onay Bekleyenler ──
    async function renderPendingTab() {
      const body = overlay.querySelector('#adminModalBody');
      body.innerHTML = `
        <div style="text-align:center;padding:2.5rem;color:var(--text-muted,#64748b);">
          <div class="splash-spinner" style="margin-bottom:1rem;"></div>
          <div>Başvurular kontrol ediliyor...</div>
        </div>
      `;

      const headers = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {};
      let pendingUsers = [];
      try {
        const res = await fetch('/api/admin/pending-users', { headers });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.users)) pendingUsers = data.users;
      } catch (e) {
        try {
          const res = await fetch(`${SUPABASE_REST_URL}/rest/v1/app_users?is_active=eq.false&order=created_at.desc`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
          });
          if (res.ok) pendingUsers = await res.json();
        } catch {}
      }

      const badge = overlay.querySelector('#adminPendingTabBadge');
      if (badge) badge.textContent = pendingUsers.length;

      if (pendingUsers.length === 0) {
        body.innerHTML = `
          <div style="text-align:center;padding:3.5rem 1rem;">
            <div style="font-size:3.5rem;margin-bottom:1rem;animation:pulse 2s infinite;">🎉</div>
            <div style="font-size:1.2rem;font-weight:800;margin-bottom:.4rem;color:var(--text-primary,#0f172a);">Onay Bekleyen Kayıt Yok</div>
            <div style="font-size:.85rem;color:var(--text-muted,#64748b);max-width:380px;margin:0 auto;">
              Şu anda sisteme katılmak için onay bekleyen yeni bir kullanıcı başvurusu bulunmuyor.
            </div>
          </div>
        `;
        return;
      }

      let html = `
        <div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;">
          <div style="font-size:.85rem;font-weight:700;color:var(--text-muted,#64748b);">
            Toplam <strong>${pendingUsers.length}</strong> kullanıcı onayı bekliyor:
          </div>
          <button type="button" id="btnRefreshPendingList" class="btn btn-sm btn-ghost" style="font-size:.78rem;">🔄 Listeyi Yenile</button>
        </div>
        <div class="admin-card-grid" id="pendingGridList">
      `;

      pendingUsers.forEach(u => {
        const timeAgo = formatRelativeTime(u.created_at);
        html += `
          <div class="admin-user-card" id="pendingCard_${u.id}">
            <div class="admin-user-info">
              <div class="admin-user-avatar">${u.avatar || '👤'}</div>
              <div style="min-width:0;flex:1;">
                <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.2rem;">
                  <span style="font-weight:900;font-size:1rem;color:var(--text-primary,#0f172a);">${escHtml(u.full_name || u.username)}</span>
                  <span style="font-size:.78rem;font-weight:700;font-family:monospace;color:#2563eb;background:rgba(37,99,235,0.08);padding:.15rem .45rem;border-radius:6px;">@${escHtml(u.username)}</span>
                  <span class="badge badge-amber" style="font-size:.7rem;">⏳ Onay Bekliyor</span>
                </div>
                <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;font-size:.78rem;color:var(--text-secondary,#475569);">
                  <span>📧 ${escHtml(u.email || '-')}</span>
                  ${u.phone ? `<span>📱 ${escHtml(u.phone)}</span>` : ''}
                  <span>🏢 <strong>${escHtml(u.department || 'Bilgi İşlem')}</strong></span>
                  <span style="color:var(--text-muted,#94a3b8);">🕒 ${timeAgo}</span>
                </div>
              </div>
            </div>
            <div class="admin-actions">
              <button type="button" class="btn btn-sm btn-success btn-approve-user" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}" style="font-weight:800;padding:.45rem .85rem;box-shadow:0 2px 6px rgba(16,185,129,0.25);">
                ✅ Onayla
              </button>
              <button type="button" class="btn btn-sm btn-danger btn-reject-user" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}" style="font-weight:800;padding:.45rem .85rem;">
                ❌ Reddet
              </button>
            </div>
          </div>
        `;
      });

      html += `</div>`;
      body.innerHTML = html;

      body.querySelector('#btnRefreshPendingList')?.addEventListener('click', renderPendingTab);

      // Onayla
      body.querySelectorAll('.btn-approve-user').forEach(btn => {
        btn.onclick = async () => {
          const uId = btn.getAttribute('data-id');
          const uName = btn.getAttribute('data-name');
          const card = document.getElementById(`pendingCard_${uId}`);
          btn.disabled = true;
          btn.textContent = 'Onaylanıyor...';

          try {
            const res = await fetch('/api/admin/approve-user', {
              method: 'POST',
              headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {},
              body: JSON.stringify({ userId: uId })
            });
            const data = await res.json();
            if (data.success) {
              if (card) card.remove();
              if (typeof window.toast === 'function') window.toast(`✅ "${uName}" kullanıcısı başarıyla onaylandı!`, 'success');
              renderPendingTab();
            } else {
              throw new Error(data.reason || 'Onaylanamadı');
            }
          } catch (err) {
            alert('Onaylanırken hata: ' + err.message);
          }
        };
      });

      // Reddet
      body.querySelectorAll('.btn-reject-user').forEach(btn => {
        btn.onclick = () => {
          const uId = btn.getAttribute('data-id');
          const uName = btn.getAttribute('data-name');
          if (confirm(`"${uName}" kullanıcısının kayıt başvurusunu reddetmek istediğinize emin misiniz?`)) {
            fetch('/api/admin/reject-user', {
              method: 'POST',
              headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {},
              body: JSON.stringify({ userId: uId, deletePermanently: true })
            }).then(() => {
              if (typeof window.toast === 'function') window.toast(`"${uName}" başvurusu reddedildi.`, 'info');
              renderPendingTab();
            });
          }
        };
      });
    }

    // ── Sekme 2: Tüm Kullanıcılar ──
    async function renderAllUsersTab() {
      const body = overlay.querySelector('#adminModalBody');
      body.innerHTML = `
        <div style="text-align:center;padding:2.5rem;color:var(--text-muted,#64748b);">
          <div class="splash-spinner" style="margin-bottom:1rem;"></div>
          <div>Tüm kullanıcı kayıtları yükleniyor...</div>
        </div>
      `;

      let allUsers = [];
      try {
        const res = await fetch('/api/admin/all-users', {
          headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {}
        });
        const data = await res.json();
        if (data && data.success && Array.isArray(data.users)) allUsers = data.users;
      } catch (e) {}

      const badge = overlay.querySelector('#adminAllTabBadge');
      if (badge) badge.textContent = allUsers.length;

      let html = `
        <div style="margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;">
          <input type="text" id="adminUserSearchInput" class="master-search-input" placeholder="🔍 Kullanıcı adı, e-posta veya departmanda ara..." style="flex:1;max-width:320px;font-size:.84rem;padding:.45rem .8rem;" />
          <button type="button" id="btnRefreshAllUsers" class="btn btn-sm btn-ghost" style="font-size:.78rem;">🔄 Listeyi Yenile</button>
        </div>
        <div class="admin-card-grid" id="allUsersGridList">
      `;

      allUsers.forEach(u => {
        const isUsrAdmin = (u.role === 'admin' || u.username === 'admin');
        const isPending = (u.is_active === false);

        html += `
          <div class="admin-user-card" id="userCard_${u.id}">
            <div class="admin-user-info">
              <div class="admin-user-avatar">${u.avatar || (isUsrAdmin ? '👑' : '👤')}</div>
              <div style="min-width:0;flex:1;">
                <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.2rem;">
                  <span style="font-weight:800;font-size:.95rem;color:var(--text-primary,#0f172a);">${escHtml(u.full_name || u.username)}</span>
                  <span style="font-size:.78rem;font-weight:700;font-family:monospace;color:#2563eb;background:rgba(37,99,235,0.08);padding:.15rem .45rem;border-radius:6px;display:inline-flex;align-items:center;gap:.35rem;">
                    @${escHtml(u.username)}
                    <button type="button" class="btn btn-sm btn-ghost btn-edit-username" data-id="${u.id}" data-name="${escHtml(u.username)}" style="padding:1px 6px;font-size:.72rem;font-weight:700;color:#2563eb;background:#ffffff;border:1px solid rgba(37,99,235,0.25);border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;gap:2px;box-shadow:0 1px 3px rgba(0,0,0,0.06);" title="Kullanıcı Adını Değiştir">
                      <span>✏️</span><span>Düzenle</span>
                    </button>
                  </span>
                  ${isUsrAdmin ? `<span class="badge badge-purple" style="font-size:.68rem;">👑 Admin</span>` : `<span class="badge badge-blue" style="font-size:.68rem;">Kullanıcı</span>`}
                  ${isPending ? `<span class="badge badge-amber" style="font-size:.68rem;">⏳ Onay Bekliyor</span>` : `<span class="badge badge-green" style="font-size:.68rem;">🟢 Aktif</span>`}
                </div>
                <div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;font-size:.75rem;color:var(--text-secondary,#64748b);">
                  <span>📧 ${escHtml(u.email || '-')}</span>
                  ${u.phone ? `<span>📱 ${escHtml(u.phone)}</span>` : ''}
                  <span>🏢 ${escHtml(u.department || 'Bilgi İşlem')}</span>
                </div>
              </div>
            </div>
            <div class="admin-actions">
              <button type="button" class="btn btn-sm btn-ghost btn-admin-reset-pass" data-id="${u.id}" data-name="${escHtml(u.full_name || u.username)}" title="Şifre Sıfırla" style="font-size:.78rem;font-weight:700;">
                🔑 Şifre Sıfırla
              </button>
            </div>
          </div>
        `;
      });

      html += `</div>`;
      body.innerHTML = html;

      // Kullanıcı Adı Değiştirme
      body.querySelectorAll('.btn-edit-username').forEach(btn => {
        btn.onclick = () => {
          const uId = btn.getAttribute('data-id');
          const oldName = btn.getAttribute('data-name');
          showAdminCustomPrompt({
            title: 'Kullanıcı Adını Değiştir',
            message: `<strong>@${oldName}</strong> için yeni kullanıcı adını girin:`,
            defaultValue: oldName,
            confirmText: 'Kaydet',
            onConfirm: async (newName) => {
              if (!newName || newName === oldName) return;
              try {
                const res = await fetch('/api/admin/update-username', {
                  method: 'POST',
                  headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {},
                  body: JSON.stringify({ userId: uId, newUsername: newName })
                });
                const data = await res.json();
                if (data.success) {
                  if (typeof window.toast === 'function') window.toast(`Kullanıcı adı @${newName} olarak güncellendi!`, 'success');
                  renderAllUsersTab();
                } else {
                  alert(data.reason || 'Kullanıcı adı güncellenemedi.');
                }
              } catch (e) {
                alert('Hata oluştu: ' + e.message);
              }
            }
          });
        };
      });

      // Şifre Sıfırla
      body.querySelectorAll('.btn-admin-reset-pass').forEach(btn => {
        btn.onclick = () => {
          const uId = btn.getAttribute('data-id');
          const uName = btn.getAttribute('data-name');
          const newPass = prompt(`"${uName}" kullanıcısı için YENİ şifreyi giriniz:`);
          if (!newPass) return;
          fetch('/api/admin/reset-user-password', {
            method: 'POST',
            headers: (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {},
            body: JSON.stringify({ userId: uId, newPassword: newPass })
          }).then(r => r.json()).then(data => {
            if (data.success) {
              if (typeof window.toast === 'function') window.toast(`"${uName}" şifresi başarıyla güncellendi! 🔑`, 'success');
            } else {
              alert(data.reason || 'Şifre güncellenemedi.');
            }
          });
        };
      });
    }

    if (initialTab === 'all') renderAllUsersTab();
    else renderPendingTab();
  }

  window.showAdminApprovalModal = showAdminApprovalModal;
})();
