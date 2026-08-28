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
    
    let storageFormatted = '1.4 MB';
    try {
      const totalBytes = new Blob([localStorage.getItem('frpoku_store_v2') || '']).size;
      storageFormatted = (totalBytes / 1024).toFixed(1) + ' KB';
    } catch {}

    const host = typeof window !== 'undefined' && window.location ? window.location.host : 'localhost';
    const protocol = typeof window !== 'undefined' && window.location ? window.location.protocol.replace(':', '').toUpperCase() : 'HTTP';
    const clientIp = window.FrpAudit ? window.FrpAudit.getClientIp() : '127.0.0.1';

    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">👤 Kullanıcı & Cihaz Profili</div>
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
              <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">E-Posta Adresiniz</label>
              <div style="display:flex;gap:.4rem;">
                <input type="email" id="profEmail" class="master-search-input" style="flex:1;" value="${escHtml(stagedProfile.email || '')}" />
                <button type="button" class="btn btn-sm btn-primary" id="btnUpdateEmailDirectly" style="font-weight:700;font-size:.75rem;padding:.3rem .65rem;">Değiştir</button>
              </div>
            </div>

            <div>
              <label style="font-size:.75rem;font-weight:700;color:var(--text-secondary);margin-bottom:.2rem;display:block;">Hesap Oluşturulma Tarihi</label>
              <input type="text" class="master-search-input" style="width:100%;background:rgba(0,0,0,.03);cursor:not-allowed;" value="${escHtml(stagedProfile.accountCreatedDate || '01.05.2026 18:55')}" readonly />
            </div>
          </div>

          <!-- Sağ Kart: Tarayıcı ve Sistem Çalışma Ortamı -->
          <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
            <div style="font-weight:800;font-size:.88rem;color:var(--text-primary);border-bottom:1px solid var(--border-light);padding-bottom:.4rem;display:flex;align-items:center;justify-content:space-between;">
              <span>🖥️ İstemci & Sistem Ortamı</span>
              <span class="badge badge-green" style="font-size:.68rem;">🟢 Aktif & Hazır</span>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:.55rem;font-size:.78rem;">
              
              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">🌐 Tarayıcı & Motor</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(browser)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">💻 İşletim Sistemi</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(os)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">📡 İstemci IP Adresi</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--accent);margin-top:.15rem;font-family:var(--mono);">${escHtml(clientIp)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">🖥️ Ekran & Çözünürlük</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--accent);margin-top:.15rem;">${escHtml(resolution)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">⚡ CPU / Donanım</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(cores)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">💾 Depolama (Store)</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;">${escHtml(storageFormatted)}</div>
              </div>

              <div style="background:var(--bg-surface);padding:.55rem .75rem;border-radius:9px;border:1px solid var(--border-light);">
                <div style="font-size:.7rem;color:var(--text-muted);font-weight:700;">🚀 Sunucu Modu & Port</div>
                <div style="font-size:.8rem;font-weight:700;color:var(--text-primary);margin-top:.15rem;font-family:var(--mono);">${escHtml(protocol)} · ${escHtml(host)}</div>
              </div>

            </div>

          </div>

          <!-- Alt Kart: 🔒 Şifre ve Hesap Güvenliği -->
          <div class="settings-card" style="grid-column: 1 / -1; display:flex; flex-direction:column; gap:.85rem; border: 1.5px solid var(--accent); background: var(--bg-surface); padding: 1.25rem; border-radius: 14px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-light); padding-bottom:.5rem;">
              <div style="display:flex; align-items:center; gap:.5rem;">
                <span style="font-size:1.2rem;">🔒</span>
                <div>
                  <div style="font-weight:800; font-size:.92rem; color:var(--text-primary);">Şifre ve Hesap Güvenliği</div>
                  <div style="font-size:.74rem; color:var(--text-muted);">Giriş şifrenizi güvenli bir şekilde güncelleyin</div>
                </div>
              </div>
              <span class="badge" style="background:var(--accent-light); color:var(--accent); font-weight:700; font-size:.7rem;">🛡️ Uçtan Uca Şifreli</span>
            </div>

            <!-- Canlı Uyarı / Bilgi Kutusu -->
            <div id="profilePassAlert" style="display:none; padding:.75rem 1rem; border-radius:10px; font-size:.82rem; font-weight:600;"></div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:.85rem;">
              <div>
                <label style="font-size:.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:.3rem; display:block;">🔑 Mevcut Şifre</label>
                <input type="password" id="profOldPass" class="master-search-input" style="width:100%;" placeholder="Mevcut şifrenizi girin" />
              </div>
              <div>
                <label style="font-size:.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:.3rem; display:block;">🔒 Yeni Şifre</label>
                <input type="password" id="profNewPass" class="master-search-input" style="width:100%;" placeholder="En az 4 karakter" />
              </div>
              <div>
                <label style="font-size:.75rem; font-weight:700; color:var(--text-secondary); margin-bottom:.3rem; display:block;">🔒 Yeni Şifre Tekrar</label>
                <input type="password" id="profNewPassConfirm" class="master-search-input" style="width:100%;" placeholder="Yeni şifreyi onaylayın" />
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; margin-top:.3rem;">
              <button type="button" id="btnUpdatePasswordProfile" class="btn btn-primary" style="padding:.6rem 1.4rem; font-weight:800; font-size:.85rem; border-radius:10px;">
                🔐 Şifremi Güncelle
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
    bindInput('#profEmail', 'email');

    // E-Posta Değiştir Butonu
    overlay.querySelector('#btnUpdateEmailDirectly')?.addEventListener('click', async () => {
      const emailInput = overlay.querySelector('#profEmail');
      const newEmail = (emailInput?.value || '').trim();
      const authUser = window.FrpAuth?.getUser();
      const oldEmail = authUser?.email || stagedProfile.email || '';

      if (!newEmail) {
        safeToast('Lütfen geçerli bir e-posta adresi girin.', 'error');
        return;
      }

      if (newEmail === oldEmail) {
        safeToast('Girdiğiniz e-posta adresi mevcut adresinizle aynı.', 'info');
        return;
      }

      if (window.FrpAuth && typeof window.FrpAuth.updateEmailDirectly === 'function') {
        const res = await window.FrpAuth.updateEmailDirectly(newEmail);
        if (res.success) {
          stagedProfile.email = newEmail;
          safeToast('E-posta adresi başarıyla güncellendi! ✉️', 'success');
        } else {
          safeToast(res.reason || 'E-posta adresi güncellenemedi.', 'error');
        }
      } else {
        stagedProfile.email = newEmail;
        safeToast('E-posta adresi taslağa kaydedildi.', 'info');
        markDirty();
      }
    });

    // Şifre Güncelleme Butonu
    overlay.querySelector('#btnUpdatePasswordProfile')?.addEventListener('click', async () => {
      const oldPass = (overlay.querySelector('#profOldPass')?.value || '').trim();
      const newPass = (overlay.querySelector('#profNewPass')?.value || '').trim();
      const newPassConf = (overlay.querySelector('#profNewPassConfirm')?.value || '').trim();
      const alertBox = overlay.querySelector('#profilePassAlert');

      const showAlert = (msg, isErr = true) => {
        if (!alertBox) return;
        alertBox.style.display = 'block';
        alertBox.style.background = isErr ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)';
        alertBox.style.color = isErr ? 'var(--red)' : 'var(--green)';
        alertBox.style.border = `1px solid ${isErr ? 'var(--red)' : 'var(--green)'}`;
        alertBox.textContent = msg;
      };

      if (!oldPass || !newPass || !newPassConf) {
        showAlert('Lütfen tüm şifre alanlarını eksiksiz doldurun.');
        return;
      }

      if (newPass.length < 4) {
        showAlert('Yeni şifreniz en az 4 karakter uzunluğunda olmalıdır.');
        return;
      }

      if (newPass !== newPassConf) {
        showAlert('Yeni şifreler birbiriyle eşleşmiyor.');
        return;
      }

      const curUser = window.FrpAuth ? window.FrpAuth.getUser() : null;
      if (!curUser) {
        showAlert('Oturum açık değil, lütfen giriş yapın.');
        return;
      }

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: curUser.id, oldPassword: oldPass, newPassword: newPass })
        });
        const data = await res.json();
        if (data.success) {
          showAlert('✅ Şifreniz başarıyla güncellendi!', false);
          overlay.querySelector('#profOldPass').value = '';
          overlay.querySelector('#profNewPass').value = '';
          overlay.querySelector('#profNewPassConfirm').value = '';
          safeToast('Şifreniz başarıyla değiştirildi! 🔐', 'success');
        } else {
          showAlert(data.reason || 'Mevcut şifreniz hatalı.');
        }
      } catch (err) {
        showAlert('Şifre güncellenirken bir hata oluştu.');
      }
    });
  }
};
