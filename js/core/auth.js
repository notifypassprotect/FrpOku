/**
 * FrpOku - Güvenli Kullanıcı Oturum & Kimlik Doğrulama Katmanı (Auth Orchestrator v5)
 * Modüler Mimari:
 * - js/core/auth/auth_portal.js (Giriş/Kayıt Portalı ve Kullanıcı Menüsü)
 * - js/core/auth/auth_admin_modal.js (Yönetici Kayıt Onay & Kullanıcı Yönetimi)
 * - js/core/auth/audit_logger.js (Canlı IP ve Sistem Denetim Günlüğü)
 */

(function () {
  'use strict';

  const AUTH_STORAGE_KEY = 'frpoku_auth_session';
  const REMEMBER_KEY = 'frpoku_remember_flag';
  const SAVED_IDENTIFIER_KEY = 'frpoku_saved_identifier';
  const SUPABASE_REST_URL = 'https://wxlmbpognkjlwyksmosd.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ASaLwO7-3T7nRqneM0GW6g_8cgCNzQJ';

  let currentUser = null;
  let adminPollingInterval = null;

  async function hashPassword(plainText) {
    if (!plainText) return '';
    try {
      const msgBuffer = new TextEncoder().encode(plainText);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      let hash = 0;
      for (let i = 0; i < plainText.length; i++) {
        const char = plainText.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      return 'fb_' + Math.abs(hash);
    }
  }

  async function fetchUsersFromRest(queryString = '') {
    const res = await fetch(`${SUPABASE_REST_URL}/rest/v1/app_users${queryString}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  }

  async function register({ fullName, username, email, phone, department, password }) {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (fullName || '').trim().replace(/\s+/g, ' ');

    try {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: cleanName,
            username: cleanUser,
            email: cleanEmail,
            phone: phone || null,
            department: (department || 'Bilgi İşlem').trim(),
            password
          })
        });
        const data = await res.json();
        if (data && data.success) {
          return { success: true, pendingApproval: true, message: data.message };
        } else if (data && data.reason) {
          return { success: false, reason: data.reason };
        }
      } catch (backendErr) {}

      const passwordHash = await hashPassword(password);
      const newUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

      const newRecord = {
        id: newUserId,
        username: cleanUser,
        email: cleanEmail,
        phone: phone || null,
        full_name: cleanName,
        department: (department || 'Bilgi İşlem').trim(),
        password_hash: passwordHash,
        role: 'user',
        avatar: '👤',
        is_active: false,
        created_at: new Date().toISOString(),
        last_login: null
      };

      const res = await fetch(`${SUPABASE_REST_URL}/rest/v1/app_users`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(newRecord)
      });

      if (!res.ok) throw new Error('Kayıt oluşturulamadı');

      return {
        success: true,
        pendingApproval: true,
        message: 'Kayıt başvurunuz başarıyla alındı. Yönetici onayından sonra aktif edilecektir.'
      };
    } catch (err) {
      return { success: false, reason: 'Kayıt sırasında hata: ' + err.message };
    }
  }

  async function login({ identifier, password, rememberMe = true }) {
    const ident = (identifier || '').trim();
    if (!ident || !password) return { success: false, reason: 'Lütfen tüm alanları doldurun.' };

    try {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: ident, password })
        });
        const data = await res.json();
        if (data && data.success && data.user) {
          if (data.token) {
            data.user.token = data.token;
            try { localStorage.setItem('frpoku_auth_token', data.token); } catch (e) {}
          }
          if (rememberMe) localStorage.setItem(SAVED_IDENTIFIER_KEY, ident);
          else localStorage.removeItem(SAVED_IDENTIFIER_KEY);
          setSession(data.user, rememberMe);
          return { success: true, user: data.user };
        } else if (data && data.pendingApproval) {
          return {
            success: false,
            pendingApproval: true,
            reason: data.reason || '⏳ Hesabınız henüz sistem yöneticisi (Admin) tarafından onaylanmamıştır.'
          };
        } else if (data && data.reason) {
          return { success: false, reason: data.reason };
        }
      } catch (backendErr) {}

      const cleanIdent = ident.toLowerCase();
      const users = await fetchUsersFromRest(`?or=(username.eq.${encodeURIComponent(cleanIdent)},email.eq.${encodeURIComponent(cleanIdent)})&limit=1`);
      if (!users || users.length === 0) {
        return { success: false, reason: '❌ Kullanıcı hesabı bulunamadı.' };
      }

      const user = users[0];
      const pHash = await hashPassword(password);
      if (user.password_hash !== pHash && user.password_hash !== password) {
        return { success: false, reason: '🔒 Şifreniz hatalı!' };
      }

      if (user.is_active === false) {
        return {
          success: false,
          pendingApproval: true,
          reason: '⏳ Hesabınız henüz sistem yöneticisi tarafından onaylanmamıştır.'
        };
      }

      setSession(user, rememberMe);
      return { success: true, user };
    } catch (err) {
      return { success: false, reason: 'Giriş hatası: ' + err.message };
    }
  }

  function setSession(user, remember = true) {
    currentUser = user;
    const json = JSON.stringify(user);
    if (remember) {
      localStorage.setItem(AUTH_STORAGE_KEY, json);
      localStorage.setItem(REMEMBER_KEY, '1');
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, json);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    }
    updateNavbarUserBadge();
    refreshAdminPendingBadge();
  }

  function getSession() {
    if (currentUser) return currentUser;
    try {
      const isRemembered = localStorage.getItem(REMEMBER_KEY) === '1';
      const raw = isRemembered
        ? localStorage.getItem(AUTH_STORAGE_KEY)
        : (sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY));
      if (raw) {
        currentUser = JSON.parse(raw);
        return currentUser;
      }
    } catch {
      currentUser = null;
    }
    return null;
  }

  function logout() {
    currentUser = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    localStorage.removeItem('frpoku_auth_token');
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    updateNavbarUserBadge();
    document.getElementById('btnAdminPendingRegistrations')?.remove();
    if (typeof window.showAuthFullScreenPortal === 'function') {
      window.showAuthFullScreenPortal('login');
    } else {
      window.location.reload();
    }
  }

  function isLoggedIn() { return !!getSession(); }
  function getUser() { return getSession(); }
  function isAdmin() {
    const u = getSession();
    return !!(u && (u.role === 'admin' || u.username === 'admin'));
  }

  function confirmLogout() {
    if (typeof window.showConfirmDialog === 'function') {
      window.showConfirmDialog({
        title: 'Oturumu Kapat',
        message: 'Mevcut kullanıcı oturumunuz kapatılacaktır. Devam etmek istiyor musunuz?',
        confirmText: 'Çıkış Yap',
        cancelText: 'Vazgeç',
        isDanger: true,
        onConfirm: () => logout()
      });
    } else {
      if (confirm('Oturumunuz kapatılacaktır. Devam etmek istiyor musunuz?')) logout();
    }
  }

  function getAuthHeaders(extra = {}) {
    const user = getSession();
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (user) {
      try {
        const token = user.token || localStorage.getItem('frpoku_auth_token') || btoa(unescape(encodeURIComponent(JSON.stringify(user))));
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Admin-Auth'] = token;
      } catch (e) {}
    }
    return headers;
  }

  function updateNavbarUserBadge() {
    const user = getSession();
    const btnProfile = document.getElementById('btnUserProfile') || document.querySelector('[data-auth-badge]');
    let quickLogoutBtn = document.getElementById('btnQuickLogout');
    const topbarRight = document.querySelector('.topbar-right');

    const btnDashboard = document.getElementById('btnDashboardPanel');
    if (btnDashboard) btnDashboard.style.display = isAdmin() ? 'inline-flex' : 'none';

    if (user) {
      if (btnProfile) {
        btnProfile.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:.4rem;">
            <span style="font-weight:700;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${user.full_name || user.username}</span>
            <span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;"></span>
          </span>
        `;
      }
      if (topbarRight && !quickLogoutBtn) {
        quickLogoutBtn = document.createElement('button');
        quickLogoutBtn.id = 'btnQuickLogout';
        quickLogoutBtn.className = 'btn btn-sm btn-logout-compact';
        quickLogoutBtn.style.cssText = `
          font-weight: 800; font-size: .82rem; padding: .4rem .75rem; border-radius: 9px;
          background: rgba(239, 68, 68, 0.08); color: #ef4444; border: 1.5px solid rgba(239, 68, 68, 0.3);
          display: inline-flex; align-items: center; gap: .35rem; cursor: pointer; margin-left: .2rem;
        `;
        quickLogoutBtn.innerHTML = `<span class="btn-text">Çıkış</span>`;
        quickLogoutBtn.onclick = confirmLogout;
        topbarRight.appendChild(quickLogoutBtn);
      }
    } else {
      if (btnProfile) {
        btnProfile.innerHTML = `<span style="font-weight:700;">Giriş Yap</span>`;
      }
      if (quickLogoutBtn) quickLogoutBtn.remove();
    }
  }

  async function refreshAdminPendingBadge() {
    if (!isAdmin()) {
      document.getElementById('btnAdminPendingRegistrations')?.remove();
      return;
    }
    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;

    let pendingCount = 0;
    try {
      const res = await fetch('/api/admin/pending-users', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.users)) pendingCount = data.users.length;
    } catch {}

    let adminBtn = document.getElementById('btnAdminPendingRegistrations');
    if (!adminBtn) {
      adminBtn = document.createElement('button');
      adminBtn.id = 'btnAdminPendingRegistrations';
      adminBtn.type = 'button';
      adminBtn.className = 'btn-admin-pending';
      adminBtn.onclick = () => window.showAdminApprovalModal && window.showAdminApprovalModal('pending');
      topbarRight.insertBefore(adminBtn, topbarRight.firstChild);
    }

    if (pendingCount > 0) {
      adminBtn.classList.add('has-pending');
      adminBtn.innerHTML = `<span>Yeni Kayıt</span> <span class="admin-pending-badge">${pendingCount}</span>`;
    } else {
      adminBtn.classList.remove('has-pending');
      adminBtn.innerHTML = `<span>Kullanıcı Yönetimi</span>`;
    }
  }

  function setupAdminFeatures() {
    if (!isAdmin()) {
      if (adminPollingInterval) {
        clearInterval(adminPollingInterval);
        adminPollingInterval = null;
      }
      document.getElementById('btnAdminPendingRegistrations')?.remove();
      return;
    }
    refreshAdminPendingBadge();
    if (!adminPollingInterval) {
      adminPollingInterval = setInterval(() => { if (isAdmin()) refreshAdminPendingBadge(); }, 6000);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
      if (typeof window.showAuthFullScreenPortal === 'function') window.showAuthFullScreenPortal('login');
    } else {
      const appWrap = document.querySelector('.app-wrap');
      if (appWrap) appWrap.style.display = 'flex';
      updateNavbarUserBadge();
      setupAdminFeatures();
    }

    const btnProfile = document.getElementById('btnUserProfile') || document.querySelector('[data-auth-badge]');
    if (btnProfile) {
      btnProfile.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isLoggedIn()) {
          if (typeof window.showUserDropdown === 'function') window.showUserDropdown(btnProfile);
        } else {
          if (typeof window.showAuthFullScreenPortal === 'function') window.showAuthFullScreenPortal('login');
        }
      });
    }
  });

  window.FrpAuth = {
    register,
    login,
    logout,
    confirmLogout,
    isLoggedIn,
    getUser,
    isAdmin,
    getSession,
    setSession,
    getAuthHeaders,
    updateNavbarUserBadge,
    setupAdminFeatures,
    refreshAdminPendingBadge,
    updateSession(updatedUser) {
      if (currentUser && updatedUser) {
        currentUser = { ...currentUser, ...updatedUser };
        const isRem = localStorage.getItem(REMEMBER_KEY) === '1';
        setSession(currentUser, isRem);
      }
    }
  };
})();
