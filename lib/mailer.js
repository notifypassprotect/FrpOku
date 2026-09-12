const nodemailer = require('nodemailer');

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function createMailTemplates({ appName = 'FrpOku', baseUrl = '' } = {}) {
  const loginUrl = String(baseUrl || '').replace(/\/$/, '') || '#';

  const baseHeader = (title = appName) => `
    <div style="background:linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);color:#ffffff;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;border-radius:16px 16px 0 0;">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">${escapeHtml(appName)}</div>
      <div style="font-size:12px;font-weight:700;background:rgba(255,255,255,0.2);padding:4px 12px;border-radius:20px;">Kurumsal Portal</div>
    </div>
  `;

  const baseFooter = () => `
    <div style="border-top:1px solid #e2e8f0;padding:20px 28px;background:#f8fafc;border-radius:0 0 16px 16px;font-size:12px;color:#64748b;line-height:1.5;">
      <p style="margin:0 0 6px;">Bu e-posta <strong>${escapeHtml(appName)}</strong> sistemi tarafından otomatik olarak oluşturulmuştur.</p>
      <p style="margin:0;">Lütfen bu mesaja doğrudan yanıt vermeyiniz. Sorularınız için kurum bilgi işlem yöneticinizle iletişime geçiniz.</p>
    </div>
  `;

  return {
    accountApproved(data = {}) {
      const fullName = escapeHtml(data.fullName || data.username || 'Kullanıcı');
      const username = escapeHtml(data.username || '');
      return {
        subject: `${appName} hesabınız onaylandı`,
        text: `Merhaba ${data.fullName || data.username || 'Kullanıcı'},\n\n${appName} hesabınız sistem yöneticisi tarafından onaylandı ve kullanıma açıldı.${data.username ? `\nKullanıcı adınız: ${data.username}` : ''}\n\nGiriş: ${loginUrl}\n\nBu işlemi beklemiyorsanız sistem yöneticinizle iletişime geçin.`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <h1 style="font-size:20px;margin:0 0 16px;color:#0f172a;">Hesabınız Onaylandı</h1>
        <p>Merhaba <strong>${fullName}</strong>,</p>
        <p>${escapeHtml(appName)} kurumsal rapor kütüphanesine erişim başvurunuz sistem yöneticisi tarafından incelenmiş ve hesabınız <strong>onaylanarak aktifleştirilmiştir</strong>.</p>
        ${username ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin:18px 0;font-size:14px;">Kullanıcı Adınız: <strong style="color:#2563eb;font-family:monospace;">@${username}</strong></div>` : ''}
        <p style="margin:24px 0;"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">Sisteme Giriş Yap</a></p>
        <p style="font-size:13px;color:#64748b;">Giriş yaptıktan sonra şifrenizi profil ayarlarından güncelleyebilir veya kişisel çalışma alanınıza başlayabilirsiniz.</p>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    emailChangeCode(data = {}) {
      const code = escapeHtml(data.code || '');
      const fullName = escapeHtml(data.fullName || 'Kullanıcı');
      const expiresIn = data.expiresIn || '15';
      return {
        subject: `${code} — ${appName} e-posta doğrulama kodunuz`,
        text: `Merhaba ${data.fullName || 'Kullanıcı'},\n\n${appName} hesabınızın e-posta adresini güncellemek için güvenlik doğrulama kodunuz: ${code}\n\nBu kod ${expiresIn} dakika geçerlidir.\n\nBu işlemi siz başlatmadıysanız lütfen şifrenizi değiştirin ve sistem yöneticinizle iletişime geçin.`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <h1 style="font-size:20px;margin:0 0 14px;color:#0f172a;">E-Posta Değişikliği Doğrulama Kodu</h1>
        <p>Merhaba <strong>${fullName}</strong>,</p>
        <p>${escapeHtml(appName)} hesabınıza bu e-posta adresini bağlamak için aşağıdaki tek kullanımlık güvenlik kodunu arayüzdeki kutucuğa giriniz:</p>
        
        <div style="text-align:center;margin:28px 0;">
          <div style="display:inline-block;background:#f8fafc;border:2px dashed #3b82f6;border-radius:14px;padding:16px 36px;">
            <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:900;letter-spacing:8px;color:#1e40af;">${code}</span>
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:8px;">Bu kod <strong>${escapeHtml(expiresIn)} dakika</strong> boyunca geçerlidir.</div>
        </div>

        <div style="background:rgba(239,68,68,0.06);border-left:4px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin-top:20px;">
          <strong style="color:#b91c1c;font-size:13px;">Güvenlik Uyarısı:</strong>
          <div style="font-size:12.5px;color:#7f1d1d;margin-top:4px;">Bu e-posta değişikliği talebini siz yapmadıysanız, hesabınızın güvenliği için derhal şifrenizi güncelleyiniz ve sistem yöneticinizle iletişime geçiniz.</div>
        </div>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    emailChangedNotice(data = {}) {
      const fullName = escapeHtml(data.fullName || 'Kullanıcı');
      const newEmail = escapeHtml(data.newEmail || '');
      const time = escapeHtml(data.timestamp || new Date().toLocaleString('tr-TR'));
      const ip = escapeHtml(data.ip || '-');
      return {
        subject: `${appName} hesap e-posta adresiniz güncellendi`,
        text: `Merhaba ${data.fullName || 'Kullanıcı'},\n\n${appName} hesabınızın iletişim e-posta adresi '${data.newEmail}' olarak güncellenmiştir.\nTarih: ${time}\nIP: ${ip}\n\nBu işlemi siz yapmadıysanız lütfen derhal sistem yöneticinizle iletişime geçin.`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <h1 style="font-size:19px;margin:0 0 14px;color:#0f172a;">E-Posta Adresiniz Güncellendi</h1>
        <p>Merhaba <strong>${fullName}</strong>,</p>
        <p>${escapeHtml(appName)} hesabınıza bağlı iletişim e-posta adresi başarıyla değiştirildi.</p>
        
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;margin:20px 0;font-size:13.5px;">
          <div>Yeni E-Posta: <strong>${newEmail}</strong></div>
          <div style="margin-top:4px;color:#64748b;">İşlem Zamanı: ${time}</div>
          <div style="margin-top:4px;color:#64748b;">İstemci IP: ${ip}</div>
        </div>

        <div style="background:rgba(239,68,68,0.06);border-left:4px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;">
          <strong style="color:#b91c1c;font-size:13px;">Bu işlemi siz yapmadınız mı?</strong>
          <div style="font-size:12.5px;color:#7f1d1d;margin-top:4px;">Hesabınız başka bir kullanıcı tarafından ele geçirilmiş olabilir. Lütfen vakit kaybetmeden sistem yöneticinizle irtibata geçiniz.</div>
        </div>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    passwordChanged(data = {}) {
      const fullName = escapeHtml(data.fullName || data.username || 'Kullanıcı');
      const time = escapeHtml(data.timestamp || new Date().toLocaleString('tr-TR'));
      const ip = escapeHtml(data.ip || '-');
      return {
        subject: `${appName} şifreniz başarıyla değiştirildi`,
        text: `Merhaba ${data.fullName || data.username || 'Kullanıcı'},\n\n${appName} hesabınızın şifresi başarıyla güncellenmiştir.\nTarih: ${time}\nIP: ${ip}\n\nBu işlemi siz yapmadıysanız lütfen derhal sistem yöneticinizle iletişime geçin.`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <h1 style="font-size:20px;margin:0 0 14px;color:#0f172a;">Şifreniz Güncellendi</h1>
        <p>Merhaba <strong>${fullName}</strong>,</p>
        <p>${escapeHtml(appName)} hesabınızın giriş şifresi başarıyla değiştirildi.</p>
        
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;margin:18px 0;font-size:13.5px;">
          <div>İşlem Zamanı: <strong>${time}</strong></div>
          <div style="margin-top:4px;color:#64748b;">İstemci IP Adresi: ${ip}</div>
        </div>

        <div style="background:rgba(239,68,68,0.06);border-left:4px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;">
          <strong style="color:#b91c1c;font-size:13px;">Bu işlemi siz yapmadıysanız:</strong>
          <div style="font-size:12.5px;color:#7f1d1d;margin-top:4px;">Hesap güvenliğiniz risk altında olabilir. Lütfen derhal sistem yöneticinize haber veriniz.</div>
        </div>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    accountStatusChanged(data = {}) {
      const fullName = escapeHtml(data.fullName || data.username || 'Kullanıcı');
      const action = data.action || 'frozen'; // 'frozen' | 'activated' | 'rejected'
      let title = 'Hesap Durumunuz Güncellendi';
      let message = '';
      let badgeColor = '#f59e0b';
      let badgeText = 'Güncellendi';

      if (action === 'frozen') {
        title = 'Hesabınız Donduruldu';
        message = `${escapeHtml(appName)} hesabınız sistem yöneticisi tarafından geçici olarak <strong>dondurulmuştur</strong>. İkinci bir bildirime kadar sisteme giriş yapamazsınız.`;
        badgeColor = '#3b82f6';
        badgeText = 'Donduruldu';
      } else if (action === 'activated') {
        title = 'Hesabınız Yeniden Aktifleştirildi';
        message = `${escapeHtml(appName)} hesabınız sistem yöneticisi tarafından yeniden <strong>aktifleştirilmiştir</strong>. Sisteme giriş yapabilirsiniz.`;
        badgeColor = '#10b981';
        badgeText = 'Aktif';
      } else if (action === 'rejected') {
        title = 'Kayıt Başvurunuz Reddedildi';
        message = `${escapeHtml(appName)} kayıt başvurunuz sistem yöneticisi tarafından incelenmiş ve <strong>onaylanmamıştır</strong>.`;
        badgeColor = '#ef4444';
        badgeText = 'Reddedildi';
      }

      return {
        subject: `${title} — ${appName}`,
        text: `Merhaba ${data.fullName || data.username || 'Kullanıcı'},\n\n${title}\n\n${message.replace(/<[^>]+>/g, '')}\n\nSorularınız için sistem yöneticinizle iletişime geçebilirsiniz.`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h1 style="font-size:20px;margin:0;color:#0f172a;">${title}</h1>
          <span style="background:${badgeColor};color:#ffffff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;">${badgeText}</span>
        </div>
        <p>Merhaba <strong>${fullName}</strong>,</p>
        <p>${message}</p>
        ${action === 'activated' ? `<p style="margin:24px 0;"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;">Giriş Yap</a></p>` : ''}
        <p style="font-size:13px;color:#64748b;margin-top:20px;">Sorularınız veya detaylı bilgi için kurum bilgi işlem sorumlunuzla iletişime geçebilirsiniz.</p>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    securityAlert(data = {}) {
      const identifier = escapeHtml(data.identifier || 'Bilinmiyor');
      const ip = escapeHtml(data.ip || 'Bilinmiyor');
      const attempts = escapeHtml(data.attempts || '5');
      const time = escapeHtml(data.timestamp || new Date().toLocaleString('tr-TR'));
      return {
        subject: `GÜVENLİK ALARMI: ${appName} başarısız giriş denemeleri tespit edildi`,
        text: `DİKKAT YÖNETİCİ:\n\n${appName} sisteminde '@${data.identifier}' hesabı için ardışık ${data.attempts} kez hatalı şifre denemesi yapıldı.\nIP: ${data.ip}\nZaman: ${time}\n\nOlası bir yetkisiz giriş denemesine karşı güvenlik önlemleri alınmıştır.`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      <div style="background:linear-gradient(135deg, #b91c1c 0%, #ef4444 100%);color:#ffffff;padding:24px 28px;border-radius:16px 16px 0 0;">
        <div style="font-size:20px;font-weight:800;letter-spacing:0.5px;">GÜVENLİK ALARMI</div>
        <div style="font-size:13px;opacity:0.9;margin-top:4px;">${escapeHtml(appName)} Yetkisiz Giriş Koruması</div>
      </div>
      <div style="padding:28px;line-height:1.65;">
        <h2 style="font-size:18px;margin:0 0 14px;color:#991b1b;">Ardışık Başarısız Giriş Denemesi</h2>
        <p>Sayın Sistem Yöneticisi,</p>
        <p>Sistemde kayıtlı bir kullanıcı hesabı için ardışık olarak <strong>${attempts} kez başarısız oturum açma</strong> denemesi tespit edilmiştir:</p>
        
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 20px;margin:18px 0;font-size:13.5px;color:#991b1b;">
          <div>Hedef Hesap: <strong>@${identifier}</strong></div>
          <div style="margin-top:6px;">Kaynak IP Adresi: <strong>${ip}</strong></div>
          <div style="margin-top:6px;">Hatalı Deneme Sayısı: <strong>${attempts}</strong></div>
          <div style="margin-top:6px;">Algılanma Zamanı: ${time}</div>
        </div>

        <p style="font-size:13px;color:#64748b;">İlgili IP adresi için Captcha güvenlik doğrulaması devreye sokulmuş ve geçici hız sınırlaması uygulanmıştır. Gerekirse yönetim panelinden kullanıcı hesabını inceleyebilir veya dondurabilirsiniz.</p>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    systemDigest(data = {}) {
      const stats = data.stats || {};
      const time = escapeHtml(data.timestamp || new Date().toLocaleString('tr-TR'));
      return {
        subject: `${appName} Yönetici Sistem & Havuz Durum Özeti`,
        text: `SAYIN YÖNETİCİ,\n\n${appName} Sistem Durumu:\n- Toplam Kullanıcı: ${stats.totalUsers || 0}\n- Onay Bekleyen: ${stats.pendingUsers || 0}\n- Dondurulmuş Hesap: ${stats.frozenUsers || 0}\n- Toplam Rapor: ${stats.totalReports || 0}\n- Ortak Havuz Raporları: ${stats.poolReports || 0}\n\nZaman: ${time}`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <h1 style="font-size:20px;margin:0 0 8px;color:#0f172a;">Sistem & Havuz Durum Özeti</h1>
        <div style="font-size:12.5px;color:#64748b;margin-bottom:20px;">Raporlama Zamanı: ${time}</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Toplam Kullanıcı</div>
            <div style="font-size:24px;font-weight:800;color:#2563eb;margin-top:4px;">${escapeHtml(stats.totalUsers || 0)}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Onay Bekleyen Başvuru</div>
            <div style="font-size:24px;font-weight:800;color:#f59e0b;margin-top:4px;">${escapeHtml(stats.pendingUsers || 0)}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Toplam Kayıtlı Rapor</div>
            <div style="font-size:24px;font-weight:800;color:#0f172a;margin-top:4px;">${escapeHtml(stats.totalReports || 0)}</div>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Ortak Havuz Katkısı</div>
            <div style="font-size:24px;font-weight:800;color:#10b981;margin-top:4px;">${escapeHtml(stats.poolReports || 0)}</div>
          </div>
        </div>

        <p style="margin:20px 0 0;"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:700;font-size:13px;">Yönetici Paneline Git</a></p>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    unreadMessageDigest(data = {}) {
      const recipientName = escapeHtml(data.recipientName || data.fullName || 'Kullanıcı');
      const senderName = escapeHtml(data.senderName || 'Bir ekip arkadaşınız');
      const unreadCount = parseInt(data.unreadCount, 10) || 1;
      const snippet = escapeHtml(data.lastMessageSnippet || 'Yeni bir mesajınız var.');
      const countBadge = unreadCount > 1 ? `${unreadCount} Yeni Mesajınız Var` : `1 Yeni Mesajınız Var`;
      const time = escapeHtml(data.timestamp || new Date().toLocaleString('tr-TR'));

      return {
        subject: `💬 ${countBadge} — ${appName} Ekip Sohbeti`,
        text: `Merhaba ${data.recipientName || 'Kullanıcı'},\n\n${appName} platformunda ${data.senderName || 'ekip arkadaşınız'} tarafından size gönderilen okunmamış mesajlarınız bulunmaktadır.\n\nSon Mesaj: "${data.lastMessageSnippet || ''}"\n\nOkumak ve yanıtlamak için sisteme giriş yapın: ${loginUrl}`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <div style="display:inline-flex;align-items:center;gap:6px;background:#eff6ff;color:#2563eb;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:12px;">
          <span>💬</span> <span>Ekip Sohbeti Bildirimi</span>
        </div>
        <h1 style="font-size:20px;margin:0 0 12px;color:#0f172a;">${countBadge}</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#334155;">Merhaba <strong>${recipientName}</strong>,</p>
        <p style="margin:0 0 16px;font-size:14px;color:#334155;">
          <strong>${senderName}</strong> tarafından size gönderilen ve henüz okumadığınız mesaj(lar) bulunmaktadır:
        </p>

        <div style="background:#f8fafc;border-left:4px solid #2563eb;border-radius:0 12px 12px 0;padding:16px 20px;margin:20px 0;">
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px;">Son İleti Özeti</div>
          <div style="font-size:14px;color:#1e293b;font-style:italic;line-height:1.5;">"${snippet}"</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:8px;">Tarih: ${time}</div>
        </div>

        <p style="margin:24px 0 0;">
          <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
            Sohbete Git ve Yanıtla
          </a>
        </p>
        <p style="font-size:12px;color:#94a3b8;margin-top:20px;">
          Bu bildirimleri profil ayarlarınızdan dilediğiniz zaman kapatabilirsiniz.
        </p>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    emergencyRecoveryKeys(data = {}) {
      const fullName = escapeHtml(data.fullName || data.username || 'Kullanıcı');
      const username = escapeHtml(data.username || '');
      const keys = Array.isArray(data.keys) ? data.keys : [];
      const keysHtml = keys.map((k, i) => `
        <div style="background:#f8fafc;border:1.5px dashed #3b82f6;border-radius:8px;padding:10px 14px;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:800;color:#1e40af;letter-spacing:1px;display:flex;align-items:center;justify-content:space-between;">
          <span>Anahtar #${i + 1}:</span>
          <span>${escapeHtml(k)}</span>
        </div>
      `).join('');

      return {
        subject: `🔑 ${appName} Acil Erişim & Kurtarma Anahtarlarınız`,
        text: `Merhaba ${data.fullName || 'Kullanıcı'},\n\n${appName} hesabınız için 4 adet tek kullanımlık Acil Erişim Anahtarı oluşturuldu:\n\n${keys.map((k, i) => `#${i + 1}: ${k}`).join('\n')}\n\nBu anahtarları güvenli bir yerde saklayınız. Şifrenizi unutmanız veya e-postanıza erişememeniz durumunda bu anahtarlarla hesabınızı anında kurtarabilirsiniz.\n\nGiriş: ${loginUrl}`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <div style="display:inline-flex;align-items:center;gap:6px;background:#fef3c7;color:#b45309;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:12px;">
          <span>🔑</span> <span>Yüksek Güvenlik Önlemi</span>
        </div>
        <h1 style="font-size:20px;margin:0 0 12px;color:#0f172a;">Acil Erişim & Kurtarma Anahtarlarınız</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#334155;">Merhaba <strong>${fullName}</strong>,</p>
        <p style="margin:0 0 16px;font-size:14px;color:#334155;">
          ${escapeHtml(appName)} hesabınız için <strong>4 adet tek kullanımlık acil kurtarma anahtarı</strong> üretilmiştir.
        </p>

        <div style="display:flex;flex-direction:column;gap:8px;margin:20px 0;">
          ${keysHtml}
        </div>

        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin:18px 0;font-size:13px;color:#92400e;line-height:1.5;">
          <strong>Önemli Güvenlik Notu:</strong> Şifrenizi unutursanız veya e-postanıza/yöneticinize erişemezseniz bu anahtarlardan herhangi birini kullanarak şifrenizi anında sıfırlayabilirsiniz. Her anahtar yalnızca 1 kez kullanılabilir.
        </div>

        <p style="margin:20px 0 0;"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 24px;border-radius:8px;font-weight:700;font-size:14px;">Giriş Portalı</a></p>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    passwordResetByAdmin(data = {}) {
      const fullName = escapeHtml(data.fullName || data.username || 'Kullanıcı');
      const username = escapeHtml(data.username || '');
      const time = escapeHtml(data.timestamp || new Date().toLocaleString('tr-TR'));
      return {
        subject: `${appName} — Hesabınızın Şifresi Yönetici Tarafından Sıfırlandı`,
        text: `Merhaba ${data.fullName || data.username || 'Kullanıcı'},\n\n${appName} hesabınızın giriş şifresi sistem yöneticisi tarafından sıfırlandı.\n\nKullanıcı Adı: ${data.username || ''}\n\nGeçici şifrenizi yöneticinizden güvenli bir iletişim kanalıyla alınız. Güvenlik nedeniyle parola e-posta içinde gönderilmez.\n\nGiriş: ${loginUrl}`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <h1 style="font-size:20px;margin:0 0 14px;color:#0f172a;">Şifreniz Sıfırlandı</h1>
        <p>Merhaba <strong>${fullName}</strong>,</p>
        <p>${escapeHtml(appName)} kurumsal portal hesabınızın giriş şifresi sistem yöneticisi tarafından güncellenmiştir.</p>
        
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px 20px;margin:20px 0;">
          ${username ? `<div style="font-size:13.5px;color:#64748b;margin-bottom:8px;">Kullanıcı Adı: <strong style="color:#0f172a;font-family:monospace;font-size:14px;">@${username}</strong></div>` : ''}
          <div style="font-size:13.5px;color:#334155;">Geçici şifrenizi yöneticinizden güvenli bir iletişim kanalıyla alınız. Güvenlik nedeniyle parola e-posta içinde gönderilmez.</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:10px;">Sıfırlama Zamanı: ${time}</div>
        </div>

        <p style="margin:24px 0;">
          <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">Sisteme Giriş Yap</a>
        </p>

        <p style="font-size:13px;color:#64748b;">Güvenliğiniz için sisteme giriş yaptıktan sonra profil ayarlarınızdan şifrenizi kendinize özel yeni bir şifre ile değiştirmeniz önerilir.</p>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    selfServiceResetCode(data = {}) {
      const code = escapeHtml(data.code || '');
      const fullName = escapeHtml(data.fullName || data.username || 'Kullanıcı');
      const expiresIn = data.expiresIn || '15';
      return {
        subject: `${code} — ${appName} şifre sıfırlama doğrulama kodunuz`,
        text: `Merhaba ${data.fullName || data.username || 'Kullanıcı'},\n\n${appName} hesabınız için şifre sıfırlama talebinde bulundunuz.\n\nDoğrulama Kodunuz: ${code}\n\nBu kod ${expiresIn} dakika geçerlidir.\n\nBu talebi siz yapmadıysanız lütfen bu mesajı dikkate almayınız.`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <h1 style="font-size:20px;margin:0 0 14px;color:#0f172a;">Şifre Sıfırlama Kodu</h1>
        <p>Merhaba <strong>${fullName}</strong>,</p>
        <p>${escapeHtml(appName)} hesabınızın şifresini yenilemek için talepte bulundunuz. Aşağıdaki 6 haneli güvenlik kodunu şifre sıfırlama ekranına giriniz:</p>
        
        <div style="text-align:center;margin:28px 0;">
          <div style="display:inline-block;background:#f8fafc;border:2px dashed #3b82f6;border-radius:14px;padding:16px 36px;">
            <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:900;letter-spacing:8px;color:#1e40af;">${code}</span>
          </div>
          <div style="font-size:12px;color:#64748b;margin-top:8px;">Bu kod <strong>${escapeHtml(expiresIn)} dakika</strong> boyunca geçerlidir.</div>
        </div>

        <div style="background:rgba(239,68,68,0.06);border-left:4px solid #ef4444;padding:12px 16px;border-radius:0 8px 8px 0;margin-top:20px;">
          <strong style="color:#b91c1c;font-size:13px;">Güvenlik Uyarısı:</strong>
          <div style="font-size:12.5px;color:#7f1d1d;margin-top:4px;">Bu şifre sıfırlama talebini siz başlatmadıysanız lütfen bu e-postayı dikkate almayınız. Mevcut şifreniz değişmeyecektir.</div>
        </div>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    newUserPendingApproval(data = {}) {
      const adminName = escapeHtml(data.adminName || 'Yönetici');
      const newUser = data.newUser || {};
      const newFullName = escapeHtml(newUser.fullName || newUser.full_name || newUser.username || 'Yeni Kullanıcı');
      const newUsername = escapeHtml(newUser.username || '');
      const newEmail = escapeHtml(newUser.email || '-');
      const newDepartment = escapeHtml(newUser.department || 'Bilgi İşlem');
      const time = escapeHtml(data.timestamp || new Date().toLocaleString('tr-TR'));
      return {
        subject: `Yeni Kayıt Başvurusu Onay Bekliyor — ${newUser.full_name || newUser.username}`,
        text: `Sayın ${adminName},\n\n${appName} sistemine yeni bir kullanıcı kayıt başvurusu yapıldı ve onayınızı bekliyor.\n\nAd Soyad: ${newFullName}\nKullanıcı Adı: @${newUsername}\nE-Posta: ${newEmail}\nDepartman: ${newDepartment}\nTarih: ${time}\n\nBaşvuruyu onaylamak veya reddetmek için yönetici paneline giriş yapınız:\n${loginUrl}`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <h1 style="font-size:20px;margin:0 0 14px;color:#0f172a;">Yeni Kayıt Başvurusu Onay Bekliyor</h1>
        <p>Sayın <strong>${adminName}</strong>,</p>
        <p>${escapeHtml(appName)} kurumsal rapor kütüphanesine yeni bir kullanıcı erişim başvurusu yapılmıştır.</p>
        
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:18px 0;font-size:13.5px;">
          <div style="margin-bottom:6px;">Ad Soyad: <strong>${newFullName}</strong></div>
          <div style="margin-bottom:6px;">Kullanıcı Adı: <strong style="color:#2563eb;font-family:monospace;">@${newUsername}</strong></div>
          <div style="margin-bottom:6px;">E-Posta: <strong>${newEmail}</strong></div>
          <div style="margin-bottom:6px;">Departman: <strong>${newDepartment}</strong></div>
          <div style="color:#64748b;font-size:12px;margin-top:8px;">Başvuru Zamanı: ${time}</div>
        </div>

        <p style="margin:24px 0;">
          <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:14px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">Yönetici Paneline Git ve İncele</a>
        </p>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    emergencyRecoveryKeys(data = {}) {
      const fullName = escapeHtml(data.fullName || data.username || 'Kullanıcı');
      const username = escapeHtml(data.username || '');
      const keys = Array.isArray(data.keys) ? data.keys : [];
      const keysHtml = keys.map((k, i) => `
        <div style="background:#f8fafc;border:1.5px dashed #3b82f6;border-radius:8px;padding:10px 14px;font-family:'Courier New',Courier,monospace;font-size:15px;font-weight:800;color:#1e40af;letter-spacing:1px;display:flex;align-items:center;justify-content:space-between;">
          <span>Anahtar #${i + 1}:</span>
          <span>${escapeHtml(k)}</span>
        </div>
      `).join('');

      return {
        subject: `🔑 ${appName} Acil Erişim & Kurtarma Anahtarlarınız`,
        text: `Merhaba ${data.fullName || 'Kullanıcı'},\n\n${appName} hesabınız için 4 adet tek kullanımlık Acil Erişim Anahtarı oluşturuldu:\n\n${keys.map((k, i) => `#${i + 1}: ${k}`).join('\n')}\n\nBu anahtarları güvenli bir yerde saklayınız. Şifrenizi unutmanız veya e-postanıza erişememeniz durumunda bu anahtarlarla hesabınızı anında kurtarabilirsiniz.\n\nGiriş: ${loginUrl}`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <div style="display:inline-flex;align-items:center;gap:6px;background:#fef3c7;color:#b45309;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:12px;">
          <span>🔑</span> <span>Yüksek Güvenlik Önlemi</span>
        </div>
        <h1 style="font-size:20px;margin:0 0 12px;color:#0f172a;">Acil Erişim & Kurtarma Anahtarlarınız</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#334155;">Merhaba <strong>${fullName}</strong>,</p>
        <p style="margin:0 0 16px;font-size:14px;color:#334155;">
          ${escapeHtml(appName)} hesabınız için <strong>4 adet tek kullanımlık acil kurtarma anahtarı</strong> üretilmiştir.
        </p>

        <div style="display:flex;flex-direction:column;gap:8px;margin:20px 0;">
          ${keysHtml}
        </div>

        <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin:18px 0;font-size:13px;color:#92400e;line-height:1.5;">
          <strong>Önemli Güvenlik Notu:</strong> Şifrenizi unutursanız veya e-postanıza/yöneticinize erişemezseniz bu anahtarlardan herhangi birini kullanarak şifrenizi anında sıfırlayabilirsiniz. Her anahtar yalnızca 1 kez kullanılabilir.
        </div>

        <p style="margin:20px 0 0;"><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:11px 24px;border-radius:8px;font-weight:700;font-size:14px;">Giriş Portalı</a></p>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    },

    test(data = {}) {
      return {
        subject: `${appName} e-posta testi`,
        text: `${appName} e-posta gönderim altyapısı başarıyla çalışıyor. Zaman: ${data.timestamp || new Date().toISOString()}`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <h1 style="font-size:20px;margin:0 0 12px;color:#10b981;">E-Posta Testi Başarılı</h1>
        <p>Tebrikler! <strong>${escapeHtml(appName)}</strong> e-posta gönderim altyapısı sorunsuz bir şekilde çalışmaktadır.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;margin:18px 0;font-size:13px;color:#64748b;">
          <div>Test Zamanı: <strong>${escapeHtml(data.timestamp || new Date().toISOString())}</strong></div>
        </div>
      </div>
      ${baseFooter()}
    </div>
  </div>
</body></html>`
      };
    }
  };
}

function createMailer({ env = process.env, transporter = null, fetchImpl = globalThis.fetch, logger = console } = {}) {
  const getEnv = () => (env === process.env ? process.env : env);
  let activeTransporter = transporter;
  let lastTransporterKey = '';

  function getProvider(curEnv = getEnv()) {
    const requested = String(curEnv.MAIL_PROVIDER || '').trim().toLowerCase();
    if (requested === 'brevo' || (!requested && curEnv.BREVO_API_KEY)) return 'brevo';
    return 'smtp';
  }

  function getBrevoSender(curEnv = getEnv()) {
    const email = cleanHeader(curEnv.BREVO_FROM_EMAIL || curEnv.SMTP_USER || '');
    const name = cleanHeader(curEnv.BREVO_FROM_NAME || curEnv.MAIL_APP_NAME || 'FrpOku Cloud Portal');
    return { email, name };
  }

  function getStatus() {
    const curEnv = getEnv();
    const isCurrentlyEnabled = isTruthy(curEnv.MAIL_ENABLED);
    const providerType = getProvider(curEnv);
    const brevoSender = getBrevoSender(curEnv);
    const from = providerType === 'brevo'
      ? `${brevoSender.name} <${brevoSender.email}>`
      : (curEnv.SMTP_FROM || curEnv.SMTP_USER || '');
    const configured = providerType === 'brevo'
      ? Boolean(curEnv.BREVO_API_KEY && brevoSender.email)
      : Boolean(curEnv.SMTP_HOST && curEnv.SMTP_USER && curEnv.SMTP_PASS && from);
    const missing = [];
    if (!isCurrentlyEnabled) missing.push('MAIL_ENABLED=true');
    if (providerType === 'brevo') {
      if (!curEnv.BREVO_API_KEY) missing.push('BREVO_API_KEY');
      if (!brevoSender.email) missing.push('BREVO_FROM_EMAIL');
    } else {
      if (!curEnv.SMTP_HOST) missing.push('SMTP_HOST');
      if (!curEnv.SMTP_USER) missing.push('SMTP_USER');
      if (!curEnv.SMTP_PASS) missing.push('SMTP_PASS');
      if (!from) missing.push('SMTP_FROM');
    }

    return {
      enabled: isCurrentlyEnabled,
      configured,
      ready: isCurrentlyEnabled && configured,
      provider: providerType === 'brevo' ? 'Brevo HTTPS API' : (curEnv.SMTP_HOST || null),
      providerType,
      from: from || null,
      missing
    };
  }

  function getTransporter() {
    if (transporter) return transporter;
    const curEnv = getEnv();
    const port = Number(curEnv.SMTP_PORT || 465);
    const secure = curEnv.SMTP_SECURE === undefined ? port === 465 : isTruthy(curEnv.SMTP_SECURE);
    const smtpHost = String(curEnv.SMTP_HOST || '').trim();
    const rawPassword = String(curEnv.SMTP_PASS || '');
    const smtpPassword = /(^|\.)gmail\.com$/i.test(smtpHost) ? rawPassword.replace(/\s+/g, '') : rawPassword;
    const key = `${smtpHost}:${port}:${secure}:${curEnv.SMTP_USER}:${smtpPassword}`;

    if (!activeTransporter || lastTransporterKey !== key) {
      activeTransporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        secure,
        connectionTimeout: 15000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        auth: {
          user: curEnv.SMTP_USER,
          pass: smtpPassword
        }
      });
      lastTransporterKey = key;
    }
    return activeTransporter;
  }

  function getTemplates() {
    const curEnv = getEnv();
    return createMailTemplates({
      appName: curEnv.MAIL_APP_NAME || 'FrpOku',
      baseUrl: curEnv.APP_BASE_URL || ''
    });
  }

  const mailStats = {
    total: 0,
    successful: 0,
    failed: 0,
    lastSentAt: null,
    byType: {
      accountApproved: 0,
      emailChangeCode: 0,
      emailChangedNotice: 0,
      passwordChanged: 0,
      accountStatusChanged: 0,
      securityAlert: 0,
      systemDigest: 0,
      test: 0,
      other: 0
    },
    history: []
  };

  function recordMailResult({ templateName, to, success, provider, error = null, messageId = null }) {
    mailStats.total++;
    if (success) {
      mailStats.successful++;
      mailStats.lastSentAt = new Date().toISOString();
    } else {
      mailStats.failed++;
    }
    const typeKey = mailStats.byType[templateName] !== undefined ? templateName : 'other';
    mailStats.byType[typeKey] = (mailStats.byType[typeKey] || 0) + 1;

    mailStats.history.unshift({
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: new Date().toISOString(),
      templateName,
      recipient: String(to || ''),
      status: success ? 'SUCCESS' : 'FAILED',
      provider: provider || (getStatus().providerType || 'smtp'),
      error: error || null,
      messageId: messageId || null
    });

    if (mailStats.history.length > 60) {
      mailStats.history.pop();
    }
  }

  async function sendTemplate(templateName, { to, data = {} } = {}) {
    const curEnv = getEnv();
    const status = getStatus();
    if (!status.enabled) {
      recordMailResult({ templateName, to, success: false, error: 'MAIL_ENABLED kapalı' });
      return { sent: false, status: 'disabled', reason: 'MAIL_ENABLED ortam değişkeni kapalı' };
    }
    if (!status.configured) {
      recordMailResult({ templateName, to, success: false, error: 'Eksik e-posta değişkenleri' });
      return { sent: false, status: 'not_configured', reason: 'Eksik e-posta değişkenleri: ' + status.missing.join(', ') };
    }
    if (!to) {
      recordMailResult({ templateName, to, success: false, error: 'Alıcı adresi eksik' });
      return { sent: false, status: 'missing_recipient' };
    }
    const templates = getTemplates();
    if (!templates[templateName]) {
      recordMailResult({ templateName, to, success: false, error: 'Bilinmeyen şablon' });
      return { sent: false, status: 'unknown_template' };
    }

    try {
      const message = templates[templateName](data);
      if (status.providerType === 'brevo') {
        if (typeof fetchImpl !== 'function') throw new Error('HTTPS istemcisi kullanılamıyor');
        const sender = getBrevoSender(curEnv);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        let response;
        try {
          response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { accept: 'application/json', 'api-key': curEnv.BREVO_API_KEY, 'content-type': 'application/json' },
            body: JSON.stringify({ sender, to: [{ email: cleanHeader(to) }], subject: cleanHeader(message.subject), textContent: message.text, htmlContent: message.html }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeout);
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || `Brevo API HTTP ${response.status}`);
        recordMailResult({ templateName, to, success: true, provider: 'brevo', messageId: payload.messageId });
        return { sent: true, status: 'sent', messageId: payload.messageId || null, provider: 'brevo' };
      }
      const from = curEnv.SMTP_FROM || curEnv.SMTP_USER || '';
      const info = await getTransporter().sendMail({
        from,
        to: cleanHeader(to),
        subject: cleanHeader(message.subject),
        text: message.text,
        html: message.html
      });
      recordMailResult({ templateName, to, success: true, provider: 'smtp', messageId: info.messageId });
      return { sent: true, status: 'sent', messageId: info.messageId || null };
    } catch (error) {
      logger.warn('E-posta gönderilemedi:', error.message);
      recordMailResult({ templateName, to, success: false, error: error.message });
      return { sent: false, status: 'failed', error: error.message };
    }
  }

  async function verify() {
    const curEnv = getEnv();
    const status = getStatus();
    if (!status.enabled) return { ok: false, status: 'disabled' };
    if (!status.configured) return { ok: false, status: 'not_configured' };
    try {
      if (status.providerType === 'brevo') {
        if (typeof fetchImpl !== 'function') throw new Error('HTTPS istemcisi kullanılamıyor');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        let response;
        try {
          response = await fetchImpl('https://api.brevo.com/v3/account', {
            headers: { accept: 'application/json', 'api-key': curEnv.BREVO_API_KEY },
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeout);
        }
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || `Brevo API HTTP ${response.status}`);
        return { ok: true, status: 'ready', provider: 'brevo' };
      }
      await getTransporter().verify();
      return { ok: true, status: 'ready' };
    } catch (error) {
      logger.warn('E-posta altyapısı doğrulanamadı:', error.message);
      return { ok: false, status: 'failed', error: error.message };
    }
  }

  return {
    getStatus,
    verify,
    getMailStats: () => ({ ...mailStats, history: [...mailStats.history] }),
    sendAccountApproved: ({ to, fullName, username } = {}) => sendTemplate('accountApproved', { to, data: { fullName, username } }),
    sendEmailChangeCode: ({ to, fullName, code, expiresIn = '15' } = {}) => sendTemplate('emailChangeCode', { to, data: { fullName, code, expiresIn } }),
    sendEmailChangedNotice: ({ to, fullName, newEmail, ip } = {}) => sendTemplate('emailChangedNotice', { to, data: { fullName, newEmail, ip } }),
    sendPasswordChanged: ({ to, fullName, username, ip, timestamp } = {}) => sendTemplate('passwordChanged', { to, data: { fullName, username, ip, timestamp } }),
    sendAccountStatusChanged: ({ to, fullName, username, action, isFrozen } = {}) => sendTemplate('accountStatusChanged', { to, data: { fullName, username, action: action || (isFrozen === false ? 'activated' : 'frozen') } }),
    sendSecurityAlert: ({ to, identifier, ip, clientIp, attempts } = {}) => sendTemplate('securityAlert', { to, data: { identifier, ip: ip || clientIp, attempts } }),
    sendSystemDigest: ({ to, stats } = {}) => sendTemplate('systemDigest', { to, data: { stats } }),
    sendUnreadMessageDigest: ({ to, recipientName, senderName, unreadCount, lastMessageSnippet } = {}) =>
      sendTemplate('unreadMessageDigest', { to, data: { recipientName, senderName, unreadCount, lastMessageSnippet } }),
    sendEmergencyRecoveryKeys: ({ to, fullName, username, keys } = {}) =>
      sendTemplate('emergencyRecoveryKeys', { to, data: { fullName, username, keys } }),
    sendPasswordResetByAdmin: ({ to, fullName, username, timestamp } = {}) =>
      sendTemplate('passwordResetByAdmin', { to, data: { fullName, username, timestamp } }),
    sendSelfServiceResetCode: ({ to, fullName, username, code, expiresIn = '15' } = {}) =>
      sendTemplate('selfServiceResetCode', { to, data: { fullName, username, code, expiresIn } }),
    sendNewUserPendingApproval: ({ to, adminName, newUser } = {}) =>
      sendTemplate('newUserPendingApproval', { to, data: { adminName, newUser } }),
    sendAdminNewRegistrationNotification: ({ to, adminName, newUser } = {}) =>
      sendTemplate('newUserPendingApproval', { to, data: { adminName, newUser } }),
    sendTestEmail: ({ to } = {}) => sendTemplate('test', { to, data: { timestamp: new Date().toISOString() } })
  };
}

module.exports = {
  createMailer,
  createMailTemplates,
  escapeHtml
};
