require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ── Nodemailer SMTP Transporter ─────────────────────────────
const SMTP_USER = process.env.SMTP_USER || 'notifypassprotect@gmail.com';
const SMTP_PASS = (process.env.SMTP_PASS || 'pudmkitqegolfpkf').replace(/\s+/g, '');
const SMTP_FROM = process.env.SMTP_FROM || `"FrpOku Cloud Portal" <${SMTP_USER}>`;

let mailTransporter = null;
if (SMTP_USER && SMTP_PASS) {
  mailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });

  mailTransporter.verify((err, success) => {
    if (err) {
      console.warn('⚠️ SMTP Bağlantı Uyarısı:', err.message);
    } else {
      console.log('✅ SMTP E-Posta Servisi Hazır:', SMTP_USER);
    }
  });
}

// In-Memory OTP, Cooldown & Pending Registration Stores
const otpStore = new Map(); // email -> { code, expiresAt, userId, name, attempts }
const otpCooldownStore = new Map(); // email -> lastRequestTimestamp
const pendingRegistrations = new Map(); // email -> { code, expiresAt, fullName, username, email, phone, department, passwordHash, attempts }

function hashPassword(plainText) {
  if (!plainText) return '';
  return crypto.createHash('sha256').update(plainText).digest('hex');
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return '***@***.com';
  const [user, domain] = email.split('@');
  const maskedUser = user.length > 2 ? user[0] + '*'.repeat(user.length - 2) + user[user.length - 1] : user[0] + '*';
  return `${maskedUser}@${domain}`;
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

// Config endpoint for client-side Supabase connection
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL || '',
    supabaseKey: SUPABASE_KEY || '',
    smtpActive: !!mailTransporter
  });
});

// ── E-POSTA ŞABLONLARI ───────────────────────────────────────
function getWelcomeEmailHtml(name, username) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Roboto,Helvetica,sans-serif;color:#f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 10px;">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#1e293b;border-radius:20px;border:1px solid #334155;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <!-- Header Header Gradient Bar -->
            <tr>
              <td style="height:6px;background:linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899);"></td>
            </tr>
            <tr>
              <td style="padding:36px 40px;text-align:center;">
                <div style="display:inline-block;width:68px;height:68px;line-height:68px;background:linear-gradient(135deg, #3b82f6, #8b5cf6);border-radius:18px;font-size:32px;text-align:center;box-shadow:0 10px 25px rgba(59,130,246,0.4);">⚡</div>
                <h1 style="margin:20px 0 6px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">FrpOku Ailesine Hoş Geldiniz!</h1>
                <p style="margin:0;color:#94a3b8;font-size:14px;">FastReport Rapor & SQL Kod Analiz Merkezi</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 36px;">
                <div style="background-color:#0f172a;border-radius:14px;border:1px solid #334155;padding:24px;margin-bottom:24px;">
                  <p style="margin:0 0 12px;font-size:16px;color:#f8fafc;">Sayın <strong>${name || username}</strong>,</p>
                  <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#cbd5e1;">
                    FrpOku Cloud Portal hesabınız başarıyla oluşturuldu. Artık tüm FastReport (.frp) raporlarınızı bulutta güvenle arşivleyebilir, SQL sorgularınızı doğrulayabilir, bağımlılık haritalarını ve karmaşıklık analizlerini inceleyebilirsiniz.
                  </p>
                  <div style="background:#1e293b;padding:12px 16px;border-radius:8px;border-left:4px solid #3b82f6;font-size:13px;color:#94a3b8;">
                    <strong>Kullanıcı Adınız:</strong> <span style="color:#60a5fa;font-family:monospace;font-weight:bold;">${username}</span>
                  </div>
                </div>
                
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <a href="https://frpoku.onrender.com" target="_blank" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg, #2563eb, #1d4ed8);color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;border-radius:12px;box-shadow:0 4px 15px rgba(37,99,235,0.4);">
                        🚀 FrpOku Portalına Giriş Yap
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px;background-color:#0f172a;border-top:1px solid #334155;text-align:center;font-size:12px;color:#64748b;">
                Bu e-posta otomatik olarak gönderilmiştir. Sorularınız için <a href="mailto:notifypassprotect@gmail.com" style="color:#38bdf8;text-decoration:none;">notifypassprotect@gmail.com</a> adresine ulaşabilirsiniz.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

