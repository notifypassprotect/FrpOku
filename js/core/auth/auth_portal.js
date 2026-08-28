// ============================================================
//  auth_portal.js — Modern Tam Ekran Giriş, Kayıt ve Profil Portalı
// ============================================================

(function () {
  'use strict';

  const REMEMBER_KEY = 'frpoku_remember_flag';
  const SAVED_IDENTIFIER_KEY = 'frpoku_saved_identifier';

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

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
        <div style="text-align:center;margin-bottom:1.25rem;">
          <div style="width:50px;height:50px;margin:0 auto .6rem;background:linear-gradient(135deg, #3b82f6, #6366f1);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.8rem;box-shadow:0 6px 18px rgba(59,130,246,0.28);">📋</div>
          <h1 style="font-size:1.35rem;font-weight:800;letter-spacing:-.02em;margin:0 0 .2rem;color:#0f172a;">FrpOku</h1>
          <p id="authSubtitle" style="font-size:.82rem;color:#64748b;margin:0;">FastReport Rapor & Kod Portalı</p>
        </div>

        <div id="authAlertBox" style="
          display: none; padding: .75rem .9rem; border-radius: 10px; margin-bottom: 1rem;
          font-size: .82rem; font-weight: 600; line-height: 1.45; animation: shake .3s ease-in-out;
        "></div>

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

        <!-- 1. GİRİŞ FORMU -->
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

        <!-- 2. KAYIT FORMU -->
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

        <!-- 3. ŞİFREMİ UNUTTUM -->
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

        <div id="authFooterNote" style="margin-top: 1.1rem; text-align: center; font-size: .8rem; color: #64748b;">
          ${initialTab === 'login' ? `Hesabınız yok mu? <a href="#" id="linkGoToRegister" style="color:#2563eb;font-weight:700;text-decoration:none;">Kayıt Olun</a>` : `Zaten hesabınız var mı? <a href="#" id="linkGoToLogin" style="color:#2563eb;font-weight:700;text-decoration:none;">Giriş Yapın</a>`}
        </div>
      </div>
    `;

    document.body.appendChild(portal);

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

    // Giriş submit
    portal.querySelector('#authLoginForm').onsubmit = async (e) => {
      e.preventDefault();
      hideAlert();

      const ident = (portal.querySelector('#loginIdentifier').value || '').trim();
      const pass = portal.querySelector('#loginPassword').value;

      if (!ident || !pass) {
        showAlert('⚠️ Lütfen tüm alanları doldurunuz.', 'warning');
        return;
      }

      const submitBtn = portal.querySelector('#btnLoginSubmit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Giriş Yapılıyor...';

      const remember = portal.querySelector('#loginRememberMe').checked;
      const res = await window.FrpAuth.login({ identifier: ident, password: pass, rememberMe: remember });
      submitBtn.disabled = false;
      submitBtn.textContent = 'Giriş Yap';

      if (res.success) {
        portal.remove();
        showLoginTransitionSplash(res.user, () => {
          if (appWrap) appWrap.style.display = 'flex';
          if (typeof window.FrpAuth?.updateNavbarUserBadge === 'function') window.FrpAuth.updateNavbarUserBadge();
          if (typeof window.FrpAuth?.setupAdminFeatures === 'function') window.FrpAuth.setupAdminFeatures();
          if (window.FrpStore && typeof window.FrpStore.refreshFromCloud === 'function') window.FrpStore.refreshFromCloud();
          if (typeof window.toast === 'function') window.toast(`Hoş geldiniz, ${res.user.full_name || res.user.username}! 🌟`, 'success');
        });
      } else {
        showAlert(res.reason || 'Giriş başarısız oldu.', res.pendingApproval ? 'warning' : 'error');
      }
    };

    // Kayıt submit
    portal.querySelector('#authRegisterForm').onsubmit = async (e) => {
      e.preventDefault();
      hideAlert();

      const fullName = (portal.querySelector('#regFullName').value || '').trim();
      const username = (portal.querySelector('#regUsername').value || '').trim();
      const email = (portal.querySelector('#regEmail').value || '').trim().toLowerCase();
      const pass = portal.querySelector('#regPassword').value;
      const passConf = portal.querySelector('#regPasswordConfirm').value;

      if (pass !== passConf) {
        showAlert('🔒 Girdiğiniz şifreler birbiriyle eşleşmiyor.', 'warning');
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

      const res = await window.FrpAuth.register(payload);
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

  function showUserDropdown(anchorEl) {
    const existing = document.getElementById('userDropdownMenu');
    if (existing) { existing.remove(); return; }

    const user = window.FrpAuth.getUser();
    if (!user) return;

    const dropdown = document.createElement('div');
    dropdown.id = 'userDropdownMenu';
    dropdown.style.cssText = `
      position: fixed; z-index: 999999;
      background: var(--bg-surface, #ffffff); border: 1.5px solid var(--border, #e2e8f0);
      border-radius: 14px; box-shadow: 0 16px 36px rgba(0,0,0,.22);
      width: 260px; padding: .65rem; animation: fadeIn .12s ease-out;
    `;

    const rect = anchorEl.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 8) + 'px';
    dropdown.style.right = (window.innerWidth - rect.right) + 'px';

    dropdown.innerHTML = `
      <div style="padding:.6rem .75rem;border-bottom:1px solid var(--border-light,#f1f5f9);margin-bottom:.4rem;">
        <div style="font-weight:800;font-size:.9rem;color:var(--text-primary);">${escHtml(user.full_name || user.username)}</div>
        <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px;">@${escHtml(user.username)} · ${user.role === 'admin' ? '👑 Admin' : '👤 Kullanıcı'}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:.25rem;">
        ${user.role === 'admin' ? `
          <button type="button" class="btn btn-sm btn-ghost" id="ddBtnAdminApproval" style="text-align:left;justify-content:flex-start;padding:.5rem .75rem;font-weight:700;">
            👑 Kayıt Onay & Yönetim
          </button>
        ` : ''}
        <button type="button" class="btn btn-sm btn-ghost" id="ddBtnSettings" style="text-align:left;justify-content:flex-start;padding:.5rem .75rem;font-weight:700;">
          ⚙️ Profil & Ayarlar
        </button>
        <button type="button" class="btn btn-sm btn-ghost" id="ddBtnAuditLogs" style="text-align:left;justify-content:flex-start;padding:.5rem .75rem;font-weight:700;">
          📋 Denetim Günlüğü (Audit)
        </button>
        <div style="border-top:1px solid var(--border-light,#f1f5f9);margin:.3rem 0;"></div>
        <button type="button" class="btn btn-sm btn-ghost" id="ddBtnLogout" style="text-align:left;justify-content:flex-start;padding:.5rem .75rem;font-weight:800;color:#ef4444;">
          🚪 Oturumu Kapat
        </button>
      </div>
    `;

    document.body.appendChild(dropdown);

    const closeDropdown = (e) => {
      if (!dropdown.contains(e.target) && e.target !== anchorEl && !anchorEl.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    };
    setTimeout(() => document.addEventListener('click', closeDropdown), 10);

    dropdown.querySelector('#ddBtnAdminApproval')?.addEventListener('click', () => {
      dropdown.remove();
      if (typeof window.showAdminApprovalModal === 'function') window.showAdminApprovalModal('pending');
    });

    dropdown.querySelector('#ddBtnSettings')?.addEventListener('click', () => {
      dropdown.remove();
      if (typeof window.openSettingsModal === 'function') window.openSettingsModal('profile');
    });

    dropdown.querySelector('#ddBtnAuditLogs')?.addEventListener('click', () => {
      dropdown.remove();
      if (typeof window.openSettingsModal === 'function') window.openSettingsModal('audit');
    });

    dropdown.querySelector('#ddBtnLogout')?.addEventListener('click', () => {
      dropdown.remove();
      if (typeof window.FrpAuth?.confirmLogout === 'function') window.FrpAuth.confirmLogout();
    });
  }

  window.showAuthFullScreenPortal = showAuthFullScreenPortal;
  window.showUserDropdown = showUserDropdown;
})();
