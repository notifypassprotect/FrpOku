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
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 465;
const SMTP_SECURE = process.env.SMTP_SECURE !== 'false';
const SMTP_USER = process.env.SMTP_USER || 'notifypassprotect@gmail.com';
const SMTP_PASS = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
const SMTP_FROM = process.env.SMTP_FROM || `"FrpOku Cloud Portal" <${SMTP_USER}>`;

let mailTransporter = null;
if (SMTP_USER && SMTP_PASS) {
  mailTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  mailTransporter.verify((err, success) => {
    if (err) {
      console.warn('⚠️ SMTP Bağlantı Uyarısı:', err.message);
    } else {
      console.log('✅ SMTP E-Posta Servisi Hazır:', SMTP_USER);
    }
  });
}

// In-Memory OTP Store: identifier -> { code, expiresAt, email, userId }
const otpStore = new Map();

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

// ── 1. HOŞ GELDİNİZ MAİLİ GÖNDERME ──────────────────────────
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
    return res.status(400).json({ success: false, reason: 'Lütfen kullanıcı adı veya e-posta girin.' });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, reason: 'Veritabanı bağlantısı yok.' });
  }

  try {
    // Kullanıcıyı bul
    let query = supabase.from('app_users').select('id, username, email, full_name');
    if (ident.includes('@')) {
      query = query.eq('email', ident);
    } else {
      query = query.eq('username', ident);
    }

    const { data: users, error } = await query.limit(1);
    if (error || !users || users.length === 0) {
      return res.status(404).json({ success: false, reason: 'Girdiğiniz bilgilere ait bir kullanıcı bulunamadı.' });
    }

    const user = users[0];
    if (!user.email) {
      return res.status(400).json({ success: false, reason: 'Kullanıcının kayıtlı bir e-posta adresi bulunmuyor.' });
    }

    // 6 Haneli Rastgele Sayısal OTP Üret
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 dakika

    // Store in memory
    otpStore.set(user.email.toLowerCase(), {
      code: otpCode,
      expiresAt,
      userId: user.id,
      name: user.full_name || user.username
    });

    // E-Posta Gönder
    if (mailTransporter) {
      await mailTransporter.sendMail({
        from: SMTP_FROM,
        to: user.email,
        subject: `🔑 ${otpCode} - FrpOku Şifre Sıfırlama Doğrulama Kodu`,
        html: getOtpEmailHtml(user.full_name || user.username, otpCode)
      });
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
  const cleanCode = (code || '').trim();

  if (!cleanEmail || !cleanCode || !newPassword) {
    return res.status(400).json({ success: false, reason: 'Lütfen tüm alanları doldurun.' });
  }

  if (newPassword.length < 3) {
    return res.status(400).json({ success: false, reason: 'Yeni şifre en az 3 karakter olmalıdır.' });
  }

  const record = otpStore.get(cleanEmail);
  if (!record) {
    return res.status(400).json({ success: false, reason: 'Geçersiz veya süresi dolmuş kod talebi. Lütfen tekrar kod isteyin.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanEmail);
    return res.status(400).json({ success: false, reason: 'Doğrulama kodunun süresi doldu (10 dakika). Lütfen yeni kod isteyin.' });
  }

  if (record.code !== cleanCode) {
    return res.status(400).json({ success: false, reason: 'Girdiğiniz 6 haneli güvenlik kodu hatalı!' });
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

    // Güvenlik e-postası gönder
    if (mailTransporter) {
      mailTransporter.sendMail({
        from: SMTP_FROM,
        to: cleanEmail,
        subject: '🛡️ FrpOku Şifreniz Güncellendi',
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
    return res.status(400).json({ success: false, reason: 'Lütfen mevcut ve yeni şifrenizi girin.' });
  }

  if (newPassword.length < 3) {
    return res.status(400).json({ success: false, reason: 'Yeni şifre en az 3 karakter olmalıdır.' });
  }

  if (!supabase) {
    return res.status(500).json({ success: false, reason: 'Veritabanı bağlantısı kurulamadı.' });
  }

  try {
    const { data: users, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', userId)
      .limit(1);

    if (error || !users || users.length === 0) {
      return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
    }

    const user = users[0];
    const oldHash = hashPassword(oldPassword);

    if (user.password_hash !== oldHash && user.password_hash !== oldPassword) {
      return res.status(400).json({ success: false, reason: 'Mevcut şifrenizi hatalı girdiniz!' });
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
        subject: '🛡️ FrpOku Şifreniz Güncellendi',
        html: getPasswordChangedEmailHtml(user.full_name || user.username)
      }).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Şifre güncellenemedi: ' + err.message });
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