function getOtpEmailHtml(name, code) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Roboto,Helvetica,sans-serif;color:#f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 10px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#1e293b;border-radius:20px;border:1px solid #334155;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <tr>
              <td style="height:6px;background:linear-gradient(90deg, #f59e0b, #ef4444);"></td>
            </tr>
            <tr>
              <td style="padding:32px 36px;text-align:center;">
                <div style="display:inline-block;width:64px;height:64px;line-height:64px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:18px;font-size:30px;text-align:center;">🔑</div>
                <h1 style="margin:18px 0 6px;color:#ffffff;font-size:22px;font-weight:800;">Şifre Sıfırlama Doğrulama Kodu</h1>
                <p style="margin:0;color:#94a3b8;font-size:13px;">FrpOku Cloud Güvenlik Doğrulaması</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 32px;">
                <div style="background-color:#0f172a;border-radius:14px;border:1px solid #334155;padding:24px;text-align:center;margin-bottom:20px;">
                  <p style="margin:0 0 14px;font-size:14px;color:#cbd5e1;">
                    Merhaba <strong>${name || 'Kullanıcı'}</strong>, FrpOku hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki 6 haneli güvenlik kodunu ilgili ekrana giriniz:
                  </p>
                  
                  <!-- OTP CODE BOX -->
                  <div style="display:inline-block;background:linear-gradient(135deg, rgba(37,99,235,0.15), rgba(139,92,246,0.15));border:2px dashed #3b82f6;border-radius:14px;padding:16px 36px;letter-spacing:10px;font-size:32px;font-weight:900;color:#60a5fa;font-family:monospace;margin:12px 0;">
                    ${code}
                  </div>

                  <p style="margin:14px 0 0;font-size:12px;color:#ef4444;font-weight:600;">
                    ⏱️ Bu kod 10 dakika boyunca geçerlidir.
                  </p>
                </div>

                <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;text-align:center;">
                  Bu işlemi siz talep etmediyseniz, hesabınız güvendedir. Bu e-postayı görmezden gelebilirsiniz.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px;background-color:#0f172a;border-top:1px solid #334155;text-align:center;font-size:11px;color:#64748b;">
                FrpOku Güvenlik Ekibi • <a href="https://frpoku.onrender.com" style="color:#38bdf8;text-decoration:none;">frpoku.onrender.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

function getPasswordChangedEmailHtml(name) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Roboto,Helvetica,sans-serif;color:#f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 10px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#1e293b;border-radius:20px;border:1px solid #334155;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <tr>
              <td style="height:6px;background:linear-gradient(90deg, #10b981, #059669);"></td>
            </tr>
            <tr>
              <td style="padding:32px 36px;text-align:center;">
                <div style="display:inline-block;width:64px;height:64px;line-height:64px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:18px;font-size:30px;text-align:center;">🛡️</div>
                <h1 style="margin:18px 0 6px;color:#ffffff;font-size:22px;font-weight:800;">Şifreniz Başarıyla Güncellendi</h1>
                <p style="margin:0;color:#94a3b8;font-size:13px;">Güvenlik Bilgilendirmesi</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 32px;">
                <div style="background-color:#0f172a;border-radius:14px;border:1px solid #334155;padding:22px;margin-bottom:20px;">
                  <p style="margin:0 0 12px;font-size:15px;color:#f8fafc;">Merhaba <strong>${name || 'Kullanıcı'}</strong>,</p>
                  <p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#cbd5e1;">
                    FrpOku Cloud Portal hesabınızın giriş şifresi <strong>${new Date().toLocaleString('tr-TR')}</strong> tarihinde başarıyla değiştirildi.
                  </p>
                  <p style="margin:0;font-size:12px;color:#94a3b8;">
                    Eğer bu işlemi siz yapmadıysanız, lütfen derhal sistem yöneticisi ile iletişime geçiniz.
                  </p>
                </div>

                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center">
                      <a href="https://frpoku.onrender.com" target="_blank" style="display:inline-block;padding:12px 28px;background:#10b981;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;border-radius:10px;">
                        Giriş Ekranına Git
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px;background-color:#0f172a;border-top:1px solid #334155;text-align:center;font-size:11px;color:#64748b;">
                FrpOku Güvenlik Ekibi • <a href="https://frpoku.onrender.com" style="color:#38bdf8;text-decoration:none;">frpoku.onrender.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

