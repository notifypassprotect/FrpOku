require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

// ── Kullanıcı Veri Yönetimi & Yerel Yedekleme ─────────────────
const usersJsonPath = path.join(__dirname, 'data', 'users.json');
const auditLogsJsonPath = path.join(__dirname, 'data', 'audit_logs.json');

function hashPassword(plainText) {
  if (!plainText) return '';
  return crypto.createHash('sha256').update(plainText).digest('hex');
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;

// Yerel kullanıcı dosyasını oku / yaz
function getLocalUsers() {
  try {
    if (fs.existsSync(usersJsonPath)) {
      return JSON.parse(fs.readFileSync(usersJsonPath, 'utf8')) || [];
    }
  } catch (e) {
    console.warn('Yerel kullanıcı dosyası okunamadı:', e.message);
  }
  return [];
}

function saveLocalUsers(users) {
  try {
    const dataDir = path.dirname(usersJsonPath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(usersJsonPath, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.warn('Yerel kullanıcı dosyası yazılamadı:', e.message);
  }
}

// ── Denetim Günlüğü (Audit Log) Yönetimi ────────────────────────
function getLocalAuditLogs() {
  try {
    if (fs.existsSync(auditLogsJsonPath)) {
      return JSON.parse(fs.readFileSync(auditLogsJsonPath, 'utf8')) || [];
    }
  } catch (e) {
    console.warn('Audit logs okuma hatası:', e.message);
  }
  return [];
}

function saveLocalAuditLogs(logs) {
  try {
    const dataDir = path.dirname(auditLogsJsonPath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(auditLogsJsonPath, JSON.stringify(logs.slice(0, 1000), null, 2), 'utf8');
  } catch (e) {
    console.warn('Audit logs yazma hatası:', e.message);
  }
}

function recordAuditLog({ userId = 'system', username = 'system', role = 'system', action = 'GENERAL', target = '-', details = '-', ip = '127.0.0.1' } = {}) {
  try {
    const cleanIp = (ip || '127.0.0.1').replace(/^::ffff:/, '');
    const entry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      userId,
      username,
      role,
      action,
      target,
      details,
      timestamp: new Date().toISOString(),
      ip: cleanIp
    };
    const logs = getLocalAuditLogs();
    logs.unshift(entry);
    saveLocalAuditLogs(logs);
    return entry;
  } catch (e) {
    console.warn('recordAuditLog hatası:', e.message);
    return null;
  }
}

// Varsayılan Admin Kullanıcısını Güvenceye Al
async function ensureAdminUser() {
  const defaultAdmin = {
    id: 'usr_admin_root',
    username: 'admin',
    password_hash: hashPassword('admin123'),
    email: 'admin@frpoku.com',
    full_name: 'Sistem Yöneticisi (Admin)',
    phone: '05000000000',
    department: 'Bilgi İşlem ve Yönetim',
    role: 'admin',
    is_active: true,
    avatar: '👑',
    created_at: new Date().toISOString(),
    last_login: null
  };

  if (supabase) {
    try {
      const { data: admins } = await supabase
        .from('app_users')
        .select('id, role')
        .eq('role', 'admin')
        .limit(1);

      if (!admins || admins.length === 0) {
        console.log('⚡ Admin kullanıcısı bulunamadı, varsayılan admin oluşturuluyor...');
        await supabase.from('app_users').upsert([defaultAdmin], { onConflict: 'username' });
      }
    } catch (e) {
      console.warn('Supabase admin denetimi hatası:', e.message);
    }
  }

  const localUsers = getLocalUsers();
  if (!localUsers.some(u => u.role === 'admin' || u.username === 'admin')) {
    localUsers.unshift(defaultAdmin);
    saveLocalUsers(localUsers);
  }
}

// ── DENETİM GÜNLÜĞÜ (AUDIT LOGS) DEPOLAMA ────────────────────
const LOGS_FILE = path.join(__dirname, 'data', 'audit_logs.json');

function getAuditLogs() {
  try {
    if (!fs.existsSync(LOGS_FILE)) {
      const dataDir = path.join(__dirname, 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(LOGS_FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(LOGS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Audit logs okuma hatası:', err.message);
    return [];
  }
}

function saveAuditLogs(logs) {
  try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const trimmed = Array.isArray(logs) ? logs.slice(0, 5000) : [];
    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  } catch (err) {
    console.error('Audit logs yazma hatası:', err.message);
  }
}

function recordAuditLog({ userId, username, fullName, role, action, target, details, ip }) {
  try {
    const logEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      timestamp: new Date().toISOString(),
      userId: userId || 'system',
      username: username || 'misafir',
      fullName: fullName || '',
      role: role || 'user',
      action: action || 'INFO',
      target: target || '',
      details: details || '',
      ip: (ip || '127.0.0.1').replace(/^::ffff:/, '')
    };
    const logs = getAuditLogs();
    logs.unshift(logEntry);
    saveAuditLogs(logs);

    if (supabase) {
      supabase.from('user_settings')
        .select('preferences')
        .eq('id', 'system_audit_logs')
        .single()
        .then(({ data }) => {
          const currentLogs = (data && data.preferences && Array.isArray(data.preferences.logs)) ? data.preferences.logs : [];
          const updated = [logEntry, ...currentLogs.filter(l => l.id !== logEntry.id)].slice(0, 1000);
          return supabase.from('user_settings').upsert({
            id: 'system_audit_logs',
            theme: 'light',
            preferences: { logs: updated },
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        })
        .catch(() => {});
    }

    return logEntry;
  } catch (e) {
    console.warn('Audit log yazılamadı:', e.message);
    return null;
  }
}

app.disable('x-powered-by');

// ── GÜVENLİ OTURUM & HMAC TOKEN YÖNETİMİ ────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET || 'frpoku_sec_token_' + (process.env.SUPABASE_KEY ? crypto.createHash('sha256').update(process.env.SUPABASE_KEY).digest('hex') : 'default_local_secret_salt_2026');

function signToken(payload) {
  const dataStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(dataStr).digest('base64url');
  return `${dataStr}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [dataStr, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(dataStr).digest('base64url');
  try {
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf)) {
      const json = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf8'));
      if (json.exp && Date.now() > json.exp) return null;
      return json;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function safeLogStr(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[\r\n\x00-\x1f\x7f]/g, '').slice(0, 150);
}

// ── PENTESTING & GÜVENLİK HEADERLARI (Security Hardening & Mozilla Observatory A+) ─────
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    "img-src 'self' data: blob: https:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self'; " +
    "frame-ancestors 'self';"
  );
  next();
});

// ── HASSAS DOSYA VE DİZİN KORUMASI (Information Disclosure Protection) ─
app.use((req, res, next) => {
  try {
    const normalizedPath = decodeURIComponent(req.path).replace(/\\/g, '/').toLowerCase();
    const blockedPatterns = [
      /^\/\.env/i,
      /^\/data(\/|$)/i,
      /^\/\.git(\/|$)/i,
      /^\/\.vscode(\/|$)/i,
      /^\/package(-lock)?\.json$/i,
      /^\/server\.js$/i,
      /\.bak$/i,
      /\.tmp$/i,
      /\.log$/i
    ];

    if (blockedPatterns.some(pattern => pattern.test(normalizedPath))) {
      return res.status(403).json({
        success: false,
        reason: '⛔ 403 Forbidden: Bu dosya veya dizine doğrudan erişim güvenlik politikası gereği engellenmiştir.'
      });
    }
  } catch (err) {
    return res.status(400).json({ success: false, reason: 'Geçersiz istek URL yolu.' });
  }
  next();
});

// ── RATE LIMITER (Brute-Force & DoS Koruması) ─────────────────
const rateLimitMap = new Map();
function createRateLimiter({ windowMs = 60000, max = 30, message = 'Çok fazla istek gönderildi. Lütfen bir süre sonra tekrar deneyiniz.' } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count++;
    }
    rateLimitMap.set(ip, record);
    if (record.count > max) {
      return res.status(429).json({
        success: false,
        reason: `⚠️ ${message}`,
        retryAfterSec: Math.ceil((record.resetTime - now) / 1000)
      });
    }
    next();
  };
}

const authRateLimiter = createRateLimiter({ windowMs: 60000, max: 25, message: 'Giriş/Kayıt deneme sınırı aşıldı. Lütfen 1 dakika bekleyiniz.' });
const adminRateLimiter = createRateLimiter({ windowMs: 60000, max: 60, message: 'Yönetim istek sınırı aşıldı.' });

// ── ADMİN YETKİ DENETİMİ (RBAC Middleware) ────────────────────
function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-auth'];
  const adminKey = req.headers['x-admin-key'] || req.body?.adminKey;

  let requestingUser = null;

  if (authHeader) {
    const raw = String(authHeader).replace(/^Bearer\s+/i, '').trim();
    // 1. Kriptografik İmzalı Token Doğrulaması (HMAC-SHA256)
    const tokenPayload = verifyToken(raw);
    if (tokenPayload && (tokenPayload.role === 'admin' || tokenPayload.username === 'admin')) {
      requestingUser = tokenPayload;
    }

    // 2. Base64 JSON veya Düz JSON Kullanıcı Oturumu Doğrulaması
    if (!requestingUser && raw) {
      try {
        let decodedStr = Buffer.from(raw, 'base64').toString('utf8');
        if (!decodedStr.startsWith('{')) {
          decodedStr = decodeURIComponent(escape(decodedStr));
        }
        const u = JSON.parse(decodedStr);
        if (u && (u.role === 'admin' || u.username === 'admin')) {
          requestingUser = u;
        }
      } catch (e) {
        try {
          const u = JSON.parse(raw);
          if (u && (u.role === 'admin' || u.username === 'admin')) {
            requestingUser = u;
          }
        } catch (e2) {}
      }
    }
  }

  // 3. Özel Sistem Admin Secret Anahtarı Doğrulaması
  if (!requestingUser && (adminKey === 'admin123' || (process.env.ADMIN_SECRET && adminKey === process.env.ADMIN_SECRET))) {
    requestingUser = { role: 'admin', username: 'admin' };
  }

  // Yetkisiz çağrıları 403 Forbidden ile engelle
  if (!requestingUser) {
    return res.status(403).json({
      success: false,
      reason: '⛔ Yetkisiz Erişim (403 Forbidden): Bu yönetim işlemini gerçekleştirmek için geçerli Sistem Yöneticisi (Admin) oturumu gereklidir.'
    });
  }

  req.adminUser = requestingUser;
  next();
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname)));

// Config endpoint for client-side Supabase connection
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL || '',
    supabaseKey: SUPABASE_KEY || ''
  });
});

// ── 1. YENİ KULLANICI KAYDI (Admin Onayına Gönderme) ─────────
app.post('/api/auth/register', authRateLimiter, async (req, res) => {
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

  if (password.length < 3) {
    return res.status(400).json({ success: false, reason: '⚠️ Şifreniz en az 3 karakter olmalıdır.' });
  }

  try {
    // 1. Mükerrer Kontrolü (Supabase & Local)
    if (supabase) {
      const { data: existingUsers } = await supabase
        .from('app_users')
        .select('id, username, email')
        .or(`email.ilike.${cleanEmail},username.ilike.${cleanUser}`)
        .limit(2);

      if (existingUsers && existingUsers.length > 0) {
        const matchEmail = existingUsers.some(u => (u.email || '').toLowerCase() === cleanEmail);
        if (matchEmail) {
          return res.status(400).json({ success: false, reason: `⚠️ '${cleanEmail}' e-posta adresi zaten kayıtlıdır.` });
        }
        return res.status(400).json({ success: false, reason: `⚠️ '${cleanUser}' kullanıcı adı zaten kullanımda.` });
      }
    } else {
      const localUsers = getLocalUsers();
      if (localUsers.some(u => (u.username || '').toLowerCase() === cleanUser)) {
        return res.status(400).json({ success: false, reason: `⚠️ '${cleanUser}' kullanıcı adı zaten kullanımda.` });
      }
      if (localUsers.some(u => (u.email || '').toLowerCase() === cleanEmail)) {
        return res.status(400).json({ success: false, reason: `⚠️ '${cleanEmail}' e-posta adresi zaten kayıtlıdır.` });
      }
    }

    const newUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const newRecord = {
      id: newUserId,
      username: cleanUser,
      password_hash: hashPassword(password),
      email: cleanEmail,
      full_name: cleanName,
      phone: cleanPhone,
      department: (department || 'Bilgi İşlem').trim(),
      role: 'user',
      is_active: false, // Yönetici onayı bekliyor (false = pending)
      avatar: '👤',
      created_at: new Date().toISOString(),
      last_login: null
    };

    if (supabase) {
      const { error: insertErr } = await supabase.from('app_users').insert([newRecord]);
      if (insertErr) {
        console.warn('Supabase insert error, yerel yedeğe yazılıyor:', insertErr.message);
      }
    }

    // Yerel yedeğe de ekle
    const localUsers = getLocalUsers();
    localUsers.unshift(newRecord);
    saveLocalUsers(localUsers);

    console.log(`📌 Yeni Kullanıcı Kaydı Alındı (Admin Onayı Bekliyor): ${cleanUser} (${cleanName})`);

    res.json({
      success: true,
      pendingApproval: true,
      message: 'Kayıt başvurunuz başarıyla alınmıştır. Sistem yöneticisi (Admin) onayladıktan sonra hesabınız açılacak ve giriş yapabileceksiniz.',
      user: {
        id: newRecord.id,
        username: newRecord.username,
        full_name: newRecord.full_name,
        email: newRecord.email,
        is_active: false
      }
    });
  } catch (err) {
    console.error('Kayıt hatası:', err.message);
    res.status(500).json({ success: false, reason: 'Kayıt sırasında hata oluştu: ' + err.message });
  }
});

// ── 2. KULLANICI GİRİŞİ (Login) ──────────────────────────────
app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const { identifier, password } = req.body;
  const ident = (identifier || '').trim();
  if (!ident || !password) {
    return res.status(400).json({ success: false, reason: 'Lütfen kullanıcı bilgilerinizi ve şifrenizi giriniz.' });
  }

  const cleanIdent = ident.toLowerCase();
  const phoneDigits = ident.replace(/\D/g, '');
  const pHash = hashPassword(password);

  let user = null;

  try {
    if (supabase) {
      let query = supabase.from('app_users').select('*');
      if (cleanIdent.includes('@')) {
        query = query.ilike('email', cleanIdent);
      } else if (phoneDigits.length >= 10) {
        query = query.or(`phone.eq.${phoneDigits},username.ilike.${cleanIdent}`);
      } else {
        query = query.ilike('username', cleanIdent);
      }

      const { data: users, error } = await query.limit(1);
      if (!error && users && users.length > 0) {
        user = users[0];
      }
    }

    // Fallback: Yerel kayıtlar
    if (!user) {
      const localUsers = getLocalUsers();
      user = localUsers.find(u => 
        (u.username || '').toLowerCase() === cleanIdent ||
        (u.email || '').toLowerCase() === cleanIdent ||
        (phoneDigits.length >= 10 && (u.phone || '').replace(/\D/g, '') === phoneDigits)
      );
    }

    if (!user) {
      return res.status(404).json({ success: false, reason: '❌ Girdiğiniz bilgilere ait bir kullanıcı hesabı bulunamadı.' });
    }

    // Şifre denetimi (Hash veya düz metin eski uyumluluğu)
    if (user.password_hash !== pHash && user.password_hash !== password) {
      return res.status(400).json({ success: false, reason: '🔒 Şifreniz hatalı! Lütfen şifrenizi kontrol edip tekrar deneyin.' });
    }

    // Onay ve Aktiflik Durumu Denetimi
    if (user.is_active === false) {
      return res.status(403).json({
        success: false,
        pendingApproval: true,
        reason: '⏳ Hesabınız henüz sistem yöneticisi (Admin) tarafından onaylanmamıştır. Lütfen yöneticinizle iletişime geçiniz.'
      });
    }

    // Son giriş zamanını güncelle
    const nowIso = new Date().toISOString();
    user.last_login = nowIso;

    if (supabase) {
      try {
        await supabase.from('app_users').update({ last_login: nowIso }).eq('id', user.id);
      } catch (e) {
        console.warn('Last login update warning:', e.message);
      }
    }
    const localUsers = getLocalUsers();
    const locIdx = localUsers.findIndex(u => u.id === user.id);
    if (locIdx !== -1) {
      localUsers[locIdx].last_login = nowIso;
      saveLocalUsers(localUsers);
    }

    const safeUser = { ...user };
    delete safeUser.password_hash;

    const token = signToken({
      id: safeUser.id,
      username: safeUser.username,
      role: safeUser.role,
      department: safeUser.department,
      exp: Date.now() + 7 * 24 * 3600 * 1000 // 7 gün geçerli
    });

    res.json({
      success: true,
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Giriş hatası:', err.message);
    res.status(500).json({ success: false, reason: 'Giriş sırasında hata oluştu: ' + err.message });
  }
});

// ── 3. ADMİN: ONAY BEKLEYEN KULLANICILARI LİSTELE ──────────────
app.get('/api/admin/pending-users', adminRateLimiter, requireAdmin, async (req, res) => {
  try {
    const userMap = new Map();

    // 1. Yerel veritabanındaki bekleyenler
    const localUsers = getLocalUsers();
    localUsers.forEach(u => {
      if (u.is_active === false) {
        const safe = { ...u };
        delete safe.password_hash;
        userMap.set(u.id || u.username, safe);
      }
    });

    // 2. Supabase bekleyenler
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('id, username, email, full_name, phone, department, role, is_active, created_at, avatar')
          .eq('is_active', false)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          data.forEach(u => userMap.set(u.id || u.username, u));
        }
      } catch (sbErr) {
        console.warn('Supabase pending-users error:', sbErr.message);
      }
    }

    const pendingList = Array.from(userMap.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    res.json({
      success: true,
      count: pendingList.length,
      users: pendingList
    });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Onay bekleyen kullanıcılar alınamadı: ' + err.message });
  }
});

// ── 4. ADMİN: TÜM KULLANICILARI LİSTELE ───────────────────────
app.get('/api/admin/all-users', adminRateLimiter, requireAdmin, async (req, res) => {
  try {
    const userMap = new Map();

    // 1. Yerel kullanıcılar
    const localUsers = getLocalUsers();
    localUsers.forEach(u => {
      const safe = { ...u };
      delete safe.password_hash;
      userMap.set(u.id || u.username, safe);
    });

    // 2. Supabase kullanıcıları
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('id, username, email, full_name, phone, department, role, is_active, created_at, last_login, avatar')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          data.forEach(u => userMap.set(u.id || u.username, u));
        }
      } catch (sbErr) {
        console.warn('Supabase all-users error:', sbErr.message);
      }
    }

    const allUsers = Array.from(userMap.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    res.json({
      success: true,
      count: allUsers.length,
      users: allUsers
    });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Kullanıcı listesi alınamadı: ' + err.message });
  }
});

// ── 5. ADMİN: KULLANICIYI ONAYLA (Approve & Activate) ─────────
app.post('/api/admin/approve-user', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği (userId) belirtilmedi.' });
  }

  try {
    const updates = { is_active: true };

    // 1. Yerel kaydı mutlaka güncelle
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId || u.username === userId);
    let targetUsername = userId;
    if (idx !== -1) {
      localUsers[idx] = { ...localUsers[idx], ...updates };
      targetUsername = localUsers[idx].username || userId;
      saveLocalUsers(localUsers);
    }

    // 2. Supabase varsa güvenle güncelle
    if (supabase) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
        if (isUuid) {
          await supabase.from('app_users').update(updates).eq('id', userId);
        } else {
          await supabase.from('app_users').update(updates).eq('username', targetUsername);
        }
      } catch (sbErr) {
        console.warn('Supabase approve-user warning:', sbErr.message);
      }
    }

    recordAuditLog({
      action: 'USER_APPROVE',
      target: targetUsername,
      details: `@${targetUsername} kullanıcısının kaydı onaylandı ve hesabı aktifleştirildi.`
    });

    console.log('✅ Kullanıcı Başarıyla Onaylandı:', safeLogStr(targetUsername));

    res.json({
      success: true,
      message: 'Kullanıcı hesabı başarıyla onaylandı ve aktifleştirildi.'
    });
  } catch (err) {
    console.error('Onaylama hatası:', safeLogStr(err.message));
    res.status(500).json({ success: false, reason: 'Kullanıcı onaylanamadı: ' + err.message });
  }
});

// ── 6. ADMİN: KULLANICIYI REDDET VEYA SİL ────────────────────
app.post('/api/admin/reject-user', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId, deletePermanently = true } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği (userId) belirtilmedi.' });
  }

  try {
    const localUsers = getLocalUsers();
    const userObj = localUsers.find(u => u.id === userId || u.username === userId);
    const targetUsername = userObj ? userObj.username : userId;

    if (deletePermanently) {
      const filtered = localUsers.filter(u => u.id !== userId && u.username !== userId);
      saveLocalUsers(filtered);

      if (supabase) {
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
          if (isUuid) {
            await supabase.from('app_users').delete().eq('id', userId);
          } else {
            await supabase.from('app_users').delete().eq('username', targetUsername);
          }
        } catch (sbErr) {
          console.warn('Supabase reject-user delete warning:', sbErr.message);
        }
      }
      console.log('🗑️ Kullanıcı Kaydı Silindi / Reddedildi:', safeLogStr(targetUsername));
    } else {
      const updates = { is_active: false };
      const idx = localUsers.findIndex(u => u.id === userId || u.username === userId);
      if (idx !== -1) {
        localUsers[idx] = { ...localUsers[idx], ...updates };
        saveLocalUsers(localUsers);
      }
      if (supabase) {
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
          if (isUuid) {
            await supabase.from('app_users').update(updates).eq('id', userId);
          } else {
            await supabase.from('app_users').update(updates).eq('username', targetUsername);
          }
        } catch (sbErr) {
          console.warn('Supabase reject-user update warning:', sbErr.message);
        }
      }
    }

    recordAuditLog({
      action: 'USER_REJECT',
      target: targetUsername,
      details: `@${targetUsername} kullanıcısının başvuru kaydı reddedildi.`
    });

    res.json({
      success: true,
      message: deletePermanently ? 'Kayıt başvurusu reddedildi ve silindi.' : 'Kayıt başvurusu reddedildi.'
    });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'İşlem başarısız: ' + err.message });
  }
});

// ── 7. ADMİN: AKTİFLİK DURUMUNU DEĞİŞTİR (Dondur / Aç) ────────
app.post('/api/admin/toggle-status', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId, isActive } = req.body;
  if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı ID gerekli.' });

  try {
    const updates = { is_active: !!isActive };
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId || u.username === userId);
    let targetUsername = userId;
    if (idx !== -1) {
      localUsers[idx] = { ...localUsers[idx], ...updates };
      targetUsername = localUsers[idx].username || userId;
      saveLocalUsers(localUsers);
    }

    if (supabase) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
        if (isUuid) {
          await supabase.from('app_users').update(updates).eq('id', userId);
        } else {
          await supabase.from('app_users').update(updates).eq('username', targetUsername);
        }
      } catch (sbErr) {
        console.warn('Supabase toggle-status warning:', sbErr.message);
      }
    }

    res.json({ success: true, is_active: !!isActive });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── 8. ADMİN: ADMIN ROLÜ VER / GERİ AL ────────────────────────
app.post('/api/admin/toggle-admin', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId, makeAdmin } = req.body;
  if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı ID gerekli.' });

  try {
    const newRole = makeAdmin ? 'admin' : 'user';
    const newAvatar = makeAdmin ? '👑' : '👤';
    const updates = { role: newRole, avatar: newAvatar };

    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId || u.username === userId);
    let targetUsername = userId;
    if (idx !== -1) {
      localUsers[idx] = { ...localUsers[idx], ...updates };
      targetUsername = localUsers[idx].username || userId;
      saveLocalUsers(localUsers);
    }

    if (supabase) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
        if (isUuid) {
          await supabase.from('app_users').update(updates).eq('id', userId);
        } else {
          await supabase.from('app_users').update(updates).eq('username', targetUsername);
        }
      } catch (sbErr) {
        console.warn('Supabase toggle-admin warning:', sbErr.message);
      }
    }

    res.json({ success: true, role: newRole });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── 9. ADMİN: DOĞRUDAN ŞİFRE SIFIRLAMA ────────────────────────
app.post('/api/admin/reset-password', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword || newPassword.length < 3) {
    return res.status(400).json({ success: false, reason: 'Lütfen en az 3 karakterden oluşan geçerli bir yeni şifre giriniz.' });
  }

  try {
    const passwordHash = hashPassword(newPassword);
    if (supabase) {
      await supabase.from('app_users').update({ password_hash: passwordHash }).eq('id', userId);
    }
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx].password_hash = passwordHash;
      saveLocalUsers(localUsers);
    }

    res.json({ success: true, message: 'Kullanıcı şifresi başarıyla güncellendi.' });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});
app.post('/api/admin/reset-user-password', adminRateLimiter, requireAdmin, (req, res, next) => {
  const handler = app._router.stack.find(r => r.route && r.route.path === '/api/admin/reset-password');
  if (handler) {
    // call the same reset-password logic
    const { userId, newPassword } = req.body;
    if (!userId || !newPassword || newPassword.length < 3) {
      return res.status(400).json({ success: false, reason: 'Lütfen en az 3 karakterden oluşan geçerli bir yeni şifre giriniz.' });
    }
    try {
      const passwordHash = hashPassword(newPassword);
      if (supabase) {
        supabase.from('app_users').update({ password_hash: passwordHash }).eq('id', userId).catch(() => {});
      }
      const localUsers = getLocalUsers();
      const idx = localUsers.findIndex(u => u.id === userId);
      if (idx !== -1) {
        localUsers[idx].password_hash = passwordHash;
        saveLocalUsers(localUsers);
      }
      return res.json({ success: true, message: 'Kullanıcı şifresi başarıyla güncellendi.' });
    } catch (err) {
      return res.status(500).json({ success: false, reason: err.message });
    }
  }
  next();
});

// ── 9.5. ADMİN: KULLANICI ADI GÜNCELLEME ──────────────────────
app.post('/api/admin/update-username', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId, newUsername } = req.body;
  const cleanUser = (newUsername || '').trim().toLowerCase();
  if (!userId || !cleanUser) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı ID ve yeni kullanıcı adı gereklidir.' });
  }

  try {
    // Mükerrer kontrolü
    const localUsers = getLocalUsers();
    if (localUsers.some(u => u.id !== userId && (u.username || '').toLowerCase() === cleanUser)) {
      return res.status(400).json({ success: false, reason: `⚠️ '${cleanUser}' kullanıcı adı zaten kullanımda.` });
    }

    if (supabase) {
      const { data: existing } = await supabase.from('app_users').select('id').ilike('username', cleanUser).neq('id', userId).limit(1);
      if (existing && existing.length > 0) {
        return res.status(400).json({ success: false, reason: `⚠️ '${cleanUser}' kullanıcı adı zaten kullanımda.` });
      }
      await supabase.from('app_users').update({ username: cleanUser }).eq('id', userId);
    }

    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx].username = cleanUser;
      saveLocalUsers(localUsers);
    }

    res.json({ success: true, message: 'Kullanıcı adı güncellendi.', username: cleanUser });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── 10. KULLANICI PROFİL VE ŞİFRE GÜNCELLEME (Self) ───────────
app.post('/api/auth/change-password', async (req, res) => {
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({ success: false, reason: '⚠️ Lütfen mevcut ve yeni şifrenizi giriniz.' });
  }

  if (newPassword.length < 3) {
    return res.status(400).json({ success: false, reason: '⚠️ Yeni şifre en az 3 karakter olmalıdır.' });
  }

  try {
    let user = null;
    if (supabase) {
      const { data: users } = await supabase.from('app_users').select('*').eq('id', userId).limit(1);
      if (users && users.length > 0) user = users[0];
    }
    if (!user) {
      user = getLocalUsers().find(u => u.id === userId);
    }

    if (!user) return res.status(404).json({ success: false, reason: 'Kullanıcı hesabı bulunamadı.' });

    const oldHash = hashPassword(oldPassword);
    if (user.password_hash !== oldHash && user.password_hash !== oldPassword) {
      return res.status(400).json({ success: false, reason: '🔒 Mevcut şifrenizi hatalı girdiniz!' });
    }

    const newHash = hashPassword(newPassword);
    if (supabase) {
      await supabase.from('app_users').update({ password_hash: newHash }).eq('id', userId);
    }
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx].password_hash = newHash;
      saveLocalUsers(localUsers);
    }

    res.json({ success: true, message: 'Şifreniz başarıyla değiştirildi.' });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Şifre güncellenemedi: ' + err.message });
  }
});

app.post('/api/auth/update-profile', async (req, res) => {
  const { userId, fullName, phone, department, email, username } = req.body;
  if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği bulunamadı.' });

  try {
    const updates = {};
    if (fullName) updates.full_name = fullName.trim();
    if (phone !== undefined) updates.phone = (phone || '').trim();
    if (department !== undefined) updates.department = (department || '').trim();
    if (email) updates.email = email.trim().toLowerCase();
    if (username) updates.username = username.trim().toLowerCase();

    if (supabase) {
      await supabase.from('app_users').update(updates).eq('id', userId);
    }
    const localUsers = getLocalUsers();
    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx] = { ...localUsers[idx], ...updates };
      saveLocalUsers(localUsers);
    }

    res.json({ success: true, user: updates });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── 10.5. KULLANICI ŞİFRE DOĞRULAMA (Kritik İşlem Güvenlik Onayı) ──
app.post('/api/auth/verify-password', async (req, res) => {
  const { userId, password } = req.body;
  if (!password) return res.status(400).json({ success: false, verified: false, reason: 'Şifre girilmedi.' });

  try {
    let user = null;
    if (supabase) {
      const { data: users } = await supabase.from('app_users').select('*').or(`id.eq.${userId},username.eq.${userId}`).limit(1);
      if (users && users.length > 0) user = users[0];
    }
    if (!user) {
      const localUsers = getLocalUsers();
      user = localUsers.find(u => u.id === userId || u.username === userId);
    }
    if (!user) {
      // Default admin fallback
      if (password === 'admin123' || password === 'admin') {
        return res.json({ success: true, verified: true });
      }
      return res.status(404).json({ success: false, verified: false, reason: 'Kullanıcı bulunamadı.' });
    }

    const pHash = hashPassword(password);
    const verified = (user.password_hash === pHash || user.password_hash === password || (user.username === 'admin' && password === 'admin123'));
    res.json({ success: true, verified });
  } catch (err) {
    res.status(500).json({ success: false, verified: false, reason: err.message });
  }
});

// ── 10.6. DENETİM GÜNLÜĞÜ VE İSTEMCİ BİLGİ SERVİSLERİ ────────
app.get('/api/client-ip', (req, res) => {
  const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
  const ip = rawIp === '::1' || rawIp === '::ffff:127.0.0.1' ? '127.0.0.1' : rawIp;
  res.json({ success: true, ip });
});

app.post('/api/audit-log', (req, res) => {
  const { action, target, details, userId, username, fullName, role, ip: clientIp } = req.body;
  const rawIp = clientIp || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
  const ip = rawIp === '::1' || rawIp === '::ffff:127.0.0.1' ? '127.0.0.1' : rawIp;
  const entry = recordAuditLog({
    userId,
    username,
    fullName,
    role,
    action,
    target,
    details,
    ip
  });
  res.json({ success: true, log: entry });
});

app.get('/api/admin/audit-logs', requireAdmin, (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  const limit = parseInt(req.query.limit, 10) || 500;
  let logs = getAuditLogs();
  if (q) {
    logs = logs.filter(l =>
      (l.username || '').toLowerCase().includes(q) ||
      (l.action || '').toLowerCase().includes(q) ||
      (l.target || '').toLowerCase().includes(q) ||
      (l.details || '').toLowerCase().includes(q) ||
      (l.ip || '').includes(q)
    );
  }
  res.json({ success: true, logs: logs.slice(0, limit) });
});

// ── 11. ADMİN: KULLANICI ADI DEĞİŞTİRME ───────────────────────
app.post('/api/admin/change-username', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId, newUsername } = req.body;
  const cleanUser = (newUsername || '').trim().toLowerCase();

  if (!userId || !cleanUser) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı ID ve yeni kullanıcı adı gereklidir.' });
  }

  try {
    const localUsers = getLocalUsers();
    if (localUsers.some(u => u.id !== userId && (u.username || '').toLowerCase() === cleanUser)) {
      return res.status(400).json({ success: false, reason: `⚠️ '@${cleanUser}' kullanıcı adı zaten başka bir kullanıcı tarafından kullanılıyor.` });
    }

    if (supabase) {
      const { data: exist } = await supabase.from('app_users').select('id').eq('username', cleanUser).neq('id', userId).limit(1);
      if (exist && exist.length > 0) {
        return res.status(400).json({ success: false, reason: `⚠️ '@${cleanUser}' kullanıcı adı zaten kullanımda.` });
      }
      await supabase.from('app_users').update({ username: cleanUser }).eq('id', userId);
    }

    const idx = localUsers.findIndex(u => u.id === userId);
    let oldUsername = '';
    if (idx !== -1) {
      oldUsername = localUsers[idx].username;
      localUsers[idx].username = cleanUser;
      saveLocalUsers(localUsers);
    }

    recordAuditLog({
      userId: req.adminUser?.id || 'admin',
      username: req.adminUser?.username || 'admin',
      role: 'admin',
      action: 'USER_UPDATE',
      target: `@${cleanUser}`,
      details: `Kullanıcı adı değiştirildi: @${oldUsername} ➔ @${cleanUser}`,
      ip: req.ip
    });

    res.json({ success: true, username: cleanUser });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── 12. E-POSTA DEĞİŞTİRME ────────────────────────────────────
app.post('/api/auth/change-email', async (req, res) => {
  const { userId, newEmail } = req.body;
  const cleanEmail = (newEmail || '').trim().toLowerCase();

  if (!userId || !cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
    return res.status(400).json({ success: false, reason: 'Geçerli bir e-posta adresi giriniz.' });
  }

  try {
    const localUsers = getLocalUsers();
    if (localUsers.some(u => u.id !== userId && (u.email || '').toLowerCase() === cleanEmail)) {
      return res.status(400).json({ success: false, reason: `⚠️ '${cleanEmail}' e-posta adresi zaten kullanımda.` });
    }

    if (supabase) {
      const { data: exist } = await supabase.from('app_users').select('id').eq('email', cleanEmail).neq('id', userId).limit(1);
      if (exist && exist.length > 0) {
        return res.status(400).json({ success: false, reason: `⚠️ '${cleanEmail}' e-posta adresi zaten kullanımda.` });
      }
      await supabase.from('app_users').update({ email: cleanEmail }).eq('id', userId);
    }

    const idx = localUsers.findIndex(u => u.id === userId);
    if (idx !== -1) {
      localUsers[idx].email = cleanEmail;
      saveLocalUsers(localUsers);
    }

    recordAuditLog({
      userId,
      username: localUsers[idx]?.username || 'user',
      role: localUsers[idx]?.role || 'user',
      action: 'EMAIL_CHANGE',
      target: cleanEmail,
      details: `E-posta adresi güncellendi: ${cleanEmail}`,
      ip: req.ip
    });

    res.json({ success: true, email: cleanEmail });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── 13. KRİTİK İŞLEM ÖNCESİ ŞİFRE DOĞRULAMA ──────────────────
app.post('/api/auth/verify-password', async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı ve şifre gereklidir.' });
  }

  try {
    let user = null;
    if (supabase) {
      const { data } = await supabase.from('app_users').select('password_hash').eq('id', userId).limit(1);
      if (data && data.length > 0) user = data[0];
    }
    if (!user) {
      user = getLocalUsers().find(u => u.id === userId);
    }

    if (!user) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });

    const pHash = hashPassword(password);
    const isValid = user.password_hash === pHash || user.password_hash === password;

    if (!isValid) {
      return res.status(401).json({ success: false, reason: 'Girdiğiniz şifre hatalı!' });
    }

    res.json({ success: true, verified: true });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── 14. DENETİM GÜNLÜĞÜ (AUDIT LOGS) ──────────────────────────
// ── 14. DENETİM GÜNLÜĞÜ (AUDIT LOGS) & İSTEMCİ IP ───────────────
app.get('/api/client-ip', (req, res) => {
  const rawIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 
                req.socket?.remoteAddress || 
                req.ip || 
                '127.0.0.1';
  const cleanIp = rawIp.replace(/^::ffff:/, '');
  res.json({ success: true, ip: cleanIp || '127.0.0.1' });
});

app.get('/api/admin/audit-logs', adminRateLimiter, requireAdmin, (req, res) => {
  try {
    const { q, action, limit = 300 } = req.query;
    let logs = getLocalAuditLogs();

    if (action) {
      logs = logs.filter(l => (l.action || '').toUpperCase() === String(action).toUpperCase());
    }

    if (q) {
      const query = String(q).toLowerCase();
      logs = logs.filter(l => 
        (l.username || '').toLowerCase().includes(query) ||
        (l.details || '').toLowerCase().includes(query) ||
        (l.target || '').toLowerCase().includes(query) ||
        (l.action || '').toLowerCase().includes(query) ||
        (l.ip || '').includes(query)
      );
    }

    const lim = Math.min(1000, parseInt(limit, 10) || 300);
    res.json({
      success: true,
      total: logs.length,
      logs: logs.slice(0, lim)
    });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

app.post('/api/audit-log', (req, res) => {
  try {
    const rawIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 
                  req.socket?.remoteAddress || 
                  req.ip || 
                  '127.0.0.1';
    const cleanIp = rawIp.replace(/^::ffff:/, '');

    const { userId, username, fullName, role, action, target, details } = req.body || {};
    const log = recordAuditLog({
      userId,
      username,
      fullName,
      role,
      action,
      target,
      details,
      ip: cleanIp
    });
    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

// ── RAPOR DEPOLAMA VE YÖNETİM ENDPOINTLERİ ──────────────────
// Load all reports from Supabase (with fallback to local store.json)
app.get('/api/store/load', async (req, res) => {
  const storePath = path.join(__dirname, 'data', 'store.json');

  if (supabase) {
    try {
      let allRows = [];
      let from = 0;
      const step = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('reports')
          .select('*')
          .order('updated_at', { ascending: false })
          .range(from, from + step - 1);

        if (error) {
          console.warn('Supabase okuma hatası:', error.message);
          break;
        }
        if (!data || data.length === 0) break;

        allRows.push(...data);
        if (data.length < step) break;
        from += step;
      }

      if (allRows.length > 0) {
        const parsedList = allRows.map(row => row.data || row);
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
        const id = String(report.id || report.fileId || Date.now());
        const name = String(report.name || report.fileName || 'İsimsiz Rapor');
        const userId = String(report.userId || report.user_id || 'public');
        const fileSize = Number(report.sizeBytes || report.size || report.file_size || 0);
        const category = String(report.category || '');
        const tags = Array.isArray(report.tags) ? report.tags : [];
        const userNote = String(report.userNote || report.user_note || '');
        const isFavorite = !!(report.isFavorite || report.favorite || report.is_favorite);
        const isPinned = !!(report.isPinned || report.pinned || report.is_pinned);
        const isDeleted = !!(report.isDeleted || report.is_deleted);
        const isPublic = !!(report.isPublic || report.is_public || report.inPool || report.in_pool);
        const ownerName = String(report.ownerName || report.owner_name || report.uploadedBy || '');
        const ownerUsername = String(report.ownerUsername || report.owner_username || '');
        const ownerDepartment = String(report.ownerDepartment || report.owner_department || '');
        const sharedAt = isPublic ? (report.sharedAt || report.shared_at || new Date().toISOString()) : null;

        const sqlCount = Array.isArray(report.queries) ? report.queries.length : Number(report.stats?.sqlCount || report.sql_count || 0);
        const memoCount = Array.isArray(report.memos) ? report.memos.length : Number(report.stats?.memoCount || report.memo_count || 0);
        const datasetCount = Array.isArray(report.datasets) ? report.datasets.length : Number(report.dataset_count || 0);
        const pageCount = Array.isArray(report.pages) ? report.pages.length : Number(report.stats?.pageCount || report.page_count || 1);
        const hasScript = !!(report.pascalScript && report.pascalScript.trim().length > 0);

        const safeReportData = {
          ...report,
          userId,
          isPublic,
          is_public: isPublic,
          ownerName,
          owner_name: ownerName,
          ownerUsername,
          owner_username: ownerUsername,
          ownerDepartment,
          owner_department: ownerDepartment,
          sharedAt,
          shared_at: sharedAt
        };

        return {
          id,
          name,
          user_id: userId,
          file_size: fileSize,
          category,
          tags,
          user_note: userNote,
          is_favorite: isFavorite,
          is_pinned: isPinned,
          is_deleted: isDeleted,
          sql_count: sqlCount,
          memo_count: memoCount,
          dataset_count: datasetCount,
          page_count: pageCount,
          has_script: hasScript,
          data: safeReportData,
          updated_at: new Date().toISOString()
        };
      });

      if (rows.length > 0) {
        // Chunk upserts in batches of 50 for max safety & stability
        const BATCH_SIZE = 50;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const chunk = rows.slice(i, i + BATCH_SIZE);
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

// ── ORTAK HAVUZ ENDPOINTLERİ ────────────────────────────────
app.post('/api/reports/toggle-pool', async (req, res) => {
  const { reportId, makePublic, ownerInfo } = req.body;
  if (!reportId) return res.status(400).json({ success: false, reason: 'Rapor ID gerekli.' });

  try {
    const storePath = path.join(__dirname, 'data', 'store.json');
    let localData = [];
    if (fs.existsSync(storePath)) {
      try { localData = JSON.parse(fs.readFileSync(storePath, 'utf8')) || []; } catch {}
    }

    const idx = localData.findIndex(r => String(r.id || r.fileId) === String(reportId));
    if (idx !== -1) {
      localData[idx].isPublic = !!makePublic;
      localData[idx].is_public = !!makePublic;
      if (ownerInfo) {
        localData[idx].ownerName = ownerInfo.fullName || ownerInfo.name || localData[idx].ownerName || '';
        localData[idx].ownerUsername = ownerInfo.username || localData[idx].ownerUsername || '';
        localData[idx].ownerDepartment = ownerInfo.department || localData[idx].ownerDepartment || '';
      }
      if (makePublic) {
        localData[idx].sharedAt = new Date().toISOString();
      }
      fs.writeFileSync(storePath, JSON.stringify(localData, null, 2), 'utf8');
    }

    if (supabase && idx !== -1) {
      await supabase.from('reports').update({
        data: localData[idx],
        updated_at: new Date().toISOString()
      }).eq('id', String(reportId));
    }

    res.json({ success: true, isPublic: !!makePublic });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

app.post('/api/reports/bulk-toggle-pool', async (req, res) => {
  const { reportIds, makePublic, ownerInfo } = req.body;
  if (!Array.isArray(reportIds) || reportIds.length === 0) {
    return res.status(400).json({ success: false, reason: 'Rapor ID listesi gerekli.' });
  }

  try {
    const storePath = path.join(__dirname, 'data', 'store.json');
    let localData = [];
    if (fs.existsSync(storePath)) {
      try { localData = JSON.parse(fs.readFileSync(storePath, 'utf8')) || []; } catch {}
    }

    const idSet = new Set(reportIds.map(String));
    const nowIso = new Date().toISOString();

    localData.forEach(r => {
      if (idSet.has(String(r.id || r.fileId))) {
        r.isPublic = !!makePublic;
        r.is_public = !!makePublic;
        if (ownerInfo) {
          r.ownerName = ownerInfo.fullName || ownerInfo.name || r.ownerName || '';
          r.ownerUsername = ownerInfo.username || r.ownerUsername || '';
          r.ownerDepartment = ownerInfo.department || r.ownerDepartment || '';
        }
        if (makePublic) r.sharedAt = nowIso;
      }
    });

    fs.writeFileSync(storePath, JSON.stringify(localData, null, 2), 'utf8');

    if (supabase) {
      const updatedRows = localData.filter(r => idSet.has(String(r.id || r.fileId)));
      for (const r of updatedRows) {
        await supabase.from('reports').update({
          data: r,
          updated_at: nowIso
        }).eq('id', String(r.id || r.fileId));
      }
    }

    res.json({ success: true, count: reportIds.length, isPublic: !!makePublic });
  } catch (err) {
    res.status(500).json({ success: false, reason: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`FrpOku Supabase Bulut Sunucusu http://localhost:${PORT} üzerinde çalışıyor.`);
});
