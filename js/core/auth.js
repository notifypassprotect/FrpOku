/**
 * FrpOku - Güvenli Kullanıcı Oturum & Kimlik Doğrulama Katmanı (Auth Module v4)
 * - Beni Hatırla & Giriş Bilgileri Kalıcılığı
 * - 6 Haneli OTP Kodlu Şifremi Unuttum Akışı (Gmail SMTP)
 * - Otomatik Hoş Geldiniz & Güvenlik Bildirim E-postaları
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
  let currentCaptchaText = '';
  let activeResetEmail = '';

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

  // ── 2. Akıllı Görsel CAPTCHA Motoru (Aydınlık & Kontrastlı) ─────
  function generateCaptcha(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return '';

    const ctx = canvas.getContext('2d');
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    currentCaptchaText = code;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Açık Gradyan Arka Plan
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Parazit Çizgileri
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `rgba(37, 99, 235, ${0.25 + Math.random() * 0.35})`;
      ctx.lineWidth = 1.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
      ctx.stroke();
    }

    // Parazit Noktaları
    for (let i = 0; i < 35; i++) {
      ctx.fillStyle = `rgba(15, 23, 42, ${0.15 + Math.random() * 0.25})`;
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Karakterleri Açılı ve Renkli Çiz
    ctx.font = 'bold 22px "Consolas", "Courier New", monospace';
    ctx.textBaseline = 'middle';

    const colors = ['#1e40af', '#4338ca', '#047857', '#b91c1c', '#7c2d12'];
    for (let i = 0; i < code.length; i++) {
      ctx.save();
      const x = 14 + i * 22;
      const y = canvas.height / 2 + (Math.random() * 4 - 2);
      const angle = (Math.random() * 24 - 12) * Math.PI / 180;
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillText(code[i], 0, 0);
      ctx.restore();
    }

    return code;
  }

  // ── 3. REST API İstek Motoru ──────────────────────────────────
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

  async function insertUserToRest(userRecord) {
    const res = await fetch(`${SUPABASE_REST_URL}/rest/v1/app_users`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(userRecord)
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || ('HTTP ' + res.status));
    }
    return await res.json();
  }

  // ── 4. Kayıt Ol (Register) ────────────────────────────────────
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
      const isRepeatingBogus = /^5(\d)\1{8}$/.test(tenDigits) || tenDigits === '5345241111' || tenDigits === '5000000000';

      if (!isTurkishMobile || isRepeatingBogus) {
        return { success: false, reason: '⚠️ Lütfen geçerli bir Türkiye cep telefonu numarası giriniz (Örnek: 05XX XXX XX XX).' };
      }
      formattedPhone = tenDigits;
    }

    // 5. Şifre Uzunluğu
    if (!password || password.length < 3) {
      return { success: false, reason: '⚠️ Şifre en az 3 karakter olmalıdır.' };
    }

    try {
      // 6. Mükerrer Kontrolü
      let existingUsers = [];
      try {
        existingUsers = await fetchUsersFromRest(`?or=(username.eq.${cleanUser},email.eq.${cleanEmail})&limit=1`);
      } catch (e) {}

      if (existingUsers && existingUsers.length > 0) {
        if (existingUsers[0].username === cleanUser) {
          return { success: false, reason: `⚠️ '${cleanUser}' kullanıcı adı zaten kullanımda. Lütfen başka bir kullanıcı adı seçin.` };
        }
        if (existingUsers[0].email === cleanEmail) {
          return { success: false, reason: `⚠️ '${cleanEmail}' e-posta adresi zaten kayıtlı. Giriş yapmayı deneyin.` };
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
        is_active: true,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString()
      };

      await insertUserToRest(newRecord);
      setSession(newRecord, true);

      // Kayıt Sonrası Hoş Geldiniz E-Postası Gönder (Arka Planda)
      fetch('/api/auth/send-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          fullName: cleanName,
          username: cleanUser
        })
      }).catch(err => console.warn('Welcome email error:', err));

      return { success: true, user: newRecord };
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

      if (user.is_active === false) {
        return { success: false, reason: '🚫 Hesabınız pasif duruma getirilmiştir. Yöneticinizle iletişime geçin.' };
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
      }).catch(() => {});

      // Giriş bilgisini hatırla (Identifier)
      if (rememberMe) {
        localStorage.setItem(SAVED_IDENTIFIER_KEY, ident);
      } else {
        localStorage.removeItem(SAVED_IDENTIFIER_KEY);
      }

      setSession(user, rememberMe);
      return { success: true, user };
    } catch (err) {
      return { success: false, reason: 'Bulut bağlantı hatası: ' + (err.message || err) };
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
    updateNavbarUserBadge();

    // Raporları temizle ve tam ekran portalı aç
    if (window.FrpStore && typeof window.FrpStore.refreshFromCloud === 'function') {
      window.FrpStore.refreshFromCloud();
    }

    showAuthFullScreenPortal('login');
  }

  function isLoggedIn() { return !!getSession(); }
  function getUser() { return getSession(); }

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

  // ── 8. Navbar Rozeti & Hızlı Çıkış Butonu ────────────────────
  function updateNavbarUserBadge() {
    const user = getSession();
    const btnProfile = document.getElementById('btnUserProfile') || document.querySelector('[data-auth-badge]');
    let quickLogoutBtn = document.getElementById('btnQuickLogout');
    const topbarRight = document.querySelector('.topbar-right');

    if (user) {
      if (btnProfile) {
        btnProfile.innerHTML = `
          <span style="display:inline-flex;align-items:center;gap:.4rem;">
            <span style="font-size:1.05rem;">${user.avatar || '👤'}</span>
            <span style="font-weight:700;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(user.full_name || user.username)}</span>
            <span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;"></span>
          </span>
        `;
        btnProfile.title = `${user.full_name} (${user.email || user.username}) - Profil & Ayarlar`;
      }

      // Hızlı Çıkış Butonunu EN SAĞA Ekle
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

  // ── 9. Oturum Açılış Splash Screen ───────────────────────────
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
          ${user.avatar || '⚡'}
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

  // ── 10. BAĞIMSIZ TAM EKRAN AUTH PORTAL (Aydınlık & Responsive) ─
  function showAuthFullScreenPortal(initialTab = 'login') {
    const existing = document.getElementById('authFullScreenPortal');
    if (existing) existing.remove();

    // Ana uygulama kapsayıcısını gizle
    const appWrap = document.querySelector('.app-wrap');
    if (appWrap) appWrap.style.display = 'none';

    const savedIdentifier = localStorage.getItem(SAVED_IDENTIFIER_KEY) || '';

    const portal = document.createElement('div');
    portal.id = 'authFullScreenPortal';
    portal.style.cssText = `
      position: fixed; inset: 0;
      background: radial-gradient(circle at 50% 30%, #1e293b 0%, #0f172a 60%, #020617 100%);
      z-index: 1000000;
      display: flex; align-items: center; justify-content: center;
      padding: 1.25rem; overflow-y: auto; font-family: inherit;
    `;

    portal.innerHTML = `
      <div class="auth-card" style="
        max-width: 480px; width: 100%;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 26px;
        box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);
        padding: 2.2rem 2.2rem 1.8rem;
        position: relative; overflow: hidden;
        color: #0f172a;
      ">
        <!-- Dekoratif Üst Çizgi -->
        <div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);"></div>

        <!-- Logo & Başlık -->
        <div style="text-align:center;margin-bottom:1.35rem;">
          <div style="width:62px;height:62px;margin:0 auto .75rem;background:linear-gradient(135deg, #3b82f6, #8b5cf6);border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:2.2rem;box-shadow:0 8px 24px rgba(59,130,246,0.35);">⚡</div>
          <h1 style="font-size:1.45rem;font-weight:900;letter-spacing:-.02em;margin:0 0 .25rem;color:#0f172a;">FrpOku Cloud Portal</h1>
          <p id="authSubtitle" style="font-size:.82rem;color:#64748b;margin:0;">Kurumsal FastReport Rapor & Kod Havuzu</p>
        </div>

        <!-- Canlı Hata / Uyarı Bildirim Kutusu -->
        <div id="authAlertBox" style="
          display: none; padding: .8rem 1rem; border-radius: 12px; margin-bottom: 1.2rem;
          font-size: .83rem; font-weight: 600; line-height: 1.4; animation: shake .3s ease-in-out;
        "></div>

        <!-- Sekmeler (Tab Switcher) -->
        <div id="authTabSwitcher" style="
          display: flex; background: #f1f5f9;
          border-radius: 12px; padding: 4px; margin-bottom: 1.35rem;
          border: 1px solid #e2e8f0;
        ">
          <button type="button" id="tabLoginBtn" style="
            flex: 1; padding: .6rem; border: none; border-radius: 9px;
            font-weight: 800; font-size: .88rem; cursor: pointer; transition: all .2s;
            background: ${initialTab === 'login' ? '#ffffff' : 'transparent'};
            color: ${initialTab === 'login' ? '#2563eb' : '#64748b'};
            box-shadow: ${initialTab === 'login' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'};
          ">🔑 Giriş Yap</button>
          <button type="button" id="tabRegisterBtn" style="
            flex: 1; padding: .6rem; border: none; border-radius: 9px;
            font-weight: 800; font-size: .88rem; cursor: pointer; transition: all .2s;
            background: ${initialTab === 'register' ? '#ffffff' : 'transparent'};
            color: ${initialTab === 'register' ? '#2563eb' : '#64748b'};
            box-shadow: ${initialTab === 'register' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none'};
          ">✨ Kayıt Ol</button>
        </div>

        <!-- ── 1. GİRİŞ FORMU ── -->
        <form id="authLoginForm" style="display: ${initialTab === 'login' ? 'block' : 'none'};">
          <div style="margin-bottom: .95rem;">
            <label style="display:block;font-size:.78rem;font-weight:700;color:#334155;margin-bottom:.35rem;">
              👤 E-Posta / Kullanıcı Adı / Telefon No
            </label>
            <input type="text" id="loginIdentifier" required value="${escHtml(savedIdentifier)}" placeholder="ör: deneme, ilker veya 0534..." style="
              width: 100%; padding: .72rem 1rem; border-radius: 12px;
              background: #f8fafc; border: 1.5px solid #cbd5e1;
              color: #0f172a; font-size: .9rem; outline: none; transition: all .2s; box-sizing: border-box;
            " />
          </div>

          <div style="margin-bottom: .95rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem;">
              <label style="font-size:.78rem;font-weight:700;color:#334155;">🔒 Şifre</label>
              <a href="#" id="linkForgotPassword" style="font-size:.75rem;color:#2563eb;text-decoration:none;font-weight:700;">Şifremi Unuttum?</a>
            </div>
            <div style="position:relative;">
              <input type="password" id="loginPassword" required placeholder="Şifrenizi girin" style="
                width: 100%; padding: .72rem 2.5rem .72rem 1rem; border-radius: 12px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size: .9rem; outline: none; transition: all .2s; box-sizing: border-box;
              " />
              <button type="button" id="toggleLoginPass" style="
                position:absolute;right:.75rem;top:50%;transform:translateY(-50%);
                background:none;border:none;color:#64748b;cursor:pointer;font-size:1rem;
              ">👁️</button>
            </div>
          </div>

          <!-- CAPTCHA -->
          <div style="margin-bottom: 1rem; background: #f8fafc; padding:.7rem; border-radius: 12px; border: 1.5px solid #e2e8f0;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem;">
              <span style="font-size:.75rem;font-weight:700;color:#334155;">🛡️ Güvenlik Doğrulaması</span>
              <button type="button" id="btnRefreshCaptchaLogin" style="background:none;border:none;color:#2563eb;font-size:.75rem;font-weight:700;cursor:pointer;">🔄 Yeni Kod</button>
            </div>
            <div style="display:flex;gap:.75rem;align-items:center;">
              <canvas id="captchaCanvasLogin" width="130" height="38" style="border-radius:8px;border:1px solid #cbd5e1;cursor:pointer;background:#fff;" title="Yenilemek için tıklayın"></canvas>
              <input type="text" id="loginCaptchaInput" maxlength="5" required placeholder="Kodu yazın" style="
                flex:1; padding:.55rem .75rem; border-radius:8px; text-transform:uppercase; font-family:monospace; font-weight:800;
                background:#ffffff; border:1.5px solid #cbd5e1; color:#0f172a; font-size:.95rem; outline:none; text-align:center;
              " />
            </div>
          </div>

          <!-- Beni Hatırla -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.2rem;">
            <label style="display:flex;align-items:center;gap:.5rem;font-size:.82rem;color:#475569;cursor:pointer;font-weight:600;">
              <input type="checkbox" id="loginRememberMe" ${localStorage.getItem(REMEMBER_KEY) !== '0' ? 'checked' : ''} style="width:16px;height:16px;accent-color:#2563eb;cursor:pointer;" />
              Beni Hatırla (Oturumu Açık Tut)
            </label>
          </div>

          <button type="submit" id="btnLoginSubmit" style="
            width: 100%; padding: .85rem; border: none; border-radius: 12px;
            background: linear-gradient(135deg, #2563eb, #1d4ed8);
            color: #ffffff; font-weight: 800; font-size: .95rem; cursor: pointer;
            box-shadow: 0 4px 14px rgba(37,99,235,0.3); transition: all .2s;
          ">🚀 Giriş Yap</button>
        </form>

        <!-- ── 2. KAYIT FORMU ── -->
        <form id="authRegisterForm" style="display: ${initialTab === 'register' ? 'block' : 'none'};">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.75rem;">
            <div>
              <label style="display:block;font-size:.75rem;font-weight:700;color:#334155;margin-bottom:.25rem;">👤 Ad Soyad *</label>
              <input type="text" id="regFullName" required placeholder="İlker Diner" style="
                width: 100%; padding: .65rem .85rem; border-radius: 10px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size: .85rem; outline: none; box-sizing: border-box;
              " />
            </div>
            <div>
              <label style="display:block;font-size:.75rem;font-weight:700;color:#334155;margin-bottom:.25rem;">🏷️ Kullanıcı Adı *</label>
              <input type="text" id="regUsername" required placeholder="ilker" style="
                width: 100%; padding: .65rem .85rem; border-radius: 10px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size: .85rem; outline: none; box-sizing: border-box;
              " />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.75rem;">
            <div>
              <label style="display:block;font-size:.75rem;font-weight:700;color:#334155;margin-bottom:.25rem;">📧 E-Posta *</label>
              <input type="email" id="regEmail" required placeholder="ornek@kurum.com" style="
                width: 100%; padding: .65rem .85rem; border-radius: 10px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size: .85rem; outline: none; box-sizing: border-box;
              " />
            </div>
            <div>
              <label style="display:block;font-size:.75rem;font-weight:700;color:#334155;margin-bottom:.25rem;">📱 Telefon No</label>
              <input type="tel" id="regPhone" placeholder="0534..." style="
                width: 100%; padding: .65rem .85rem; border-radius: 10px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size: .85rem; outline: none; box-sizing: border-box;
              " />
            </div>
          </div>

          <div style="margin-bottom:.75rem;">
            <label style="display:block;font-size:.75rem;font-weight:700;color:#334155;margin-bottom:.25rem;">🏢 Kurum / Birim</label>
            <input type="text" id="regDepartment" placeholder="ör: Şehir Hastanesi Bilgi İşlem" style="
              width: 100%; padding: .65rem .85rem; border-radius: 10px;
              background: #f8fafc; border: 1.5px solid #cbd5e1;
              color: #0f172a; font-size: .85rem; outline: none; box-sizing: border-box;
            " />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:.75rem;">
            <div>
              <label style="display:block;font-size:.75rem;font-weight:700;color:#334155;margin-bottom:.25rem;">🔒 Şifre *</label>
              <input type="password" id="regPassword" required placeholder="Şifreniz" style="
                width: 100%; padding: .65rem .85rem; border-radius: 10px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size: .85rem; outline: none; box-sizing: border-box;
              " />
            </div>
            <div>
              <label style="display:block;font-size:.75rem;font-weight:700;color:#334155;margin-bottom:.25rem;">🔒 Şifre Tekrar *</label>
              <input type="password" id="regPasswordConfirm" required placeholder="Tekrar girin" style="
                width: 100%; padding: .65rem .85rem; border-radius: 10px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size: .85rem; outline: none; box-sizing: border-box;
              " />
            </div>
          </div>

          <!-- CAPTCHA (Kayıt) -->
          <div style="margin-bottom: 1rem; background: #f8fafc; padding:.65rem; border-radius: 10px; border: 1.5px solid #e2e8f0;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem;">
              <span style="font-size:.72rem;font-weight:700;color:#334155;">🛡️ Güvenlik Doğrulaması</span>
              <button type="button" id="btnRefreshCaptchaReg" style="background:none;border:none;color:#2563eb;font-size:.72rem;font-weight:700;cursor:pointer;">🔄 Yeni Kod</button>
            </div>
            <div style="display:flex;gap:.65rem;align-items:center;">
              <canvas id="captchaCanvasReg" width="120" height="34" style="border-radius:6px;border:1px solid #cbd5e1;cursor:pointer;background:#fff;"></canvas>
              <input type="text" id="regCaptchaInput" maxlength="5" required placeholder="Kodu girin" style="
                flex:1; padding:.5rem .7rem; border-radius:6px; text-transform:uppercase; font-family:monospace; font-weight:800;
                background:#ffffff; border:1.5px solid #cbd5e1; color:#0f172a; font-size:.9rem; outline:none; text-align:center;
              " />
            </div>
          </div>

          <button type="submit" id="btnRegisterSubmit" style="
            width: 100%; padding: .85rem; border: none; border-radius: 12px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: #ffffff; font-weight: 800; font-size: .95rem; cursor: pointer;
            box-shadow: 0 4px 14px rgba(16,185,129,0.3); transition: all .2s;
          ">✨ Hesabımı Oluştur</button>
        </form>

        <!-- ── 3. ŞİFREMİ UNUTTUM FORMU (6 HANELİ OTP AKIŞI) ── -->
        <div id="authForgotPanel" style="display: none; text-align: left;">
          <!-- Adım 1: E-Posta / Kullanıcı Adı Girme -->
          <div id="forgotStep1">
            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin-bottom: .3rem;">🔑 Şifre Sıfırlama</div>
            <p style="font-size: .82rem; color: #64748b; margin-bottom: 1.2rem; line-height: 1.4;">
              Kayıtlı e-posta adresinizi veya kullanıcı adınızı girin. 6 haneli doğrulama kodu gönderilecektir.
            </p>
            <div style="margin-bottom: 1.2rem;">
              <label style="display:block;font-size:.78rem;font-weight:700;color:#334155;margin-bottom:.35rem;">👤 E-Posta veya Kullanıcı Adı</label>
              <input type="text" id="forgotIdentInput" placeholder="ornek@kurum.com veya kullanıcı adı" style="
                width: 100%; padding: .75rem 1rem; border-radius: 12px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size: .9rem; outline: none; box-sizing: border-box;
              " />
            </div>
            <button type="button" id="btnSendForgotOtp" style="
              width: 100%; padding: .85rem; border: none; border-radius: 12px;
              background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff; font-weight: 800; font-size: .92rem; cursor: pointer; margin-bottom: .8rem;
              box-shadow: 0 4px 14px rgba(37,99,235,0.3);
            ">📨 6 Haneli Doğrulama Kodu Gönder</button>
          </div>

          <!-- Adım 2: OTP ve Yeni Şifre Belirleme -->
          <div id="forgotStep2" style="display: none;">
            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin-bottom: .3rem;">🛡️ Kodu Girin & Şifrenizi Yenileyin</div>
            <p id="forgotOtpNotice" style="font-size: .82rem; color: #64748b; margin-bottom: 1.2rem; line-height: 1.4;">
              E-posta adresinize 6 haneli bir güvenlik kodu gönderildi.
            </p>

            <div style="margin-bottom: 1rem;">
              <label style="display:block;font-size:.78rem;font-weight:700;color:#334155;margin-bottom:.35rem;">🔢 6 Haneli Güvenlik Kodu</label>
              <input type="text" id="forgotOtpCodeInput" maxlength="6" placeholder="______" style="
                width: 100%; padding: .75rem 1rem; border-radius: 12px; letter-spacing: 8px; font-weight: 900; font-family: monospace;
                background: #eff6ff; border: 2px dashed #3b82f6; text-align: center;
                color: #1e40af; font-size: 1.4rem; outline: none; box-sizing: border-box;
              " />
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1.1rem;">
              <div>
                <label style="display:block;font-size:.75rem;font-weight:700;color:#334155;margin-bottom:.25rem;">🔒 Yeni Şifre</label>
                <input type="password" id="forgotNewPass" placeholder="Yeni şifreniz" style="
                  width: 100%; padding: .65rem .85rem; border-radius: 10px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size: .85rem; outline: none; box-sizing: border-box;
                " />
              </div>
              <div>
                <label style="display:block;font-size:.75rem;font-weight:700;color:#334155;margin-bottom:.25rem;">🔒 Yeni Şifre Tekrar</label>
                <input type="password" id="forgotNewPassConfirm" placeholder="Tekrar girin" style="
                  width: 100%; padding: .65rem .85rem; border-radius: 10px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size: .85rem; outline: none; box-sizing: border-box;
                " />
              </div>
            </div>

            <button type="button" id="btnVerifyOtpAndReset" style="
              width: 100%; padding: .85rem; border: none; border-radius: 12px;
              background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 800; font-size: .92rem; cursor: pointer; margin-bottom: .8rem;
              box-shadow: 0 4px 14px rgba(16,185,129,0.3);
            ">✅ Şifremi Güncelle ve Giriş Yap</button>
          </div>

          <button type="button" id="btnBackToLoginFromForgot" style="
            width: 100%; padding: .65rem; border: 1px solid #cbd5e1; border-radius: 12px;
            background: #f1f5f9; color: #475569; font-weight: 700; font-size: .82rem; cursor: pointer;
          ">← Giriş Ekranına Geri Dön</button>
        </div>

        <!-- Alt Bilgi / Geri Dönüş Linkleri -->
        <div id="authFooterNote" style="margin-top: 1.25rem; text-align: center; font-size: .82rem; color: #64748b;">
          ${initialTab === 'login' ? `Hesabınız yok mu? <a href="#" id="linkGoToRegister" style="color:#2563eb;font-weight:800;text-decoration:none;">Hemen Kayıt Olun</a>` : `Zaten hesabınız var mı? <a href="#" id="linkGoToLogin" style="color:#2563eb;font-weight:800;text-decoration:none;">Giriş Yapın</a>`}
        </div>
      </div>
    `;

    document.body.appendChild(portal);

    // Odaklanma Efekti
    portal.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('focus', () => { inp.style.borderColor = '#2563eb'; inp.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.15)'; });
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
      const forgotStep1 = portal.querySelector('#forgotStep1');
      const forgotStep2 = portal.querySelector('#forgotStep2');

      tabSwitcher.style.display = 'flex';
      forgotPanel.style.display = 'none';

      if (tab === 'login') {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
        tabLogin.style.background = '#ffffff';
        tabLogin.style.color = '#2563eb';
        tabLogin.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        tabReg.style.background = 'transparent';
        tabReg.style.color = '#64748b';
        tabReg.style.boxShadow = 'none';
        footerNote.innerHTML = `Hesabınız yok mu? <a href="#" id="linkGoToRegister" style="color:#2563eb;font-weight:800;text-decoration:none;">Hemen Kayıt Olun</a>`;
        bindFooterLinks();
        generateCaptcha('captchaCanvasLogin');
      } else if (tab === 'register') {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
        tabReg.style.background = '#ffffff';
        tabReg.style.color = '#2563eb';
        tabReg.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        tabLogin.style.background = 'transparent';
        tabLogin.style.color = '#64748b';
        tabLogin.style.boxShadow = 'none';
        footerNote.innerHTML = `Zaten hesabınız var mı? <a href="#" id="linkGoToLogin" style="color:#2563eb;font-weight:800;text-decoration:none;">Giriş Yapın</a>`;
        bindFooterLinks();
        generateCaptcha('captchaCanvasReg');
      } else if (tab === 'forgot') {
        loginForm.style.display = 'none';
        regForm.style.display = 'none';
        tabSwitcher.style.display = 'none';
        forgotPanel.style.display = 'block';
        forgotStep1.style.display = 'block';
        forgotStep2.style.display = 'none';
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

    // CAPTCHA Başlat
    if (initialTab === 'login') generateCaptcha('captchaCanvasLogin');
    else generateCaptcha('captchaCanvasReg');

    const cCanvasLogin = portal.querySelector('#captchaCanvasLogin');
    if (cCanvasLogin) cCanvasLogin.onclick = () => generateCaptcha('captchaCanvasLogin');
    const btnRefLogin = portal.querySelector('#btnRefreshCaptchaLogin');
    if (btnRefLogin) btnRefLogin.onclick = () => generateCaptcha('captchaCanvasLogin');

    const cCanvasReg = portal.querySelector('#captchaCanvasReg');
    if (cCanvasReg) cCanvasReg.onclick = () => generateCaptcha('captchaCanvasReg');
    const btnRefReg = portal.querySelector('#btnRefreshCaptchaReg');
    if (btnRefReg) btnRefReg.onclick = () => generateCaptcha('captchaCanvasReg');

    // ── GİRİŞ SUBMIT ──
    const loginForm = portal.querySelector('#authLoginForm');
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      hideAlert();

      const captchaInput = portal.querySelector('#loginCaptchaInput').value.trim().toUpperCase();
      if (captchaInput !== currentCaptchaText.toUpperCase()) {
        showAlert('🛡️ Güvenlik kodu (CAPTCHA) hatalı! Lütfen görseldeki kodu tekrar girin.', 'warning');
        generateCaptcha('captchaCanvasLogin');
        portal.querySelector('#loginCaptchaInput').value = '';
        portal.querySelector('#loginCaptchaInput').focus();
        return;
      }

      const submitBtn = portal.querySelector('#btnLoginSubmit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Giriş Yapılıyor... ⏳';

      const ident = portal.querySelector('#loginIdentifier').value;
      const pass = portal.querySelector('#loginPassword').value;
      const remember = portal.querySelector('#loginRememberMe').checked;

      const res = await login({ identifier: ident, password: pass, rememberMe: remember });
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Giriş Yap';

      if (res.success) {
        portal.remove();
        showLoginTransitionSplash(res.user, () => {
          if (appWrap) appWrap.style.display = 'flex';
          updateNavbarUserBadge();
          if (window.FrpStore && typeof window.FrpStore.refreshFromCloud === 'function') {
            window.FrpStore.refreshFromCloud();
          }
          if (typeof window.toast === 'function') window.toast(`Hoş geldiniz, ${res.user.full_name || res.user.username}! 🌟`, 'success');
        });
      } else {
        showAlert(res.reason || 'Giriş başarısız oldu.', 'error');
        generateCaptcha('captchaCanvasLogin');
      }
    };

    // ── KAYIT SUBMIT ──
    const regForm = portal.querySelector('#authRegisterForm');
    regForm.onsubmit = async (e) => {
      e.preventDefault();
      hideAlert();

      const pass = portal.querySelector('#regPassword').value;
      const passConf = portal.querySelector('#regPasswordConfirm').value;

      if (pass !== passConf) {
        showAlert('🔒 Girdiğiniz şifreler birbiriyle eşleşmiyor. İki kutuya da aynı şifreyi yazın.', 'warning');
        return;
      }

      const captchaInput = portal.querySelector('#regCaptchaInput').value.trim().toUpperCase();
      if (captchaInput !== currentCaptchaText.toUpperCase()) {
        showAlert('🛡️ Güvenlik kodu (CAPTCHA) hatalı! Görseldeki kodu doğru girin.', 'warning');
        generateCaptcha('captchaCanvasReg');
        portal.querySelector('#regCaptchaInput').value = '';
        return;
      }

      const submitBtn = portal.querySelector('#btnRegisterSubmit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Hesap Oluşturuluyor... ⏳';

      const res = await register({
        fullName: portal.querySelector('#regFullName').value,
        username: portal.querySelector('#regUsername').value,
        email: portal.querySelector('#regEmail').value,
        phone: portal.querySelector('#regPhone').value,
        department: portal.querySelector('#regDepartment').value,
        password: pass
      });

      submitBtn.disabled = false;
      submitBtn.textContent = '✨ Hesabımı Oluştur';

      if (res.success) {
        portal.remove();
        showLoginTransitionSplash(res.user, () => {
          if (appWrap) appWrap.style.display = 'flex';
          updateNavbarUserBadge();
          if (window.FrpStore && typeof window.FrpStore.refreshFromCloud === 'function') {
            window.FrpStore.refreshFromCloud();
          }
          if (typeof window.toast === 'function') window.toast(`Hesabınız oluşturuldu! Hoş geldiniz, ${res.user.full_name}! 🎉 (Bilgilendirme e-postanız gönderildi)`, 'success');
        });
      } else {
        showAlert(res.reason || 'Kayıt işlemi başarısız oldu.', 'error');
        generateCaptcha('captchaCanvasReg');
      }
    };

    // ── ŞİFREMİ UNUTTUM 1. ADIM: KOD GÖNDER ──
    const btnSendOtp = portal.querySelector('#btnSendForgotOtp');
    btnSendOtp.onclick = async () => {
      hideAlert();
      const ident = portal.querySelector('#forgotIdentInput').value.trim();
      if (!ident) {
        showAlert('Lütfen e-posta adresinizi veya kullanıcı adınızı girin.', 'warning');
        return;
      }

      btnSendOtp.disabled = true;
      btnSendOtp.textContent = 'Kod Gönderiliyor... ⏳';

      try {
        const res = await fetch('/api/auth/send-reset-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: ident })
        });

        const data = await res.json();
        btnSendOtp.disabled = false;
        btnSendOtp.textContent = '📨 6 Haneli Doğrulama Kodu Gönder';

        if (data.success) {
          activeResetEmail = data.email;
          portal.querySelector('#forgotStep1').style.display = 'none';
          portal.querySelector('#forgotStep2').style.display = 'block';
          portal.querySelector('#forgotOtpNotice').innerHTML = `
            <strong>${data.maskedEmail}</strong> adresine 6 haneli güvenlik kodu gönderildi. Kodunuzu aşağıya giriniz:
          `;
          showAlert('✅ Doğrulama kodu e-posta adresinize gönderildi!', 'success');
          portal.querySelector('#forgotOtpCodeInput').focus();
        } else {
          showAlert(data.reason || 'Kod gönderilemedi.', 'error');
        }
      } catch (err) {
        btnSendOtp.disabled = false;
        btnSendOtp.textContent = '📨 6 Haneli Doğrulama Kodu Gönder';
        showAlert('Sunucu bağlantı hatası: ' + err.message, 'error');
      }
    };

    // ── ŞİFREMİ UNUTTUM 2. ADIM: OTP DOĞRULA VE ŞİFRE GÜNCELLE ──
    const btnVerifyOtp = portal.querySelector('#btnVerifyOtpAndReset');
    btnVerifyOtp.onclick = async () => {
      hideAlert();
      const code = portal.querySelector('#forgotOtpCodeInput').value.trim();
      const newPass = portal.querySelector('#forgotNewPass').value;
      const newPassConf = portal.querySelector('#forgotNewPassConfirm').value;

      if (!code || code.length !== 6) {
        showAlert('Lütfen 6 haneli güvenlik kodunu eksiksiz girin.', 'warning');
        return;
      }

      if (!newPass || newPass.length < 3) {
        showAlert('Yeni şifreniz en az 3 karakter olmalıdır.', 'warning');
        return;
      }

      if (newPass !== newPassConf) {
        showAlert('Yeni şifreler eşleşmiyor! İki kutuya da aynı şifreyi yazın.', 'warning');
        return;
      }

      btnVerifyOtp.disabled = true;
      btnVerifyOtp.textContent = 'Şifre Güncelleniyor... ⏳';

      try {
        const res = await fetch('/api/auth/verify-reset-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: activeResetEmail,
            code,
            newPassword: newPass
          })
        });

        const data = await res.json();
        btnVerifyOtp.disabled = false;
        btnVerifyOtp.textContent = '✅ Şifremi Güncelle ve Giriş Yap';

        if (data.success) {
          showAlert('🎉 Şifreniz başarıyla güncellendi! Giriş ekranına yönlendiriliyorsunuz...', 'success');
          setTimeout(() => {
            switchTab('login');
            portal.querySelector('#loginIdentifier').value = activeResetEmail;
            portal.querySelector('#loginPassword').value = '';
            portal.querySelector('#loginPassword').focus();
          }, 1800);
        } else {
          showAlert(data.reason || 'Doğrulama başarısız oldu.', 'error');
        }
      } catch (err) {
        btnVerifyOtp.disabled = false;
        btnVerifyOtp.textContent = '✅ Şifremi Güncelle ve Giriş Yap';
        showAlert('Sunucu hatası: ' + err.message, 'error');
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

  // ── Kullanıcı Dropdown Menüsü (Akıllı Konumlandırma) ─────────
  function showUserDropdown(anchorEl) {
    const user = getUser();
    if (!user) { showAuthFullScreenPortal('login'); return; }

    const existing = document.getElementById('userMenuDropdown');
    if (existing) { existing.remove(); return; }

    const rect = anchorEl.getBoundingClientRect();
    const drop = document.createElement('div');
    drop.id = 'userMenuDropdown';
    
    // Sağdan taşmayı önleme
    const rightOffset = Math.max(16, window.innerWidth - rect.right);

    drop.style.cssText = `
      position: fixed; top: ${rect.bottom + 8}px; right: ${rightOffset}px;
      background: #ffffff; border: 1px solid #e2e8f0;
      border-radius: 18px; padding: 1.2rem; min-width: 270px; z-index: 100000;
      box-shadow: 0 20px 40px -10px rgba(0,0,0,0.25); animation: fadeIn .15s ease-out;
      color: #0f172a;
    `;

    drop.innerHTML = `
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;padding-bottom:.85rem;border-bottom:1px solid #f1f5f9;">
        <div style="font-size:2rem;background:#eff6ff;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid #dbeafe;">${user.avatar || '👤'}</div>
        <div style="min-width:0;flex:1;">
          <div style="font-weight:800;font-size:1rem;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(user.full_name || user.username)}</div>
          <div style="font-size:.78rem;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(user.email || user.username)}</div>
          <div style="margin-top:.3rem;"><span class="badge badge-blue" style="font-size:.7rem;padding:.2rem .5rem;">🏢 ${user.department || 'Bilgi İşlem'}</span></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.4rem;">
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

  // ── Public Auth API ──────────────────────────────────────────
  window.FrpAuth = {
    register,
    login,
    logout,
    confirmLogout,
    getSession,
    getUser,
    isLoggedIn,
    showAuthModal: showAuthFullScreenPortal,
    showAuthFullScreenPortal,
    updateNavbarUserBadge
  };
})();