function getRegisterOtpEmailHtml(name, code) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;background-color:#0f172a;font-family:'Segoe UI',Roboto,Helvetica,sans-serif;color:#f8fafc;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 10px;">
      <tr>
        <td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#1e293b;border-radius:20px;border:1px solid #334155;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
            <tr>
              <td style="height:6px;background:linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6);"></td>
            </tr>
            <tr>
              <td style="padding:32px 36px 20px;text-align:center;">
                <div style="display:inline-block;width:64px;height:64px;line-height:64px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:18px;font-size:30px;text-align:center;">✨</div>
                <h1 style="margin:18px 0 6px;color:#ffffff;font-size:22px;font-weight:800;">E-Posta Doğrulama Kodu</h1>
                <p style="margin:0;color:#94a3b8;font-size:13px;">FrpOku Cloud Portal Hesap Oluşturma</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 32px;">
                <div style="background-color:#0f172a;border-radius:14px;border:1px solid #334155;padding:22px;margin-bottom:24px;text-align:center;">
                  <p style="margin:0 0 12px;font-size:15px;color:#f8fafc;">Merhaba <strong>${name || 'Yeni Kullanıcı'}</strong>,</p>
                  <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#cbd5e1;">
                    FrpOku Cloud Portal hesabınızı aktifleştirmek için aşağıdaki 6 haneli güvenlik kodunu giriniz:
                  </p>
                  
                  <div style="display:inline-block;background:linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.15));border:2px dashed #10b981;border-radius:12px;padding:14px 28px;letter-spacing:10px;font-size:32px;font-weight:900;color:#34d399;font-family:monospace;">
                    ${code}
                  </div>

                  <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;">
                    ⏳ Bu kod <strong>10 dakika</strong> boyunca geçerlidir.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 36px;background-color:#0f172a;border-top:1px solid #334155;text-align:center;font-size:11px;color:#64748b;">
                FrpOku Güvenlik Ekibi • <a href="https://frpoku.onrender.com" style="color:#38bdf8;text-decoration:none;">frpoku.onrender.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

// ── 0. YENİ KULLANICI KAYIT TALEBİ VE OTP GÖNDERME ─────────────
app.post('/api/auth/register-request', async (req, res) => {
  const { fullName, username, email, phone, department, password } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanName = (fullName || '').trim();
  const cleanPhone = (phone || '').trim();

  if (!cleanName || !cleanUser || !cleanEmail || !password) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen zorunlu alanları (Ad Soyad, Kullanıcı Adı, E-Posta, Şifre) eksiksiz doldurunuz.' });
  }

  if (!EMAIL_REGEX.test(cleanEmail)) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen geçerli bir e-posta formatı giriniz (Örn: ad.soyad@kurum.com).' });
  }

  if (password.length < 4) {
    return res.status(400).json({ success: false, reason: '⚠️ Şifreniz en az 4 karakter olmalıdır.' });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, reason: '❌ Veritabanı bağlantısı kurulamadı.' });
  }

  try {
    // 1. E-Posta veya Kullanıcı Adı Zaten Kayıtlı mı?
    const { data: existingUsers, error: searchErr } = await supabase
      .from('app_users')
      .select('id, username, email')
      .or(`email.ilike.${cleanEmail},username.ilike.${cleanUser}`)
      .limit(2);

    if (existingUsers && existingUsers.length > 0) {
      const matchEmail = existingUsers.some(u => (u.email || '').toLowerCase() === cleanEmail);
      if (matchEmail) {
        return res.status(400).json({ success: false, reason: `⚠️ '${cleanEmail}' e-posta adresi ile zaten kayıtlı bir hesap var. Lütfen giriş yapın veya şifrenizi sıfırlayın.` });
      }
      return res.status(400).json({ success: false, reason: `⚠️ '${cleanUser}' kullanıcı adı başkası tarafından kullanılıyor. Lütfen farklı bir kullanıcı adı seçiniz.` });
    }

    // 2. Cooldown Kontrolü (60 saniye)
    const lastSent = otpCooldownStore.get(cleanEmail);
    if (lastSent && Date.now() - lastSent < 60000) {
      const waitSeconds = Math.ceil((60000 - (Date.now() - lastSent)) / 1000);
      return res.status(429).json({
        success: false,
        reason: `⏱️ Yeni bir kayıt doğrulama kodu talep etmek için lütfen ${waitSeconds} saniye bekleyiniz.`
      });
    }

    // 3. 6 Haneli OTP Kod Üret
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 dakika

    pendingRegistrations.set(cleanEmail, {
      code: otpCode,
      expiresAt,
      fullName: cleanName,
      username: cleanUser,
      email: cleanEmail,
      phone: cleanPhone,
      department: department || '',
      passwordHash: hashPassword(password),
      attempts: 0
    });

    otpCooldownStore.set(cleanEmail, Date.now());

    // 4. Doğrulama Kodunu E-Postaya Gönder
    if (!mailTransporter) {
      return res.status(500).json({ success: false, reason: 'E-posta sunucusu (SMTP) aktif değil. Lütfen sistem yöneticinizle iletişime geçiniz.' });
    }

    try {
      const mailRes = await Promise.race([
        mailTransporter.sendMail({
          from: SMTP_FROM,
          to: cleanEmail,
          subject: `FrpOku Hesap Dogrulama Kodu: ${otpCode}`,
          text: `Merhaba ${cleanName},\n\nFrpOku hesabınızı oluşturmak için 6 haneli güvenlik kodunuz: ${otpCode}\n\nBu kod 10 dakika boyunca geçerlidir.\n\nİyi çalışmalar,\nFrpOku Güvenlik Ekibi`,
          html: getRegisterOtpEmailHtml(cleanName, otpCode),
          headers: {
            'X-Entity-Ref-ID': `reg-${cleanEmail}-${Date.now()}`,
            'X-Priority': '1 (Highest)',
            'Importance': 'High'
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('E-posta sunucusu yanıt vermedi (Zaman aşımı)')), 10000))
      ]);
      console.log(`✅ Kayıt OTP kodu gönderildi: ${cleanEmail} (MsgID: ${mailRes.messageId})`);
    } catch (mailErr) {
      console.error('❌ Register mail send error:', mailErr.message);
      return res.status(500).json({ success: false, reason: 'Doğrulama e-postası gönderilemedi: ' + mailErr.message });
    }

    res.json({
      success: true,
      email: cleanEmail,
      maskedEmail: maskEmail(cleanEmail)
    });
  } catch (err) {
    console.error('Register request error:', err.message);
    res.status(500).json({ success: false, reason: 'Kayıt kodu gönderilirken hata oluştu: ' + err.message });
  }
});

