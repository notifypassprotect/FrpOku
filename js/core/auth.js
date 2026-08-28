/**
 * FrpOku - Güvenli Kullanıcı Oturum & Kimlik Doğrulama Katmanı (Auth Module v5 - Modernized)
 * - E-Postasız Yeni Kullanıcı Kayıt Akışı
 * - Yönetici (Admin) Onayı Sistemi (Pending Approval Workflow)
 * - Admin Panelinde Yanıp Sönen (Flashing / Pulsing) "Yeni Kayıt Var" Bildirimi
 * - Ultra-Modern Kayıt Onay & Kullanıcı Yönetim Paneli (Animasyonlu, Filtreli & Şifre Üreticili)
 * - Supabase Schema Tam Uyumluluğu (is_active boolean kontrolü)
 * - Responsive Tam Ekran Portal & Akıllı Dropdown Konumlandırması
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
  let cachedPendingCount = 0;

  // ── 1. Hızlı ve Güvenli SHA-256 Hash Fonksiyonu ────────────────
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

  // ── 3. REST / Server API İstek Motoru ─────────────────────────
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

  // ── 4. Kayıt Ol (Register - E-Postasız & Admin Onayına Gönder) ─
  async function register({ fullName, username, email, phone, department, password }) {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (fullName || '').trim().replace(/\s+/g, ' ');
    const rawPhone = (phone || '').replace(/\D/g, '');

    // 1. Ad & Soyad Doğrulaması
    const nameRegex = /^[a-zA-ZçğıöşüÇĞİÖŞÜ\s]{3,50}$/;
    if (!cleanName || !nameRegex.test(cleanName)) {
      return { success: false, reason: '⚠️ Ad ve Soyad yalnızca harflerden oluşmalıdır (en az 3 harf).' };
    }

    // 2. Kullanıcı Adı Doğrulaması
    const userRegex = /^[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ]{3,25}$/;
    if (!cleanUser || !userRegex.test(cleanUser)) {
      return { success: false, reason: '⚠️ Kullanıcı adı 3-25 karakter arasında olmalı, boşluk veya özel karakter içermemelidir.' };
    }

    // 3. E-Posta Format Doğrulaması
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return { success: false, reason: '⚠️ Lütfen geçerli bir e-posta adresi giriniz (Örnek: ad.soyad@kurum.com).' };
    }

    // 4. Türkiye Cep Telefonu Doğrulaması
    let formattedPhone = null;
    if (rawPhone) {
      const tenDigits = rawPhone.startsWith('0') ? rawPhone.slice(1) : rawPhone;
      const isTurkishMobile = /^5\d{9}$/.test(tenDigits);
      if (!isTurkishMobile) {
        return { success: false, reason: '⚠️ Lütfen geçerli bir Türkiye cep telefonu numarası giriniz (Örnek: 05XX XXX XX XX).' };
      }
      formattedPhone = tenDigits;
    }

    // 5. Şifre Uzunluğu
    if (!password || password.length < 3) {
      return { success: false, reason: '⚠️ Şifre en az 3 karakter olmalıdır.' };
    }

    try {
      // Önce Node Express Backend API dene
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: cleanName,
            username: cleanUser,
            email: cleanEmail,
            phone: formattedPhone,
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
      } catch (backendErr) {
        console.warn('Backend register API çağrısı başarısız, Supabase REST doğrudan deneniyor...', backendErr);
      }

      // Supabase REST doğrudan kayıt (Backend erişilemezse)
      let existingUsers = [];
      try {
        existingUsers = await fetchUsersFromRest(`?or=(username.eq.${cleanUser},email.eq.${cleanEmail})&limit=1`);
      } catch (e) { }

      if (existingUsers && existingUsers.length > 0) {
        if (existingUsers[0].username === cleanUser) {
          return { success: false, reason: `⚠️ '${cleanUser}' kullanıcı adı zaten kullanımda. Lütfen başka bir kullanıcı adı seçin.` };
        }
        if (existingUsers[0].email === cleanEmail) {
          return { success: false, reason: `⚠️ '${cleanEmail}' e-posta adresi zaten kayıtlıdır.` };
        }
      }

      const passwordHash = await hashPassword(password);
      const newUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

      const newRecord = {
        id: newUserId,
        username: cleanUser,
        email: cleanEmail,
        phone: formattedPhone,
        full_name: cleanName,
        department: (department || 'Bilgi İşlem').trim(),
        password_hash: passwordHash,
        role: 'user',
        avatar: '👤',
        is_active: false, // Yönetici onayı bekliyor (false = pending)
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

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || ('HTTP ' + res.status));
      }

      return {
        success: true,
        pendingApproval: true,
        message: 'Kayıt başvurunuz başarıyla alındı. Sistem yöneticisi (Admin) onayladıktan sonra hesabınız aktif edilecek ve giriş yapabileceksiniz.'
      };
    } catch (err) {
      return { success: false, reason: 'Kayıt sırasında hata oluştu: ' + (err.message || err) };
    }
  }

  // ── 5. Giriş Yap (Login) ────────────────────────────────────
  async function login({ identifier, password, rememberMe = true }) {
    const ident = (identifier || '').trim();
    if (!ident) return { success: false, reason: 'Lütfen kullanıcı adı, e-posta veya telefon numaranızı girin.' };
    if (!password) return { success: false, reason: 'Lütfen şifrenizi girin.' };

    try {
      // 1. Önce Node Express Backend Endpoint'i Dene
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: ident, password })
        });
        const data = await res.json();
        if (data && data.success && data.user) {
          if (rememberMe) {
            localStorage.setItem(SAVED_IDENTIFIER_KEY, ident);
          } else {
            localStorage.removeItem(SAVED_IDENTIFIER_KEY);
          }
          setSession(data.user, rememberMe);
          return { success: true, user: data.user };
        } else if (data && data.pendingApproval) {
          return {
            success: false,
            pendingApproval: true,
            reason: data.reason || '⏳ Hesabınız henüz sistem yöneticisi (Admin) tarafından onaylanmamıştır. Lütfen yöneticinizle iletişime geçiniz.'
          };
        } else if (data && data.reason) {
          return { success: false, reason: data.reason };
        }
      } catch (backendErr) {
        console.warn('Backend login başarısız, Supabase REST doğrudan deneniyor...', backendErr);
      }

      // 2. Supabase REST Fallback
      const cleanIdent = ident.toLowerCase();
      const phoneDigits = ident.replace(/\D/g, '');

      let queryString = '?limit=1';
      if (cleanIdent.includes('@')) {
        queryString += `&email=eq.${encodeURIComponent(cleanIdent)}`;
      } else if (phoneDigits.length >= 10) {
        queryString += `&or=(phone.eq.${phoneDigits},username.eq.${encodeURIComponent(cleanIdent)})`;
      } else {
        queryString += `&username=eq.${encodeURIComponent(cleanIdent)}`;
      }

      const users = await fetchUsersFromRest(queryString);

      if (!users || users.length === 0) {
        return { success: false, reason: '❌ Girdiğiniz bilgilere ait bir kullanıcı hesabı bulunamadı.' };
      }

      const user = users[0];
      const pHash = await hashPassword(password);

      if (user.password_hash !== pHash && user.password_hash !== password) {
        return { success: false, reason: '🔒 Şifreniz hatalı! Lütfen şifrenizi kontrol edip tekrar deneyin.' };
      }

      // Onay Kontrolü (is_active boolean kontrolü)
      if (user.is_active === false) {
        return {
          success: false,
          pendingApproval: true,
          reason: '⏳ Hesabınız henüz sistem yöneticisi (Admin) tarafından onaylanmamıştır. Lütfen yöneticinizle iletişime geçiniz.'
        };
      }

      // Son giriş zamanını güncelle
      fetch(`${SUPABASE_REST_URL}/rest/v1/app_users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ last_login: new Date().toISOString() })
      }).catch(() => { });

      if (rememberMe) {
        localStorage.setItem(SAVED_IDENTIFIER_KEY, ident);
      } else {
        localStorage.removeItem(SAVED_IDENTIFIER_KEY);
      }

      setSession(user, rememberMe);
      return { success: true, user };
    } catch (err) {
      return { success: false, reason: 'Bağlantı hatası: ' + (err.message || err) };
    }
  }

  // ── 6. Oturum Yönetimi (Beni Hatırla & Kalıcılık) ───────────
  function setSession(user, rememberMe) {
    currentUser = user;
    const safeData = { ...user };
    delete safeData.password_hash;

    if (rememberMe) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeData));
      localStorage.setItem(REMEMBER_KEY, '1');
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(safeData));
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    }

    if (window.FrpStore && typeof window.FrpStore.setUserProfile === 'function') {
      window.FrpStore.setUserProfile({
        name: user.full_name || user.username,
        email: user.email || '',
        username: user.username || '',
        phone: user.phone || '',
        department: user.department || ''
      });
    }

    updateNavbarUserBadge();
    setupAdminFeatures();
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
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    if (adminPollingInterval) {
      clearInterval(adminPollingInterval);
      adminPollingInterval = null;
    }
    updateNavbarUserBadge();

    if (window.FrpStore && typeof window.FrpStore.refreshFromCloud === 'function') {
      window.FrpStore.refreshFromCloud();
    }

    showAuthFullScreenPortal('login');
  }

  function isLoggedIn() { return !!getSession(); }
  function getUser() { return getSession(); }
  function isAdmin() {
    const u = getSession();
    return !!(u && (u.role === 'admin' || u.username === 'admin'));
  }

  // ── 7. Modern Çıkış Onay Modalı ───────────────────────────────
  function confirmLogout() {
    if (typeof window.showConfirmDialog === 'function') {
      window.showConfirmDialog({
        title: 'Oturumu Kapat',
        message: 'Mevcut kullanıcı oturumunuz sonlandırılacaktır. Devam etmek istiyor musunuz?',
        confirmText: 'Evet, Çıkış Yap',
        cancelText: 'Vazgeç',
        isDanger: true,
        onConfirm: () => {
          logout();
          if (typeof window.toast === 'function') window.toast('Oturum başarıyla kapatıldı.', 'info');
        }
      });
    } else {
      if (confirm('Oturumunuz kapatılacaktır. Devam etmek istiyor musunuz?')) {
        logout();
      }
    }
  }

  function getAuthHeaders(extra = {}) {
    const user = getSession();
    const headers = { 'Content-Type': 'application/json', ...extra };
    if (user) {
      try {
        const token = btoa(unescape(encodeURIComponent(JSON.stringify(user))));
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Admin-Auth'] = token;
      } catch (e) {}
    }
    return headers;
  }

  function updateAdminPanelVisibility() {
    const isUsrAdmin = isAdmin();
    const btnDashboard = document.getElementById('btnDashboardPanel');
    if (btnDashboard) {
      btnDashboard.style.display = isUsrAdmin ? 'inline-flex' : 'none';
    }
  }

  // ── 8. ADMİN: Onay Bekleyen Kayıtları Sorgulama & Bildirim ────
  async function fetchPendingUsers() {
    try {
      const res = await fetch('/api/admin/pending-users', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.users)) {
        return data.users;
      }
    } catch (e) {
      console.warn('Pending users fetch error:', e.message);
    }

    // Fallback Supabase REST (is_active = false)
    try {
      const users = await fetchUsersFromRest('?is_active=eq.false&order=created_at.desc');
      return Array.isArray(users) ? users : [];
    } catch (e) {
      return [];
    }
  }

  async function fetchAllUsers() {
    try {
      const res = await fetch('/api/admin/all-users', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.users)) {
        return data.users;
      }
    } catch (e) { }

    try {
      const users = await fetchUsersFromRest('?order=created_at.desc');
      return Array.isArray(users) ? users : [];
    } catch (e) {
      return [];
    }
  }

  // Admin Topbar Bildirim Butonunu Güncelle (Yanıp Sönen Buton)
  async function refreshAdminPendingBadge() {
    updateAdminPanelVisibility();
    if (!isAdmin()) {
      const btn = document.getElementById('btnAdminPendingRegistrations');
      if (btn) btn.remove();
      return;
    }

    const topbarRight = document.querySelector('.topbar-right');
    if (!topbarRight) return;

    const pendingList = await fetchPendingUsers();
    const count = pendingList.length;
    cachedPendingCount = count;

    let adminBtn = document.getElementById('btnAdminPendingRegistrations');
    if (!adminBtn) {
      adminBtn = document.createElement('button');
      adminBtn.id = 'btnAdminPendingRegistrations';
      adminBtn.type = 'button';
      adminBtn.className = 'btn-admin-pending';
      adminBtn.onclick = () => showAdminApprovalModal('pending');
      topbarRight.insertBefore(adminBtn, topbarRight.firstChild);
    }

    if (count > 0) {
      adminBtn.classList.add('has-pending');
      adminBtn.innerHTML = `
        <span style="font-size:1rem;">🔔</span>
        <span>Yeni Kayıt Var</span>
        <span class="admin-pending-badge">${count}</span>
      `;
      adminBtn.title = `${count} adet yeni kullanıcı onay bekliyor! İncelemek için tıklayın.`;
    } else {
      adminBtn.classList.remove('has-pending');
      adminBtn.innerHTML = `
        <span style="font-size:1rem;">👥</span>
        <span>Kullanıcı Yönetimi</span>
      `;
      adminBtn.title = 'Kullanıcı Yönetimi & Kayıt Onay Paneli';
    }
  }

  function setupAdminFeatures() {
    if (!isAdmin()) {
      if (adminPollingInterval) {
        clearInterval(adminPollingInterval);
        adminPollingInterval = null;
      }
      const btn = document.getElementById('btnAdminPendingRegistrations');
      if (btn) btn.remove();
      return;
    }

    refreshAdminPendingBadge();

    // 6 Saniyede bir periyodik denetle (Yeni kayıt varsa anında yanıp sönsün)
    if (!adminPollingInterval) {
      adminPollingInterval = setInterval(() => {
        if (isAdmin()) {
          refreshAdminPendingBadge();
        }
      }, 6000);
    }
  }

  // ── 9. ULTRA-MODERN ADMİN MODALI (Kayıt Onay & Kullanıcı Yönetimi) ─
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

      const pendingUsers = await fetchPendingUsers();
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
        refreshAdminPendingBadge();
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
                  <span>📧 <a href="mailto:${escHtml(u.email)}" style="color:inherit;text-decoration:none;font-weight:600;">${escHtml(u.email || '-')}</a></span>
                  ${u.phone ? `<span>📱 <a href="tel:${escHtml(u.phone)}" style="color:inherit;text-decoration:none;font-weight:600;">${escHtml(u.phone)}</a></span>` : ''}
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

      const refBtn = body.querySelector('#btnRefreshPendingList');
      if (refBtn) refBtn.onclick = renderPendingTab;

      // Onayla Butonları (Animasyonlu & Hızlı)
      body.querySelectorAll('.btn-approve-user').forEach(btn => {
        btn.onclick = async () => {
          const uId = btn.getAttribute('data-id');
          const uName = btn.getAttribute('data-name');
          const card = document.getElementById(`pendingCard_${uId}`);
          btn.disabled = true;
          btn.textContent = 'Onaylanıyor...';

          try {
            // Backend API isteği
            const res = await fetch('/api/admin/approve-user', {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ userId: uId })
            });
            const data = await res.json();
            
            if (data.success) {
              if (card) {
                card.classList.add('card-approved-anim');
                setTimeout(() => {
                  card.remove();
                  const remaining = body.querySelectorAll('.admin-user-card').length;
                  if (badge) badge.textContent = remaining;
                  if (remaining === 0) renderPendingTab();
                }, 450);
              }
              if (typeof window.toast === 'function') {
                window.toast(`✅ "${uName}" kullanıcısı başarıyla onaylandı ve hesabı açıldı!`, 'success');
              }
              refreshAdminPendingBadge();
            } else {
              throw new Error(data.reason || 'Onaylanamadı');
            }
          } catch (err) {
            // Supabase REST doğrudan deneme (is_active = true)
            try {
              await fetch(`${SUPABASE_REST_URL}/rest/v1/app_users?id=eq.${uId}`, {
                method: 'PATCH',
                headers: {
                  'apikey': SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_active: true })
              });
              if (card) {
                card.classList.add('card-approved-anim');
                setTimeout(() => {
                  card.remove();
                  const remaining = body.querySelectorAll('.admin-user-card').length;
                  if (badge) badge.textContent = remaining;
                  if (remaining === 0) renderPendingTab();
                }, 450);
              }
              if (typeof window.toast === 'function') {
                window.toast(`✅ "${uName}" kullanıcısı onaylandı!`, 'success');
              }
              refreshAdminPendingBadge();
            } catch (e) {
              showCustomPromptModal({
                title: 'Onaylama Hatası',
                message: e.message || 'Kullanıcı onaylanırken bir hata oluştu.',
                isAlertOnly: true
              });
              btn.disabled = false;
              btn.textContent = '✅ Onayla';
            }
          }
        };
      });

      // Reddet Butonları (Özel Onay Modalı ile)
      body.querySelectorAll('.btn-reject-user').forEach(btn => {
        btn.onclick = () => {
          const uId = btn.getAttribute('data-id');
          const uName = btn.getAttribute('data-name');
          const card = document.getElementById(`pendingCard_${uId}`);

          showCustomPromptModal({
            title: 'Kayıt Başvurusunu Reddet',
            message: `<strong>"${escHtml(uName)}"</strong> kullanıcısının kayıt başvurusunu silmek ve reddetmek istediğinize emin misiniz?`,
            confirmText: 'Evet, Reddet ve Sil',
            isDanger: true,
            onConfirm: async () => {
              try {
                await fetch('/api/admin/reject-user', {
                  method: 'POST',
                  headers: getAuthHeaders(),
                  body: JSON.stringify({ userId: uId, deletePermanently: true })
                });
                if (card) {
                  card.classList.add('card-rejected-anim');
                  setTimeout(() => {
                    card.remove();
                    const remaining = body.querySelectorAll('.admin-user-card').length;
                    if (badge) badge.textContent = remaining;
                    if (remaining === 0) renderPendingTab();
                  }, 400);
                }
                if (typeof window.toast === 'function') {
                  window.toast(`"${uName}" başvurusu reddedildi ve silindi.`, 'info');
                }
                refreshAdminPendingBadge();
              } catch (err) {
                try {
                  await fetch(`${SUPABASE_REST_URL}/rest/v1/app_users?id=eq.${uId}`, {
                    method: 'DELETE',
                    headers: {
                      'apikey': SUPABASE_ANON_KEY,
                      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                  });
                  if (card) card.remove();
                  refreshAdminPendingBadge();
                } catch (e) { }
              }
            }
          });
        };
      });
    }

    // ── Sekme 2: Tüm Kullanıcılar (Filtreli & Gelişmiş) ──
    async function renderAllUsersTab() {
      const body = overlay.querySelector('#adminModalBody');
      body.innerHTML = `
        <div style="text-align:center;padding:2.5rem;color:var(--text-muted,#64748b);">
          <div class="splash-spinner" style="margin-bottom:1rem;"></div>
          <div>Kullanıcılar listeleniyor...</div>
        </div>
      `;

      const allUsers = await fetchAllUsers();
      const badge = overlay.querySelector('#adminAllTabBadge');
      if (badge) badge.textContent = allUsers.length;

      let activeFilter = 'all'; // 'all', 'pending', 'active', 'suspended', 'admin'

      let html = `
        <!-- Arama & Filtre Çipleri -->
        <div style="margin-bottom:.85rem;display:flex;align-items:center;gap:.75rem;">
          <div style="position:relative;flex:1;">
            <span style="position:absolute;left:.75rem;top:50%;transform:translateY(-50%);color:#94a3b8;">🔍</span>
            <input type="text" id="adminUserSearchInput" placeholder="İsim, kullanıcı adı, birim veya e-posta ile filtrele..." style="
              width:100%;padding:.65rem .85rem .65rem 2.2rem;border-radius:12px;
              background:var(--bg-raised,#f8fafc);border:1.5px solid var(--border,#cbd5e1);
              color:var(--text-primary,#0f172a);font-size:.86rem;outline:none;
            " />
          </div>
          <button type="button" id="btnRefreshAllList" class="btn btn-sm btn-ghost" style="font-size:.78rem;">🔄 Yenile</button>
        </div>

        <div class="admin-filter-chips" id="adminFilterChips">
          <button type="button" class="admin-chip active" data-filter="all">Tümü (${allUsers.length})</button>
          <button type="button" class="admin-chip" data-filter="pending">⏳ Onay Bekleyen (${allUsers.filter(u => u.is_active === false).length})</button>
          <button type="button" class="admin-chip" data-filter="active">🟢 Aktif (${allUsers.filter(u => u.is_active !== false).length})</button>
          <button type="button" class="admin-chip" data-filter="admin">👑 Adminler (${allUsers.filter(u => u.role === 'admin' || u.username === 'admin').length})</button>
        </div>

        <div class="admin-card-grid" id="adminAllUsersGrid"></div>
      `;

      body.innerHTML = html;

      const grid = body.querySelector('#adminAllUsersGrid');
      const searchInp = body.querySelector('#adminUserSearchInput');
      const chips = body.querySelectorAll('.admin-chip');

      const applyFiltersAndRender = () => {
        const q = (searchInp ? searchInp.value : '').trim().toLowerCase();
        const filtered = allUsers.filter(u => {
          const isUsrAdmin = u.role === 'admin' || u.username === 'admin';
          const isPending = u.is_active === false;
          const isActive = u.is_active !== false;

          if (activeFilter === 'pending' && !isPending) return false;
          if (activeFilter === 'active' && !isActive) return false;
          if (activeFilter === 'admin' && !isUsrAdmin) return false;

          if (q) {
            const matches = (u.full_name || '').toLowerCase().includes(q) ||
              (u.username || '').toLowerCase().includes(q) ||
              (u.email || '').toLowerCase().includes(q) ||
              (u.phone || '').includes(q) ||
              (u.department || '').toLowerCase().includes(q);
            if (!matches) return false;
          }
          return true;
        });

        if (filtered.length === 0) {
          grid.innerHTML = `<div style="text-align:center;padding:2.5rem;color:var(--text-muted,#64748b);">Filtreye uygun kullanıcı bulunamadı.</div>`;
          return;
        }

        let listHtml = '';
        filtered.forEach(u => {
          const isUsrAdmin = u.role === 'admin' || u.username === 'admin';
          const isPending = u.is_active === false;
          const isActive = u.is_active !== false;

          listHtml += `
            <div class="admin-user-card" id="allUserCard_${u.id}" style="padding:.9rem 1.15rem;">
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
                <button type="button" class="btn btn-sm btn-ghost btn-admin-toggle-role" data-id="${u.id}" data-admin="${isUsrAdmin ? '1' : '0'}" title="Rol Değiştir" style="font-size:.78rem;font-weight:700;">
                  ${isUsrAdmin ? '👤 Normal Yap' : '👑 Admin Yap'}
                </button>
                <button type="button" class="btn btn-sm ${isActive ? 'btn-ghost' : 'btn-success'} btn-admin-toggle-active" data-id="${u.id}" data-active="${isActive ? '1' : '0'}" style="font-size:.78rem;font-weight:700;">
                  ${isActive ? '⏸️ Dondur' : '▶️ Aktif Et'}
                </button>
              </div>
            </div>
          `;
        });

        grid.innerHTML = listHtml;
        bindAllUsersActions(grid);
      };

      chips.forEach(c => {
        c.onclick = () => {
          chips.forEach(x => x.classList.remove('active'));
          c.classList.add('active');
          activeFilter = c.getAttribute('data-filter');
          applyFiltersAndRender();
        };
      });

      if (searchInp) searchInp.oninput = applyFiltersAndRender;
      const refAllBtn = body.querySelector('#btnRefreshAllList');
      if (refAllBtn) refAllBtn.onclick = renderAllUsersTab;

      applyFiltersAndRender();

      function bindAllUsersActions(scope) {
        // Kullanıcı Adı Değiştirme
        // Kullanıcı Adı Değiştirme (Modern Modal)
        scope.querySelectorAll('.btn-edit-username').forEach(btn => {
          btn.onclick = async (e) => {
            e.stopPropagation();
            const uId = btn.getAttribute('data-id');
            const curUser = btn.getAttribute('data-name');
            
            let newUser = null;
            if (typeof window.showPromptModal === 'function') {
              newUser = await window.showPromptModal({
                title: 'Kullanıcı Adı Değiştir',
                message: `<strong>@${curUser}</strong> kullanıcısı için yeni kullanıcı adını giriniz:`,
                defaultValue: curUser,
                placeholder: 'ornek_kullanici',
                confirmText: '💾 Güncelle',
                cancelText: 'Vazgeç',
                badge: '✏️'
              });
            } else {
              newUser = prompt(`"${curUser}" için yeni kullanıcı adını giriniz (@kullanici_adi):`, curUser);
            }

            if (!newUser || !newUser.trim() || newUser.trim().toLowerCase() === curUser.toLowerCase()) return;

            try {
              const res = await fetch('/api/admin/change-username', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ userId: uId, newUsername: newUser.trim() })
              });
              const data = await res.json();
              if (data.success) {
                if (window.FrpNotify) {
                  window.FrpNotify.success(`Kullanıcı adı @${data.username} olarak güncellendi! ✅`);
                } else if (typeof window.toast === 'function') {
                  window.toast(`Kullanıcı adı @${data.username} olarak güncellendi! ✅`, 'success');
                }
                if (window.FrpAudit) {
                  window.FrpAudit.logAction({
                    action: 'USERNAME_CHANGE',
                    target: `@${data.username}`,
                    details: `Yönetici tarafından kullanıcı adı değiştirildi: @${curUser} ➔ @${data.username}`
                  });
                }
                renderAllUsersTab();
              } else {
                if (window.FrpNotify) window.FrpNotify.error(data.reason || 'Kullanıcı adı değiştirilemedi.');
                else alert(data.reason || 'Kullanıcı adı değiştirilemedi.');
              }
            } catch (err) {
              if (window.FrpNotify) window.FrpNotify.error('Hata: ' + err.message);
              else alert('Hata: ' + err.message);
            }
          };
        });

        // Modern Şifre Sıfırlama
        scope.querySelectorAll('.btn-admin-reset-pass').forEach(btn => {
          btn.onclick = () => {
            const uId = btn.getAttribute('data-id');
            const uName = btn.getAttribute('data-name');
            showPasswordResetDialog(uId, uName);
          };
        });

        // Admin Rolü Değiştir
        scope.querySelectorAll('.btn-admin-toggle-role').forEach(btn => {
          btn.onclick = async () => {
            const uId = btn.getAttribute('data-id');
            const isCurAdmin = btn.getAttribute('data-admin') === '1';
            const makeAdmin = !isCurAdmin;

            try {
              await fetch('/api/admin/toggle-admin', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ userId: uId, makeAdmin })
              });
              if (typeof window.toast === 'function') {
                window.toast(`Kullanıcı rolü ${makeAdmin ? '👑 Admin' : '👤 Normal Kullanıcı'} olarak güncellendi.`, 'success');
              }
              renderAllUsersTab();
            } catch (err) {
              alert('Rol güncellenemedi: ' + err.message);
            }
          };
        });

        // Aktiflik Durumu Değiştir (Dondur / Aktif Et)
        scope.querySelectorAll('.btn-admin-toggle-active').forEach(btn => {
          btn.onclick = async () => {
            const uId = btn.getAttribute('data-id');
            const isCurActive = btn.getAttribute('data-active') === '1';
            const setActive = !isCurActive;

            try {
              await fetch('/api/admin/toggle-status', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ userId: uId, isActive: setActive })
              });
              if (typeof window.toast === 'function') {
                window.toast(setActive ? '✅ Kullanıcı aktifleştirildi.' : '⏸️ Kullanıcı donduruldu.', 'info');
              }
              renderAllUsersTab();
              refreshAdminPendingBadge();
            } catch (err) {
              alert('Durum güncellenemedi: ' + err.message);
            }
          };
        });
      }
    }

    // İlk Yükleme
    if (initialTab === 'pending') {
      renderPendingTab();
    } else {
      renderAllUsersTab();
    }

    fetchPendingUsers().then(list => {
      const b = overlay.querySelector('#adminPendingTabBadge');
      if (b) b.textContent = list.length;
    });
    fetchAllUsers().then(list => {
      const b = overlay.querySelector('#adminAllTabBadge');
      if (b) b.textContent = list.length;
    });
  }

  // ── 10. MODERN ÖZEL DİYALOGLAR (Şifre Sıfırlama & Onay) ───────
  function showPasswordResetDialog(userId, userName) {
    const existing = document.getElementById('modernPasswordResetDialog');
    if (existing) existing.remove();

    const words = ['Demir', 'Gunes', 'Yildiz', 'Kartal', 'Deniz', 'Bahar', 'Toprak', 'Cinar', 'Bulut', 'Zirve', 'Kaplan', 'Atlas'];
    const genComplex = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*+=-';
      let pass = '';
      for (let i = 0; i < 16; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
      return pass;
    };
    const genStandard = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
      let pass = '';
      for (let i = 0; i < 8; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
      return pass;
    };
    const genMemorable = () => {
      const w1 = words[Math.floor(Math.random() * words.length)];
      const w2 = words[Math.floor(Math.random() * words.length)];
      const num = Math.floor(100 + Math.random() * 900);
      return `${w1}-${w2}-${num}`;
    };
    const genPin = () => {
      return String(Math.floor(100000 + Math.random() * 900000));
    };

    const dialog = document.createElement('div');
    dialog.id = 'modernPasswordResetDialog';
    dialog.className = 'modern-sub-modal';

    dialog.innerHTML = `
      <div class="modern-sub-card" style="max-width:440px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
          <div style="font-weight:900;font-size:1.1rem;display:flex;align-items:center;gap:.4rem;">
            <span>🔑</span> <span>Şifre Sıfırlama</span>
          </div>
          <button type="button" id="btnClosePassModal" class="btn btn-sm btn-ghost" style="border-radius:50%;width:32px;height:32px;padding:0;">✕</button>
        </div>
        <p style="font-size:.84rem;color:#64748b;margin-bottom:1rem;line-height:1.45;">
          <strong>"${escHtml(userName)}"</strong> kullanıcısı için yeni şifre belirleyin veya hazır algoritmalardan birini seçin:
        </p>

        <div style="margin-bottom:.85rem;">
          <label style="display:block;font-size:.76rem;font-weight:700;margin-bottom:.35rem;color:#334155;">Yeni Şifre</label>
          <div style="display:flex;gap:.5rem;">
            <input type="text" id="modernNewPassInput" value="${genComplex()}" style="
              flex:1;padding:.65rem .85rem;border-radius:10px;border:1.5px solid #cbd5e1;
              font-family:monospace;font-weight:800;font-size:.95rem;outline:none;background:#f8fafc;color:#0f172a;
            " />
          </div>
        </div>

        <!-- Gelişmiş Şifre Algoritması Seçenekleri -->
        <div style="margin-bottom:1.1rem;">
          <div style="font-size:.74rem;font-weight:700;color:#64748b;margin-bottom:.35rem;">Şifre Üretme Seçenekleri:</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;">
            <button type="button" class="btn btn-sm btn-ghost btn-pass-algo" data-type="complex" style="font-size:.74rem;padding:.3rem .5rem;justify-content:flex-start;background:rgba(37,99,235,0.06);color:#2563eb;font-weight:700;">
              🔐 Güçlü (16 Karakter)
            </button>
            <button type="button" class="btn btn-sm btn-ghost btn-pass-algo" data-type="standard" style="font-size:.74rem;padding:.3rem .5rem;justify-content:flex-start;background:rgba(16,185,129,0.06);color:#059669;font-weight:700;">
              🔡 Standart (8 Karakter)
            </button>
            <button type="button" class="btn btn-sm btn-ghost btn-pass-algo" data-type="memorable" style="font-size:.74rem;padding:.3rem .5rem;justify-content:flex-start;background:rgba(245,158,11,0.06);color:#d97706;font-weight:700;">
              🧠 Akılda Kalıcı
            </button>
            <button type="button" class="btn btn-sm btn-ghost btn-pass-algo" data-type="pin" style="font-size:.74rem;padding:.3rem .5rem;justify-content:flex-start;background:rgba(147,51,234,0.06);color:#7e22ce;font-weight:700;">
              🔢 PIN (6 Hane)
            </button>
          </div>
        </div>

        <div style="display:flex;gap:.5rem;margin-top:1.25rem;">
          <button type="button" id="btnSaveAndCopyPass" class="btn btn-primary" style="flex:1;justify-content:center;padding:.75rem;font-weight:800;">
            💾 Şifreyi Kaydet ve Kopyala
          </button>
          <button type="button" id="btnCancelPassReset" class="btn btn-ghost" style="padding:.75rem .95rem;font-weight:700;">
            İptal
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const input = dialog.querySelector('#modernNewPassInput');
    dialog.querySelectorAll('.btn-pass-algo').forEach(b => {
      b.onclick = () => {
        const type = b.getAttribute('data-type');
        if (type === 'complex') input.value = genComplex();
        else if (type === 'standard') input.value = genStandard();
        else if (type === 'memorable') input.value = genMemorable();
        else if (type === 'pin') input.value = genPin();
      };
    });

    const close = () => dialog.remove();
    dialog.querySelector('#btnClosePassModal').onclick = close;
    dialog.querySelector('#btnCancelPassReset').onclick = close;

    dialog.querySelector('#btnSaveAndCopyPass').onclick = async () => {
      const pass = (input.value || '').trim();
      if (!pass || pass.length < 3) {
        alert('Şifre en az 3 karakter olmalıdır.');
        return;
      }

      try {
        const res = await fetch('/api/admin/reset-password', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId, newPassword: pass })
        });
        const data = await res.json();
        if (data.success) {
          navigator.clipboard.writeText(pass).catch(() => {});
          if (typeof window.toast === 'function') {
            window.toast(`✅ "${userName}" şifresi güncellendi ve panoya kopyalandı! (Yeni şifre: ${pass})`, 'success');
          }
          close();
        } else {
          alert(data.reason || 'Şifre güncellenemedi.');
        }
      } catch (err) {
        alert('Hata: ' + err.message);
      }
    };
  }

  function showCustomPromptModal({ title, message, confirmText = 'Tamam', isDanger = false, isAlertOnly = false, onConfirm }) {
    const existing = document.getElementById('customPromptModal');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'customPromptModal';
    dialog.className = 'modern-sub-modal';

    dialog.innerHTML = `
      <div class="modern-sub-card">
        <div style="font-weight:900;font-size:1.15rem;margin-bottom:.5rem;color:${isDanger ? '#ef4444' : '#0f172a'};">${title}</div>
        <div style="font-size:.85rem;color:#475569;margin-bottom:1.35rem;line-height:1.5;">${message}</div>
        <div style="display:flex;gap:.5rem;justify-content:flex-end;">
          ${!isAlertOnly ? `<button type="button" id="btnPromptCancel" class="btn btn-ghost" style="padding:.65rem 1rem;font-weight:700;">Vazgeç</button>` : ''}
          <button type="button" id="btnPromptConfirm" class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" style="padding:.65rem 1.25rem;font-weight:800;">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const close = () => dialog.remove();
    const btnCancel = dialog.querySelector('#btnPromptCancel');
    if (btnCancel) btnCancel.onclick = close;

    dialog.querySelector('#btnPromptConfirm').onclick = () => {
      close();
      if (typeof onConfirm === 'function') onConfirm();
    };
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

  // ── 11. Navbar Rozeti & Hızlı Çıkış Butonu ───────────────────
  function updateNavbarUserBadge() {
    updateAdminPanelVisibility();
    const user = getSession();
    const btnProfile = document.getElementById('btnUserProfile') || document.querySelector('[data-auth-badge]');
    let quickLogoutBtn = document.getElementById('btnQuickLogout');
    const topbarRight = document.querySelector('.topbar-right');

    if (user) {
      if (btnProfile) {
        btnProfile.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:.4rem;">
            <span style="font-size:1.05rem;">${user.avatar || (user.role === 'admin' ? '👑' : '👤')}</span>
            <span style="font-weight:700;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(user.full_name || user.username)}</span>
            <span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;"></span>
          </span>
        `;
        btnProfile.title = `${user.full_name} (${user.email || user.username}) - Profil & Ayarlar`;
      }

      // Hızlı Çıkış Butonunu Ekle
      if (topbarRight && !quickLogoutBtn) {
        quickLogoutBtn = document.createElement('button');
        quickLogoutBtn.id = 'btnQuickLogout';
        quickLogoutBtn.className = 'btn btn-sm btn-logout-compact';
        quickLogoutBtn.style.cssText = `
          font-weight: 800; font-size: .82rem; padding: .4rem .75rem; border-radius: 9px;
          background: rgba(239, 68, 68, 0.08); color: #ef4444; border: 1.5px solid rgba(239, 68, 68, 0.3);
          display: inline-flex; align-items: center; gap: .35rem; cursor: pointer; transition: all .2s;
          box-shadow: 0 2px 6px rgba(239,68,68,0.1); margin-left: .2rem;
        `;
        quickLogoutBtn.innerHTML = `<span>🚪</span> <span class="btn-text">Çıkış</span>`;
        quickLogoutBtn.title = 'Oturumu Kapat';
        quickLogoutBtn.onclick = confirmLogout;
        topbarRight.appendChild(quickLogoutBtn);
      }
    } else {
      if (btnProfile) {
        btnProfile.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:.35rem;">
            <span>🔑</span>
            <span style="font-weight:700;">Giriş Yap</span>
          </span>
        `;
        btnProfile.title = 'Hesabınıza Giriş Yapın veya Kayıt Olun';
      }
      if (quickLogoutBtn) quickLogoutBtn.remove();
    }
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── 12. Oturum Açılış Splash Screen ──────────────────────────
  function showLoginTransitionSplash(user, onComplete) {
    const splash = document.createElement('div');
    splash.id = 'loginTransitionSplash';
    splash.style.cssText = `
      position: fixed; inset: 0;
      background: radial-gradient(circle at 50% 40%, #1e293b, #090d16);
      z-index: 9999999; display: flex; align-items: center; justify-content: center;
      color: #fff; font-family: inherit; text-align: center; animation: fadeIn .25s ease-out;
    `;

    splash.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:1.2rem;max-width:380px;padding:2rem;">
        <div style="width:76px;height:76px;background:linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899);border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:2.4rem;box-shadow:0 0 45px rgba(59,130,246,.6);">
          ${user.avatar || (user.role === 'admin' ? '👑' : '⚡')}
        </div>
        <div>
          <div style="font-size:1.4rem;font-weight:900;margin-bottom:.3rem;color:#f8fafc;">Hoş Geldiniz, ${escHtml(user.full_name || user.username)}</div>
          <div style="font-size:.85rem;color:#94a3b8;">Kurumsal Rapor Havuzunuz Hazırlanıyor...</div>
        </div>
        <div style="width:240px;height:6px;background:rgba(255,255,255,0.1);border-radius:6px;overflow:hidden;position:relative;">
          <div style="position:absolute;top:0;left:0;bottom:0;width:60%;background:linear-gradient(90deg, #3b82f6, #8b5cf6);box-shadow:0 0 12px #3b82f6;border-radius:6px;animation:splashProgress 1.1s infinite ease-in-out;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(splash);

    setTimeout(() => {
      splash.style.transition = 'opacity .35s ease, visibility .35s ease';
      splash.style.opacity = '0';
      splash.style.visibility = 'hidden';
      setTimeout(() => {
        splash.remove();
        if (typeof onComplete === 'function') onComplete();
      }, 360);
    }, 850);
  }

  // ── 13. SADE & MODERN TAM EKRAN GİRİŞ / KAYIT PORTALI ──────
  function showAuthFullScreenPortal(initialTab = 'login') {
    const existing = document.getElementById('authFullScreenPortal');
    if (existing) existing.remove();

    const appWrap = document.querySelector('.app-wrap');
    if (appWrap) appWrap.style.display = 'none';

    const savedIdentifier = localStorage.getItem(SAVED_IDENTIFIER_KEY) || '';

    const portal = document.createElement('div');
    portal.id = 'authFullScreenPortal';
    portal.style.cssText = `
      position: fixed; inset: 0;
      background: radial-gradient(ellipse at 50% 30%, #1e293b 0%, #0f172a 75%, #020617 100%);
      z-index: 1000000;
      display: flex; align-items: center; justify-content: center;
      padding: 1.25rem; overflow-y: auto; font-family: inherit;
    `;

    portal.innerHTML = `
      <div class="auth-card" style="
        max-width: 440px; width: 100%;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 22px;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
        padding: 2rem 2rem 1.6rem;
        position: relative; overflow: hidden;
        color: #0f172a;
      ">
        <!-- Logo & Başlık -->
        <div style="text-align:center;margin-bottom:1.25rem;">
          <div style="width:50px;height:50px;margin:0 auto .6rem;background:linear-gradient(135deg, #3b82f6, #6366f1);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;box-shadow:0 6px 18px rgba(59,130,246,0.28);">📋</div>
          <h1 style="font-size:1.35rem;font-weight:800;letter-spacing:-.02em;margin:0 0 .2rem;color:#0f172a;">FrpOku</h1>
          <p id="authSubtitle" style="font-size:.82rem;color:#64748b;margin:0;">FastReport Rapor & Kod Portalı</p>
        </div>

        <!-- Canlı Hata / Uyarı Bildirim Kutusu -->
        <div id="authAlertBox" style="
          display: none; padding: .75rem .9rem; border-radius: 10px; margin-bottom: 1rem;
          font-size: .82rem; font-weight: 600; line-height: 1.45; animation: shake .3s ease-in-out;
        "></div>

        <!-- Sekmeler (Giriş / Kayıt) -->
        <div id="authTabSwitcher" style="
          display: flex; background: #f1f5f9;
          border-radius: 10px; padding: 3px; margin-bottom: 1.25rem;
        ">
          <button type="button" id="tabLoginBtn" style="
            flex: 1; padding: .55rem; border: none; border-radius: 8px;
            font-weight: 700; font-size: .86rem; cursor: pointer; transition: all .15s;
            background: ${initialTab === 'login' ? '#ffffff' : 'transparent'};
            color: ${initialTab === 'login' ? '#2563eb' : '#64748b'};
            box-shadow: ${initialTab === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'};
          ">Giriş Yap</button>
          <button type="button" id="tabRegisterBtn" style="
            flex: 1; padding: .55rem; border: none; border-radius: 8px;
            font-weight: 700; font-size: .86rem; cursor: pointer; transition: all .15s;
            background: ${initialTab === 'register' ? '#ffffff' : 'transparent'};
            color: ${initialTab === 'register' ? '#2563eb' : '#64748b'};
            box-shadow: ${initialTab === 'register' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'};
          ">Kayıt Ol</button>
        </div>

        <!-- ── 1. GİRİŞ FORMU ── -->
        <form id="authLoginForm" style="display: ${initialTab === 'login' ? 'block' : 'none'};">
          <div style="margin-bottom: .9rem;">
            <label style="display:block;font-size:.76rem;font-weight:700;color:#334155;margin-bottom:.3rem;">
              Kullanıcı Adı veya E-Posta
            </label>
            <input type="text" id="loginIdentifier" required value="${escHtml(savedIdentifier)}" placeholder="ör: admin veya ilker" style="
              width: 100%; padding: .65rem .85rem; border-radius: 10px;
              background: #f8fafc; border: 1.5px solid #cbd5e1;
              color: #0f172a; font-size: .88rem; outline: none; transition: all .15s; box-sizing: border-box;
            " />
          </div>

          <div style="margin-bottom: .9rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem;">
              <label style="font-size:.76rem;font-weight:700;color:#334155;">Şifre</label>
              <a href="#" id="linkForgotPassword" style="font-size:.74rem;color:#2563eb;text-decoration:none;font-weight:600;">Şifremi Unuttum?</a>
            </div>
            <div style="position:relative;">
              <input type="password" id="loginPassword" required placeholder="Şifrenizi girin" style="
                width: 100%; padding: .65rem 2.4rem .65rem .85rem; border-radius: 10px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size: .88rem; outline: none; transition: all .15s; box-sizing: border-box;
              " />
              <button type="button" id="toggleLoginPass" style="
                position:absolute;right:.65rem;top:50%;transform:translateY(-50%);
                background:none;border:none;color:#64748b;cursor:pointer;font-size:.95rem;
              ">👁️</button>
            </div>
          </div>

          <!-- Beni Hatırla -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.15rem;">
            <label style="display:flex;align-items:center;gap:.45rem;font-size:.8rem;color:#475569;cursor:pointer;font-weight:500;">
              <input type="checkbox" id="loginRememberMe" ${localStorage.getItem(REMEMBER_KEY) !== '0' ? 'checked' : ''} style="width:15px;height:15px;accent-color:#2563eb;cursor:pointer;" />
              Beni Hatırla
            </label>
          </div>

          <button type="submit" id="btnLoginSubmit" style="
            width: 100%; padding: .75rem; border: none; border-radius: 10px;
            background: #2563eb; color: #ffffff; font-weight: 700; font-size: .9rem; cursor: pointer;
            box-shadow: 0 4px 12px rgba(37,99,235,0.25); transition: background .15s;
          ">Giriş Yap</button>
        </form>

        <!-- ── 2. KAYIT FORMU ── -->
        <form id="authRegisterForm" style="display: ${initialTab === 'register' ? 'block' : 'none'};">
          <div id="regFormBody">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin-bottom:.65rem;">
              <div>
                <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Ad Soyad *</label>
                <input type="text" id="regFullName" required placeholder="Ad Soyad" style="
                  width: 100%; padding: .55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size: .84rem; outline: none; box-sizing: border-box;
                " />
              </div>
              <div>
                <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Kullanıcı Adı *</label>
                <input type="text" id="regUsername" required placeholder="kullanici_adi" style="
                  width: 100%; padding: .55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size: .84rem; outline: none; box-sizing: border-box;
                " />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin-bottom:.65rem;">
              <div>
                <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">E-Posta *</label>
                <input type="email" id="regEmail" required placeholder="ornek@kurum.com" style="
                  width: 100%; padding: .55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size: .84rem; outline: none; box-sizing: border-box;
                " />
              </div>
              <div>
                <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Telefon No</label>
                <input type="tel" id="regPhone" placeholder="05XX..." style="
                  width: 100%; padding: .55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size: .84rem; outline: none; box-sizing: border-box;
                " />
              </div>
            </div>

            <div style="margin-bottom:.65rem;">
              <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Kurum / Birim</label>
              <input type="text" id="regDepartment" placeholder="ör: Bilgi İşlem" style="
                width: 100%; padding: .55rem .75rem; border-radius: 8px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size: .84rem; outline: none; box-sizing: border-box;
              " />
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin-bottom:.85rem;">
              <div>
                <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Şifre *</label>
                <input type="password" id="regPassword" required placeholder="Şifreniz" style="
                  width: 100%; padding: .55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size: .84rem; outline: none; box-sizing: border-box;
                " />
              </div>
              <div>
                <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Şifre Tekrar *</label>
                <input type="password" id="regPasswordConfirm" required placeholder="Tekrar girin" style="
                  width: 100%; padding: .55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size: .84rem; outline: none; box-sizing: border-box;
                " />
              </div>
            </div>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:.55rem .75rem;margin-bottom:.85rem;font-size:.74rem;color:#1e40af;line-height:1.4;">
              ℹ️ Kayıt başvurusu yapıldıktan sonra sistem yöneticisi onayı ile hesabınız aktifleştirilecektir.
            </div>

            <button type="submit" id="btnRegisterSubmit" style="
              width: 100%; padding: .75rem; border: none; border-radius: 10px;
              background: #10b981; color: #ffffff; font-weight: 700; font-size: .9rem; cursor: pointer;
              box-shadow: 0 4px 12px rgba(16,185,129,0.25); transition: background .15s;
            ">Kayıt Başvurusunu Gönder</button>
          </div>

          <!-- Kayıt Başarılı & Onay Bekleme Bilgilendirme Ekranı -->
          <div id="regSuccessNotice" style="display:none;text-align:center;padding:1.2rem .5rem;">
            <div style="font-size:2.8rem;margin-bottom:.6rem;">🎉</div>
            <div style="font-size:1.15rem;font-weight:800;color:#0f172a;margin-bottom:.35rem;">Başvurunuz Alındı!</div>
            <p style="font-size:.82rem;color:#475569;line-height:1.5;margin-bottom:1.2rem;">
              Hesap başvurunuz yönetici onayına iletildi. Onaylandıktan sonra giriş yapabilirsiniz.
            </p>
            <button type="button" id="btnGoToLoginAfterReg" style="
              width:100%;padding:.7rem;border:none;border-radius:10px;
              background:#2563eb;color:#fff;font-weight:700;font-size:.88rem;cursor:pointer;
            ">Giriş Ekranına Dön</button>
          </div>
        </form>

        <!-- ── 3. ŞİFREMİ UNUTTUM REHBERİ ── -->
        <div id="authForgotPanel" style="display: none; text-align: left;">
          <div style="text-align:center;margin-bottom:1.2rem;">
            <div style="font-size:2.4rem;margin-bottom:.4rem;">🔑</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin-bottom: .3rem;">Şifre Sıfırlama</div>
            <p style="font-size: .8rem; color: #475569; line-height: 1.45; margin: 0 auto;">
              Şifre sıfırlama işlemleri güvenlik amacıyla <strong>Sistem Yöneticisi (Admin)</strong> tarafından yapılmaktadır.
            </p>
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:1rem;margin-bottom:1.2rem;">
            <div style="font-weight:700;font-size:.82rem;color:#0f172a;margin-bottom:.3rem;">📌 Nasıl Yapılır?</div>
            <ul style="margin:0;padding-left:1.1rem;font-size:.78rem;color:#64748b;line-height:1.5;">
              <li>Sistem Yöneticinizle iletişime geçiniz.</li>
              <li>Yönetici paneli üzerinden yeni geçici şifreniz tanımlanacaktır.</li>
              <li>Giriş yaptıktan sonra şifrenizi profilinizden güncelleyebilirsiniz.</li>
            </ul>
          </div>

          <button type="button" id="btnBackToLoginFromForgot" style="
            width: 100%; padding: .65rem; border: 1px solid #cbd5e1; border-radius: 10px;
            background: #f1f5f9; color: #475569; font-weight: 700; font-size: .82rem; cursor: pointer;
          ">← Giriş Ekranına Dön</button>
        </div>

        <!-- Alt Bilgi / Sekme Geçiş Linki -->
        <div id="authFooterNote" style="margin-top: 1.1rem; text-align: center; font-size: .8rem; color: #64748b;">
          ${initialTab === 'login' ? `Hesabınız yok mu? <a href="#" id="linkGoToRegister" style="color:#2563eb;font-weight:700;text-decoration:none;">Kayıt Olun</a>` : `Zaten hesabınız var mı? <a href="#" id="linkGoToLogin" style="color:#2563eb;font-weight:700;text-decoration:none;">Giriş Yapın</a>`}
        </div>
      </div>
    `;

    document.body.appendChild(portal);

    portal.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('focus', () => { inp.style.borderColor = '#2563eb'; inp.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.12)'; });
      inp.addEventListener('blur', () => { inp.style.borderColor = '#cbd5e1'; inp.style.boxShadow = 'none'; });
    });

    const alertBox = portal.querySelector('#authAlertBox');
    const showAlert = (msg, type = 'error') => {
      alertBox.style.display = 'block';
      if (type === 'error') {
        alertBox.style.background = '#fef2f2';
        alertBox.style.border = '1px solid #fecaca';
        alertBox.style.color = '#b91c1c';
      } else if (type === 'warning') {
        alertBox.style.background = '#fffbeb';
        alertBox.style.border = '1px solid #fde68a';
        alertBox.style.color = '#b45309';
      } else {
        alertBox.style.background = '#f0fdf4';
        alertBox.style.border = '1px solid #bbf7d0';
        alertBox.style.color = '#15803d';
      }
      alertBox.innerHTML = msg;
    };
    const hideAlert = () => { alertBox.style.display = 'none'; };

    // Sekme Değiştirme
    const switchTab = (tab) => {
      hideAlert();
      const loginForm = portal.querySelector('#authLoginForm');
      const regForm = portal.querySelector('#authRegisterForm');
      const forgotPanel = portal.querySelector('#authForgotPanel');
      const tabSwitcher = portal.querySelector('#authTabSwitcher');
      const tabLogin = portal.querySelector('#tabLoginBtn');
      const tabReg = portal.querySelector('#tabRegisterBtn');
      const footerNote = portal.querySelector('#authFooterNote');
      const regBody = portal.querySelector('#regFormBody');
      const regNotice = portal.querySelector('#regSuccessNotice');

      tabSwitcher.style.display = 'flex';
      forgotPanel.style.display = 'none';

      if (tab === 'login') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
        tabLogin.style.background = '#ffffff';
        tabLogin.style.color = '#2563eb';
        tabLogin.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
        tabReg.style.background = 'transparent';
        tabReg.style.color = '#64748b';
        tabReg.style.boxShadow = 'none';
        footerNote.innerHTML = `Hesabınız yok mu? <a href="#" id="linkGoToRegister" style="color:#2563eb;font-weight:700;text-decoration:none;">Kayıt Olun</a>`;
        bindFooterLinks();
      } else if (tab === 'register') {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
        if (regBody) regBody.style.display = 'block';
        if (regNotice) regNotice.style.display = 'none';
        tabReg.style.background = '#ffffff';
        tabReg.style.color = '#2563eb';
        tabReg.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
        tabLogin.style.background = 'transparent';
        tabLogin.style.color = '#64748b';
        tabLogin.style.boxShadow = 'none';
        footerNote.innerHTML = `Zaten hesabınız var mı? <a href="#" id="linkGoToLogin" style="color:#2563eb;font-weight:700;text-decoration:none;">Giriş Yapın</a>`;
        bindFooterLinks();
      } else if (tab === 'forgot') {
        loginForm.style.display = 'none';
        regForm.style.display = 'none';
        tabSwitcher.style.display = 'none';
        forgotPanel.style.display = 'block';
        footerNote.innerHTML = '';
      }
    };

    const bindFooterLinks = () => {
      const toReg = portal.querySelector('#linkGoToRegister');
      if (toReg) toReg.onclick = (e) => { e.preventDefault(); switchTab('register'); };
      const toLog = portal.querySelector('#linkGoToLogin');
      if (toLog) toLog.onclick = (e) => { e.preventDefault(); switchTab('login'); };
    };

    portal.querySelector('#tabLoginBtn').onclick = () => switchTab('login');
    portal.querySelector('#tabRegisterBtn').onclick = () => switchTab('register');
    portal.querySelector('#linkForgotPassword').onclick = (e) => { e.preventDefault(); switchTab('forgot'); };
    portal.querySelector('#btnBackToLoginFromForgot').onclick = () => switchTab('login');
    bindFooterLinks();

    // Şifre Göster / Gizle
    const togglePass = portal.querySelector('#toggleLoginPass');
    const passInput = portal.querySelector('#loginPassword');
    togglePass.onclick = () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        togglePass.textContent = '🙈';
      } else {
        passInput.type = 'password';
        togglePass.textContent = '👁️';
      }
    };

    // ── GİRİŞ SUBMIT ──
    const loginForm = portal.querySelector('#authLoginForm');
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      hideAlert();

      const ident = (portal.querySelector('#loginIdentifier').value || '').trim();
      const pass = portal.querySelector('#loginPassword').value;

      if (!ident) {
        showAlert('⚠️ Lütfen e-posta adresinizi veya kullanıcı adınızı giriniz.', 'warning');
        portal.querySelector('#loginIdentifier').focus();
        return;
      }

      if (!pass) {
        showAlert('⚠️ Lütfen şifrenizi giriniz.', 'warning');
        portal.querySelector('#loginPassword').focus();
        return;
      }

      const submitBtn = portal.querySelector('#btnLoginSubmit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Giriş Yapılıyor...';

      const remember = portal.querySelector('#loginRememberMe').checked;

      const res = await login({ identifier: ident, password: pass, rememberMe: remember });
      submitBtn.disabled = false;
      submitBtn.textContent = 'Giriş Yap';

      if (res.success) {
        portal.remove();
        showLoginTransitionSplash(res.user, () => {
          if (appWrap) appWrap.style.display = 'flex';
          updateNavbarUserBadge();
          setupAdminFeatures();
          if (window.FrpStore && typeof window.FrpStore.refreshFromCloud === 'function') {
            window.FrpStore.refreshFromCloud();
          }
          if (typeof window.toast === 'function') window.toast(`Hoş geldiniz, ${res.user.full_name || res.user.username}! 🌟`, 'success');
        });
      } else {
        if (res.pendingApproval) {
          showAlert(res.reason, 'warning');
        } else {
          showAlert(res.reason || 'Giriş başarısız oldu.', 'error');
        }
      }
    };

    // ── KAYIT SUBMIT (Admin Onaylı) ──
    const regForm = portal.querySelector('#authRegisterForm');
    regForm.onsubmit = async (e) => {
      e.preventDefault();
      hideAlert();

      const fullName = (portal.querySelector('#regFullName').value || '').trim();
      const username = (portal.querySelector('#regUsername').value || '').trim();
      const email = (portal.querySelector('#regEmail').value || '').trim().toLowerCase();
      const pass = portal.querySelector('#regPassword').value;
      const passConf = portal.querySelector('#regPasswordConfirm').value;

      if (!/^[a-zA-ZçğıöşüÇĞİÖŞÜ\s]{3,50}$/.test(fullName)) {
        showAlert('⚠️ Ad ve Soyad yalnızca harflerden oluşmalıdır (en az 3 harf).', 'warning');
        portal.querySelector('#regFullName').focus();
        return;
      }

      if (!/^[a-zA-Z0-9_]{3,25}$/.test(username)) {
        showAlert('⚠️ Kullanıcı adı 3-25 karakter arasında olmalı, boşluk içermemelidir.', 'warning');
        portal.querySelector('#regUsername').focus();
        return;
      }

      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/.test(email)) {
        showAlert('⚠️ Lütfen geçerli bir e-posta formatı giriniz (Örn: ad.soyad@kurum.com).', 'warning');
        portal.querySelector('#regEmail').focus();
        return;
      }

      if (pass.length < 3) {
        showAlert('⚠️ Şifreniz en az 3 karakter olmalıdır.', 'warning');
        portal.querySelector('#regPassword').focus();
        return;
      }

      if (pass !== passConf) {
        showAlert('🔒 Girdiğiniz şifreler birbiriyle eşleşmiyor.', 'warning');
        portal.querySelector('#regPasswordConfirm').focus();
        return;
      }

      const submitBtn = portal.querySelector('#btnRegisterSubmit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Gönderiliyor...';

      const payload = {
        fullName,
        username,
        email,
        phone: portal.querySelector('#regPhone').value,
        department: portal.querySelector('#regDepartment').value,
        password: pass
      };

      const res = await register(payload);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Kayıt Başvurusunu Gönder';

      if (res.success) {
        portal.querySelector('#regFormBody').style.display = 'none';
        portal.querySelector('#regSuccessNotice').style.display = 'block';
        hideAlert();

        const btnGoLog = portal.querySelector('#btnGoToLoginAfterReg');
        if (btnGoLog) {
          btnGoLog.onclick = () => {
            switchTab('login');
            portal.querySelector('#loginIdentifier').value = username;
          };
        }
      } else {
        showAlert(res.reason || 'Kayıt işlemi gerçekleştirilemedi.', 'error');
      }
    };
  }

  // ── Sayfa İlk Yüklendiğinde Oturum Kontrolü ───────────────────
  document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
      showAuthFullScreenPortal('login');
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
          showUserDropdown(btnProfile);
        } else {
          showAuthFullScreenPortal('login');
        }
      });
    }
  });

  // ── Kullanıcı Dropdown Menüsü ─────────────────────────────────
  function showUserDropdown(anchorEl) {
    const user = getUser();
    if (!user) { showAuthFullScreenPortal('login'); return; }

    const existing = document.getElementById('userMenuDropdown');
    if (existing) { existing.remove(); return; }

    const rect = anchorEl.getBoundingClientRect();
    const drop = document.createElement('div');
    drop.id = 'userMenuDropdown';

    const rightOffset = Math.max(16, window.innerWidth - rect.right);

    drop.style.cssText = `
      position: fixed; top: ${rect.bottom + 8}px; right: ${rightOffset}px;
      background: #ffffff; border: 1px solid #e2e8f0;
      border-radius: 18px; padding: 1.2rem; min-width: 270px; z-index: 100000;
      box-shadow: 0 20px 40px -10px rgba(0,0,0,0.25); animation: fadeIn .15s ease-out;
      color: #0f172a;
    `;

    const isUsrAdmin = isAdmin();

    drop.innerHTML = `
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;padding-bottom:.85rem;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:2rem;background:#eff6ff;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid #dbeafe;">
          ${user.avatar || (isUsrAdmin ? '👑' : '👤')}
        </div>
        <div style="min-width:0;flex:1;">
          <div style="font-weight:800;font-size:1rem;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(user.full_name || user.username)}</div>
          <div style="font-size:.78rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(user.email || user.username)}</div>
          <div style="margin-top:.3rem;">
            ${isUsrAdmin ? `<span class="badge badge-purple" style="font-size:.7rem;padding:.2rem .5rem;">👑 Admin</span>` : `<span class="badge badge-blue" style="font-size:.7rem;padding:.2rem .5rem;">🏢 ${user.department || 'Bilgi İşlem'}</span>`}
          </div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.4rem;">
        ${isUsrAdmin ? `
          <button type="button" id="btnMenuAdminUsers" class="btn btn-sm btn-ghost" style="width:100%;justify-content:flex-start;padding:.6rem .8rem;font-weight:800;color:#d97706;border-radius:8px;background:rgba(245,158,11,0.08);">
            👑 Kullanıcı & Kayıt Onay Paneli
          </button>
        ` : ''}
        <button type="button" id="btnMenuProfile" class="btn btn-sm btn-ghost" style="width:100%;justify-content:flex-start;padding:.6rem .8rem;font-weight:700;color:#334155;border-radius:8px;">
          ⚙️ Profil & Ayarlar
        </button>
        <button type="button" id="btnMenuChangePass" class="btn btn-sm btn-ghost" style="width:100%;justify-content:flex-start;padding:.6rem .8rem;font-weight:700;color:#2563eb;border-radius:8px;">
          🔒 Şifre Değiştir
        </button>
        <button type="button" id="btnMenuLogout" class="btn btn-sm btn-ghost" style="width:100%;justify-content:flex-start;padding:.6rem .8rem;font-weight:700;color:#ef4444;border-radius:8px;">
          🚪 Güvenli Çıkış Yap
        </button>
      </div>
    `;

    document.body.appendChild(drop);

    if (isUsrAdmin) {
      const adminBtn = drop.querySelector('#btnMenuAdminUsers');
      if (adminBtn) {
        adminBtn.onclick = () => {
          drop.remove();
          showAdminApprovalModal('pending');
        };
      }
    }

    drop.querySelector('#btnMenuProfile').onclick = () => {
      drop.remove();
      if (typeof window.openSettingsModal === 'function') {
        window.openSettingsModal('profile');
      }
    };

    drop.querySelector('#btnMenuChangePass').onclick = () => {
      drop.remove();
      if (typeof window.openSettingsModal === 'function') {
        window.openSettingsModal('profile');
      }
    };

    drop.querySelector('#btnMenuLogout').onclick = () => {
      drop.remove();
      confirmLogout();
    };

    const closeHandler = (e) => {
      if (!drop.contains(e.target) && e.target !== anchorEl) {
        drop.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  function updateSession(newUserData) {
    if (!newUserData) return;
    const current = getSession() || {};
    const merged = { ...current, ...newUserData };
    delete merged.password_hash;
    currentUser = merged;
    setSession(merged, localStorage.getItem(REMEMBER_KEY) === '1');
  }

  // ── 14. Çoklu Sekme (Multi-tab) Canlı Oturum Senkronizasyonu ──
  window.addEventListener('storage', (e) => {
    if (e.key === AUTH_STORAGE_KEY || e.key === REMEMBER_KEY) {
      currentUser = null;
      const user = getSession();
      const portal = document.getElementById('authFullScreenPortal');
      const appWrap = document.querySelector('.app-wrap');
      const drop = document.getElementById('userMenuDropdown');
      if (drop) drop.remove();

      if (user) {
        // Başka bir sekmede giriş yapıldı veya profil güncellendi
        if (portal) portal.remove();
        if (appWrap) appWrap.style.display = 'flex';
        updateNavbarUserBadge();
        setupAdminFeatures();
        if (window.FrpStore && typeof window.FrpStore.refreshFromCloud === 'function') {
          window.FrpStore.refreshFromCloud();
        }
      } else {
        // Başka bir sekmede oturum kapatıldı -> Bu sekmeyi de anında kilitle
        if (adminPollingInterval) {
          clearInterval(adminPollingInterval);
          adminPollingInterval = null;
        }
        updateNavbarUserBadge();
        const existingAdminModal = document.getElementById('adminApprovalModalOverlay');
        if (existingAdminModal) existingAdminModal.remove();
        showAuthFullScreenPortal('login');
      }
    }
  });

  // ── Global Denetim Günlüğü API (FrpAudit) ────────────────────
  window.FrpAudit = {
    async logAction({ action, target = '', details = '', extra = {} }) {
      const user = getUser();
      const logEntry = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        userId: user ? user.id : 'guest',
        username: user ? user.username : 'Misafir',
        fullName: user ? (user.full_name || user.fullName || user.username) : 'Misafir',
        role: user ? (user.role || 'user') : 'guest',
        action: action || 'GENERAL',
        target: target || '',
        details: details || '',
        timestamp: new Date().toISOString(),
        ...extra
      };

      // 1. Yerel Depolama
      try {
        let localLogs = [];
        const stored = localStorage.getItem('frp_audit_logs');
        if (stored) {
          try { localLogs = JSON.parse(stored) || []; } catch {}
        }
        localLogs.unshift(logEntry);
        if (localLogs.length > 500) localLogs = localLogs.slice(0, 500);
        localStorage.setItem('frp_audit_logs', JSON.stringify(localLogs));
      } catch (e) {}

      // 2. Sunucuya Gönder
      try {
        fetch('/api/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logEntry)
        }).catch(() => {});
      } catch (e) {}

      return logEntry;
    },

    async getLogs(filter = {}) {
      let serverLogs = [];
      try {
        const res = await fetch('/api/admin/audit-logs' + (filter.q ? `?q=${encodeURIComponent(filter.q)}` : ''), {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.logs)) serverLogs = data.logs;
        }
      } catch (e) {}

      let localLogs = [];
      try {
        const stored = localStorage.getItem('frp_audit_logs');
        if (stored) localLogs = JSON.parse(stored) || [];
      } catch (e) {}

      const all = [...serverLogs, ...localLogs];
      const seen = new Set();
      const unique = [];
      for (const l of all) {
        const key = l.id || `${l.timestamp}_${l.action}_${l.target}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(l);
        }
      }
      unique.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return unique;
    }
  };

  // ── Public Auth API ──────────────────────────────────────────
  window.FrpAuth = {
    register,
    login,
    logout,
    confirmLogout,
    getSession,
    getUser,
    isAdmin,
    isLoggedIn,
    updateSession,
    showAuthModal: showAuthFullScreenPortal,
    showAuthFullScreenPortal,
    updateNavbarUserBadge,
    showAdminApprovalModal,
    refreshAdminPendingBadge
  };
})();
