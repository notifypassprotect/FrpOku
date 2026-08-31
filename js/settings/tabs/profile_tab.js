// ============================================================
//  profile_tab.js — Kullanıcı Profili, Şifre Değişimi & İstemci Bilgileri
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.profile = {
  render({ stagedProfile, escHtml }) {
    const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
    
    let browser = 'Modern Web Tarayıcı';
    const edgeM = ua.match(/edg\/([\d.]+)/i);
    const chromeM = ua.match(/chrome\/([\d.]+)/i);
    const ffM = ua.match(/firefox\/([\d.]+)/i);
    const operaM = ua.match(/(?:opr|opera)\/([\d.]+)/i);
    const safariM = ua.match(/version\/([\d.]+).*safari/i);

    if (edgeM) browser = `Microsoft Edge (v${edgeM[1].split('.')[0]} · Chromium)`;
    else if (operaM) browser = `Opera (v${operaM[1].split('.')[0]})`;
    else if (chromeM) browser = `Google Chrome (v${chromeM[1].split('.')[0]} · V8)`;
    else if (ffM) browser = `Mozilla Firefox (v${ffM[1].split('.')[0]} · Gecko)`;
    else if (safariM) browser = `Apple Safari (v${safariM[1].split('.')[0]} · WebKit)`;

    let os = 'Masaüstü İşletim Sistemi';
    if (/windows nt 10\.0/i.test(ua)) os = 'Windows 10 / 11 (64-bit)';
    else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1 (64-bit)';
    else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7 (64-bit)';
    else if (/windows/i.test(ua)) os = 'Windows OS (x64)';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS (Apple Silicon / Intel)';
    else if (/linux/i.test(ua)) os = 'Linux OS (Desktop)';

    const w = typeof window !== 'undefined' && window.screen ? window.screen.width : 1920;
    const h = typeof window !== 'undefined' && window.screen ? window.screen.height : 1080;
    const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? Math.round(window.devicePixelRatio * 100) : 100;
    let resLabel = '';
    if (w >= 3840) resLabel = '4K UHD';
    else if (w >= 2560) resLabel = '2K QHD';
    else if (w >= 1920) resLabel = 'FHD';
    const resolution = `${w} x ${h} ${resLabel ? `(${resLabel})` : ''} · @${dpr}% DPR`;

    const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Mantıksal CPU Çekirdeği` : 'Çok Çekirdekli CPU';
    
    let storageFormatted = '0 KB';
    try {
      const totalBytes = new Blob([localStorage.getItem('frpoku_files') || localStorage.getItem('frpoku_store_v2') || '']).size;
      storageFormatted = totalBytes > 1048576 ? (totalBytes / 1048576).toFixed(1) + ' MB' : (totalBytes / 1024).toFixed(1) + ' KB';
    } catch {}

    const host = typeof window !== 'undefined' && window.location ? window.location.host : 'localhost';
    const protocol = typeof window !== 'undefined' && window.location ? window.location.protocol.replace(':', '').toUpperCase() : 'HTTP';
    const clientIp = window.FrpAudit ? window.FrpAudit.getClientIp() : '127.0.0.1';

    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">Kullanıcı & Cihaz Profili</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
            Oturum güvenliği, yetkilendirme ve sunucu ortamı için kayıtlı profil bilgileri.
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
          
          <!-- Sol Kart: Kullanıcı Profili -->
          <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
            <div style="font-weight:800;font-size:.88rem;color:var(--text-primary);border-bottom:1px solid var(--border-light);padding-bottom:.4rem;">
              Kullanıcı Profili
              <div style="font-size:.72rem;color:var(--text-muted);font-weight:normal;margin-top:.1rem;">Hesabınız için temel iletişim bilgileri</div>
            </div>

            <div>
              <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">Adınız</label>
              <input type="text" id="profFirstName" class="master-search-input" style="width:100%;" value="${escHtml(stagedProfile.firstName || '')}" />
            </div>

            <div>
              <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">Soyadınız</label>
              <input type="text" id="profLastName" class="master-search-input" style="width:100%;" value="${escHtml(stagedProfile.lastName || '')}" />
            </div>

            <div>
              <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">Kullanıcı Adı / Sicil No</label>
              <input type="text" id="profUsername" class="master-search-input" style="width:100%;" value="${escHtml(stagedProfile.username || '')}" />
            </div>

            <div>
              <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">Kayıtlı E-Posta Adresi</label>
              <input type="email" id="profEmailDisplay" class="master-search-input" style="width:100%;background:rgba(0,0,0,.03);cursor:not-allowed;" value="${escHtml(stagedProfile.email || '')}" readonly />
              <div style="font-size:.7rem;color:var(--text-muted);margin-top:.2rem;">E-posta adresinizi aşağıdaki güvenlik alanından değiştirebilirsiniz.</div>
            </div>

            <div>
              <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">Hesap Oluşturulma Tarihi</label>
              <input type="text" class="master-search-input" style="width:100%;background:rgba(0,0,0,.03);cursor:not-allowed;" value="${escHtml(stagedProfile.accountCreatedDate || '01.05.2026 18:55')}" readonly />
            </div>
          </div>

          <!-- Sağ Kart: Tarayıcı ve Sistem Çalışma Ortamı -->
          <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
            <div style="font-weight:800;font-size:.88rem;color:var(--text-primary);border-bottom:1px solid var(--border-light);padding-bottom:.4rem;display:flex;align-items:center;justify-content:space-between;">
              <span>İstemci & Sistem Ortamı</span>
              <span class="badge badge-green" style="font-size:.68rem;">Aktif & Hazır</span>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:.55rem;font-size:.78rem;">
              
              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">Tarayıcı & Motor</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(browser)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">İşletim Sistemi</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(os)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">İstemci IP Adresi</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--accent);margin-top:.15rem;font-family:var(--mono);">${escHtml(clientIp)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">Ekran & Çözünürlük</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--accent);margin-top:.15rem;">${escHtml(resolution)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">CPU / Donanım</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(cores)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">Depolama (Store)</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(storageFormatted)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">Sunucu Modu & Port</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;font-family:var(--mono);">${escHtml(protocol)} · ${escHtml(host)}</div>
              </div>

            </div>

          </div>

          <!-- Alt Kart 1: E-Posta Değiştirme -->
          <div class="settings-card" style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:.85rem; border: 1.5px solid var(--border); background: var(--bg-surface); padding: 1.25rem; border-radius: 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-light); padding-bottom:.5rem;">
              <div>
                <div style="font-weight:800; font-size:.92rem; color:var(--text-primary);">E-Posta Adresi Güncelleme</div>
                <div style="font-size:.74rem; color:var(--text-muted);">Hesabınıza bağlı iletişim e-posta adresini doğrulayarak güncelleyin</div>
              </div>
              <span class="badge badge-purple" style="font-weight:700; font-size:.7rem;">İletişim & Bildirim</span>
            </div>

            <!-- Canlı Uyarı / Bilgi Kutusu -->
            <div id="profileEmailAlert" style="display:none; padding:.75rem 1rem; border-radius:10px; font-size:.82rem; font-weight:600;"></div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:.85rem;">
              <div>
                <label style="font-size:.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:.3rem; display:block;">Mevcut Şifreniz</label>
                <input type="password" id="profEmailCurrentPass" class="master-search-input" style="width:100%;" placeholder="Güvenlik için mevcut şifrenizi girin" />
              </div>
              <div>
                <label style="font-size:.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:.3rem; display:block;">Yeni E-Posta Adresi</label>
                <input type="email" id="profNewEmail" class="master-search-input" style="width:100%;" placeholder="yeni_eposta@alanadi.com" />
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; margin-top:.2rem;">
              <button type="button" id="btnUpdateEmailSecurely" class="btn btn-primary" style="padding:.55rem 1.35rem; font-weight:800; font-size:.84rem; border-radius:10px;">
                E-Posta Adresimi Güncelle
              </button>
            </div>
          </div>

          <!-- Alt Kart 2: Şifre ve Hesap Güvenliği -->
          <div class="settings-card" style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:.85rem; border: 1.5px solid var(--accent); background: var(--bg-surface); padding: 1.25rem; border-radius: 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-light); padding-bottom:.5rem;">
              <div>
                <div style="font-weight:800; font-size:.92rem; color:var(--text-primary);">Şifre ve Hesap Güvenliği</div>
                <div style="font-size:.74rem; color:var(--text-muted);">Giriş şifrenizi güvenli bir şekilde güncelleyin</div>
              </div>
              <span class="badge" style="background:var(--accent-light); color:var(--accent); font-weight:700; font-size:.7rem;">Uçtan Uca Şifreli</span>
            </div>

            <!-- Canlı Uyarı / Bilgi Kutusu -->
            <div id="profilePassAlert" style="display:none; padding:.75rem 1rem; border-radius:10px; font-size:.82rem; font-weight:600;"></div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:.85rem;">
              <div>
                <label style="font-size:.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:.3rem; display:block;">Mevcut Şifre</label>
                <input type="password" id="profOldPass" class="master-search-input" style="width:100%;" placeholder="Mevcut şifrenizi girin" />
              </div>
              <div>
                <label style="font-size:.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:.3rem; display:block;">Yeni Şifre</label>
                <input type="password" id="profNewPass" class="master-search-input" style="width:100%;" placeholder="En az 4 karakter" />
              </div>
              <div>
                <label style="font-size:.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:.3rem; display:block;">Yeni Şifre Tekrar</label>
                <input type="password" id="profNewPassConfirm" class="master-search-input" style="width:100%;" placeholder="Yeni şifreyi onaylayın" />
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; margin-top:.2rem;">
              <button type="button" id="btnUpdatePasswordProfile" class="btn btn-primary" style="padding:.55rem 1.35rem; font-weight:800; font-size:.84rem; border-radius:10px;">
                Şifremi Güncelle
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  },

  bind({ overlay, stagedProfile, markDirty, safeToast }) {
    const bindInput = (id, prop) => {
      overlay.querySelector(id)?.addEventListener('input', (e) => {
        stagedProfile[prop] = e.target.value;
        markDirty();
      });
    };

    bindInput('#profFirstName', 'firstName');
    bindInput('#profLastName', 'lastName');
    bindInput('#profUsername', 'username');

    // E-Posta Güvenli Güncelle Butonu
    overlay.querySelector('#btnUpdateEmailSecurely')?.addEventListener('click', async () => {
      const emailInput = overlay.querySelector('#profNewEmail');
      const passInput = overlay.querySelector('#profEmailCurrentPass');
      const alertEl = overlay.querySelector('#profileEmailAlert');
      const displayEl = overlay.querySelector('#profEmailDisplay');

      const newEmail = (emailInput?.value || '').trim();
      const currentPass = (passInput?.value || '').trim();

      const showEmailAlert = (msg, type) => {
        if (!alertEl) return;
        alertEl.style.display = 'block';
        alertEl.textContent = msg;
        if (type === 'error') {
          alertEl.style.background = 'rgba(239, 68, 68, 0.12)';
          alertEl.style.color = '#ef4444';
          alertEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        } else if (type === 'success') {
          alertEl.style.background = 'rgba(16, 185, 129, 0.12)';
          alertEl.style.color = '#10b981';
          alertEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        } else {
          alertEl.style.background = 'rgba(245, 158, 11, 0.12)';
          alertEl.style.color = '#f59e0b';
          alertEl.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        }
      };

      if (!newEmail || !newEmail.includes('@')) {
        showEmailAlert('Lütfen geçerli bir e-posta adresi giriniz.', 'warning');
        return;
      }

      if (!currentPass) {
        showEmailAlert('Güvenliğiniz için lütfen mevcut şifrenizi giriniz.', 'warning');
        return;
      }

      const btn = overlay.querySelector('#btnUpdateEmailSecurely');
      if (btn) { btn.disabled = true; btn.textContent = 'Güncelleniyor...'; }

      if (window.FrpAuth?.updateEmail) {
        const res = await window.FrpAuth.updateEmail(newEmail);
        if (btn) { btn.disabled = false; btn.textContent = 'E-Posta Adresimi Güncelle'; }

        if (res.success) {
          stagedProfile.email = newEmail;
          if (displayEl) displayEl.value = newEmail;
          if (emailInput) emailInput.value = '';
          if (passInput) passInput.value = '';
          showEmailAlert('E-posta adresi başarıyla güncellendi.', 'success');
          safeToast('E-posta adresi başarıyla güncellendi.', 'success');
        } else {
          showEmailAlert(res.reason || 'E-posta güncellenemedi.', 'error');
        }
      } else {
        stagedProfile.email = newEmail;
        if (displayEl) displayEl.value = newEmail;
        if (btn) { btn.disabled = false; btn.textContent = 'E-Posta Adresimi Güncelle'; }
        markDirty();
        showEmailAlert('E-posta kaydedilmek üzere hazırlandı.', 'success');
        safeToast('E-posta kaydedilmek üzere hazırlandı.', 'info');
      }
    });

    // Şifre Değiştirme Butonu
    overlay.querySelector('#btnUpdatePasswordProfile')?.addEventListener('click', async () => {
      const oldPassEl = overlay.querySelector('#profOldPass');
      const newPassEl = overlay.querySelector('#profNewPass');
      const confirmPassEl = overlay.querySelector('#profNewPassConfirm');
      const alertEl = overlay.querySelector('#profilePassAlert');

      const oldPass = oldPassEl?.value || '';
      const newPass = newPassEl?.value || '';
      const confirmPass = confirmPassEl?.value || '';

      const showAlert = (msg, type) => {
        if (!alertEl) return;
        alertEl.style.display = 'block';
        alertEl.textContent = msg;
        if (type === 'error') {
          alertEl.style.background = 'rgba(239, 68, 68, 0.12)';
          alertEl.style.color = '#ef4444';
          alertEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        } else if (type === 'success') {
          alertEl.style.background = 'rgba(16, 185, 129, 0.12)';
          alertEl.style.color = '#10b981';
          alertEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        } else {
          alertEl.style.background = 'rgba(245, 158, 11, 0.12)';
          alertEl.style.color = '#f59e0b';
          alertEl.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        }
      };

      if (!oldPass || !newPass || !confirmPass) {
        showAlert('Lütfen tüm şifre alanlarını eksiksiz doldurunuz.', 'warning');
        return;
      }

      if (newPass.length < 4) {
        showAlert('Yeni şifreniz en az 4 karakter uzunluğunda olmalıdır.', 'warning');
        return;
      }

      if (newPass !== confirmPass) {
        showAlert('Yeni şifre ile şifre tekrarı birbiriyle uyuşmuyor.', 'error');
        return;
      }

      if (window.FrpAuth?.updatePassword) {
        const btn = overlay.querySelector('#btnUpdatePasswordProfile');
        if (btn) { btn.disabled = true; btn.textContent = 'Güncelleniyor...'; }

        const res = await window.FrpAuth.updatePassword({ oldPassword: oldPass, newPassword: newPass });
        if (btn) { btn.disabled = false; btn.textContent = 'Şifremi Güncelle'; }

        if (res.success) {
          showAlert('Şifreniz başarıyla değiştirildi.', 'success');
          safeToast('Şifreniz başarıyla güncellendi.', 'success');
          if (oldPassEl) oldPassEl.value = '';
          if (newPassEl) newPassEl.value = '';
          if (confirmPassEl) confirmPassEl.value = '';
        } else {
          showAlert(res.reason || 'Şifre güncellenirken hata oluştu.', 'error');
        }
      } else {
        safeToast('Şifre güncelleme servisine erişilemedi.', 'error');
      }
    });
  }
};