// ── 0.1. YENİ KULLANICI OTP DOĞRULAMA VE HESAP OLUŞTURMA ───────
app.post('/api/auth/register-verify', async (req, res) => {
  const { email, code } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = (code || '').trim().replace(/\D/g, '');

  if (!cleanEmail || !cleanCode) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen güvenlik kodunu eksiksiz giriniz.' });
  }

  if (cleanCode.length !== 6) {
    return res.status(400).json({ success: false, reason: '⚠️ Güvenlik kodu 6 haneli olmalıdır.' });
  }

  const record = pendingRegistrations.get(cleanEmail);
  if (!record) {
    return res.status(400).json({ success: false, reason: '❌ Geçersiz veya süresi dolmuş kayıt başvurusu. Lütfen formu tekrar doldurunuz.' });
  }

  if (Date.now() > record.expiresAt) {
    pendingRegistrations.delete(cleanEmail);
    return res.status(400).json({ success: false, reason: '⏱️ Doğrulama kodunun süresi doldu (10 dk). Lütfen yeni kod isteyiniz.' });
  }

  record.attempts = (record.attempts || 0) + 1;
  if (record.attempts > 5) {
    pendingRegistrations.delete(cleanEmail);
    return res.status(400).json({ success: false, reason: '⛔ Çok fazla hatalı kod denemesi yapıldı. Lütfen kayıt formunu tekrar doldurunuz.' });
  }

  if (record.code !== cleanCode) {
    return res.status(400).json({
      success: false,
      reason: `❌ Girdiğiniz 6 haneli güvenlik kodu hatalı! (Kalan deneme hakkı: ${5 - record.attempts})`
    });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, reason: '❌ Veritabanı bağlantısı yok.' });
  }

  try {
    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      username: record.username,
      password_hash: record.passwordHash,
      email: record.email,
      full_name: record.fullName,
      phone: record.phone || '',
      department: record.department || '',
      role: 'user',
      is_active: true,
      email_verified: true,
      created_at: new Date().toISOString()
    };

    const { error: insertErr } = await supabase.from('app_users').insert([newUser]);
    if (insertErr) throw insertErr;

    // Temizle
    pendingRegistrations.delete(cleanEmail);
    otpCooldownStore.delete(cleanEmail);

    // 🎉 Hoş Geldiniz Maili Gönder
    if (mailTransporter) {
      mailTransporter.sendMail({
        from: SMTP_FROM,
        to: record.email,
        subject: 'FrpOku Cloud Portalına Hoş Geldiniz! 🚀',
        text: `Merhaba ${record.fullName},\n\nFrpOku hesabınız başarıyla doğrulandı ve aktifleştirildi!\n\nArtık tüm kurumsal raporlarınıza ve kod havuzunuza dilediğiniz cihazdan erişebilirsiniz.\n\nFrpOku Ekibi`,
        html: getWelcomeEmailHtml(record.fullName, record.username)
      }).catch(e => console.warn('Welcome mail error:', e.message));
    }

    const safeUser = { ...newUser };
    delete safeUser.password_hash;

    res.json({
      success: true,
      user: safeUser
    });
  } catch (err) {
    console.error('Register verify error:', err.message);
    res.status(500).json({ success: false, reason: 'Hesap oluşturulurken hata oluştu: ' + err.message });
  }
});

