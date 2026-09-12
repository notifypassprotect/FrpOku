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

    test(data = {}) {
      return {
        subject: `${appName} e-posta testi`,
        text: `${appName} SMTP yapılandırması başarıyla çalışıyor. Zaman: ${data.timestamp || new Date().toISOString()}`,
        html: `<!doctype html>
<html lang="tr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
      ${baseHeader()}
      <div style="padding:28px;line-height:1.65;">
        <h1 style="font-size:20px;margin:0 0 12px;color:#10b981;">SMTP Testi Başarılı</h1>
        <p>Tebrikler! <strong>${escapeHtml(appName)}</strong> e-posta gönderim altyapısı ve Google App Password SMTP bağlantısı sorunsuz bir şekilde çalışmaktadır.</p>
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

function createMailer({ env = process.env, transporter = null, logger = console } = {}) {
  const getEnv = () => (env === process.env ? process.env : env);
  let activeTransporter = transporter;
  let lastTransporterKey = '';

  function getStatus() {
    const curEnv = getEnv();
    const isCurrentlyEnabled = isTruthy(curEnv.MAIL_ENABLED);
    const from = curEnv.SMTP_FROM || curEnv.SMTP_USER || '';
    const configured = Boolean(curEnv.SMTP_HOST && curEnv.SMTP_USER && curEnv.SMTP_PASS && from);
    const missing = [];
    if (!isCurrentlyEnabled) missing.push('MAIL_ENABLED=true');
    if (!curEnv.SMTP_HOST) missing.push('SMTP_HOST');
    if (!curEnv.SMTP_USER) missing.push('SMTP_USER');
    if (!curEnv.SMTP_PASS) missing.push('SMTP_PASS');
    if (!from) missing.push('SMTP_FROM');

    return {
      enabled: isCurrentlyEnabled,
      configured,
      ready: isCurrentlyEnabled && configured,
      provider: curEnv.SMTP_HOST || null,
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

  async function sendTemplate(templateName, { to, data = {} } = {}) {
    const curEnv = getEnv();
    const from = curEnv.SMTP_FROM || curEnv.SMTP_USER || '';
    const status = getStatus();
    if (!status.enabled) return { sent: false, status: 'disabled', reason: 'MAIL_ENABLED ortam değişkeni kapalı' };
    if (!status.configured) return { sent: false, status: 'not_configured', reason: 'Eksik SMTP değişkenleri: ' + status.missing.join(', ') };
    if (!to) return { sent: false, status: 'missing_recipient' };
    const templates = getTemplates();
    if (!templates[templateName]) return { sent: false, status: 'unknown_template' };

    try {
      const message = templates[templateName](data);
      const info = await getTransporter().sendMail({
        from,
        to: cleanHeader(to),
        subject: cleanHeader(message.subject),
        text: message.text,
        html: message.html
      });
      return { sent: true, status: 'sent', messageId: info.messageId || null };
    } catch (error) {
      logger.warn('E-posta gönderilemedi:', error.message);
      return { sent: false, status: 'failed', error: error.message };
    }
  }

  async function verify() {
    const status = getStatus();
    if (!status.enabled) return { ok: false, status: 'disabled' };
    if (!status.configured) return { ok: false, status: 'not_configured' };
    try {
      await getTransporter().verify();
      return { ok: true, status: 'ready' };
    } catch (error) {
      logger.warn('SMTP doğrulaması başarısız:', error.message);
      return { ok: false, status: 'failed', error: error.message };
    }
  }

  return {
    getStatus,
    verify,
    sendAccountApproved: ({ to, fullName, username } = {}) => sendTemplate('accountApproved', { to, data: { fullName, username } }),
    sendEmailChangeCode: ({ to, fullName, code, expiresIn = '15' } = {}) => sendTemplate('emailChangeCode', { to, data: { fullName, code, expiresIn } }),
    sendEmailChangedNotice: ({ to, fullName, newEmail, ip } = {}) => sendTemplate('emailChangedNotice', { to, data: { fullName, newEmail, ip } }),
    sendPasswordChanged: ({ to, fullName, username, ip } = {}) => sendTemplate('passwordChanged', { to, data: { fullName, username, ip } }),
    sendAccountStatusChanged: ({ to, fullName, username, action, isFrozen } = {}) => sendTemplate('accountStatusChanged', { to, data: { fullName, username, action: action || (isFrozen === false ? 'activated' : 'frozen') } }),
    sendSecurityAlert: ({ to, identifier, ip, clientIp, attempts } = {}) => sendTemplate('securityAlert', { to, data: { identifier, ip: ip || clientIp, attempts } }),
    sendSystemDigest: ({ to, stats } = {}) => sendTemplate('systemDigest', { to, data: { stats } }),
    sendTestEmail: ({ to } = {}) => sendTemplate('test', { to, data: { timestamp: new Date().toISOString() } })
  };
}

module.exports = {
  createMailer,
  createMailTemplates,
  escapeHtml
};
