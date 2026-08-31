require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { isValidEmail, isValidText, isValidUsername, normalizeEmail, normalizePhone, normalizeText, normalizeUsername } = require('./lib/input_validation');
const { createMailer } = require('./lib/mailer');
const { PASSWORD_MAX_LENGTH, hashPassword, verifyPassword: verifyPasswordHash } = require('./lib/passwords');
const { createRateLimiter } = require('./lib/rate_limiter');
const { buildOwnedReportRow, canManageReport, canReadReport, reportId, reportRowToClient } = require('./lib/report_access');
const { createSessionAuth } = require('./lib/session_auth');
const { createStagingAccessMiddleware } = require('./lib/staging_access');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_ENV = process.env.NODE_ENV || 'development';
const IS_DEPLOYED_ENVIRONMENT = APP_ENV === 'production' || APP_ENV === 'staging';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || (!IS_DEPLOYED_ENVIRONMENT ? process.env.SUPABASE_KEY : '') || '';
const BROWSER_SUPABASE_ENABLED = ['1', 'true', 'yes', 'on'].includes(String(process.env.ENABLE_BROWSER_SUPABASE || '').toLowerCase());

function validateEnvironment() {
  const missing = [];
  const requireValue = key => {
    if (!String(process.env[key] || '').trim()) missing.push(key);
  };

  if (IS_DEPLOYED_ENVIRONMENT) {
    ['SESSION_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].forEach(requireValue);
  }
  if (APP_ENV === 'staging') {
    ['APP_BASE_URL', 'STAGING_ACCESS_USER', 'STAGING_ACCESS_PASSWORD', 'BOOTSTRAP_ADMIN_USERNAME', 'BOOTSTRAP_ADMIN_PASSWORD', 'BOOTSTRAP_ADMIN_EMAIL'].forEach(requireValue);
  }
  if (BROWSER_SUPABASE_ENABLED) requireValue('SUPABASE_ANON_KEY');
  if (['1', 'true', 'yes', 'on'].includes(String(process.env.MAIL_ENABLED || '').toLowerCase())) {
    ['APP_BASE_URL', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].forEach(requireValue);
  }
  if (missing.length > 0) {
    throw new Error(`Eksik zorunlu ortam değişkenleri: ${[...new Set(missing)].join(', ')}`);
  }
}

validateEnvironment();

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVER_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY);
}

const mailer = createMailer();

// ── Kullanıcı Veri Yönetimi & Yerel Yedekleme ─────────────────
const usersJsonPath = path.join(__dirname, 'data', 'users.json');

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

async function loadUserById(userId) {
  if (!userId) return null;
  if (supabase) {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', String(userId))
      .limit(1);
    if (error) throw error;
    return data && data[0] ? data[0] : null;
  }
  return getLocalUsers().find(user => String(user.id) === String(userId)) || null;
}

async function updateUserById(userId, updates) {
  if (supabase) {
    const { data, error } = await supabase
      .from('app_users')
      .update(updates)
      .eq('id', String(userId))
      .select('id, username, email, full_name, phone, department, role, is_active, avatar, created_at, last_login')
      .limit(1);
    if (error) throw error;
    return data && data[0] ? data[0] : null;
  }

  const users = getLocalUsers();
  const index = users.findIndex(user => String(user.id) === String(userId));
  if (index === -1) return null;
  users[index] = { ...users[index], ...updates };
  saveLocalUsers(users);
  const safeUser = { ...users[index] };
  delete safeUser.password_hash;
  return safeUser;
}

// Staging/ilk kurulum admini yalnızca ortam değişkenlerinden oluşturulur.
async function ensureAdminUser() {
  const bootstrapUsername = (process.env.BOOTSTRAP_ADMIN_USERNAME || '').trim().toLowerCase();
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  const bootstrapEmail = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();

  if (!bootstrapUsername || !bootstrapPassword) return false;
  if (bootstrapPassword.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD en az 12 karakter olmalıdır.');
  }

  const bootstrapAdmin = {
    id: 'usr_admin_root',
    username: bootstrapUsername,
    password_hash: await hashPassword(bootstrapPassword),
    email: bootstrapEmail,
    full_name: 'Sistem Yöneticisi (Admin)',
    phone: '',
    department: 'Bilgi İşlem ve Yönetim',
    role: 'admin',
    is_active: true,
    avatar: 'A',
    created_at: new Date().toISOString(),
    last_login: null
  };

  if (supabase) {
    const { data: admins, error: adminQueryError } = await supabase
      .from('app_users')
      .select('id, role')
      .eq('role', 'admin')
      .limit(1);
    if (adminQueryError) throw adminQueryError;

    if (!admins || admins.length === 0) {
      console.log('Admin kullanıcısı bulunamadı, ortam değişkenlerinden bootstrap admin oluşturuluyor...');
      const { error } = await supabase.from('app_users').upsert([bootstrapAdmin], { onConflict: 'username' });
      if (error) throw error;
    }
    return true;
  }

  const localUsers = getLocalUsers();
  if (!localUsers.some(u => u.role === 'admin' || u.username === bootstrapUsername)) {
    localUsers.unshift(bootstrapAdmin);
    saveLocalUsers(localUsers);
  }
  return true;
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

async function recordAuditLog({ userId, username, fullName, role, action, target, details, ip }) {
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
    if (supabase) {
      const { error } = await supabase.from('audit_logs').insert({
        id: logEntry.id,
        occurred_at: logEntry.timestamp,
        user_id: logEntry.userId,
        username: logEntry.username,
        full_name: logEntry.fullName,
        role: logEntry.role,
        action: logEntry.action,
        target: logEntry.target,
        details: logEntry.details,
        ip: logEntry.ip
      });
      if (error) throw error;
    } else {
      const logs = getAuditLogs();
      logs.unshift(logEntry);
      saveAuditLogs(logs);
    }

    return logEntry;
  } catch (e) {
    console.warn('Audit log yazılamadı:', safeLogStr(e.message));
    return null;
  }
}

app.disable('x-powered-by');
app.set('trust proxy', IS_DEPLOYED_ENVIRONMENT ? 1 : false);

// ── GÜVENLİ OTURUM & HMAC TOKEN YÖNETİMİ ────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');

const { signToken, requireAuth, requireAdmin } = createSessionAuth({
  secret: SESSION_SECRET,
  userLoader: loadUserById
});

function safeLogStr(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[\r\n\x00-\x1f\x7f]/g, '').slice(0, 150);
}

