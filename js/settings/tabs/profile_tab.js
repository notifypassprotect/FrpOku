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

    const getInitials = () => {
      const f = (stagedProfile.firstName || '').trim();
      const l = (stagedProfile.lastName || '').trim();
      const u = (stagedProfile.username || 'U').trim();
      if (f && l) return (f[0] + l[0]).toLocaleUpperCase('tr-TR');
      if (f) return f.slice(0, 2).toLocaleUpperCase('tr-TR');
      return u.slice(0, 2).toLocaleUpperCase('tr-TR');
    };

    const curAvatar = stagedProfile.avatar || '';
    let avatarPreviewInnerHtml = '';
    let avatarStatusText = 'Varsayılan Baş Harfler';
    if (curAvatar.startsWith('data:image/') || curAvatar.startsWith('http')) {
      avatarPreviewInnerHtml = `<img src="${escHtml(curAvatar)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      avatarStatusText = 'Özel Fotoğraf Yüklendi';
    } else if (curAvatar.trim()) {
      avatarPreviewInnerHtml = `<span style="font-size:2.3rem;line-height:1;">${escHtml(curAvatar)}</span>`;
      avatarStatusText = `Yönetici Avatarı (${escHtml(curAvatar)})`;
    } else {
      avatarPreviewInnerHtml = `<span>${escHtml(getInitials())}</span>`;
    }

    const PRESET_AVATARS = ['🦊', '🦁', '🐺', '🦅', '🚀', '⚡', '👑', '💻', '👔', '🧑‍💻', '👩‍💼', '🎨', '🛡️', '🎯', '💎', '🌟'];
    const presetButtonsHtml = PRESET_AVATARS.map(emoji => `
      <button type="button" class="btn-preset-avatar ${curAvatar === emoji ? 'active' : ''}" data-emoji="${emoji}" style="width:38px;height:38px;border-radius:50%;border:${curAvatar === emoji ? '2.5px solid var(--accent, #2563eb)' : '1px solid var(--border, #cbd5e1)'};background:${curAvatar === emoji ? 'rgba(37,99,235,0.14)' : 'var(--bg-surface, #ffffff)'};cursor:pointer;font-size:1.2rem;display:inline-flex;align-items:center;justify-content:center;transition:transform 0.15s, border-color 0.15s;padding:0;" title="${emoji}">
        ${emoji}
      </button>
    `).join('');

    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">Kullanıcı & Cihaz Profili</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
            Oturum güvenliği, yetkilendirme ve sunucu ortamı için kayıtlı profil bilgileri.
          </div>
        </div>

        <!-- Profil Resmi & Avatar Yönetim Kartı -->
        <div class="settings-card" style="display:flex; flex-direction:column; gap:1rem; border:1.5px solid var(--border); background:var(--bg-surface); padding:1.2rem; border-radius:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-light); padding-bottom:.5rem;">
            <div>
              <div style="font-weight:800; font-size:.95rem; color:var(--text-primary); display:flex; align-items:center; gap:.45rem;">
                <span>🖼️</span> Profil Resmi & Avatar Seçimi
              </div>
              <div style="font-size:.74rem; color:var(--text-muted); margin-top:2px;">
                Kişisel fotoğrafınızı yükleyip ölçeklendirin veya hazır kurumsal avatarlardan birini seçin.
              </div>
            </div>
            <span class="badge badge-purple" style="font-size:.7rem; font-weight:700;">Görünüm & Kimlik</span>
          </div>

          <div style="display:flex; align-items:center; gap:1.6rem; flex-wrap:wrap;">
            <!-- Canlı Yuvarlak Önizleme -->
            <div style="display:flex; flex-direction:column; align-items:center; gap:.45rem;">
              <div id="profAvatarPreviewWrap" style="width:82px; height:82px; border-radius:50%; border:3px solid var(--accent, #2563eb); box-shadow:0 8px 22px rgba(37,99,235,0.25); overflow:hidden; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #3b82f6, #6366f1); color:#ffffff; font-weight:800; font-size:1.85rem; user-select:none; flex-shrink:0;">
                ${avatarPreviewInnerHtml}
              </div>
              <span id="profAvatarStatusLabel" style="font-size:.72rem; font-weight:700; color:var(--text-muted); text-align:center;">
                ${avatarStatusText}
              </span>
            </div>

            <!-- Butonlar ve Hazır Avatarlar -->
            <div style="display:flex; flex-direction:column; gap:.75rem; flex:1; min-width:240px;">
              <div style="display:flex; gap:.65rem; flex-wrap:wrap; align-items:center;">
                <input type="file" id="profAvatarFileInput" accept="image/png, image/jpeg, image/webp, image/gif" style="display:none;" />
                <button type="button" id="btnUploadCustomAvatar" class="btn btn-sm btn-primary" style="font-weight:800; padding:.5rem 1.15rem; border-radius:9px; display:inline-flex; align-items:center; gap:.45rem; box-shadow:0 4px 12px rgba(37,99,235,0.25);">
                  <span>📸</span> Fotoğraf Yükle & Düzenle
                </button>
                <button type="button" id="btnResetAvatarInitials" class="btn btn-sm btn-ghost" style="font-weight:700; padding:.5rem 1rem; border-radius:9px; border:1px solid var(--border);">
                  ✨ Baş Harflere Sıfırla
                </button>
              </div>

              <!-- Hazır Yönetici Avatarları -->
              <div>
                <div style="font-size:.74rem; font-weight:700; color:var(--text-secondary); margin-bottom:.4rem;">
                  Veya Hazır Yönetici & Ekip Avatarlarından Birini Seçin:
                </div>
                <div style="display:flex; gap:.5rem; flex-wrap:wrap;" id="profPresetAvatarsWrap">
                  ${presetButtonsHtml}
                </div>
              </div>
            </div>
          </div>

          <!-- İnteraktif Görsel Düzenleme / Kırpma / Ölçekleme Alanı -->
          <div id="profAvatarCropSection" style="display:none; margin-top:.35rem; padding:1.1rem; border-radius:12px; background:var(--bg-raised, #f8fafc); border:1.5px dashed var(--accent, #2563eb); animation:fadeIn .2s ease-out;">
            <div style="font-weight:800; font-size:.85rem; color:var(--text-primary); margin-bottom:.6rem; display:flex; align-items:center; gap:.4rem;">
              <span>✂️</span> Fotoğrafınızı Konumlandırın & Ölçekleyin
            </div>
            <div style="display:flex; gap:1.4rem; align-items:center; flex-wrap:wrap;">
              <div style="position:relative; width:130px; height:130px; flex-shrink:0;">
                <canvas id="profAvatarCanvas" width="256" height="256" style="width:130px; height:130px; border-radius:50%; border:3px solid var(--accent, #2563eb); background:#0f172a; box-shadow:0 6px 18px rgba(0,0,0,0.2); display:block;"></canvas>
              </div>
              <div style="display:flex; flex-direction:column; gap:.65rem; flex:1; min-width:210px;">
                <label style="font-size:.74rem; font-weight:700; color:var(--text-secondary); display:flex; justify-content:space-between;">
                  <span>Ölçek / Yakınlaştırma</span>
                  <span id="profZoomVal" style="color:var(--accent); font-weight:800;">1.0x</span>
                </label>
                <input type="range" id="profAvatarZoom" min="0.8" max="3" step="0.05" value="1" style="width:100%; accent-color:var(--accent); cursor:pointer;" />
                <div style="font-size:.7rem; color:var(--text-muted); line-height:1.4;">
                  💡 Resim otomatik olarak kare oranına optimize edilir ve yüksek çözünürlüklü avatar olarak kaydedilir.
                </div>
                <div style="display:flex; gap:.65rem; margin-top:.2rem;">
                  <button type="button" id="btnApplyCroppedAvatar" class="btn btn-sm btn-primary" style="font-weight:800; padding:.45rem 1.25rem;">
                    ✓ Bu Resmi Kullan
                  </button>
                  <button type="button" id="btnCancelCropAvatar" class="btn btn-sm btn-ghost" style="font-weight:700; padding:.45rem 1rem;">
                    Vazgeç
                  </button>
                </div>
              </div>
            </div>
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

            <!-- Okunmamış Mesaj E-posta Bildirimi -->
            <div style="background:var(--bg-raised,#f8fafc);border:1px solid var(--border-light,#e2e8f0);border-radius:10px;padding:.75rem;margin-top:.35rem;">
              <label style="display:flex;align-items:flex-start;gap:.6rem;cursor:pointer;font-size:.82rem;font-weight:700;color:var(--text-primary,#0f172a);">
                <input type="checkbox" id="cbChatEmailDigest" ${stagedProfile.emailChatDigest !== false ? 'checked' : ''} style="width:17px;height:17px;accent-color:var(--accent,#2563eb);margin-top:2px;cursor:pointer;" />
                <div>
                  <div>💬 Okunmamış Mesajlar İçin E-Posta Bildirimi</div>
                  <div style="font-size:.7rem;color:var(--text-muted,#64748b);font-weight:normal;margin-top:2px;line-height:1.4;">
                    Mesaj aldığınızda 3-5 dakika boyunca okunmazsa e-posta kutunuza akıllı özet gönderilir (Anti-spam korumalı).
                  </div>
                </div>
              </label>
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
                <div style="font-size:.74rem; color:var(--text-muted);">Hesabınıza bağlı iletişim e-posta adresini 6 haneli doğrulama kodu ile güncelleyin</div>
              </div>
              <span class="badge badge-purple" style="font-weight:700; font-size:.7rem;">İletişim & Güvenlik</span>
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
              <button type="button" id="btnRequestEmailCode" class="btn btn-primary" style="padding:.55rem 1.35rem; font-weight:800; font-size:.84rem; border-radius:10px;">
                Doğrulama Kodu Gönder
              </button>
            </div>

            <!-- 6 Haneli Kod Onay Alanı -->
            <div id="emailVerificationSection" style="display:none; margin-top:.35rem; padding:.85rem 1rem; background:rgba(37,99,235,0.05); border:1.5px dashed var(--accent); border-radius:10px;">
              <div style="font-size:.82rem; font-weight:800; color:var(--text-primary); margin-bottom:.2rem;">
                Doğrulama Kodu Yeni Adresinize Gönderildi
              </div>
              <div style="font-size:.74rem; color:var(--text-muted); margin-bottom:.6rem;">
                Yeni e-posta gelen kutunuzu (ve spam klasörünü) kontrol edip 6 haneli kodu giriniz.
              </div>
              <div style="display:flex; gap:.65rem; align-items:center; flex-wrap:wrap;">
                <input type="text" id="profEmailVerificationCode" maxlength="6" class="master-search-input" style="width:140px; text-align:center; font-weight:800; font-size:1.15rem; letter-spacing:4px;" placeholder="123456" />
                <button type="button" id="btnConfirmEmailCode" class="btn btn-primary" style="padding:.55rem 1.25rem; font-weight:800; font-size:.82rem; border-radius:8px;">
                  Kodu Onayla ve Güncelle
                </button>
              </div>
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
                <input type="password" id="profNewPass" class="master-search-input" style="width:100%;" placeholder="En az 10 karakter" />
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

    // ── AVATAR VE PROFİL RESMİ YÖNETİMİ ──
    const avatarPreviewWrap = overlay.querySelector('#profAvatarPreviewWrap');
    const avatarStatusLabel = overlay.querySelector('#profAvatarStatusLabel');
    const presetBtns = overlay.querySelectorAll('.btn-preset-avatar');
    const fileInput = overlay.querySelector('#profAvatarFileInput');
    const btnUpload = overlay.querySelector('#btnUploadCustomAvatar');
    const btnReset = overlay.querySelector('#btnResetAvatarInitials');
    const cropSection = overlay.querySelector('#profAvatarCropSection');
    const canvas = overlay.querySelector('#profAvatarCanvas');
    const zoomInput = overlay.querySelector('#profAvatarZoom');
    const zoomVal = overlay.querySelector('#profZoomVal');
    const btnApplyCrop = overlay.querySelector('#btnApplyCroppedAvatar');
    const btnCancelCrop = overlay.querySelector('#btnCancelCropAvatar');

    const getInitials = () => {
      const f = (stagedProfile.firstName || '').trim();
      const l = (stagedProfile.lastName || '').trim();
      const u = (stagedProfile.username || 'U').trim();
      if (f && l) return (f[0] + l[0]).toLocaleUpperCase('tr-TR');
      if (f) return f.slice(0, 2).toLocaleUpperCase('tr-TR');
      return u.slice(0, 2).toLocaleUpperCase('tr-TR');
    };

    const updateAvatarUI = (avatarVal) => {
      if (!avatarPreviewWrap) return;
      if (avatarVal && (avatarVal.startsWith('data:image/') || avatarVal.startsWith('http'))) {
        avatarPreviewWrap.innerHTML = `<img src="${avatarVal}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
        if (avatarStatusLabel) avatarStatusLabel.textContent = 'Özel Fotoğraf Yüklendi';
      } else if (avatarVal && avatarVal.trim()) {
        avatarPreviewWrap.innerHTML = `<span style="font-size:2.3rem;line-height:1;">${avatarVal}</span>`;
        if (avatarStatusLabel) avatarStatusLabel.textContent = `Yönetici Avatarı (${avatarVal})`;
      } else {
        avatarPreviewWrap.innerHTML = `<span>${getInitials()}</span>`;
        if (avatarStatusLabel) avatarStatusLabel.textContent = 'Varsayılan Baş Harfler';
      }
    };

    presetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        stagedProfile.avatar = emoji;
        presetBtns.forEach(b => {
          const isActive = b.dataset.emoji === emoji;
          b.style.borderColor = isActive ? 'var(--accent, #2563eb)' : 'var(--border, #cbd5e1)';
          b.style.borderWidth = isActive ? '2.5px' : '1px';
          b.style.background = isActive ? 'rgba(37,99,235,0.14)' : 'var(--bg-surface, #ffffff)';
        });
        updateAvatarUI(emoji);
        if (cropSection) cropSection.style.display = 'none';
        markDirty();
      });
    });

    btnReset?.addEventListener('click', () => {
      stagedProfile.avatar = '';
      presetBtns.forEach(b => {
        b.style.borderColor = 'var(--border, #cbd5e1)';
        b.style.borderWidth = '1px';
        b.style.background = 'var(--bg-surface, #ffffff)';
      });
      updateAvatarUI('');
      if (cropSection) cropSection.style.display = 'none';
      markDirty();
      if (typeof safeToast === 'function') safeToast('Profil resmi baş harflere sıfırlandı.', 'info');
    });

    btnUpload?.addEventListener('click', () => {
      fileInput?.click();
    });

    let currentLoadedImg = null;
    const drawToCanvas = () => {
      if (!canvas || !currentLoadedImg) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const zoom = parseFloat(zoomInput?.value || '1');
      const imgW = currentLoadedImg.width;
      const imgH = currentLoadedImg.height;

      // Fit to cover square
      const minDim = Math.min(imgW, imgH);
      const cropW = (minDim / zoom);
      const cropH = (minDim / zoom);
      const startX = (imgW - cropW) / 2;
      const startY = (imgH - cropH) / 2;

      ctx.save();
      // Circular clipping
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      ctx.drawImage(currentLoadedImg, startX, startY, cropW, cropH, 0, 0, w, h);
      ctx.restore();
    };

    fileInput?.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        if (typeof safeToast === 'function') safeToast('Lütfen geçerli bir görsel dosyası seçin.', 'warning');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          currentLoadedImg = img;
          if (cropSection) cropSection.style.display = 'block';
          if (zoomInput) zoomInput.value = '1';
          if (zoomVal) zoomVal.textContent = '1.0x';
          drawToCanvas();
          canvas?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    });

    zoomInput?.addEventListener('input', (e) => {
      if (zoomVal) zoomVal.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
      drawToCanvas();
    });

    btnApplyCrop?.addEventListener('click', () => {
      if (!canvas || !currentLoadedImg) return;
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        stagedProfile.avatar = dataUrl;
        presetBtns.forEach(b => {
          b.style.borderColor = 'var(--border, #cbd5e1)';
          b.style.borderWidth = '1px';
          b.style.background = 'var(--bg-surface, #ffffff)';
        });
        updateAvatarUI(dataUrl);
        if (cropSection) cropSection.style.display = 'none';
        markDirty();
        if (typeof safeToast === 'function') safeToast('Özel profil fotoğrafı seçildi. Değişiklikleri kaydetmeyi unutmayın.', 'success');
      } catch (err) {
        if (typeof safeToast === 'function') safeToast('Fotoğraf işlenemedi: ' + err.message, 'error');
      }
    });

    btnCancelCrop?.addEventListener('click', () => {
      if (cropSection) cropSection.style.display = 'none';
      currentLoadedImg = null;
    });

    const cbDigest = overlay.querySelector('#cbChatEmailDigest');
    if (cbDigest) {
      cbDigest.addEventListener('change', () => {
        stagedProfile.emailChatDigest = cbDigest.checked;
        markDirty();
      });
    }

    // E-Posta Güvenli Güncelle (6 Haneli Doğrulama Kodu ile)
    const emailInput = overlay.querySelector('#profNewEmail');
    const passInput = overlay.querySelector('#profEmailCurrentPass');
    const alertEl = overlay.querySelector('#profileEmailAlert');
    const displayEl = overlay.querySelector('#profEmailDisplay');
    const verifySection = overlay.querySelector('#emailVerificationSection');
    const codeInput = overlay.querySelector('#profEmailVerificationCode');

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
        alertEl.style.background = 'rgba(37, 99, 235, 0.12)';
        alertEl.style.color = '#2563eb';
        alertEl.style.border = '1px solid rgba(37, 99, 235, 0.3)';
      }
    };

    overlay.querySelector('#btnRequestEmailCode')?.addEventListener('click', async () => {
      const newEmail = (emailInput?.value || '').trim();
      const currentPass = (passInput?.value || '').trim();

      if (!newEmail || !newEmail.includes('@')) {
        showEmailAlert('Lütfen geçerli bir yeni e-posta adresi giriniz.', 'error');
        return;
      }

      if (!currentPass) {
        showEmailAlert('Güvenliğiniz için lütfen mevcut şifrenizi giriniz.', 'error');
        return;
      }

      const btnReq = overlay.querySelector('#btnRequestEmailCode');
      if (btnReq) { btnReq.disabled = true; btnReq.textContent = 'Kod Gönderiliyor...'; }

      try {
        if (window.FrpAuth?.requestEmailChange) {
          const res = await window.FrpAuth.requestEmailChange(newEmail, currentPass);
          if (btnReq) { btnReq.disabled = false; btnReq.textContent = 'Doğrulama Kodu Gönder'; }

          if (res.success) {
            if (verifySection) verifySection.style.display = 'block';
            showEmailAlert(res.message || '6 haneli doğrulama kodu yeni adresinize gönderildi. Lütfen kodu girin.', 'info');
            safeToast('Doğrulama kodu e-postanıza gönderildi.', 'info');
            if (codeInput) codeInput.focus();
          } else {
            showEmailAlert(res.reason || 'Doğrulama kodu gönderilemedi.', 'error');
          }
        } else {
          if (btnReq) { btnReq.disabled = false; btnReq.textContent = 'Doğrulama Kodu Gönder'; }
          showEmailAlert('E-posta doğrulama servisi henüz hazır değil.', 'error');
        }
      } catch (err) {
        if (btnReq) { btnReq.disabled = false; btnReq.textContent = 'Doğrulama Kodu Gönder'; }
        showEmailAlert('Hata: ' + err.message, 'error');
      }
    });

    overlay.querySelector('#btnConfirmEmailCode')?.addEventListener('click', async () => {
      const code = (codeInput?.value || '').trim();
      if (!code || code.length !== 6) {
        showEmailAlert('Lütfen 6 haneli doğrulama kodunu eksiksiz giriniz.', 'error');
        return;
      }

      const btnConf = overlay.querySelector('#btnConfirmEmailCode');
      if (btnConf) { btnConf.disabled = true; btnConf.textContent = 'Onaylanıyor...'; }

      try {
        if (window.FrpAuth?.confirmEmailChange) {
          const res = await window.FrpAuth.confirmEmailChange(code);
          if (btnConf) { btnConf.disabled = false; btnConf.textContent = 'Kodu Onayla ve Güncelle'; }

          if (res.success) {
            const updatedEmail = res.email || (emailInput?.value || '').trim();
            stagedProfile.email = updatedEmail;
            if (displayEl) displayEl.value = updatedEmail;
            if (emailInput) emailInput.value = '';
            if (passInput) passInput.value = '';
            if (codeInput) codeInput.value = '';
            if (verifySection) verifySection.style.display = 'none';

            showEmailAlert('E-posta adresiniz başarıyla güncellendi!', 'success');
            safeToast('E-posta adresiniz başarıyla güncellendi!', 'success');
          } else {
            showEmailAlert(res.reason || 'Geçersiz veya süresi dolmuş kod.', 'error');
          }
        } else {
          if (btnConf) { btnConf.disabled = false; btnConf.textContent = 'Kodu Onayla ve Güncelle'; }
          showEmailAlert('E-posta onay servisi hazır değil.', 'error');
        }
      } catch (err) {
        if (btnConf) { btnConf.disabled = false; btnConf.textContent = 'Kodu Onayla ve Güncelle'; }
        showEmailAlert('Hata: ' + err.message, 'error');
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

      if (newPass.length < 10) {
        showAlert('Yeni şifreniz en az 10 karakter uzunluğunda olmalıdır.', 'warning');
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
          const mailFailed = res.notification?.email?.sent === false;
          const message = res.message || 'Şifreniz başarıyla değiştirildi.';
          showAlert(message, mailFailed ? 'warning' : 'success');
          safeToast(message, mailFailed ? 'warning' : 'success');
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