// ── 1. HOŞ GELDİNİZ MAİLİ GÖNDERME (Manuel Tetikleme İçin) ─────
app.post('/api/auth/send-welcome', async (req, res) => {
  const { email, fullName, username } = req.body;
  if (!email || !mailTransporter) {
    return res.json({ success: false, message: 'E-posta veya SMTP yapılandırılmamış.' });
  }

  try {
    await mailTransporter.sendMail({
      from: SMTP_FROM,
      to: email,
      subject: 'FrpOku Cloud Portalına Hoş Geldiniz! 🚀',
      html: getWelcomeEmailHtml(fullName, username)
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Welcome mail error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2. ŞİFRE SIFIRLAMA KODU (OTP) GÖNDERME ──────────────────
app.post('/api/auth/send-reset-code', async (req, res) => {
  const { identifier } = req.body;
  const ident = (identifier || '').trim().toLowerCase();

  if (!ident) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen kullanıcı adı veya e-posta adresinizi giriniz.' });
  }

  // E-Posta format kontrolü (@ içeriyorsa geçerli format olmalı)
  if (ident.includes('@') && !EMAIL_REGEX.test(ident)) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen geçerli bir e-posta formatı giriniz (Örn: ad.soyad@kurum.com).' });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, reason: '❌ Veritabanı bağlantısı kurulamadı.' });
  }

  try {
    // Kullanıcıyı bul (Büyük/Küçük harfe duyarsız)
    let query = supabase.from('app_users').select('id, username, email, full_name');
    if (ident.includes('@')) {
      query = query.ilike('email', ident);
    } else {
      query = query.or(`username.ilike.${ident},email.ilike.${ident}`);
    }

    const { data: users, error } = await query.limit(1);
    if (error || !users || users.length === 0) {
      return res.status(404).json({ 
        success: false, 
        reason: `❌ '${ident}' bilgisine ait kayıtlı bir kullanıcı hesabı bulunamadı. Lütfen bilgilerinizi kontrol ediniz.` 
      });
    }

    const user = users[0];
    if (!user.email || !EMAIL_REGEX.test(user.email)) {
      return res.status(400).json({ 
        success: false, 
        reason: '⚠️ Bu kullanıcı hesabına bağlı geçerli bir e-posta adresi bulunmuyor. Lütfen sistem yöneticinizle iletişime geçiniz.' 
      });
    }

    const userEmailKey = user.email.toLowerCase();

    // 60 Saniye Spam & Cooldown Denetimi
    const lastSent = otpCooldownStore.get(userEmailKey);
    if (lastSent && Date.now() - lastSent < 60000) {
      const waitSeconds = Math.ceil((60000 - (Date.now() - lastSent)) / 1000);
      return res.status(429).json({
        success: false,
        reason: `⏱️ Yeni bir kod talep etmek için lütfen ${waitSeconds} saniye bekleyiniz.`
      });
    }

    // 6 Haneli Rastgele Sayısal OTP Üret
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 dakika

    // Store in memory
    otpStore.set(userEmailKey, {
      code: otpCode,
      expiresAt,
      userId: user.id,
      name: user.full_name || user.username,
      attempts: 0
    });

    otpCooldownStore.set(userEmailKey, Date.now());

    // E-Posta Gönder (Timeout korumalı)
    if (mailTransporter) {
      try {
        await Promise.race([
          mailTransporter.sendMail({
            from: SMTP_FROM,
            to: user.email,
            subject: `FrpOku Sifre Sifirlama Dogrulama Kodu: ${otpCode}`,
            text: `Merhaba ${user.full_name || user.username},\n\nFrpOku hesabınız için şifre sıfırlama doğrulama kodunuz: ${otpCode}\n\nBu kod 10 dakika boyunca geçerlidir.\n\nİyi çalışmalar,\nFrpOku Güvenlik Ekibi`,
            html: getOtpEmailHtml(user.full_name || user.username, otpCode)
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('E-posta sunucusu yanıt vermedi')), 10000))
        ]);
      } catch (mailErr) {
        console.warn('Mail send timeout/error:', mailErr.message);
      }
    }

    res.json({
      success: true,
      email: user.email,
      maskedEmail: maskEmail(user.email)
    });
  } catch (err) {
    console.error('OTP Send Error:', err.message);
    res.status(500).json({ success: false, reason: 'E-posta gönderilirken hata oluştu: ' + err.message });
  }
});

// ── 3. OTP KODU DOĞRULA VE ŞİFREYİ SIFIRLA ───────────────────
app.post('/api/auth/verify-reset-code', async (req, res) => {
  const { email, code, newPassword } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanCode = (code || '').trim().replace(/\D/g, ''); // Sadece rakamlar

  if (!cleanEmail || !cleanCode || !newPassword) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen tüm alanları eksiksiz doldurunuz.' });
  }

  if (cleanCode.length !== 6) {
    return res.status(400).json({ success: false, reason: '⚠️ Güvenlik kodu 6 haneli olmalıdır.' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ success: false, reason: '⚠️ Yeni şifreniz en az 4 karakter olmalıdır.' });
  }

  const record = otpStore.get(cleanEmail);
  if (!record) {
    return res.status(400).json({ success: false, reason: '❌ Geçersiz veya süresi dolmuş kod talebi. Lütfen tekrar kod isteyiniz.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanEmail);
    return res.status(400).json({ success: false, reason: '⏱️ Doğrulama kodunun süresi doldu (10 dakika). Lütfen yeni kod talep ediniz.' });
  }

  record.attempts = (record.attempts || 0) + 1;
  if (record.attempts > 5) {
    otpStore.delete(cleanEmail);
    return res.status(400).json({ success: false, reason: '⛔ Çok fazla hatalı deneme yapıldı. Güvenliğiniz için lütfen yeni kod talep ediniz.' });
  }

  if (record.code !== cleanCode) {
    return res.status(400).json({ 
      success: false, 
      reason: `❌ Girdiğiniz 6 haneli güvenlik kodu hatalı! (Kalan deneme hakkı: ${5 - record.attempts})` 
    });
  }

  try {
    const passwordHash = hashPassword(newPassword);

    // Supabase şifreyi güncelle
    const { error } = await supabase
      .from('app_users')
      .update({ password_hash: passwordHash })
      .eq('id', record.userId);

    if (error) throw error;

    // Kod temizle
    otpStore.delete(cleanEmail);
    otpCooldownStore.delete(cleanEmail);

    // Güvenlik e-postası gönder
    if (mailTransporter) {
      mailTransporter.sendMail({
        from: SMTP_FROM,
        to: cleanEmail,
        subject: 'FrpOku Hesabinizin Sifresi Guncellendi',
        text: `Merhaba ${record.name},\n\nFrpOku hesabınızın şifresi başarıyla değiştirildi.\n\nEğer bu işlemi siz yapmadıysanız lütfen yöneticinizle görüşün.`,
        html: getPasswordChangedEmailHtml(record.name)
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Verify reset error:', err.message);
    res.status(500).json({ success: false, reason: 'Şifre güncellenirken hata oluştu: ' + err.message });
  }
});

// ── 4. PROFİL İÇİNDEN ŞİFRE DEĞİŞTİRME ──────────────────────
app.post('/api/auth/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;

  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen mevcut ve yeni şifrenizi giriniz.' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ success: false, reason: '⚠️ Yeni şifre en az 4 karakter olmalıdır.' });
  }

  if (oldPassword === newPassword) {
    return res.status(400).json({ success: false, reason: '⚠️ Yeni şifreniz mevcut şifrenizle aynı olamaz. Lütfen farklı bir şifre seçiniz.' });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, reason: '❌ Veritabanı bağlantısı kurulamadı.' });
  }

  try {
    const { data: users, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', userId)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(404).json({ success: false, reason: 'Kullanıcı hesabı bulunamadı.' });
    }

    const user = users[0];
    const oldHash = hashPassword(oldPassword);

    if (user.password_hash !== oldHash && user.password_hash !== oldPassword) {
      return res.status(400).json({ success: false, reason: '🔒 Mevcut şifrenizi hatalı girdiniz!' });
    }

    const newHash = hashPassword(newPassword);
    await supabase
      .from('app_users')
      .update({ password_hash: newHash })
      .eq('id', userId);

    if (user.email && mailTransporter) {
      mailTransporter.sendMail({
        from: SMTP_FROM,
        to: user.email,
        subject: 'FrpOku Sifreniz Basariyla Guncellendi',
        text: `Merhaba ${user.full_name || user.username},\n\nFrpOku hesabınızın şifresi güncellendi.`,
        html: getPasswordChangedEmailHtml(user.full_name || user.username)
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Şifre güncellenemedi: ' + err.message });
  }
});

// ── 5. KULLANICI PROFİLİ GÜNCELLEME (E-Posta, İsim, Telefon) ──
app.post('/api/auth/update-profile', async (req, res) => {
  const { userId, fullName, username, email, phone, department } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanName = (fullName || '').trim();
  const cleanPhone = (phone || '').trim();

  if (!userId) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği bulunamadı.' });
  }

  if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen geçerli bir e-posta formatı giriniz.' });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, reason: '❌ Veritabanı bağlantısı kurulamadı.' });
  }

  try {
    // Mevcut kullanıcıyı çek
    const { data: users, error: fetchErr } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', userId)
      .limit(1);

    if (fetchErr || !users || users.length === 0) {
      return res.status(404).json({ success: false, reason: 'Kullanıcı hesabı bulunamadı.' });
    }

    const currentUser = users[0];
    const oldEmail = currentUser.email;

    // Eğer e-posta değiştiyse başka bir hesapta kayıtlı mı kontrol et
    if (cleanEmail && cleanEmail !== (oldEmail || '').toLowerCase()) {
      const { data: existingEmail } = await supabase
        .from('app_users')
        .select('id')
        .eq('email', cleanEmail)
        .neq('id', userId)
        .limit(1);

      if (existingEmail && existingEmail.length > 0) {
        return res.status(400).json({ success: false, reason: `⚠️ '${cleanEmail}' e-posta adresi başka bir hesapta kayıtlı.` });
      }
    }

    const updates = {
      full_name: cleanName || currentUser.full_name,
      email: cleanEmail || currentUser.email,
      phone: cleanPhone || currentUser.phone,
      department: department || currentUser.department
    };

    const { data: updatedData, error: updateErr } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', userId)
      .select();

    if (updateErr) throw updateErr;

    const updatedUser = updatedData && updatedData.length > 0 ? updatedData[0] : { ...currentUser, ...updates };

    // Eğer e-posta adresi değiştiyse:
    // 1. Yeni e-postaya Hoş Geldiniz & Doğrulama maili at
    // 2. Eski e-postaya Güvenlik Uyarısı at
    if (cleanEmail && oldEmail && cleanEmail !== oldEmail.toLowerCase() && mailTransporter) {
      // Yeni e-postaya onay ve hoş geldiniz
      mailTransporter.sendMail({
        from: SMTP_FROM,
        to: cleanEmail,
        subject: 'FrpOku E-Posta Adresiniz Güncellendi! 🚀',
        text: `Merhaba ${updatedUser.full_name || updatedUser.username},\n\nFrpOku hesabınızın yeni e-posta adresi ${cleanEmail} olarak kaydedilmiştir.\n\nArtık şifre sıfırlama ve sistem bildirimleri bu adrese gelecektir.\n\nFrpOku Cloud Portal`,
        html: getWelcomeEmailHtml(updatedUser.full_name, updatedUser.username)
      }).catch(e => console.warn('New email notify error:', e.message));

      // Eski e-postaya güvenlik uyarısı
      mailTransporter.sendMail({
        from: SMTP_FROM,
        to: oldEmail,
        subject: '🛡️ FrpOku Hesabınızın E-Posta Adresi Değiştirildi',
        text: `Merhaba,\n\nFrpOku hesabınızın kayıtlı e-posta adresi ${cleanEmail} olarak güncellendi.\n\nBu işlemi siz yapmadıysanız lütfen derhal yöneticinizle iletişime geçiniz.`,
        html: `<div style="font-family:sans-serif;padding:24px;background:#0f172a;color:#fff;border-radius:12px;">
          <h2 style="color:#f59e0b;">🛡️ Güvenlik Bilgilendirmesi</h2>
          <p>FrpOku hesabınızın kayıtlı e-posta adresi <strong>${cleanEmail}</strong> olarak değiştirildi.</p>
          <p style="color:#94a3b8;font-size:13px;">Bu işlemi siz yapmadıysanız lütfen derhal sistem yöneticinize başvurunuz.</p>
        </div>`
      }).catch(e => console.warn('Old email notify error:', e.message));
    }

    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ success: false, reason: 'Profil güncellenirken hata oluştu: ' + err.message });
  }
});

// ── RAPOR DEPOLAMA VE YÖNETİM ENDPOINTLERİ ──────────────────
// Load all reports from Supabase (with fallback to local store.json)
app.get('/api/store/load', async (req, res) => {
  const storePath = path.join(__dirname, 'data', 'store.json');

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const parsedList = data.map(row => row.data || row);
        // Sync local cache
        try {
          const dataDir = path.dirname(storePath);
          if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
          fs.writeFileSync(storePath, JSON.stringify(parsedList, null, 2), 'utf8');
        } catch {}
        return res.json(parsedList);
      }
    } catch (e) {
      console.warn('Supabase okuma hatası, yerel dosyaya dönülüyor:', e.message);
    }
  }

  // Fallback to local store.json
  if (!fs.existsSync(storePath)) return res.json([]);
  try {
    const localData = fs.readFileSync(storePath, 'utf8');
    res.json(JSON.parse(localData));
  } catch {
    res.json([]);
  }
});