function boundedSetting(value, maxLength, fallback = '') {
  const text = String(value ?? fallback).trim();
  return text.slice(0, maxLength) || fallback;
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
        reason: '403 Forbidden: Bu dosya veya dizine doğrudan erişim güvenlik politikası gereği engellenmiştir.'
      });
    }
  } catch (err) {
    return res.status(400).json({ success: false, reason: 'Geçersiz istek URL yolu.' });
  }
  next();
});

const authRateLimiter = createRateLimiter({ windowMs: 60000, max: 25, message: 'Giriş/Kayıt deneme sınırı aşıldı. Lütfen 1 dakika bekleyiniz.' });
const adminRateLimiter = createRateLimiter({ windowMs: 60000, max: 60, message: 'Yönetim istek sınırı aşıldı.' });
const apiWriteRateLimiter = createRateLimiter({ windowMs: 60000, max: 120, message: 'Yazma işlemi sınırı aşıldı. Lütfen kısa bir süre bekleyiniz.' });

const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '15mb';
app.use(express.json({ limit: requestBodyLimit, strict: true }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 1000 }));
app.use(createStagingAccessMiddleware());

// Yalnızca tarayıcıya gerekli dosyaları yayınla; sunucu, test, migration ve
// deployment dosyaları statik olarak erişilebilir değildir.
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
function sendScriptSafePage(res, page) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    "img-src 'self' data: blob: https:; " +
    "worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';"
  );
  res.sendFile(path.join(__dirname, page));
}
function sendNoncePage(res, page) {
  const nonce = crypto.randomBytes(18).toString('base64');
  const filePath = path.join(__dirname, page);
  fs.readFile(filePath, 'utf8', (error, source) => {
    if (error) return res.status(500).send('Sayfa yüklenemedi.');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net; ` +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
      "img-src 'self' data: blob: https:; " +
      "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';"
    );
    const html = source.replace(/<script(?![^>]*\bsrc=)([^>]*)>/gi, `<script nonce="${nonce}"$1>`);
    res.type('html').send(html);
  });
}
app.get('/', (req, res) => sendScriptSafePage(res, 'index.html'));
app.get('/index.html', (req, res) => sendScriptSafePage(res, 'index.html'));
app.get('/compare.html', (req, res) => sendScriptSafePage(res, 'compare.html'));
app.get('/detail.html', (req, res) => sendScriptSafePage(res, 'detail.html'));
app.get('/dashboard.html', (req, res) => sendNoncePage(res, 'dashboard.html'));

app.get('/api/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    service: 'frpoku',
    environment: APP_ENV,
    timestamp: new Date().toISOString()
  });
});

app.get('/runtime-config.js', (req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  const publicConfig = {
    supabaseUrl: SUPABASE_URL || '',
    supabaseAnonKey: BROWSER_SUPABASE_ENABLED ? SUPABASE_ANON_KEY : '',
    environment: APP_ENV
  };
  res.send(`window.FRP_RUNTIME_CONFIG = ${JSON.stringify(publicConfig)};`);
});

// Config endpoint for client-side Supabase connection
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: SUPABASE_URL || '',
    supabaseAnonKey: BROWSER_SUPABASE_ENABLED ? SUPABASE_ANON_KEY : ''
  });
});

// ── 1. YENİ KULLANICI KAYDI (Admin Onayına Gönderme) ─────────
app.post('/api/auth/register', authRateLimiter, async (req, res) => {
  const { fullName, username, email, phone, department, password } = req.body;
  const cleanEmail = normalizeEmail(email);
  const cleanUser = normalizeUsername(username);
  const cleanName = normalizeText(fullName);
  const cleanPhone = normalizePhone(phone);
  const cleanDepartment = normalizeText(department || 'Bilgi İşlem');

  if (!cleanName || !cleanUser || !cleanEmail || !password) {
    return res.status(400).json({ success: false, reason: 'Lütfen zorunlu alanları (Ad Soyad, Kullanıcı Adı, E-Posta, Şifre) eksiksiz doldurunuz.' });
  }

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ success: false, reason: 'Lütfen geçerli bir e-posta formatı giriniz (Örn: ad.soyad@kurum.com).' });
  }

  if (!isValidUsername(cleanUser)) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı adı 3-50 karakter olmalı; yalnızca küçük harf, rakam, nokta, alt çizgi ve tire içermelidir.' });
  }

  if (!isValidText(cleanName, { min: 2, max: 120 }) || !isValidText(cleanDepartment, { min: 1, max: 120 })) {
    return res.status(400).json({ success: false, reason: 'Ad soyad veya bölüm alanı izin verilen uzunlukta değildir.' });
  }

  if (password.length < 10 || password.length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ success: false, reason: `Şifreniz 10-${PASSWORD_MAX_LENGTH} karakter arasında olmalıdır.` });
  }

  try {
    if (supabase) {
      const usernameResult = await supabase.from('app_users').select('id').eq('username', cleanUser).limit(1);
      if (usernameResult.error) throw usernameResult.error;
      if (usernameResult.data?.length) return res.status(400).json({ success: false, reason: `'${cleanUser}' kullanıcı adı zaten kullanımda.` });

      const emailResult = await supabase.from('app_users').select('id').eq('email', cleanEmail).limit(1);
      if (emailResult.error) throw emailResult.error;
      if (emailResult.data?.length) return res.status(400).json({ success: false, reason: `'${cleanEmail}' e-posta adresi zaten kayıtlıdır.` });
    } else {
      const localUsers = getLocalUsers();
      if (localUsers.some(u => (u.username || '').toLowerCase() === cleanUser)) {
        return res.status(400).json({ success: false, reason: `'${cleanUser}' kullanıcı adı zaten kullanımda.` });
      }
      if (localUsers.some(u => (u.email || '').toLowerCase() === cleanEmail)) {
        return res.status(400).json({ success: false, reason: `'${cleanEmail}' e-posta adresi zaten kayıtlıdır.` });
      }
    }

    const newUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const newRecord = {
      id: newUserId,
      username: cleanUser,
      password_hash: await hashPassword(password),
      email: cleanEmail,
      full_name: cleanName,
      phone: cleanPhone,
      department: cleanDepartment,
      role: 'user',
      is_active: false, // Yönetici onayı bekliyor (false = pending)
      avatar: 'U',
      created_at: new Date().toISOString(),
      last_login: null
    };

    if (supabase) {
      const { error: insertErr } = await supabase.from('app_users').insert([newRecord]);
      if (insertErr) throw insertErr;
    } else {
      const localUsers = getLocalUsers();
      localUsers.unshift(newRecord);
      saveLocalUsers(localUsers);
    }

    console.log(`Yeni Kullanıcı Kaydı Alındı (Admin Onayı Bekliyor): ${cleanUser} (${cleanName})`);

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
    console.error('Kayıt hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Kayıt servisi geçici olarak kullanılamıyor.' });
  }
});

// ── 2. KULLANICI GİRİŞİ (Login) ──────────────────────────────
app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const { identifier, password } = req.body;
  const ident = String(identifier || '').trim();
  if (!ident || !password || ident.length > 254 || String(password).length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ success: false, reason: 'Lütfen kullanıcı bilgilerinizi ve şifrenizi giriniz.' });
  }

  const cleanIdent = ident.toLowerCase();
  const phoneDigits = ident.replace(/\D/g, '');
  let user = null;

  try {
    if (supabase) {
      let query = supabase.from('app_users').select('*');
      if (isValidEmail(cleanIdent)) {
        query = query.eq('email', cleanIdent);
      } else if (phoneDigits.length >= 10) {
        query = query.eq('phone', phoneDigits);
      } else {
        query = query.eq('username', cleanIdent);
      }

      const { data: users, error } = await query.limit(1);
      if (error) throw error;
      if (users?.length) user = users[0];
    }

    if (!supabase) {
      const localUsers = getLocalUsers();
      user = localUsers.find(u => 
        (u.username || '').toLowerCase() === cleanIdent ||
        (u.email || '').toLowerCase() === cleanIdent ||
        (phoneDigits.length >= 10 && (u.phone || '').replace(/\D/g, '') === phoneDigits)
      );
    }

    if (!user) {
      return res.status(401).json({ success: false, reason: 'Kullanıcı bilgileriniz veya şifreniz hatalı.' });
    }

    const passwordCheck = await verifyPasswordHash(password, user.password_hash);
    if (!passwordCheck.valid) {
      return res.status(401).json({ success: false, reason: 'Kullanıcı bilgileriniz veya şifreniz hatalı.' });
    }

    // Başarılı girişte eski SHA-256 kaydını otomatik olarak scrypt'e yükselt.
    if (passwordCheck.needsRehash) {
      const upgradedHash = await hashPassword(password);
      user.password_hash = upgradedHash;
      if (supabase) {
        const { error: upgradeError } = await supabase.from('app_users').update({ password_hash: upgradedHash }).eq('id', user.id);
        if (upgradeError) console.warn('Parola hash yükseltme uyarısı:', upgradeError.message);
      }
      if (!supabase) {
        const upgradeUsers = getLocalUsers();
        const upgradeIndex = upgradeUsers.findIndex(u => u.id === user.id);
        if (upgradeIndex !== -1) {
          upgradeUsers[upgradeIndex].password_hash = upgradedHash;
          saveLocalUsers(upgradeUsers);
        }
      }
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
      const { error: lastLoginError } = await supabase.from('app_users').update({ last_login: nowIso }).eq('id', user.id);
      if (lastLoginError) console.warn('Last login update warning:', safeLogStr(lastLoginError.message));
    } else {
      const localUsers = getLocalUsers();
      const locIdx = localUsers.findIndex(u => u.id === user.id);
      if (locIdx !== -1) {
        localUsers[locIdx].last_login = nowIso;
        saveLocalUsers(localUsers);
      }
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
    console.error('Giriş hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Giriş servisi geçici olarak kullanılamıyor.' });
  }
});

// ── 3. ADMİN: ONAY BEKLEYEN KULLANICILARI LİSTELE ──────────────
app.get('/api/admin/pending-users', adminRateLimiter, requireAdmin, async (req, res) => {
  try {
    let pendingList = [];
    if (supabase) {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, username, email, full_name, phone, department, role, is_active, created_at, avatar')
        .eq('is_active', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      pendingList = data || [];
    } else {
      pendingList = getLocalUsers().filter(user => user.is_active === false).map(user => {
        const safe = { ...user };
        delete safe.password_hash;
        return safe;
      }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    res.json({
      success: true,
      count: pendingList.length,
      users: pendingList
    });
  } catch (err) {
    console.warn('Onay bekleyen kullanıcı listesi hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Onay bekleyen kullanıcılar geçici olarak alınamıyor.' });
  }
});

// ── 4. ADMİN: TÜM KULLANICILARI LİSTELE ───────────────────────
app.get('/api/admin/all-users', adminRateLimiter, requireAdmin, async (req, res) => {
  try {
    let allUsers = [];
    if (supabase) {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, username, email, full_name, phone, department, role, is_active, created_at, last_login, avatar')
        .order('created_at', { ascending: false });
      if (error) throw error;
      allUsers = data || [];
    } else {
      allUsers = getLocalUsers().map(user => {
        const safe = { ...user };
        delete safe.password_hash;
        return safe;
      }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    res.json({
      success: true,
      count: allUsers.length,
      users: allUsers
    });
  } catch (err) {
    console.warn('Kullanıcı listesi hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Kullanıcı listesi geçici olarak alınamıyor.' });
  }
});

// ── 5. ADMİN: KULLANICIYI ONAYLA (Approve & Activate) ─────────
app.post('/api/admin/approve-user', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği (userId) belirtilmedi.' });
  }

  try {
    const approvedUser = await updateUserById(userId, { is_active: true });
    if (!approvedUser) return res.status(404).json({ success: false, reason: 'Onaylanacak kullanıcı bulunamadı.' });
    const targetUsername = approvedUser.username || String(userId);

    await recordAuditLog({
      userId: req.adminUser.id,
      username: req.adminUser.username,
      role: 'admin',
      action: 'USER_APPROVE',
      target: targetUsername,
      details: `@${targetUsername} kullanıcısının kaydı onaylandı ve hesabı aktifleştirildi.`,
      ip: req.ip
    });

    console.log('Kullanıcı Başarıyla Onaylandı:', safeLogStr(targetUsername));

    // Mail hatası hesap onayını geri almaz; durum ayrıca audit kaydına yazılır.
    const mailResult = await mailer.sendAccountApproved({
      to: approvedUser.email,
      fullName: approvedUser.full_name,
      username: approvedUser.username
    });

    await recordAuditLog({
      userId: req.adminUser.id,
      username: req.adminUser.username,
      role: 'admin',
      action: mailResult.sent ? 'MAIL_ACCOUNT_APPROVED' : 'MAIL_ACCOUNT_APPROVED_SKIPPED',
      target: approvedUser.email || '-',
      details: `Hesap onay e-postası durumu: ${mailResult.status}`,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Kullanıcı hesabı başarıyla onaylandı ve aktifleştirildi.',
      notification: {
        email: {
          sent: mailResult.sent,
          status: mailResult.status
        }
      }
    });
  } catch (err) {
    console.error('Onaylama hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Kullanıcı geçici olarak onaylanamadı.' });
  }
});

app.get('/api/admin/mail/status', adminRateLimiter, requireAdmin, (req, res) => {
  res.json({ success: true, mail: mailer.getStatus() });
});

app.post('/api/admin/mail/test', adminRateLimiter, requireAdmin, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, reason: 'Geçerli bir test e-posta adresi gereklidir.' });
  }

  const result = await mailer.sendTestEmail({ to: email });
  await recordAuditLog({
    userId: req.adminUser.id,
    username: req.adminUser.username,
    role: req.adminUser.role,
    action: result.sent ? 'MAIL_TEST_SENT' : 'MAIL_TEST_FAILED',
    target: email,
    details: `SMTP test e-postası durumu: ${result.status}`,
    ip: req.ip
  });

  res.status(result.sent ? 200 : 503).json({
    success: result.sent,
    mail: { sent: result.sent, status: result.status },
    reason: result.sent ? undefined : 'Test e-postası gönderilemedi. Mail yapılandırmasını kontrol edin.'
  });
});

// ── 6. ADMİN: KULLANICIYI REDDET VEYA SİL ────────────────────
app.post('/api/admin/reject-user', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId, deletePermanently = true } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği (userId) belirtilmedi.' });
  }
  if (String(userId) === String(req.adminUser.id)) {
    return res.status(400).json({ success: false, reason: 'Kendi yönetici hesabınızı reddedemez veya silemezsiniz.' });
  }

  try {
    const userObj = await loadUserById(userId);
    if (!userObj) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
    const targetUsername = userObj.username || String(userId);

    if (deletePermanently) {
      if (supabase) {
        const reportDelete = await supabase.from('reports').delete().eq('user_id', String(userId));
        if (reportDelete.error) throw reportDelete.error;
        const userDelete = await supabase.from('app_users').delete().eq('id', String(userId));
        if (userDelete.error) throw userDelete.error;
      } else {
        saveLocalUsers(getLocalUsers().filter(user => String(user.id) !== String(userId)));
        writeLocalReports(readLocalReports().filter(report => String(report.user_id) !== String(userId)));
      }
      console.log('Kullanıcı Kaydı Silindi / Reddedildi:', safeLogStr(targetUsername));
    } else {
      const rejectedUser = await updateUserById(userId, { is_active: false });
      if (!rejectedUser) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
    }

    await recordAuditLog({
      userId: req.adminUser.id,
      username: req.adminUser.username,
      role: 'admin',
      action: 'USER_REJECT',
      target: targetUsername,
      details: deletePermanently
        ? `@${targetUsername} kullanıcısının başvuru kaydı reddedildi ve silindi.`
        : `@${targetUsername} kullanıcısının başvuru kaydı reddedildi.`,
      ip: req.ip
    });

    res.json({
      success: true,
      message: deletePermanently ? 'Kayıt başvurusu reddedildi ve silindi.' : 'Kayıt başvurusu reddedildi.'
    });
  } catch (err) {
    console.warn('Kullanıcı reddetme hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Kullanıcı işlemi geçici olarak tamamlanamadı.' });
  }
});

// ── 7. ADMİN: AKTİFLİK DURUMUNU DEĞİŞTİR (Dondur / Aç) ────────
app.post('/api/admin/toggle-status', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId, isActive } = req.body;
  if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı ID gerekli.' });
  if (String(userId) === String(req.adminUser.id) && !isActive) {
    return res.status(400).json({ success: false, reason: 'Kendi yönetici hesabınızı donduramazsınız.' });
  }

  try {
    const updatedUser = await updateUserById(userId, { is_active: Boolean(isActive) });
    if (!updatedUser) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
    await recordAuditLog({ userId: req.adminUser.id, username: req.adminUser.username, role: 'admin', action: 'USER_STATUS_CHANGE', target: updatedUser.username, details: `Hesap durumu: ${isActive ? 'aktif' : 'donduruldu'}`, ip: req.ip });
    res.json({ success: true, is_active: !!isActive });
  } catch (err) {
    console.warn('Kullanıcı durumu güncelleme hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Kullanıcı durumu geçici olarak güncellenemedi.' });
  }
});

// ── 8. ADMİN: ADMIN ROLÜ VER / GERİ AL ────────────────────────
app.post('/api/admin/toggle-admin', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId, makeAdmin } = req.body;
  if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı ID gerekli.' });
  if (String(userId) === String(req.adminUser.id) && !makeAdmin) {
    return res.status(400).json({ success: false, reason: 'Kendi yönetici yetkinizi kaldıramazsınız.' });
  }

  try {
    const newRole = makeAdmin ? 'admin' : 'user';
    const newAvatar = makeAdmin ? 'A' : 'U';
    const updatedUser = await updateUserById(userId, { role: newRole, avatar: newAvatar });
    if (!updatedUser) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
    await recordAuditLog({ userId: req.adminUser.id, username: req.adminUser.username, role: 'admin', action: 'USER_ROLE_CHANGE', target: updatedUser.username, details: `Yeni rol: ${newRole}`, ip: req.ip });
    res.json({ success: true, role: newRole });
  } catch (err) {
    console.warn('Kullanıcı rolü güncelleme hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Kullanıcı rolü geçici olarak güncellenemedi.' });
  }
});

// ── 9. ADMİN: DOĞRUDAN ŞİFRE SIFIRLAMA ────────────────────────
async function handleAdminPasswordReset(req, res) {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword || newPassword.length < 10 || newPassword.length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ success: false, reason: `Lütfen 10-${PASSWORD_MAX_LENGTH} karakter arasında geçerli bir yeni şifre giriniz.` });
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    const updatedUser = await updateUserById(userId, { password_hash: passwordHash });
    if (!updatedUser) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
    await recordAuditLog({ userId: req.adminUser.id, username: req.adminUser.username, role: 'admin', action: 'USER_PASSWORD_RESET', target: updatedUser.username, details: 'Yönetici tarafından parola sıfırlandı.', ip: req.ip });
    res.json({ success: true, message: 'Kullanıcı şifresi başarıyla güncellendi.' });
  } catch (err) {
    console.warn('Yönetici parola sıfırlama hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Kullanıcı şifresi geçici olarak güncellenemedi.' });
  }
}

app.post('/api/admin/reset-password', adminRateLimiter, requireAdmin, handleAdminPasswordReset);
app.post('/api/admin/reset-user-password', adminRateLimiter, requireAdmin, handleAdminPasswordReset);

// ── 9.5. ADMİN: KULLANICI ADI GÜNCELLEME ──────────────────────
async function handleAdminUsernameChange(req, res) {
  const { userId, newUsername } = req.body;
  const cleanUser = normalizeUsername(newUsername);
  if (!userId || !isValidUsername(cleanUser)) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı ID ve 3-50 karakterlik geçerli bir kullanıcı adı gereklidir.' });
  }

  try {
    let oldUsername = '';
    if (supabase) {
      const current = await supabase.from('app_users').select('id,username').eq('id', userId).limit(1);
      if (current.error) throw current.error;
      if (!current.data?.length) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      oldUsername = current.data[0].username || '';

      const existing = await supabase.from('app_users').select('id').eq('username', cleanUser).neq('id', userId).limit(1);
      if (existing.error) throw existing.error;
      if (existing.data?.length) return res.status(409).json({ success: false, reason: `'${cleanUser}' kullanıcı adı zaten kullanımda.` });

      const update = await supabase.from('app_users').update({ username: cleanUser }).eq('id', userId);
      if (update.error) throw update.error;
    } else {
      const localUsers = getLocalUsers();
      if (localUsers.some(u => u.id !== userId && normalizeUsername(u.username) === cleanUser)) {
        return res.status(409).json({ success: false, reason: `'${cleanUser}' kullanıcı adı zaten kullanımda.` });
      }
      const idx = localUsers.findIndex(u => u.id === userId);
      if (idx === -1) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      oldUsername = localUsers[idx].username || '';
      localUsers[idx].username = cleanUser;
      saveLocalUsers(localUsers);
    }

    await recordAuditLog({
      userId: req.adminUser.id,
      username: req.adminUser.username,
      role: 'admin',
      action: 'USER_UPDATE',
      target: `@${cleanUser}`,
      details: `Kullanıcı adı değiştirildi: @${oldUsername} ➔ @${cleanUser}`,
      ip: req.ip
    });
    res.json({ success: true, message: 'Kullanıcı adı güncellendi.', username: cleanUser });
  } catch (err) {
    console.warn('Kullanıcı adı güncelleme hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Kullanıcı adı geçici olarak güncellenemedi.' });
  }
}

app.post('/api/admin/update-username', adminRateLimiter, requireAdmin, handleAdminUsernameChange);

// ── 10. KULLANICI PROFİL VE ŞİFRE GÜNCELLEME (Self) ───────────
app.post('/api/auth/change-password', authRateLimiter, requireAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.authUser.id;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, reason: 'Lütfen mevcut ve yeni şifrenizi giriniz.' });
  }

  if (newPassword.length < 10 || newPassword.length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ success: false, reason: `Yeni şifre 10-${PASSWORD_MAX_LENGTH} karakter arasında olmalıdır.` });
  }

  try {
    const user = await loadUserById(userId);
    if (!user) return res.status(404).json({ success: false, reason: 'Kullanıcı hesabı bulunamadı.' });

    const oldPasswordCheck = await verifyPasswordHash(oldPassword, user.password_hash);
    if (!oldPasswordCheck.valid) {
      return res.status(400).json({ success: false, reason: 'Mevcut şifrenizi hatalı girdiniz!' });
    }

    const newHash = await hashPassword(newPassword);
    if (supabase) {
      const { error } = await supabase.from('app_users').update({ password_hash: newHash }).eq('id', userId);
      if (error) throw error;
    } else {
      const localUsers = getLocalUsers();
      const idx = localUsers.findIndex(u => u.id === userId);
      if (idx !== -1) {
        localUsers[idx].password_hash = newHash;
        saveLocalUsers(localUsers);
      }
    }

    res.json({ success: true, message: 'Şifreniz başarıyla değiştirildi.' });
  } catch (err) {
    console.warn('Şifre güncelleme hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Şifre geçici olarak güncellenemedi.' });
  }
});

app.post('/api/auth/update-profile', authRateLimiter, requireAuth, async (req, res) => {
  const { fullName, phone, department, email, username } = req.body;
  const userId = req.authUser.id;

  try {
    const updates = {};
    if (fullName !== undefined) {
      if (!isValidText(fullName, { min: 2, max: 120 })) return res.status(400).json({ success: false, reason: 'Ad soyad 2-120 karakter arasında olmalıdır.' });
      updates.full_name = normalizeText(fullName);
    }
    if (phone !== undefined) updates.phone = normalizePhone(phone);
    if (department !== undefined) {
      if (!isValidText(department, { min: 1, max: 120 })) return res.status(400).json({ success: false, reason: 'Bölüm 1-120 karakter arasında olmalıdır.' });
      updates.department = normalizeText(department);
    }
    if (email !== undefined) {
      const cleanEmail = normalizeEmail(email);
      if (!isValidEmail(cleanEmail)) return res.status(400).json({ success: false, reason: 'Geçerli bir e-posta adresi giriniz.' });
      updates.email = cleanEmail;
    }
    if (username !== undefined) {
      const cleanUsername = normalizeUsername(username);
      if (!isValidUsername(cleanUsername)) return res.status(400).json({ success: false, reason: 'Geçerli bir kullanıcı adı giriniz.' });
      updates.username = cleanUsername;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, reason: 'Güncellenecek profil alanı bulunamadı.' });

    if (supabase) {
      if (updates.email) {
        const result = await supabase.from('app_users').select('id').eq('email', updates.email).neq('id', userId).limit(1);
        if (result.error) throw result.error;
        if (result.data?.length) return res.status(409).json({ success: false, reason: 'Bu e-posta adresi zaten kullanımda.' });
      }
      if (updates.username) {
        const result = await supabase.from('app_users').select('id').eq('username', updates.username).neq('id', userId).limit(1);
        if (result.error) throw result.error;
        if (result.data?.length) return res.status(409).json({ success: false, reason: 'Bu kullanıcı adı zaten kullanımda.' });
      }
      const { error } = await supabase.from('app_users').update(updates).eq('id', userId);
      if (error) throw error;
    } else {
      const localUsers = getLocalUsers();
      if (updates.email && localUsers.some(user => user.id !== userId && normalizeEmail(user.email) === updates.email)) {
        return res.status(409).json({ success: false, reason: 'Bu e-posta adresi zaten kullanımda.' });
      }
      if (updates.username && localUsers.some(user => user.id !== userId && normalizeUsername(user.username) === updates.username)) {
        return res.status(409).json({ success: false, reason: 'Bu kullanıcı adı zaten kullanımda.' });
      }
      const idx = localUsers.findIndex(u => u.id === userId);
      if (idx === -1) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      localUsers[idx] = { ...localUsers[idx], ...updates };
      saveLocalUsers(localUsers);
    }

    res.json({ success: true, user: updates });
  } catch (err) {
    console.warn('Profil güncelleme hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Profil geçici olarak güncellenemedi.' });
  }
});

// ── 10.5. KULLANICI ŞİFRE DOĞRULAMA (Kritik İşlem Güvenlik Onayı) ──
app.post('/api/auth/verify-password', authRateLimiter, requireAuth, async (req, res) => {
  const { password } = req.body;
  const userId = req.authUser.id;
  if (!password || String(password).length > PASSWORD_MAX_LENGTH) return res.status(400).json({ success: false, verified: false, reason: 'Geçerli bir şifre giriniz.' });

  try {
    const user = await loadUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, verified: false, reason: 'Kullanıcı bulunamadı.' });
    }

    const verified = (await verifyPasswordHash(password, user.password_hash)).valid;
    res.status(verified ? 200 : 401).json({ success: verified, verified, reason: verified ? undefined : 'Girdiğiniz şifre hatalı.' });
  } catch (err) {
    res.status(503).json({ success: false, verified: false, reason: 'Şifre doğrulama servisi geçici olarak kullanılamıyor.' });
  }
});

// ── 10.6. DENETİM GÜNLÜĞÜ VE İSTEMCİ BİLGİ SERVİSLERİ ────────
app.get('/api/client-ip', (req, res) => {
  const rawIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const ip = rawIp === '::1' || rawIp === '::ffff:127.0.0.1' ? '127.0.0.1' : rawIp;
  res.json({ success: true, ip });
});

app.post('/api/audit-log', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const { action, target, details } = req.body;
  const cleanAction = String(action || '').trim().toUpperCase().slice(0, 80);
  if (!/^[A-Z0-9_:-]{2,80}$/.test(cleanAction)) return res.status(400).json({ success: false, reason: 'Geçersiz audit işlem kodu.' });
  const rawIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  const ip = rawIp === '::1' || rawIp === '::ffff:127.0.0.1' ? '127.0.0.1' : rawIp;
  const entry = await recordAuditLog({
    userId: req.authUser.id,
    username: req.authUser.username,
    fullName: req.authUser.full_name,
    role: req.authUser.role,
    action: cleanAction,
    target: String(target || '').slice(0, 300),
    details: String(details || '').slice(0, 2000),
    ip
  });
  if (!entry) return res.status(503).json({ success: false, reason: 'Denetim kaydı geçici olarak yazılamadı.' });
  res.json({ success: true, log: entry });
});

app.get('/api/admin/audit-logs', adminRateLimiter, requireAdmin, async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase().slice(0, 200);
  const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit, 10) || 500));
  let logs;
  if (supabase) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, occurred_at, user_id, username, full_name, role, action, target, details, ip')
      .order('occurred_at', { ascending: false })
      .limit(q ? 1000 : limit);
    if (error) {
      console.warn('Audit log listesi alınamadı:', safeLogStr(error.message));
      return res.status(503).json({ success: false, reason: 'Denetim kayıtları geçici olarak alınamıyor.' });
    }
    logs = (data || []).map(row => ({
      id: row.id,
      timestamp: row.occurred_at,
      userId: row.user_id,
      username: row.username,
      fullName: row.full_name,
      role: row.role,
      action: row.action,
      target: row.target,
      details: row.details,
      ip: row.ip
    }));
  } else {
    logs = getAuditLogs();
  }
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
app.post('/api/admin/change-username', adminRateLimiter, requireAdmin, handleAdminUsernameChange);

// ── 12. E-POSTA DEĞİŞTİRME ────────────────────────────────────
app.post('/api/auth/change-email', authRateLimiter, requireAuth, async (req, res) => {
  const { newEmail } = req.body;
  const userId = req.authUser.id;
  const cleanEmail = normalizeEmail(newEmail);

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ success: false, reason: 'Geçerli bir e-posta adresi giriniz.' });
  }

  try {
    if (supabase) {
      const existing = await supabase.from('app_users').select('id').eq('email', cleanEmail).neq('id', userId).limit(1);
      if (existing.error) throw existing.error;
      if (existing.data?.length) return res.status(409).json({ success: false, reason: `'${cleanEmail}' e-posta adresi zaten kullanımda.` });
      const update = await supabase.from('app_users').update({ email: cleanEmail }).eq('id', userId);
      if (update.error) throw update.error;
    } else {
      const localUsers = getLocalUsers();
      if (localUsers.some(u => u.id !== userId && normalizeEmail(u.email) === cleanEmail)) {
        return res.status(409).json({ success: false, reason: `'${cleanEmail}' e-posta adresi zaten kullanımda.` });
      }
      const idx = localUsers.findIndex(u => u.id === userId);
      if (idx === -1) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      localUsers[idx].email = cleanEmail;
      saveLocalUsers(localUsers);
    }

    await recordAuditLog({
      userId,
      username: req.authUser.username,
      role: req.authUser.role,
      action: 'EMAIL_CHANGE',
      target: cleanEmail,
      details: `E-posta adresi güncellendi: ${cleanEmail}`,
      ip: req.ip
    });

    res.json({ success: true, email: cleanEmail });
  } catch (err) {
    console.warn('E-posta güncelleme hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'E-posta adresi geçici olarak güncellenemedi.' });
  }
});

// ── RAPOR DEPOLAMA VE YÖNETİM ENDPOINTLERİ ──────────────────
const REPORT_STORE_PATH = path.join(__dirname, 'data', 'store.json');
const REPORT_STORE_TEMP_PATH = path.join(__dirname, 'data', 'store.json.tmp');
const MAX_REPORTS_PER_REQUEST = 500;

function readLocalReports() {
  if (!fs.existsSync(REPORT_STORE_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(REPORT_STORE_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalReports(reports) {
  const dataDir = path.dirname(REPORT_STORE_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(REPORT_STORE_TEMP_PATH, JSON.stringify(reports, null, 2), 'utf8');
  fs.renameSync(REPORT_STORE_TEMP_PATH, REPORT_STORE_PATH);
}

async function getReportRecord(id) {
  if (supabase) {
    const { data, error } = await supabase.from('reports').select('*').eq('id', String(id)).limit(1);
    if (error) throw error;
    return data && data[0] ? data[0] : null;
  }
  return readLocalReports().find(report => reportId(report) === String(id)) || null;
}

async function loadVisibleReports(user, isDeleted) {
  if (supabase) {
    let rows = [];
    let from = 0;
    const step = 1000;

    while (true) {
      let query = supabase.from('reports').select('*').eq('is_deleted', isDeleted);
      if (user.role !== 'admin') {
        query = isDeleted ? query.eq('user_id', user.id) : query.or(`user_id.eq.${user.id},is_public.eq.true`);
      }
      const { data, error } = await query.order('updated_at', { ascending: false }).range(from, from + step - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < step) break;
      from += step;
    }
    return rows.map(reportRowToClient);
  }

  return readLocalReports()
    .filter(report => Boolean(report.isDeleted || report.is_deleted) === isDeleted && canReadReport(user, report))
    .sort((left, right) => new Date(right.loadedAt || right.updated_at || 0) - new Date(left.loadedAt || left.updated_at || 0));
}

app.get('/api/store/load', requireAuth, async (req, res) => {
  try {
    res.json(await loadVisibleReports(req.authUser, false));
  } catch (error) {
    console.warn('Raporlar yüklenemedi:', safeLogStr(error.message));
    res.status(503).json({ success: false, reason: 'Rapor verileri geçici olarak yüklenemiyor.' });
  }
});

app.get('/api/store/trash', requireAuth, async (req, res) => {
  try {
    res.json(await loadVisibleReports(req.authUser, true));
  } catch (error) {
    console.warn('Çöp kutusu yüklenemedi:', safeLogStr(error.message));
    res.status(503).json({ success: false, reason: 'Çöp kutusu geçici olarak yüklenemiyor.' });
  }
});

app.get('/api/settings', requireAuth, async (req, res) => {
  if (!supabase) return res.json({ success: true, settings: null });
  try {
    const { data, error } = await supabase.from('user_settings').select('*').eq('id', String(req.authUser.id)).limit(1);
    if (error) throw error;
    const settings = data && data[0] ? data[0] : null;
    res.json({ success: true, settings: settings ? { ...settings, customTags: settings.custom_tags || [] } : null });
  } catch (error) {
    console.warn('Kullanıcı ayarları yüklenemedi:', safeLogStr(error.message));
    res.status(503).json({ success: false, reason: 'Kullanıcı ayarları yüklenemedi.' });
  }
});

app.patch('/api/settings', apiWriteRateLimiter, requireAuth, async (req, res) => {
  if (!supabase) return res.status(503).json({ success: false, reason: 'Ayar senkronizasyonu kullanılamıyor.' });
  try {
    const currentResult = await supabase.from('user_settings').select('*').eq('id', String(req.authUser.id)).limit(1);
    if (currentResult.error) throw currentResult.error;
    const current = currentResult.data?.[0] || {};
    const customTagsInput = req.body?.custom_tags ?? req.body?.customTags;
    const row = {
      id: String(req.authUser.id),
      theme: boundedSetting(req.body?.theme ?? current.theme, 50, 'light'),
      preferences: plainObject(req.body?.preferences) ? req.body.preferences : (current.preferences || {}),
      recent_reports: Array.isArray(req.body?.recent_reports) ? req.body.recent_reports.slice(0, 100) : (current.recent_reports || []),
      custom_tags: Array.isArray(customTagsInput) ? customTagsInput.slice(0, 100).map(tag => boundedSetting(tag, 100)).filter(Boolean) : (current.custom_tags || []),
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('user_settings').upsert(row, { onConflict: 'id' });
    if (error) throw error;
    res.json({ success: true, settings: { ...row, customTags: row.custom_tags } });
  } catch (error) {
    console.warn('Kullanıcı ayarları kaydedilemedi:', safeLogStr(error.message));
    res.status(503).json({ success: false, reason: 'Kullanıcı ayarları kaydedilemedi.' });
  }
});

app.post('/api/store/save', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const reports = req.body;
  if (!Array.isArray(reports) || reports.length > MAX_REPORTS_PER_REQUEST) {
    return res.status(400).json({ success: false, reason: `Tek istekte en fazla ${MAX_REPORTS_PER_REQUEST} rapor kaydedilebilir.` });
  }

  try {
    const rows = reports.map(report => buildOwnedReportRow(report, req.authUser));
    const ids = rows.map(row => row.id);
    if (new Set(ids).size !== ids.length) {
      return res.status(400).json({ success: false, reason: 'Aynı rapor kimliği birden fazla kez gönderilemez.' });
    }

    if (supabase) {
      const existingOwners = new Map();
      for (let i = 0; i < ids.length; i += 100) {
        const idChunk = ids.slice(i, i + 100);
        if (idChunk.length === 0) continue;
        const { data, error } = await supabase.from('reports').select('id,user_id').in('id', idChunk);
        if (error) throw error;
        (data || []).forEach(row => existingOwners.set(String(row.id), String(row.user_id)));
      }
      const foreignId = ids.find(id => existingOwners.has(id) && existingOwners.get(id) !== String(req.authUser.id));
      if (foreignId) {
        return res.status(403).json({ success: false, reason: 'Başka bir kullanıcıya ait rapor güncellenemez.' });
      }

      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await supabase.from('reports').upsert(rows.slice(i, i + 50), { onConflict: 'id' });
        if (error) throw error;
      }
    } else {
      const existing = readLocalReports();
      const existingMap = new Map(existing.map(report => [reportId(report), report]));
      const foreignId = ids.find(id => existingMap.has(id) && String(existingMap.get(id).userId || existingMap.get(id).user_id) !== String(req.authUser.id));
      if (foreignId) {
        return res.status(403).json({ success: false, reason: 'Başka bir kullanıcıya ait rapor güncellenemez.' });
      }
      rows.forEach(row => existingMap.set(row.id, reportRowToClient(row)));
      writeLocalReports(Array.from(existingMap.values()));
    }

    res.json({ success: true, count: rows.length });
  } catch (error) {
    console.warn('Rapor senkronizasyonu başarısız:', safeLogStr(error.message));
    res.status(400).json({ success: false, reason: error.message === 'Geçersiz rapor kimliği.' ? error.message : 'Raporlar kaydedilemedi.' });
  }
});

app.delete('/api/reports', apiWriteRateLimiter, requireAuth, async (req, res) => {
  try {
    if (supabase) {
      const { error } = await supabase.from('reports').delete().eq('user_id', String(req.authUser.id));
      if (error) throw error;
    } else {
      writeLocalReports(readLocalReports().filter(report => String(report.userId || report.user_id) !== String(req.authUser.id)));
    }
    res.json({ success: true });
  } catch {
    res.status(503).json({ success: false, reason: 'Kullanıcı raporları silinemedi.' });
  }
});

app.delete('/api/reports/trash/all', apiWriteRateLimiter, requireAuth, async (req, res) => {
  try {
    if (supabase) {
      const { error } = await supabase.from('reports').delete().eq('user_id', String(req.authUser.id)).eq('is_deleted', true);
      if (error) throw error;
    } else {
      writeLocalReports(readLocalReports().filter(report =>
        String(report.userId || report.user_id) !== String(req.authUser.id) || !Boolean(report.isDeleted || report.is_deleted)
      ));
    }
    res.json({ success: true });
  } catch {
    res.status(503).json({ success: false, reason: 'Çöp kutusu boşaltılamadı.' });
  }
});

app.delete('/api/reports/:id', apiWriteRateLimiter, requireAuth, async (req, res) => {
  try {
    const report = await getReportRecord(req.params.id);
    if (!report) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
    if (!canManageReport(req.authUser, report)) {
      return res.status(403).json({ success: false, reason: 'Bu raporu silme yetkiniz yok.' });
    }

    if (supabase) {
      const { error } = await supabase.from('reports').delete().eq('id', String(req.params.id));
      if (error) throw error;
    } else {
      writeLocalReports(readLocalReports().filter(item => reportId(item) !== String(req.params.id)));
    }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, reason: 'Rapor silinemedi.' });
  }
});

app.patch('/api/reports/:id/trash', apiWriteRateLimiter, requireAuth, async (req, res) => {
  try {
    const report = await getReportRecord(req.params.id);
    if (!report) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
    if (!canManageReport(req.authUser, report)) {
      return res.status(403).json({ success: false, reason: 'Bu raporu değiştirme yetkiniz yok.' });
    }

    const isDeleted = req.body?.deleted !== false;
    const deletedAt = isDeleted ? new Date().toISOString() : null;
    if (supabase) {
      const current = reportRowToClient(report);
      const data = { ...current, isDeleted, is_deleted: isDeleted, deletedAt, deleted_at: deletedAt };
      const { error } = await supabase.from('reports').update({ is_deleted: isDeleted, deleted_at: deletedAt, data, updated_at: new Date().toISOString() }).eq('id', String(req.params.id));
      if (error) throw error;
    } else {
      const reports = readLocalReports();
      const index = reports.findIndex(item => reportId(item) === String(req.params.id));
      reports[index] = { ...reports[index], isDeleted, is_deleted: isDeleted, deletedAt, deleted_at: deletedAt };
      writeLocalReports(reports);
    }
    res.json({ success: true, isDeleted });
  } catch (error) {
    res.status(503).json({ success: false, reason: 'Rapor durumu güncellenemedi.' });
  }
});

app.post('/api/reports/toggle-pool', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const reportIdValue = String(req.body?.reportId || '');
  if (!reportIdValue) return res.status(400).json({ success: false, reason: 'Rapor ID gerekli.' });

  try {
    const report = await getReportRecord(reportIdValue);
    if (!report) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
    if (!canManageReport(req.authUser, report)) {
      return res.status(403).json({ success: false, reason: 'Bu raporu havuzda değiştirme yetkiniz yok.' });
    }

    const isPublic = Boolean(req.body.makePublic);
    const sharedAt = isPublic ? new Date().toISOString() : null;
    if (supabase) {
      const current = reportRowToClient(report);
      const data = { ...current, isPublic, is_public: isPublic, sharedAt, shared_at: sharedAt };
      const { error } = await supabase.from('reports').update({ is_public: isPublic, shared_at: sharedAt, data, updated_at: new Date().toISOString() }).eq('id', reportIdValue);
      if (error) throw error;
    } else {
      const reports = readLocalReports();
      const index = reports.findIndex(item => reportId(item) === reportIdValue);
      reports[index] = { ...reports[index], isPublic, is_public: isPublic, sharedAt, shared_at: sharedAt };
      writeLocalReports(reports);
    }
    res.json({ success: true, isPublic });
  } catch (error) {
    res.status(503).json({ success: false, reason: 'Ortak havuz durumu güncellenemedi.' });
  }
});

app.post('/api/reports/bulk-toggle-pool', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const reportIds = Array.isArray(req.body?.reportIds) ? [...new Set(req.body.reportIds.map(String))] : [];
  if (reportIds.length === 0 || reportIds.length > 100) {
    return res.status(400).json({ success: false, reason: '1-100 arasında rapor ID değeri gereklidir.' });
  }

  try {
    const reports = [];
    for (const id of reportIds) {
      const report = await getReportRecord(id);
      if (!report) return res.status(404).json({ success: false, reason: 'Raporlardan biri bulunamadı.' });
      if (!canManageReport(req.authUser, report)) {
        return res.status(403).json({ success: false, reason: 'Raporlardan biri için yönetim yetkiniz yok.' });
      }
      reports.push(report);
    }

    const isPublic = Boolean(req.body.makePublic);
    const sharedAt = isPublic ? new Date().toISOString() : null;
    if (supabase) {
      for (const report of reports) {
        const current = reportRowToClient(report);
        const data = { ...current, isPublic, is_public: isPublic, sharedAt, shared_at: sharedAt };
        const { error } = await supabase.from('reports').update({ is_public: isPublic, shared_at: sharedAt, data, updated_at: new Date().toISOString() }).eq('id', String(report.id));
        if (error) throw error;
      }
    } else {
      const localReports = readLocalReports();
      const idSet = new Set(reportIds);
      localReports.forEach((report, index) => {
        if (idSet.has(reportId(report))) localReports[index] = { ...report, isPublic, is_public: isPublic, sharedAt, shared_at: sharedAt };
      });
      writeLocalReports(localReports);
    }
    res.json({ success: true, count: reportIds.length, isPublic });
  } catch (error) {
    res.status(503).json({ success: false, reason: 'Ortak havuz durumu güncellenemedi.' });
  }
});

async function startServer() {
  await ensureAdminUser();
  app.listen(PORT, () => {
    console.log(`FrpOku Supabase Bulut Sunucusu http://localhost:${PORT} üzerinde çalışıyor.`);
  });
}

startServer().catch(error => {
  console.error('Sunucu başlatılamadı:', safeLogStr(error.message));
  process.exit(1);
});
