// ============================================================
//  mail_tab.js — E-posta & SMTP Altyapısı Yönetimi (Admin Sekmesi)
// ============================================================

window.FrpSettingsTabs = window.FrpSettingsTabs || {};

window.FrpSettingsTabs.mail = {
  render({ escHtml }) {
    return `
      <div style="display:flex;flex-direction:column;gap:1.25rem;">
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">✉️ E-posta & SMTP Sistem Sağlığı</div>
          <div style="font-size:.78rem;color:var(--text-muted);margin-top:.2rem;">
            Sunucu e-posta gönderim altyapısını, SMTP bağlantı durumunu ve bildirim istatistiklerini izleyin.
          </div>
        </div>

        <div id="settingsMailTabBody" style="display:flex;flex-direction:column;gap:1rem;">
          <div style="text-align:center;padding:3rem 1rem;color:var(--text-muted);">
            <div class="splash-spinner" style="margin:0 auto 1rem;"></div>
            <div>E-posta sunucusu ve SMTP bağlantısı kontrol ediliyor...</div>
          </div>
        </div>
      </div>
    `;
  },

  async bind({ overlay, escHtml, safeToast }) {
    const container = overlay.querySelector('#settingsMailTabBody');
    if (!container) return;

    const headers = (window.FrpAuth && typeof window.FrpAuth.getAuthHeaders === 'function') ? window.FrpAuth.getAuthHeaders() : {};

    try {
      const [mailRes, healthRes] = await Promise.all([
        fetch('/api/admin/mail/status', { headers }).then(r => r.json()).catch(() => ({})),
        fetch('/api/admin/system-health', { headers }).then(r => r.json()).catch(() => ({}))
      ]);

      const mail = mailRes.mail || {};
      const ready = mail.enabled && mail.configured && mail.verified === true;
      const mailStats = mailRes.stats || { total: 0, successful: 0, failed: 0, lastSentAt: null };

      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;">
          <!-- Durum Kartı -->
          <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
            <div style="font-weight:800;font-size:.88rem;color:var(--text-primary);border-bottom:1px solid var(--border-light);padding-bottom:.4rem;display:flex;align-items:center;justify-content:space-between;">
              <span>SMTP Sunucu Bağlantısı</span>
              <span class="badge ${ready ? 'badge-green' : 'badge-red'}" style="font-size:.72rem;">
                ${ready ? '● Bağlantı Aktif' : '○ Devre Dışı / Yapılandırılmadı'}
              </span>
            </div>

            <div style="display:flex;flex-direction:column;gap:.4rem;font-size:.82rem;">
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-muted);">SMTP Sunucusu:</span>
                <span style="font-weight:700;">${escHtml(mail.host || 'Tanımsız')}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-muted);">Port / Güvenlik:</span>
                <span style="font-weight:700;">${escHtml(mail.port || '587')} · ${mail.secure ? 'SSL/TLS' : 'STARTTLS'}</span>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-muted);">Gönderici Adresi:</span>
                <span style="font-weight:700;">${escHtml(mail.from || 'Tanımsız')}</span>
              </div>
            </div>

            <!-- Test Gönderim Butonu -->
            <div style="margin-top:.5rem;padding-top:.75rem;border-top:1px solid var(--border-light);display:flex;align-items:center;gap:.6rem;">
              <input type="email" id="tbMailTestTarget" class="master-search-input" placeholder="Test e-posta adresi..." style="flex:1;font-size:.82rem;padding:.4rem .65rem;" />
              <button type="button" id="btnSendTestEmail" class="btn btn-sm btn-primary" style="font-weight:700;padding:.45rem .85rem;white-space:nowrap;">
                📧 Test Gönder
              </button>
            </div>
          </div>

          <!-- İstatistik Kartı -->
          <div class="settings-card" style="display:flex;flex-direction:column;gap:.75rem;">
            <div style="font-weight:800;font-size:.88rem;color:var(--text-primary);border-bottom:1px solid var(--border-light);padding-bottom:.4rem;">
              Gönderim İstatistikleri & Özet
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;">
              <div style="background:var(--bg-raised);padding:.6rem .8rem;border-radius:8px;text-align:center;">
                <div style="font-size:1.3rem;font-weight:800;color:var(--green);">${mailStats.successful || 0}</div>
                <div style="font-size:.7rem;color:var(--text-muted);margin-top:2px;">Başarılı Teslimat</div>
              </div>
              <div style="background:var(--bg-raised);padding:.6rem .8rem;border-radius:8px;text-align:center;">
                <div style="font-size:1.3rem;font-weight:800;color:var(--red);">${mailStats.failed || 0}</div>
                <div style="font-size:.7rem;color:var(--text-muted);margin-top:2px;">Başarısız Gönderim</div>
              </div>
            </div>

            <div style="font-size:.75rem;color:var(--text-muted);margin-top:.3rem;">
              <div>Son Gönderim: <strong>${mailStats.lastSentAt ? new Date(mailStats.lastSentAt).toLocaleString('tr-TR') : 'Henüz gönderim yapılmadı'}</strong></div>
              <div style="margin-top:4px;">Kullanıcı onay bildirimleri, şifre sıfırlama linkleri ve okunmamış sohbet özetleri otomatik yönetilir.</div>
            </div>
          </div>
        </div>
      `;

      // Test e-posta gönderimi
      const btnTest = container.querySelector('#btnSendTestEmail');
      const targetInput = container.querySelector('#tbMailTestTarget');

      if (btnTest && targetInput) {
        btnTest.addEventListener('click', async () => {
          const to = targetInput.value.trim();
          if (!to) {
            safeToast('Lütfen hedef e-posta adresini girin.', 'warning');
            return;
          }

          btnTest.disabled = true;
          btnTest.textContent = 'Gönderiliyor...';

          try {
            const res = await fetch('/api/admin/mail/test', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({ to })
            });
            const data = await res.json();
            if (data && data.success) {
              safeToast(`"${to}" adresine test e-postası başarıyla ulaştırıldı.`, 'success');
            } else {
              safeToast(data?.reason || 'Test e-postası gönderilemedi.', 'error');
            }
          } catch (err) {
            safeToast('Hata: ' + err.message, 'error');
          } finally {
            btnTest.disabled = false;
            btnTest.textContent = '📧 Test Gönder';
          }
        });
      }

    } catch (err) {
      container.innerHTML = `<div style="text-align:center;padding:2rem;color:#ef4444;font-weight:700;">E-posta bilgileri yüklenemedi: ${escHtml(err.message)}</div>`;
    }
  }
};