// Save / sync reports
app.post('/api/store/save', async (req, res) => {
  const storePath = path.join(__dirname, 'data', 'store.json');
  const tempPath = path.join(__dirname, 'data', 'store.json.tmp');
  const reports = req.body;

  // 1. Save local backup first
  try {
    const dataDir = path.dirname(storePath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(tempPath, JSON.stringify(reports, null, 2), 'utf8');
    fs.renameSync(tempPath, storePath);
  } catch (err) {
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
  }

  // 2. Sync to Supabase in parallel
  if (supabase && Array.isArray(reports)) {
    try {
      const rows = reports.map(report => {
        const id = report.id || report.fileId || String(Date.now());
        const name = report.name || report.fileName || 'İsimsiz Rapor';
        return {
          id,
          name,
          file_size: report.size || 0,
          category: report.category || '',
          tags: Array.isArray(report.tags) ? report.tags : [],
          is_favorite: !!report.favorite,
          is_pinned: !!report.pinned,
          sql_count: Array.isArray(report.queries) ? report.queries.length : (report.stats?.sqlCount || 0),
          memo_count: Array.isArray(report.memos) ? report.memos.length : (report.stats?.memoCount || 0),
          dataset_count: Array.isArray(report.datasets) ? report.datasets.length : 0,
          page_count: Array.isArray(report.pages) ? report.pages.length : (report.stats?.pageCount || 1),
          has_script: !!(report.pascalScript && report.pascalScript.trim().length > 0),
          data: report,
          updated_at: new Date().toISOString()
        };
      });

      if (rows.length > 0) {
        // Chunk upserts in batches of 100
        for (let i = 0; i < rows.length; i += 100) {
          const chunk = rows.slice(i, i + 100);
          await supabase.from('reports').upsert(chunk, { onConflict: 'id' });
        }
      }
    } catch (e) {
      console.warn('Supabase sync warning:', e.message);
    }
  }

  res.json({ success: true });
});

// Single report delete from Supabase
app.delete('/api/reports/:id', async (req, res) => {
  const { id } = req.params;
  if (supabase) {
    try {
      await supabase.from('reports').delete().eq('id', id);
    } catch (e) {
      console.warn('Supabase delete error:', e.message);
    }
  }
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`FrpOku Supabase Bulut Sunucusu http://localhost:${PORT} üzerinde çalışıyor.`);
});
