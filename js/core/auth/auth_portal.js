// ============================================================
// auth_portal.js — Modern Tam Ekran Giriş, Kayıt ve Profil Portalı
// ============================================================

(function () {
 'use strict';

 const REMEMBER_KEY = 'frpoku_remember_flag';
 const SAVED_IDENTIFIER_KEY = 'frpoku_saved_identifier';

 function escHtml(str) {
 return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
 }

  function getFrpLogoSvg(size = 48) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${size}" height="${size}" style="flex-shrink:0;vertical-align:middle;filter:drop-shadow(0 6px 16px rgba(37,99,235,0.35));">
      <defs>
        <linearGradient id="frpPrism_${size}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="40%" stop-color="#2563eb" />
          <stop offset="85%" stop-color="#4f46e5" />
          <stop offset="100%" stop-color="#7c3aed" />
        </linearGradient>
        <linearGradient id="frpFold_${size}" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="50%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#e0f2fe" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="120" height="120" rx="28" fill="#0b1120" stroke="rgba(56,189,248,0.3)" stroke-width="2.5" />
      <circle cx="64" cy="40" r="44" fill="#38bdf8" opacity="0.16" />
      <g>
        <path d="M 34 26 L 76 26 L 94 44 L 94 98 A 6 6 0 0 1 88 104 L 40 104 A 6 6 0 0 1 34 98 Z" fill="url(#frpPrism_${size})" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" />
        <path d="M 76 26 L 76 40 A 4 4 0 0 0 80 44 L 94 44 Z" fill="url(#frpFold_${size})" />
        <rect x="44" y="40" width="24" height="4.5" rx="2.25" fill="#ffffff" opacity="0.95" />
        <rect x="44" y="52" width="40" height="3.5" rx="1.75" fill="#06b6d4" />
        <rect x="44" y="61" width="34" height="3.5" rx="1.75" fill="#cbd5e1" opacity="0.8" />
        <rect x="44" y="70" width="26" height="3.5" rx="1.75" fill="#94a3b8" opacity="0.7" />
        <g transform="translate(44, 80)">
          <rect x="0" y="8" width="6" height="10" rx="2" fill="#10b981" />
          <rect x="9" y="3" width="6" height="15" rx="2" fill="#06b6d4" />
          <rect x="18" y="0" width="6" height="18" rx="2" fill="#8b5cf6" />
          <rect x="27" y="5" width="6" height="13" rx="2" fill="#38bdf8" />
          <rect x="36" y="9" width="6" height="9" rx="2" fill="#a855f7" />
        </g>
        <circle cx="89" cy="40" r="2.5" fill="#ffffff" />
      </g>
    </svg>`;
  }
  window.getFrpLogoSvg = getFrpLogoSvg;

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
 <div style="animation:pulse 2s infinite ease-in-out;">
 ${getFrpLogoSvg(72)}
 </div>
 <div>
 <div style="font-size:1.4rem;font-weight:900;margin-bottom:.3rem;color:#f8fafc;">Hoş Geldiniz, ${escHtml(user.full_name || user.username)}</div>
 <div style="font-size:.85rem;color:#94a3b8;">Kurumsal Rapor Çalışma Alanınız Hazırlanıyor...</div>
 </div>
 <div style="width:240px;height:6px;background:rgba(255,255,255,0.1);border-radius:6px;overflow:hidden;position:relative;">
 <div style="position:absolute;top:0;left:0;bottom:0;width:60%;background:linear-gradient(90deg, #38bdf8, #8b5cf6);box-shadow:0 0 12px #38bdf8;border-radius:6px;animation:splashProgress 1.1s infinite ease-in-out;"></div>
 </div>
 </div>
 `;

 document.body.appendChild(splash);

 setTimeout(() => {
 splash.style.transition = 'opacity.35s ease, visibility.35s ease';
 splash.style.opacity = '0';
 splash.style.visibility = 'hidden';
 setTimeout(() => {
 splash.remove();
 if (typeof onComplete === 'function') onComplete();
 }, 360);
 }, 850);
 }

 function showAuthFullScreenPortal(initialTab = 'login') {
 const splash = document.getElementById('splashScreen');
 if (splash) {
 splash.style.display = 'none';
 splash.remove();
 }
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
    <style>
      @media (max-width: 860px) {
        .auth-brand-pane { display: none !important; }
        .auth-split-wrapper { max-width: 440px !important; }
      }
      .auth-recovery-key-pill {
        background: #f1f5f9;
        border: 1.5px solid #cbd5e1;
        border-radius: 8px;
        padding: 0.55rem 0.75rem;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.8rem;
        font-weight: 700;
        color: #1e293b;
        letter-spacing: 0.8px;
        user-select: all;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
    </style>

    <div class="auth-split-wrapper" style="
      display: flex; width: 100%; max-width: 960px; min-height: 570px;
      background: #ffffff; border-radius: 24px; box-shadow: 0 25px 70px rgba(0, 0, 0, 0.45);
      overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.15);
    ">
      <!-- SOL MARKA & GÜVENLİK PANELİ -->
      <div class="auth-brand-pane" style="
        flex: 1.15; background: linear-gradient(145deg, #090d16 0%, #172554 50%, #0f172a 100%);
        color: #ffffff; padding: 2.5rem 2.2rem; display: flex; flex-direction: column; justify-content: space-between;
        position: relative; overflow: hidden;
      ">
        <div style="position:absolute;top:-60px;left:-60px;width:220px;height:220px;background:rgba(37,99,235,0.25);border-radius:50%;filter:blur(60px);pointer-events:none;"></div>
        <div style="position:absolute;bottom:-80px;right:-60px;width:260px;height:260px;background:rgba(99,102,241,0.22);border-radius:50%;filter:blur(70px);pointer-events:none;"></div>

        <div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;text-align:center;justify-content:center;flex:1;padding:2rem 1rem;">
          <div style="margin-bottom:1.5rem;filter:drop-shadow(0 16px 36px rgba(37,99,235,0.5));">
            ${getFrpLogoSvg(88)}
          </div>
          <h1 style="font-size:1.75rem;font-weight:900;letter-spacing:-.03em;margin:0 0 .5rem;color:#ffffff;text-shadow:0 2px 14px rgba(0,0,0,0.4);">FrpOku Enterprise</h1>
          <div style="display:inline-flex;align-items:center;gap:.4rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);padding:.35rem .85rem;border-radius:20px;font-size:.76rem;color:#93c5fd;font-weight:600;letter-spacing:0.3px;">
            Kurumsal Rapor Yönetimi
          </div>
        </div>

        <div style="position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:.55rem;padding-top:1.2rem;border-top:1px solid rgba(255,255,255,0.08);">
          <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span>
          <span style="font-size:.74rem;color:#94a3b8;font-weight:600;">Güvenli Kurumsal Oturum</span>
        </div>
      </div>

      <!-- SAĞ FORM BÖLÜMÜ -->
      <div class="auth-card-side" style="
        flex: 1; padding: 2.2rem 2.2rem 1.8rem; display: flex; flex-direction: column; justify-content: center;
        background: #ffffff; color: #0f172a; overflow-y: auto; max-height: 90vh;
      ">
        <div style="text-align:center;margin-bottom:1.15rem;">
          <h2 style="font-size:1.35rem;font-weight:900;letter-spacing:-.02em;margin:0 0 .25rem;color:#0f172a;">Hoş Geldiniz</h2>
          <p id="authSubtitle" style="font-size:.82rem;color:#64748b;margin:0;">Lütfen kurumsal hesabınıza giriş yapın</p>
        </div>

        <div id="authAlertBox" style="
          display: none; padding:.75rem .9rem; border-radius: 10px; margin-bottom: 1rem;
          font-size:.82rem; font-weight: 600; line-height: 1.45; animation: shake .3s ease-in-out;
        "></div>

        <div id="authTabSwitcher" style="
          display: flex; background: #f1f5f9;
          border-radius: 10px; padding: 3px; margin-bottom: 1.15rem;
        ">
          <button type="button" id="tabLoginBtn" style="
            flex: 1; padding:.55rem; border: none; border-radius: 8px;
            font-weight: 700; font-size:.86rem; cursor: pointer; transition: all .15s;
            background: ${initialTab === 'login' ? '#ffffff' : 'transparent'};
            color: ${initialTab === 'login' ? '#2563eb' : '#64748b'};
            box-shadow: ${initialTab === 'login' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'};
          ">Giriş Yap</button>
          <button type="button" id="tabRegisterBtn" style="
            flex: 1; padding:.55rem; border: none; border-radius: 8px;
            font-weight: 700; font-size:.86rem; cursor: pointer; transition: all .15s;
            background: ${initialTab === 'register' ? '#ffffff' : 'transparent'};
            color: ${initialTab === 'register' ? '#2563eb' : '#64748b'};
            box-shadow: ${initialTab === 'register' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none'};
          ">Kayıt Ol</button>
        </div>

        <!-- 1. GİRİŞ FORMU -->
        <form id="authLoginForm" style="display: ${initialTab === 'login' ? 'block' : 'none'};">
          <div style="margin-bottom:.85rem;">
            <label style="display:block;font-size:.76rem;font-weight:700;color:#334155;margin-bottom:.3rem;">
              Kullanıcı Adı veya E-Posta
            </label>
            <input type="text" id="loginIdentifier" required value="${escHtml(savedIdentifier)}" placeholder="ör: admin veya ilker" style="
              width: 100%; padding:.65rem .85rem; border-radius: 10px;
              background: #f8fafc; border: 1.5px solid #cbd5e1;
              color: #0f172a; font-size:.88rem; outline: none; transition: all .15s; box-sizing: border-box;
            " />
          </div>

          <div style="margin-bottom:.85rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem;">
              <label style="font-size:.76rem;font-weight:700;color:#334155;">Şifre</label>
              <a href="#" id="linkForgotPassword" style="font-size:.74rem;color:#2563eb;text-decoration:none;font-weight:600;">Şifremi Unuttum?</a>
            </div>
            <div style="position:relative;">
              <input type="password" id="loginPassword" required placeholder="Şifrenizi girin" style="
                width: 100%; padding:.65rem 2.4rem .65rem .85rem; border-radius: 10px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size:.88rem; outline: none; transition: all .15s; box-sizing: border-box;
              " />
              <button type="button" id="toggleLoginPass" style="
                position:absolute;right:.65rem;top:50%;transform:translateY(-50%);
                background:none;border:none;color:#64748b;cursor:pointer;font-size:.74rem;font-weight:700;
              ">Göster</button>
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.9rem;">
            <label style="display:flex;align-items:center;gap:.45rem;font-size:.8rem;color:#475569;cursor:pointer;font-weight:500;">
              <input type="checkbox" id="loginRememberMe" ${localStorage.getItem(REMEMBER_KEY) !== '0' ? 'checked' : ''} style="width:15px;height:15px;accent-color:#2563eb;cursor:pointer;" />
              Beni Hatırla
            </label>
            <a href="#" id="linkEmergencyRecover" style="font-size:.75rem;color:#4f46e5;font-weight:700;text-decoration:none;display:none;">
              🔐 Acil Kurtarma Anahtarı ile Sıfırla
            </a>
          </div>

          <div id="loginCaptchaContainer" style="display:none;margin-bottom:.85rem;background:#fffbeb;border:1.5px solid #f59e0b;border-radius:10px;padding:.75rem .9rem;box-shadow:0 2px 8px rgba(245,158,11,0.12);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem;">
              <label style="font-size:.76rem;font-weight:800;color:#92400e;display:flex;align-items:center;gap:.35rem;">
                <span>🛡️ Güvenlik Doğrulaması (Captcha)</span>
              </label>
              <button type="button" id="btnRefreshCaptcha" title="Soruyu Yenile" style="background:none;border:none;cursor:pointer;font-size:.74rem;font-weight:700;color:#2563eb;">🔄 Yenile</button>
            </div>
            <div style="display:flex;align-items:center;gap:.65rem;margin-bottom:.35rem;">
              <span id="loginCaptchaQuestion" style="font-size:.95rem;font-weight:800;color:#1e293b;background:#f1f5f9;border:1px solid #cbd5e1;padding:.4rem .85rem;border-radius:8px;letter-spacing:1px;font-family:monospace;">?</span>
              <input type="text" id="loginCaptchaAnswer" placeholder="Sonucu yazın" style="
                flex: 1; padding:.55rem .75rem; border-radius: 8px;
                background: #ffffff; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size:.86rem; outline: none; box-sizing: border-box; font-weight:700;
              " />
              <input type="hidden" id="loginCaptchaToken" value="" />
            </div>
            <div style="font-size:.68rem;color:#b45309;font-weight:600;">Kaba kuvvet koruması: Devam etmek için matematik işlemini yanıtlayınız.</div>
          </div>

          <button type="submit" id="btnLoginSubmit" style="
            width: 100%; padding:.75rem; border: none; border-radius: 10px;
            background: #2563eb; color: #ffffff; font-weight: 700; font-size:.9rem; cursor: pointer;
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
                  width: 100%; padding:.55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size:.84rem; outline: none; box-sizing: border-box;
                " />
              </div>
              <div>
                <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Kullanıcı Adı *</label>
                <input type="text" id="regUsername" required placeholder="kullanici_adi" style="
                  width: 100%; padding:.55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size:.84rem; outline: none; box-sizing: border-box;
                " />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin-bottom:.65rem;">
              <div>
                <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">E-Posta *</label>
                <input type="email" id="regEmail" required placeholder="ornek@kurum.com" style="
                  width: 100%; padding:.55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size:.84rem; outline: none; box-sizing: border-box;
                " />
              </div>
              <div>
                <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Telefon No</label>
                <input type="tel" id="regPhone" placeholder="05XX..." style="
                  width: 100%; padding:.55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size:.84rem; outline: none; box-sizing: border-box;
                " />
              </div>
            </div>

            <div style="margin-bottom:.65rem;">
              <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Kurum / Departman</label>
              <input type="text" id="regDepartment" placeholder="ör: Bilgi İşlem" style="
                width: 100%; padding:.55rem .75rem; border-radius: 8px;
                background: #f8fafc; border: 1.5px solid #cbd5e1;
                color: #0f172a; font-size:.84rem; outline: none; box-sizing: border-box;
              " />
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin-bottom:.85rem;">
              <div>
                <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Şifre (Min 6 Karakter) *</label>
                <input type="password" id="regPassword" required placeholder="En az 6 karakter" style="
                  width: 100%; padding:.55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size:.84rem; outline: none; box-sizing: border-box;
                " />
              </div>
              <div>
                <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Şifre Tekrar *</label>
                <input type="password" id="regPasswordConfirm" required placeholder="Tekrar girin" style="
                  width: 100%; padding:.55rem .75rem; border-radius: 8px;
                  background: #f8fafc; border: 1.5px solid #cbd5e1;
                  color: #0f172a; font-size:.84rem; outline: none; box-sizing: border-box;
                " />
              </div>
            </div>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:.55rem .75rem;margin-bottom:.85rem;font-size:.74rem;color:#1e40af;line-height:1.4;">
              ℹ️ Kaydınız onaylandıktan sonra 4 adet Acil Kurtarma Anahtarı üretilerek e-postanıza iletilecektir.
            </div>

            <button type="submit" id="btnRegisterSubmit" style="
              width: 100%; padding:.75rem; border: none; border-radius: 10px;
              background: #10b981; color: #ffffff; font-weight: 700; font-size:.9rem; cursor: pointer;
              box-shadow: 0 4px 12px rgba(16,185,129,0.25); transition: background .15s;
            ">Kayıt Başvurusunu Gönder</button>
          </div>

          <div id="regSuccessNotice" style="display:none;text-align:center;padding:1.2rem .5rem;">
            <div style="font-size:2.6rem;margin-bottom:.5rem;">✅</div>
            <div style="font-size:1.15rem;font-weight:800;color:#0f172a;margin-bottom:.35rem;">Başvurunuz Alındı!</div>
            <p style="font-size:.82rem;color:#475569;line-height:1.5;margin-bottom:1.2rem;">
              Hesap başvurunuz yönetici onayına iletildi. Onaylandıktan sonra giriş yapabilirsiniz.
            </p>
            <button type="button" id="btnGoToLoginAfterReg" style="
              width:100%;padding:.7rem;border:none;border-radius:10px;
              background:#2563eb;color:#fff;font-weight:700;font-size:.88rem;cursor:pointer;
            ">Giriş Ekranına Dön</button>
          </div>

          <!-- 4 ADET ACİL ERİŞİM ANAHTARI KARTI -->
          <div id="regKeysNotice" style="display:none;text-align:center;padding:0.5rem 0;">
            <div style="width:48px;height:48px;margin:0 auto .6rem;background:linear-gradient(135deg, #10b981, #059669);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;color:#fff;box-shadow:0 6px 20px rgba(16,185,129,0.3);">🔐</div>
            <div style="font-size:1.1rem;font-weight:800;color:#0f172a;margin-bottom:.25rem;">Kayıt Başarılı!</div>
            <div style="font-size:.82rem;font-weight:700;color:#2563eb;margin-bottom:.4rem;">4 Adet Acil Erişim Anahtarınız Üretildi</div>
            <p style="font-size:.76rem;color:#475569;line-height:1.45;margin-bottom:.85rem;">
              Bu tek kullanımlık anahtarlar admine veya e-postanıza ulaşamadığınız acil durumlarda şifrenizi sıfırlamanızı sağlar. Lütfen kopyalayıp güvenli bir yere kaydedin.
            </p>
            <div id="regKeysList" style="display:flex;flex-direction:column;gap:.4rem;margin-bottom:.85rem;"></div>
            <button type="button" id="btnCopyAllRecoveryKeys" style="width:100%;padding:.6rem;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;color:#0f172a;font-weight:700;font-size:.8rem;cursor:pointer;margin-bottom:.55rem;">
              📋 Tüm Anahtarları Kopyala
            </button>
            <button type="button" id="btnProceedAfterKeys" style="width:100%;padding:.7rem;border:none;border-radius:10px;background:#2563eb;color:#fff;font-weight:700;font-size:.86rem;cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,0.25);">
              Anahtarları Kaydettim, Giriş Yap
            </button>
          </div>
        </form>

        <!-- 3. ŞİFREMİ UNUTTUM -->
        <div id="authForgotPanel" style="display: none; text-align: left;">
          <div style="text-align:center;margin-bottom:1.1rem;">
            <div style="width:48px;height:48px;margin:0 auto .6rem;background:linear-gradient(135deg, #f59e0b, #d97706);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin-bottom:.3rem;">Şifre Sıfırlama</div>
            <p style="font-size:.78rem; color: #475569; line-height: 1.45; margin: 0 auto;">
              E-posta doğrulaması, acil kurtarma anahtarı veya yönetici yardımı ile şifrenizi sıfırlayabilirsiniz.
            </p>
          </div>

          <!-- ADIM 1: E-Posta Kodu Gönderme -->
          <div id="forgotStep1" style="margin-bottom:.9rem;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:.85rem;margin-bottom:.75rem;">
              <div style="font-weight:800;font-size:.82rem;color:#1e40af;margin-bottom:.45rem;">📧 E-Posta ile Kod Alarak Sıfırla</div>
              <div style="display:flex;gap:.5rem;align-items:center;">
                <input type="text" id="forgotIdentifier" placeholder="Kullanıcı adı veya e-posta" style="flex:1;padding:.55rem .75rem;border-radius:8px;background:#ffffff;border:1.5px solid #bfdbfe;color:#0f172a;font-size:.83rem;outline:none;box-sizing:border-box;" />
                <button type="button" id="btnSendForgotCode" style="padding:.55rem .85rem;border:none;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;font-size:.78rem;cursor:pointer;white-space:nowrap;flex-shrink:0;">Kod Gönder</button>
              </div>
              <div id="forgotCodeMsg" style="display:none;font-size:.72rem;color:#15803d;margin-top:.4rem;"></div>
            </div>

            <!-- ADIM 2: Kod + Yeni Şifre -->
            <div id="forgotStep2" style="display:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:.85rem;margin-bottom:.75rem;">
              <div style="font-weight:800;font-size:.82rem;color:#0f172a;margin-bottom:.45rem;">🔢 Doğrulama Kodunu Girin</div>
              <div style="margin-bottom:.5rem;">
                <input type="text" id="forgotCode" maxlength="6" placeholder="6 haneli kod" style="width:100%;padding:.55rem .75rem;border-radius:8px;background:#ffffff;border:1.5px solid #cbd5e1;color:#0f172a;font-size:1.1rem;font-family:monospace;font-weight:800;letter-spacing:6px;text-align:center;outline:none;box-sizing:border-box;" />
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">
                <input type="password" id="forgotNewPass" placeholder="Yeni şifre (min 6)" style="padding:.5rem .65rem;border-radius:8px;background:#fff;border:1.5px solid #cbd5e1;color:#0f172a;font-size:.83rem;outline:none;box-sizing:border-box;" />
                <input type="password" id="forgotNewPassConf" placeholder="Tekrar girin" style="padding:.5rem .65rem;border-radius:8px;background:#fff;border:1.5px solid #cbd5e1;color:#0f172a;font-size:.83rem;outline:none;box-sizing:border-box;" />
              </div>
              <button type="button" id="btnApplyForgotCode" style="width:100%;padding:.65rem;border:none;border-radius:8px;background:#10b981;color:#fff;font-weight:700;font-size:.85rem;cursor:pointer;">✅ Şifreyi Sıfırla</button>
              <div id="forgotCodeError" style="display:none;font-size:.72rem;color:#b91c1c;margin-top:.4rem;"></div>
            </div>

            <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;">
              <div style="flex:1;height:1px;background:#e2e8f0;"></div>
              <span style="font-size:.7rem;font-weight:700;color:#94a3b8;">VEYA</span>
              <div style="flex:1;height:1px;background:#e2e8f0;"></div>
            </div>
          </div>

          <button type="button" id="btnGoToRecFromForgot" style="
            width: 100%; padding:.65rem; border: none; border-radius: 10px;
            background: #4f46e5; color: #ffffff; font-weight: 700; font-size:.82rem; cursor: pointer; margin-bottom:.5rem;
          ">🔐 Acil Kurtarma Anahtarı ile Sıfırla</button>
          <button type="button" id="btnBackToLoginFromForgot" style="
            width: 100%; padding:.6rem; border: 1px solid #cbd5e1; border-radius: 10px;
            background: #f1f5f9; color: #475569; font-weight: 700; font-size:.8rem; cursor: pointer;
          ">← Giriş Ekranına Dön</button>
        </div>

        <!-- 4. ACİL ERİŞİM ANAHTARI İLE ŞİFRE SIFIRLAMA -->
        <form id="authRecoveryPanel" style="display: none; text-align: left;">
          <div style="text-align:center;margin-bottom:1.15rem;">
            <div style="width:48px;height:48px;margin:0 auto .6rem;background:linear-gradient(135deg, #6366f1, #4f46e5);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.35rem;">🔐</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-bottom:.25rem;">Acil Erişim Anahtarı ile Kurtarma</div>
            <p style="font-size:.78rem; color: #475569; line-height: 1.45; margin: 0 auto;">
              Kayıt esnasında verilen 4 acil erişim anahtarından birini girerek şifrenizi anında sıfırlayabilirsiniz.
            </p>
          </div>

          <div style="margin-bottom:.75rem;">
            <label style="display:block;font-size:.76rem;font-weight:700;color:#334155;margin-bottom:.25rem;">Kullanıcı Adı veya E-Posta *</label>
            <input type="text" id="recIdentifier" required placeholder="ör: admin veya ilker" style="width:100%;padding:.6rem .85rem;border-radius:10px;background:#f8fafc;border:1.5px solid #cbd5e1;color:#0f172a;font-size:.86rem;outline:none;box-sizing:border-box;" />
          </div>

          <div style="margin-bottom:.75rem;">
            <label style="display:block;font-size:.76rem;font-weight:700;color:#334155;margin-bottom:.25rem;">Acil Erişim Anahtarı (FRP-RECOVER-...) *</label>
            <input type="text" id="recKey" required placeholder="FRP-RECOVER-XXXX-XXXX" style="width:100%;padding:.6rem .85rem;border-radius:10px;background:#f8fafc;border:1.5px solid #cbd5e1;color:#0f172a;font-size:.86rem;font-family:monospace;font-weight:700;letter-spacing:.8px;outline:none;box-sizing:border-box;" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin-bottom:.85rem;">
            <div>
              <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Yeni Şifre (Min 6 Karakter) *</label>
              <input type="password" id="recNewPassword" required placeholder="Yeni şifreniz" style="width:100%;padding:.55rem .75rem;border-radius:8px;background:#f8fafc;border:1.5px solid #cbd5e1;color:#0f172a;font-size:.84rem;outline:none;box-sizing:border-box;" />
            </div>
            <div>
              <label style="display:block;font-size:.74rem;font-weight:700;color:#334155;margin-bottom:.2rem;">Yeni Şifre Tekrar *</label>
              <input type="password" id="recNewPasswordConfirm" required placeholder="Tekrar girin" style="width:100%;padding:.55rem .75rem;border-radius:8px;background:#f8fafc;border:1.5px solid #cbd5e1;color:#0f172a;font-size:.84rem;outline:none;box-sizing:border-box;" />
            </div>
          </div>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:.5rem .75rem;margin-bottom:.85rem;font-size:.72rem;color:#1e40af;line-height:1.4;">
            ℹ️ Kullanılan kurtarma anahtarı iptal edilir. Yeni şifreniz son 3 şifreniz ile aynı olamaz.
          </div>

          <button type="submit" id="btnRecSubmit" style="width:100%;padding:.75rem;border:none;border-radius:10px;background:#4f46e5;color:#ffffff;font-weight:700;font-size:.9rem;cursor:pointer;box-shadow:0 4px 14px rgba(79,70,229,0.25);margin-bottom:.55rem;">
            Şifreyi Sıfırla ve Oturum Aç 🔓
          </button>
          <button type="button" id="btnBackToLoginFromRec" style="width:100%;padding:.65rem;border:1px solid #cbd5e1;border-radius:10px;background:#f1f5f9;color:#475569;font-weight:700;font-size:.82rem;cursor:pointer;">
            ← Giriş Ekranına Dön
          </button>
        </form>

        <div id="authFooterNote" style="margin-top: 1.1rem; text-align: center; font-size:.8rem; color: #64748b;">
          ${initialTab === 'login' ? `Hesabınız yok mu? <a href="#" id="linkGoToRegister" style="color:#2563eb;font-weight:700;text-decoration:none;">Kayıt Olun</a>` : `Zaten hesabınız var mı? <a href="#" id="linkGoToLogin" style="color:#2563eb;font-weight:700;text-decoration:none;">Giriş Yapın</a>`}
        </div>
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
    alertBox.textContent = String(msg || '');
  };
  const hideAlert = () => { alertBox.style.display = 'none'; };

  const switchTab = (tab) => {
    hideAlert();
    const loginForm = portal.querySelector('#authLoginForm');
    const regForm = portal.querySelector('#authRegisterForm');
    const forgotPanel = portal.querySelector('#authForgotPanel');
    const recPanel = portal.querySelector('#authRecoveryPanel');
    const tabSwitcher = portal.querySelector('#authTabSwitcher');
    const tabLogin = portal.querySelector('#tabLoginBtn');
    const tabReg = portal.querySelector('#tabRegisterBtn');
    const footerNote = portal.querySelector('#authFooterNote');
    const regBody = portal.querySelector('#regFormBody');
    const regNotice = portal.querySelector('#regSuccessNotice');
    const regKeysNotice = portal.querySelector('#regKeysNotice');

    forgotPanel.style.display = 'none';
    if (recPanel) recPanel.style.display = 'none';

    if (tab === 'login') {
      tabSwitcher.style.display = 'flex';
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
      tabSwitcher.style.display = 'flex';
      loginForm.style.display = 'none';
      regForm.style.display = 'block';
      if (regBody) regBody.style.display = 'block';
      if (regNotice) regNotice.style.display = 'none';
      if (regKeysNotice) regKeysNotice.style.display = 'none';
      tabReg.style.background = '#ffffff';
      tabReg.style.color = '#2563eb';
      tabReg.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
      tabLogin.style.background = 'transparent';
      tabLogin.style.color = '#64748b';
      tabLogin.style.boxShadow = 'none';
      footerNote.innerHTML = `Zaten hesabınız var mı? <a href="#" id="linkGoToLogin" style="color:#2563eb;font-weight:700;text-decoration:none;">Giriş Yapın</a>`;
      bindFooterLinks();
    } else if (tab === 'forgot') {
      tabSwitcher.style.display = 'none';
      loginForm.style.display = 'none';
      regForm.style.display = 'none';
      forgotPanel.style.display = 'block';
      footerNote.innerHTML = '';
    } else if (tab === 'recovery') {
      tabSwitcher.style.display = 'none';
      loginForm.style.display = 'none';
      regForm.style.display = 'none';
      if (recPanel) recPanel.style.display = 'block';
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
  portal.querySelector('#linkForgotPassword').onclick = (e) => {
    e.preventDefault();
    const linkEmergency = portal.querySelector('#linkEmergencyRecover');
    if (linkEmergency) linkEmergency.style.display = 'inline-block';
    switchTab('forgot');
  };
  portal.querySelector('#btnBackToLoginFromForgot').onclick = () => switchTab('login');
  portal.querySelector('#btnGoToRecFromForgot').onclick = () => switchTab('recovery');
  portal.querySelector('#linkEmergencyRecover').onclick = (e) => { e.preventDefault(); switchTab('recovery'); };
  portal.querySelector('#btnBackToLoginFromRec').onclick = () => switchTab('login');
  bindFooterLinks();

  // ── E-Posta ile Şifre Sıfırlama Adım 1: Kod gönder
  const btnSendForgotCode = portal.querySelector('#btnSendForgotCode');
  if (btnSendForgotCode) {
    btnSendForgotCode.onclick = async () => {
      const ident = (portal.querySelector('#forgotIdentifier').value || '').trim();
      const msgEl = portal.querySelector('#forgotCodeMsg');
      const step2El = portal.querySelector('#forgotStep2');
      if (!ident) { msgEl.style.display = 'block'; msgEl.style.color = '#b91c1c'; msgEl.textContent = 'Lütfen kullanıcı adı veya e-posta giriniz.'; return; }
      btnSendForgotCode.disabled = true;
      btnSendForgotCode.textContent = 'Gönderiliyor...';
      try {
        const r = await fetch('/api/auth/forgot-password-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: ident })
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.success) {
          msgEl.style.display = 'block';
          msgEl.style.color = '#15803d';
          msgEl.textContent = d.message || 'Kod gönderildi. Lütfen e-postanızı kontrol edin.';
          if (step2El) step2El.style.display = 'block';
          portal.querySelector('#forgotCode')?.focus();
        } else {
          msgEl.style.display = 'block';
          msgEl.style.color = '#b91c1c';
          msgEl.textContent = d.reason || 'Kod gönderilemedi.';
        }
      } catch (err) {
        msgEl.style.display = 'block';
        msgEl.style.color = '#b91c1c';
        msgEl.textContent = 'Bağlantı hatası: ' + err.message;
      } finally {
        btnSendForgotCode.disabled = false;
        btnSendForgotCode.textContent = 'Kod Gönder';
      }
    };
  }

  // ── E-Posta ile Şifre Sıfırlama Adım 2: Kodu doğrula ve şifreyi güncelle
  const btnApplyForgotCode = portal.querySelector('#btnApplyForgotCode');
  if (btnApplyForgotCode) {
    btnApplyForgotCode.onclick = async () => {
      const ident = (portal.querySelector('#forgotIdentifier').value || '').trim();
      const code = (portal.querySelector('#forgotCode').value || '').trim();
      const newPass = portal.querySelector('#forgotNewPass').value;
      const newPassConf = portal.querySelector('#forgotNewPassConf').value;
      const errEl = portal.querySelector('#forgotCodeError');

      errEl.style.display = 'none';
      if (!code || code.length !== 6) { errEl.style.display = 'block'; errEl.textContent = '6 haneli kodu eksiksiz giriniz.'; return; }
      if (!newPass || newPass.length < 6) { errEl.style.display = 'block'; errEl.textContent = 'Yeni şifreniz en az 6 karakter olmalıdır.'; return; }
      if (newPass !== newPassConf) { errEl.style.display = 'block'; errEl.textContent = 'Şifreler eşleşmiyor.'; return; }

      btnApplyForgotCode.disabled = true;
      btnApplyForgotCode.textContent = 'Sıfırlanıyor...';
      try {
        const r = await fetch('/api/auth/reset-password-with-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: ident, code, newPassword: newPass })
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.success) {
          if (!d.token || !d.user || !window.FrpAuth || typeof window.FrpAuth.applyExternalSession !== 'function') {
            throw new Error('Güvenli oturum oluşturulamadı. Lütfen yeni şifrenizle giriş yapınız.');
          }
          window.FrpAuth.applyExternalSession(d.token, d.user, true);
          if (window.FrpStore && typeof window.FrpStore.clearSessionCache === 'function') {
            window.FrpStore.clearSessionCache();
          }
          if (window.FrpStore && typeof window.FrpStore.refreshFromCloud === 'function') {
            await window.FrpStore.refreshFromCloud();
          }
          portal.remove();
          const appWrapEl = document.querySelector('.app-wrap');
          if (appWrapEl) appWrapEl.style.display = 'flex';
          if (typeof window.toast === 'function') window.toast('Şifreniz başarıyla sıfırlandı! Hoş geldiniz.', 'success');
          if (typeof window.FrpAuth?.updateNavbarUserBadge === 'function') window.FrpAuth.updateNavbarUserBadge();
          if (typeof window.refreshAll === 'function') window.refreshAll();
        } else {
          errEl.style.display = 'block';
          errEl.textContent = d.reason || 'Kod doğrulanamadı. Kodu ve şifrenizi kontrol ediniz.';
        }
      } catch (err) {
        errEl.style.display = 'block';
        errEl.textContent = 'Bağlantı hatası: ' + err.message;
      } finally {
        btnApplyForgotCode.disabled = false;
        btnApplyForgotCode.textContent = '✅ Şifreyi Sıfırla';
      }
    };
  }

  const togglePass = portal.querySelector('#toggleLoginPass');
  const passInput = portal.querySelector('#loginPassword');
  if (togglePass && passInput) {
    togglePass.onclick = () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        togglePass.textContent = 'Gizle';
      } else {
        passInput.type = 'password';
        togglePass.textContent = 'Göster';
      }
    };
  }

  const captchaContainer = portal.querySelector('#loginCaptchaContainer');
  const captchaQuestion = portal.querySelector('#loginCaptchaQuestion');
  const captchaAnswerInput = portal.querySelector('#loginCaptchaAnswer');
  const captchaTokenInput = portal.querySelector('#loginCaptchaToken');
  const btnRefreshCaptcha = portal.querySelector('#btnRefreshCaptcha');

  let failedLoginAttempts = 0;

  async function loadCaptcha() {
    try {
      const res = await fetch('/api/auth/captcha');
      const data = await res.json();
      const token = data?.captchaToken || data?.token;
      if (data && token) {
        captchaTokenInput.value = token;
        captchaQuestion.textContent = data.question;
        captchaAnswerInput.value = '';
        captchaContainer.style.display = 'block';
        setTimeout(() => { if (captchaAnswerInput) captchaAnswerInput.focus(); }, 40);
      }
    } catch (e) {
      console.warn('Captcha yüklenemedi:', e);
    }
  }

  if (btnRefreshCaptcha) {
    btnRefreshCaptcha.onclick = (e) => {
      e.preventDefault();
      loadCaptcha();
    };
  }

  // Giriş submit
  portal.querySelector('#authLoginForm').onsubmit = async (e) => {
    e.preventDefault();
    hideAlert();

    const ident = (portal.querySelector('#loginIdentifier').value || '').trim();
    const pass = portal.querySelector('#loginPassword').value;

    if (!ident || !pass) {
      showAlert('Lütfen tüm alanları doldurunuz.', 'warning');
      return;
    }

    const captchaAnswer = captchaAnswerInput?.value ? captchaAnswerInput.value.trim() : '';
    const captchaToken = captchaTokenInput?.value || '';

    const submitBtn = portal.querySelector('#btnLoginSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Giriş Yapılıyor...';

    const remember = portal.querySelector('#loginRememberMe').checked;
    const res = await window.FrpAuth.login({
      identifier: ident,
      password: pass,
      rememberMe: remember,
      captchaAnswer,
      captchaToken
    });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Giriş Yap';

    if (res.success) {
      portal.remove();
      showLoginTransitionSplash(res.user, async () => {
        if (appWrap) appWrap.style.display = 'flex';
        if (typeof window.FrpAuth?.updateNavbarUserBadge === 'function') window.FrpAuth.updateNavbarUserBadge();
        if (typeof window.FrpAuth?.setupAdminFeatures === 'function') window.FrpAuth.setupAdminFeatures();
        if (window.FrpStore && typeof window.FrpStore.clearSessionCache === 'function') {
          window.FrpStore.clearSessionCache();
        }
        if (window.FrpStore && typeof window.FrpStore.refreshFromCloud === 'function') {
          await window.FrpStore.refreshFromCloud();
        }
        if (typeof window.refreshAll === 'function') window.refreshAll();
        if (typeof window.toast === 'function') window.toast(`Hoş geldiniz, ${res.user.full_name || res.user.username}!`, 'success');
      });
    } else {
      failedLoginAttempts++;
      const linkEmergency = portal.querySelector('#linkEmergencyRecover');
      if (linkEmergency && (failedLoginAttempts >= 2 || res.requireCaptcha || res.failedAttempts >= 2)) {
        linkEmergency.style.display = 'inline-block';
      }

      if (res.requireCaptcha || res.reason?.toLowerCase().includes('captcha')) {
        await loadCaptcha();
      }
      if (res.isFrozen) {
        showAlert('Bu hesap dondurulmuştur. Lütfen sistem yöneticisi ile iletişime geçin.', 'error');
      } else {
        showAlert(res.reason || 'Giriş başarısız oldu.', res.pendingApproval ? 'warning' : 'error');
      }
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

    if (pass.length < 6) {
      showAlert('Şifreniz en az 6 karakter uzunluğunda olmalıdır.', 'warning');
      return;
    }

    if (pass !== passConf) {
      showAlert('Girdiğiniz şifreler birbiriyle eşleşmiyor.', 'warning');
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

      // 4 Acil Kurtarma Anahtarı Üretildiyse Ekranda Güvenle Göster
      if (res.recoveryKeys && Array.isArray(res.recoveryKeys) && res.recoveryKeys.length > 0) {
        const keysNotice = portal.querySelector('#regKeysNotice');
        const keysList = portal.querySelector('#regKeysList');
        keysList.innerHTML = res.recoveryKeys.map((k, idx) => `
          <div class="auth-recovery-key-pill">
            <span>🔑 Anahtar #${idx + 1}</span>
            <code>${escHtml(k)}</code>
          </div>
        `).join('');

        keysNotice.style.display = 'block';

        const btnCopy = portal.querySelector('#btnCopyAllRecoveryKeys');
        btnCopy.onclick = async () => {
          try {
            await navigator.clipboard.writeText(res.recoveryKeys.join('\n'));
            btnCopy.textContent = '✅ Tüm Anahtarlar Kopyalandı!';
            if (typeof window.toast === 'function') window.toast('Kurtarma anahtarları panoya kopyalandı.', 'success');
          } catch {
            if (typeof window.toast === 'function') window.toast('Lütfen anahtarları elle seçerek kopyalayınız.', 'info');
          }
        };

        const btnProceed = portal.querySelector('#btnProceedAfterKeys');
        btnProceed.onclick = () => {
          switchTab('login');
          portal.querySelector('#loginIdentifier').value = username;
        };
      } else {
        portal.querySelector('#regSuccessNotice').style.display = 'block';
        const btnGoLog = portal.querySelector('#btnGoToLoginAfterReg');
        if (btnGoLog) {
          btnGoLog.onclick = () => {
            switchTab('login');
            portal.querySelector('#loginIdentifier').value = username;
          };
        }
      }
      hideAlert();
    } else {
      showAlert(res.reason || 'Kayıt işlemi gerçekleştirilemedi.', 'error');
    }
  };

  // Acil Kurtarma Anahtarı ile Şifre Sıfırlama submit
  portal.querySelector('#authRecoveryPanel').onsubmit = async (e) => {
    e.preventDefault();
    hideAlert();

    const ident = (portal.querySelector('#recIdentifier').value || '').trim();
    const recKey = (portal.querySelector('#recKey').value || '').trim();
    const newPass = portal.querySelector('#recNewPassword').value;
    const newPassConf = portal.querySelector('#recNewPasswordConfirm').value;

    if (!ident || !recKey || !newPass) {
      showAlert('Lütfen tüm alanları eksiksiz doldurunuz.', 'warning');
      return;
    }

    if (newPass.length < 6) {
      showAlert('Yeni şifreniz en az 6 karakter uzunluğunda olmalıdır.', 'warning');
      return;
    }

    if (newPass !== newPassConf) {
      showAlert('Yeni şifreleriniz birbiriyle eşleşmiyor.', 'warning');
      return;
    }

    const btnSubmit = portal.querySelector('#btnRecSubmit');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Sıfırlanıyor...';

    const res = await window.FrpAuth.recoverWithKey({
      identifier: ident,
      recoveryKey: recKey,
      newPassword: newPass
    });

    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Şifreyi Sıfırla ve Oturum Aç 🔓';

    if (res.success && res.user) {
      portal.remove();
      showLoginTransitionSplash(res.user, async () => {
        if (appWrap) appWrap.style.display = 'flex';
        if (typeof window.FrpAuth?.updateNavbarUserBadge === 'function') window.FrpAuth.updateNavbarUserBadge();
        if (typeof window.FrpAuth?.setupAdminFeatures === 'function') window.FrpAuth.setupAdminFeatures();
        if (window.FrpStore && typeof window.FrpStore.clearSessionCache === 'function') {
          window.FrpStore.clearSessionCache();
        }
        if (window.FrpStore && typeof window.FrpStore.refreshFromCloud === 'function') {
          await window.FrpStore.refreshFromCloud();
        }
        if (typeof window.refreshAll === 'function') window.refreshAll();
        if (typeof window.toast === 'function') window.toast('Şifreniz başarıyla sıfırlandı ve oturum açıldı!', 'success');
      });
    } else {
      showAlert(res.reason || 'Kurtarma işlemi başarısız oldu. Anahtarınızı kontrol edin.', 'error');
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
 width: 260px; padding:.65rem; animation: fadeIn.12s ease-out;
 `;

 const rect = anchorEl.getBoundingClientRect();
 dropdown.style.top = (rect.bottom + 8) + 'px';
 dropdown.style.right = (window.innerWidth - rect.right) + 'px';

 dropdown.innerHTML = `
 <div style="padding:.6rem.75rem;border-bottom:1px solid var(--border-light,#f1f5f9);margin-bottom:.4rem;">
 <div style="font-weight:800;font-size:.9rem;color:var(--text-primary);">${escHtml(user.full_name || user.username)}</div>
 <div style="font-size:.74rem;color:var(--text-muted);margin-top:2px;">@${escHtml(user.username)} · ${user.role === 'admin'? 'Admin': 'Kullanıcı'}</div>
 </div>
 <div style="display:flex;flex-direction:column;gap:.25rem;">
 ${user.role === 'admin'? `
 <button type="button" class="btn btn-sm btn-ghost" id="ddBtnAdminApproval" style="text-align:left;justify-content:flex-start;padding:.5rem.75rem;font-weight:700;">
 Kayıt Onay & Yönetim
 </button>
 `: ''}
 <button type="button" class="btn btn-sm btn-ghost" id="ddBtnSettings" style="text-align:left;justify-content:flex-start;padding:.5rem.75rem;font-weight:700;">
 Profil & Ayarlar
 </button>
 <button type="button" class="btn btn-sm btn-ghost" id="ddBtnAuditLogs" style="text-align:left;justify-content:flex-start;padding:.5rem .75rem;font-weight:700;">
 Denetim Günlüğü
 </button>
 <div style="border-top:1px solid var(--border-light,#f1f5f9);margin:.3rem 0;"></div>
 <button type="button" class="btn btn-sm btn-ghost" id="ddBtnLogout" style="text-align:left;justify-content:flex-start;padding:.5rem.75rem;font-weight:800;color:#ef4444;">
 Oturumu Kapat
 </button>
 </div>
 `;

 document.body.appendChild(dropdown);

 const closeDropdown = (e) => {
 if (!dropdown.contains(e.target) && e.target!== anchorEl &&!anchorEl.contains(e.target)) {
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
