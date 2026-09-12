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
const { buildOwnedReportRow, canManageReport, canEditReportNote, canReadReport, nextReportVersion, reportId, reportRowToClient, reportRowToSummaryClient, toSupabaseReportRow } = require('./lib/report_access');
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
    ['APP_BASE_URL', 'BOOTSTRAP_ADMIN_USERNAME', 'BOOTSTRAP_ADMIN_PASSWORD', 'BOOTSTRAP_ADMIN_EMAIL'].forEach(requireValue);
    // STAGING_ACCESS_USER/PASSWORD yalnızca STAGING_ACCESS_ENABLED=true ise zorunludur
    if (['1', 'true', 'yes', 'on'].includes(String(process.env.STAGING_ACCESS_ENABLED || '').toLowerCase())) {
      ['STAGING_ACCESS_USER', 'STAGING_ACCESS_PASSWORD'].forEach(requireValue);
    }
  }
  if (BROWSER_SUPABASE_ENABLED) requireValue('SUPABASE_ANON_KEY');
  if (['1', 'true', 'yes', 'on'].includes(String(process.env.MAIL_ENABLED || '').toLowerCase())) {
    requireValue('APP_BASE_URL');
    const mailProvider = String(process.env.MAIL_PROVIDER || '').trim().toLowerCase();
    if (mailProvider === 'brevo' || (!mailProvider && process.env.BREVO_API_KEY)) {
      ['BREVO_API_KEY', 'BREVO_FROM_EMAIL'].forEach(requireValue);
    } else {
      ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].forEach(requireValue);
    }
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
    const pendingUpdates = { ...updates };
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from('app_users')
        .update(pendingUpdates)
        .eq('id', String(userId))
        .select('id, username, email, full_name, phone, department, role, is_active, avatar, created_at, last_login')
        .limit(1);
      if (!error) return data && data[0] ? data[0] : null;

      const optionalColumn = ['is_frozen', 'password_changed_at'].find(column =>
        Object.prototype.hasOwnProperty.call(pendingUpdates, column) && String(error.message || '').includes(column)
      );
      if (optionalColumn) {
        delete pendingUpdates[optionalColumn];
        continue;
      }
      throw error;
    }
    throw new Error('Kullanıcı güncellemesi desteklenmeyen veritabanı şeması nedeniyle tamamlanamadı.');
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
    try {
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
    } catch (err) {
      console.warn('Supabase admin doğrulama uyarısı:', safeLogStr(err.message));
    }
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

// ── E-POSTA DOĞRULAMA & BRUTE-FORCE / CAPTCHA KORUMASI ─────
const pendingEmailVerifications = new Map();
const loginFailures = new Map();

function generateCaptcha() {
  const a = Math.floor(Math.random() * 8) + 1;
  const b = Math.floor(Math.random() * 8) + 1;
  const ans = String(a + b);
  const exp = Date.now() + 5 * 60 * 1000;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(`${ans}:${exp}`).digest('hex');
  return {
    question: `${a} + ${b} = ?`,
    token: `${ans}:${exp}:${sig}`
  };
}

function verifyCaptcha(token, answer) {
  if (!token || !answer) return false;
  const parts = String(token).split(':');
  if (parts.length !== 3) return false;
  const [expectedAns, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(`${expectedAns}:${expStr}`).digest('hex');
  if (sig !== expectedSig) return false;
  return String(answer).trim() === expectedAns;
}

function generateEmergencyRecoveryKey() {
  const p1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const p2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `FRP-RECOVER-${p1}-${p2}`;
}

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
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(self)');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    "img-src 'self' data: blob: https:; " +
    "frame-src 'self' blob: data: https:; " +
    "object-src 'self' blob: data:; " +
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
function setNoStoreHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}
function sendScriptSafePage(res, page) {
  setNoStoreHeaders(res);
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    "img-src 'self' data: blob: https:; " +
    "frame-src 'self' blob: data: https:; " +
    "object-src 'self' blob: data:; " +
    "worker-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';"
  );
  res.sendFile(path.join(__dirname, page));
}
function sendNoncePage(res, page) {
  const nonce = crypto.randomBytes(18).toString('base64');
  const filePath = path.join(__dirname, page);
  fs.readFile(filePath, 'utf8', (error, source) => {
    if (error) return res.status(500).send('Sayfa yüklenemedi.');
    setNoStoreHeaders(res);
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
      `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net; ` +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
      "img-src 'self' data: blob: https:; " +
      "frame-src 'self' blob: data: https:; " +
      "object-src 'self' blob: data:; " +
      "base-uri 'self'; form-action 'self'; frame-ancestors 'self';"
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

  if (password.length < 6 || password.length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ success: false, reason: `Şifreniz en az 6, en fazla ${PASSWORD_MAX_LENGTH} karakter arasında olmalıdır.` });
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

    const rawRecoveryKeys = [
      generateEmergencyRecoveryKey(),
      generateEmergencyRecoveryKey(),
      generateEmergencyRecoveryKey(),
      generateEmergencyRecoveryKey()
    ];
    const storedRecoveryKeys = rawRecoveryKeys.map(k => ({
      keyHash: crypto.createHash('sha256').update(k).digest('hex'),
      used: false,
      usedAt: null
    }));

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
      recovery_keys: storedRecoveryKeys,
      previous_password_hashes: [],
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

    // Kullanıcıya 4 adet acil kurtarma anahtarını e-posta ile ilet
    if (cleanEmail) {
      mailer.sendEmergencyRecoveryKeys({
        to: cleanEmail,
        fullName: cleanName,
        username: cleanUser,
        keys: rawRecoveryKeys
      }).catch(() => {});
    }

    let adminNotification = { attempted: 0, sent: 0, failed: 0 };
    try {
      let adminUsers = [];
      if (supabase) {
        const { data: admData, error: admError } = await supabase.from('app_users').select('email, full_name, username').eq('role', 'admin').eq('is_active', true);
        if (admError) throw admError;
        if (admData) adminUsers = admData;
      } else {
        adminUsers = getLocalUsers().filter(u => u.role === 'admin' && u.is_active !== false && u.is_frozen !== true);
      }
      const uniqueAdmins = Array.from(new Map(adminUsers.filter(adm => isValidEmail(normalizeEmail(adm.email))).map(adm => [normalizeEmail(adm.email), adm])).values());
      const results = await Promise.all(uniqueAdmins.map(adm =>
        mailer.sendAdminNewRegistrationNotification({
            to: adm.email,
            adminName: adm.full_name || adm.username,
            newUser: {
              fullName: cleanName,
              username: cleanUser,
              email: cleanEmail,
              department: cleanDepartment
            }
        })
      ));
      adminNotification = {
        attempted: results.length,
        sent: results.filter(result => result.sent).length,
        failed: results.filter(result => !result.sent).length
      };
    } catch (admErr) {
      console.warn('Admin kullanıcıları listeleme uyarısı:', admErr.message);
      adminNotification.failed += 1;
    }

    res.json({
      success: true,
      pendingApproval: true,
      recoveryKeys: rawRecoveryKeys,
      notification: { admins: adminNotification },
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


// ── CAPTCHA GÜVENLİK DOĞRULAMA ROTASI ─────────────────────────
app.get('/api/auth/captcha', authRateLimiter, (req, res) => {
  const c = generateCaptcha();
  res.json({ success: true, question: c.question, token: c.token, captchaToken: c.token });
});

// ── 2. KULLANICI GİRİŞİ (Login) ──────────────────────────────
app.post('/api/auth/login', authRateLimiter, async (req, res) => {
  const { identifier, password, captchaToken, captchaAnswer } = req.body;
  const ident = String(identifier || '').trim();
  if (!ident || !password || ident.length > 254 || String(password).length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ success: false, reason: 'Lütfen kullanıcı bilgilerinizi ve şifrenizi giriniz.' });
  }

  const cleanIdent = ident.toLowerCase();
  const failKey = `${cleanIdent}_${(req.ip || '127.0.0.1').replace(/^::ffff:/, '')}`;
  const currentFailures = loginFailures.get(failKey) || 0;
  const isCaptchaRequired = currentFailures >= 3;

  if (isCaptchaRequired) {
    if (!captchaToken || !captchaAnswer || !verifyCaptcha(captchaToken, captchaAnswer)) {
      return res.status(400).json({
        success: false,
        requireCaptcha: true,
        failedAttempts: currentFailures,
        reason: '3 ve üzeri hatalı deneme nedeniyle güvenlik doğrulaması (Captcha) gereklidir. Lütfen soruyu doğru yanıtlayınız.'
      });
    }
  }

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
      const newFailures = currentFailures + 1;
      loginFailures.set(failKey, newFailures);
      const requireNow = newFailures >= 3;
      return res.status(401).json({
        success: false,
        requireCaptcha: requireNow,
        failedAttempts: newFailures,
        reason: requireNow ? '3 hatalı deneme yapıldı. Güvenlik doğrulaması (Captcha) gereklidir.' : 'Kullanıcı bilgileriniz veya şifreniz hatalı.'
      });
    }

    const passwordCheck = await verifyPasswordHash(password, user.password_hash);
    if (!passwordCheck.valid) {
      const newFailures = currentFailures + 1;
      loginFailures.set(failKey, newFailures);
      const requireNow = newFailures >= 3;
      return res.status(401).json({
        success: false,
        requireCaptcha: requireNow,
        failedAttempts: newFailures,
        reason: requireNow ? '3 hatalı deneme yapıldı. Güvenlik doğrulaması (Captcha) gereklidir.' : 'Kullanıcı bilgileriniz veya şifreniz hatalı.'
      });
    }

    // Başarılı girişte başarısız sayaçları temizle
    loginFailures.delete(failKey);

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
    delete safeUser.previous_password_hashes;

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

// ── 2.5. ACİL ERİŞİM ANAHTARI İLE ŞİFRE SIFIRLAMA & GİRİŞ ─────────
app.post('/api/auth/recover-with-key', authRateLimiter, async (req, res) => {
  const { identifier, recoveryKey, newPassword } = req.body || {};
  const ident = String(identifier || '').trim().toLowerCase();
  const rawKey = String(recoveryKey || '').trim().toUpperCase();
  const pass = String(newPassword || '');

  if (!ident || !rawKey || !pass) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı adı, acil erişim anahtarı ve yeni şifre gereklidir.' });
  }

  if (pass.length < 6 || pass.length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ success: false, reason: `Yeni şifreniz en az 6, en fazla ${PASSWORD_MAX_LENGTH} karakter olmalıdır.` });
  }

  try {
    let user = null;
    if (supabase) {
      const { data, error } = await supabase.from('app_users').select('*').or(`username.eq.${ident},email.eq.${ident}`).limit(1);
      if (error) throw error;
      if (data && data.length) user = data[0];
    } else {
      const localUsers = getLocalUsers();
      user = localUsers.find(u => (u.username || '').toLowerCase() === ident || (u.email || '').toLowerCase() === ident);
    }

    if (!user) {
      return res.status(404).json({ success: false, reason: 'Kullanıcı hesabı bulunamadı.' });
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keysList = Array.isArray(user.recovery_keys) ? user.recovery_keys : [];
    const matchIdx = keysList.findIndex(k => k.keyHash === keyHash && !k.used);

    if (matchIdx === -1) {
      return res.status(400).json({ success: false, reason: 'Geçersiz veya daha önce kullanılmış acil erişim anahtarı!' });
    }

    // Anahtarı kullanıldı olarak işaretle
    keysList[matchIdx].used = true;
    keysList[matchIdx].usedAt = new Date().toISOString();

    const newHash = await hashPassword(pass);
    const nowIso = new Date().toISOString();
    const prevHashes = [user.password_hash, ...(Array.isArray(user.previous_password_hashes) ? user.previous_password_hashes : [])].filter(Boolean).slice(0, 3);

    const updates = {
      password_hash: newHash,
      password_changed_at: nowIso,
      previous_password_hashes: prevHashes,
      recovery_keys: keysList,
      last_login: nowIso
    };

    await updateUserById(user.id, updates);

    await recordAuditLog({
      userId: user.id,
      username: user.username,
      role: user.role,
      action: 'SECURITY_RECOVERY',
      target: user.username,
      details: 'Hesap acil erişim anahtarı ile kurtarıldı ve şifre sıfırlandı.',
      ip: req.ip
    });

    const safeUser = { ...user, ...updates };
    delete safeUser.password_hash;
    delete safeUser.previous_password_hashes;
    delete safeUser.recovery_keys;

    const token = signToken({
      id: safeUser.id,
      username: safeUser.username,
      role: safeUser.role,
      department: safeUser.department,
      exp: Date.now() + 7 * 24 * 3600 * 1000
    });

    res.json({
      success: true,
      message: 'Hesabınız acil kurtarma anahtarı ile başarıyla kurtarıldı. Yeni şifreniz aktif.',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Acil kurtarma hatası:', err.message);
    res.status(500).json({ success: false, reason: 'Kurtarma işlemi gerçekleştirilemedi.' });
  }
});

// In-memory 6-haneli doğrulama kodu deposu
const passwordResetVerificationCodes = new Map();

function maskEmailAddress(email) {
  if (!email || !email.includes('@')) return 'e-posta adresinize';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
}

// ── 2.5. E-POSTA İLE DOĞRULAMA KODU GÖNDERME (Self-Service Forgot Password) ──
app.post('/api/auth/forgot-password-code', authRateLimiter, async (req, res) => {
  const { identifier } = req.body || {};
  const ident = String(identifier || '').trim().toLowerCase();

  if (!ident) {
    return res.status(400).json({ success: false, reason: 'Lütfen kullanıcı adınızı veya e-posta adresinizi giriniz.' });
  }

  try {
    let user = null;
    if (supabase) {
      const { data, error } = await supabase.from('app_users').select('*').or(`username.eq.${ident},email.eq.${ident}`).limit(1);
      if (error) throw error;
      if (data && data.length) user = data[0];
    } else {
      const localUsers = getLocalUsers();
      user = localUsers.find(u => (u.username || '').toLowerCase() === ident || (u.email || '').toLowerCase() === ident);
    }

    if (!user || !user.email) {
      return res.status(400).json({
        success: false,
        reason: 'Bu hesap için tanımlı bir e-posta adresi bulunamadı. Lütfen sistem yöneticinizden şifrenizi sıfırlamasını talep ediniz veya acil kurtarma anahtarınızı kullanınız.'
      });
    }

    // 6 haneli rastgele kod oluştur (100000 - 999999)
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 dakika

    passwordResetVerificationCodes.set(ident, {
      code,
      userId: user.id,
      email: user.email,
      username: user.username,
      fullName: user.full_name,
      expiresAt
    });
    passwordResetVerificationCodes.set(user.email.toLowerCase(), {
      code,
      userId: user.id,
      email: user.email,
      username: user.username,
      fullName: user.full_name,
      expiresAt
    });

    await mailer.sendSelfServiceResetCode({
      to: user.email,
      fullName: user.full_name || user.username,
      username: user.username,
      code,
      expiresIn: '15'
    });

    res.json({
      success: true,
      message: `6 haneli şifre sıfırlama kodu ${maskEmailAddress(user.email)} adresine gönderildi.`,
      maskedEmail: maskEmailAddress(user.email),
      expiresInMinutes: 15
    });
  } catch (err) {
    console.error('Şifre sıfırlama kodu hatası:', err.message);
    res.status(500).json({ success: false, reason: 'Doğrulama kodu gönderilemedi. Lütfen daha sonra tekrar deneyiniz.' });
  }
});

// ── 2.6. E-POSTA KODU İLE ŞİFRE SIFIRLAMA ────────────────────────
app.post('/api/auth/reset-password-with-code', authRateLimiter, async (req, res) => {
  const { identifier, code, newPassword } = req.body || {};
  const ident = String(identifier || '').trim().toLowerCase();
  const rawCode = String(code || '').trim();
  const pass = String(newPassword || '');

  if (!ident || !rawCode || !pass) {
    return res.status(400).json({ success: false, reason: 'Kullanıcı adı/e-posta, 6 haneli kod ve yeni şifre gereklidir.' });
  }

  if (pass.length < 6 || pass.length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ success: false, reason: `Yeni şifreniz en az 6, en fazla ${PASSWORD_MAX_LENGTH} karakter olmalıdır.` });
  }

  const entry = passwordResetVerificationCodes.get(ident);
  if (!entry || entry.code !== rawCode) {
    return res.status(400).json({ success: false, reason: 'Girilen doğrulama kodu hatalı veya geçersiz!' });
  }

  if (Date.now() > entry.expiresAt) {
    passwordResetVerificationCodes.delete(ident);
    return res.status(400).json({ success: false, reason: 'Doğrulama kodunun 15 dakikalık kullanım süresi dolmuş. Lütfen yeni bir kod isteyiniz.' });
  }

  try {
    const passwordHash = await hashPassword(pass);
    const nowIso = new Date().toISOString();

    const updatedUser = await updateUserById(entry.userId, {
      password_hash: passwordHash,
      password_changed_at: nowIso,
      last_login: nowIso
    });

    if (!updatedUser) {
      return res.status(404).json({ success: false, reason: 'Kullanıcı hesabı bulunamadı.' });
    }

    // Kodları ve başarısız giriş deneme sayacını temizle
    passwordResetVerificationCodes.delete(ident);
    if (entry.email) passwordResetVerificationCodes.delete(entry.email.toLowerCase());
    const cleanU = (updatedUser.username || '').toLowerCase();
    const cleanE = (updatedUser.email || '').toLowerCase();
    for (const [key] of loginFailures.entries()) {
      if (key.startsWith(cleanU + '_') || (cleanE && key.startsWith(cleanE + '_'))) {
        loginFailures.delete(key);
      }
    }

    await recordAuditLog({
      userId: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      action: 'PASSWORD_RESET_SELF_CODE',
      target: updatedUser.username,
      details: 'Kullanıcı e-posta doğrulama kodu ile şifresini sıfırladı.',
      ip: req.ip
    });

    const token = signToken({
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      department: updatedUser.department,
      exp: Date.now() + 7 * 24 * 3600 * 1000
    });

    const safeUser = { ...updatedUser };
    delete safeUser.password_hash;
    delete safeUser.previous_password_hashes;
    delete safeUser.recovery_keys;

    res.json({
      success: true,
      message: 'Şifreniz başarıyla sıfırlandı ve oturum açıldı.',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('Kod ile şifre sıfırlama hatası:', err.message);
    res.status(500).json({ success: false, reason: 'Şifre güncellenemedi.' });
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

app.get('/api/admin/mail/status', adminRateLimiter, requireAdmin, async (req, res) => {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envConfig = dotenv.parse(fs.readFileSync(envPath));
      for (const k in envConfig) {
        process.env[k] = envConfig[k];
      }
    }
  } catch (e) {}
  const status = mailer.getStatus();
  const verification = status.ready ? await mailer.verify() : { ok: false, status: status.enabled ? 'not_configured' : 'disabled' };
  const stats = mailer.getMailStats ? mailer.getMailStats() : null;
  res.json({
    success: true,
    mail: {
      ...status,
      verified: verification.ok,
      verifyStatus: verification.status,
      error: verification.error || null
    },
    stats
  });
});

app.get('/api/admin/mail/stats', adminRateLimiter, requireAdmin, (req, res) => {
  res.json({
    success: true,
    stats: mailer.getMailStats ? mailer.getMailStats() : null
  });
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
    details: `E-posta testi durumu: ${result.status}`,
    ip: req.ip
  });

  res.status(result.sent ? 200 : 503).json({
    success: result.sent,
    mail: { sent: result.sent, status: result.status },
    reason: result.sent ? undefined : (result.error || result.reason || 'Test e-postası gönderilemedi. Mail yapılandırmasını kontrol edin.')
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
  if (!userId || !newPassword || newPassword.length < 6 || newPassword.length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ success: false, reason: `Lütfen 6-${PASSWORD_MAX_LENGTH} karakter arasında geçerli bir yeni şifre giriniz.` });
  }

  try {
    const passwordHash = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();
    const updatedUser = await updateUserById(userId, {
      password_hash: passwordHash,
      password_changed_at: nowIso
    });
    if (!updatedUser) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });

    // Kullanıcının varsa geçmiş hatalı denemelerden kaynaklı blokajını temizle:
    const cleanU = (updatedUser.username || '').toLowerCase();
    const cleanE = (updatedUser.email || '').toLowerCase();
    for (const [key] of loginFailures.entries()) {
      if (key.startsWith(cleanU + '_') || (cleanE && key.startsWith(cleanE + '_'))) {
        loginFailures.delete(key);
      }
    }

    const mailResult = await mailer.sendPasswordResetByAdmin({
      to: updatedUser.email,
      fullName: updatedUser.full_name || updatedUser.username,
      username: updatedUser.username,
      timestamp: nowIso
    });

    await recordAuditLog({
      userId: req.adminUser.id,
      username: req.adminUser.username,
      role: 'admin',
      action: 'USER_PASSWORD_RESET',
      target: updatedUser.username,
      details: `Yönetici tarafından parola sıfırlandı. Bildirim durumu: ${mailResult.status}`,
      ip: req.ip
    });

    res.json({
      success: true,
      message: mailResult.sent
        ? `"${updatedUser.full_name || updatedUser.username}" kullanıcısının şifresi güncellendi ve güvenlik bildirimi gönderildi.`
        : `"${updatedUser.full_name || updatedUser.username}" kullanıcısının şifresi güncellendi; ancak güvenlik bildirimi gönderilemedi.`,
      notification: { email: { sent: mailResult.sent, status: mailResult.status } }
    });
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
      details: `Kullanıcı adı değiştirildi: @${oldUsername} -> @${cleanUser}`,
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

  if (newPassword.length < 6 || newPassword.length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ success: false, reason: `Yeni şifre en az 6, en fazla ${PASSWORD_MAX_LENGTH} karakter arasında olmalıdır.` });
  }

  try {
    const user = await loadUserById(userId);
    if (!user) return res.status(404).json({ success: false, reason: 'Kullanıcı hesabı bulunamadı.' });

    const oldPasswordCheck = await verifyPasswordHash(oldPassword, user.password_hash);
    if (!oldPasswordCheck.valid) {
      return res.status(400).json({ success: false, reason: 'Mevcut şifrenizi hatalı girdiniz!' });
    }

    // Şifre Geçmişi Kontrolü: Mevcut şifre veya önceki 3 şifre ile aynı olamaz
    const prevList = Array.isArray(user.previous_password_hashes) ? user.previous_password_hashes : [];
    const hashesToCheck = [user.password_hash, ...prevList].filter(Boolean);
    for (const h of hashesToCheck) {
      const match = await verifyPasswordHash(newPassword, h);
      if (match.valid) {
        return res.status(400).json({
          success: false,
          reason: 'Yeni şifreniz, mevcut şifreniz veya daha önce kullandığınız son 3 şifrenizden biriyle aynı olamaz.'
        });
      }
    }

    const newHash = await hashPassword(newPassword);
    const nowIso = new Date().toISOString();
    const updatedPrevHashes = [user.password_hash, ...prevList].filter(Boolean).slice(0, 3);

    await updateUserById(userId, {
      password_hash: newHash,
      password_changed_at: nowIso,
      previous_password_hashes: updatedPrevHashes
    });

    const newToken = signToken({
      id: user.id,
      username: user.username,
      role: user.role,
      department: user.department,
      iat: Date.now()
    });

    const mailResult = await mailer.sendPasswordChanged({
      to: user.email,
      fullName: user.full_name || user.username,
      username: user.username,
      ip: req.ip,
      timestamp: nowIso
    });
    res.json({
      success: true,
      message: mailResult.sent
        ? 'Şifreniz değiştirildi ve güvenlik bildirimi e-posta adresinize gönderildi.'
        : 'Şifreniz değiştirildi; ancak güvenlik bildirimi gönderilemedi.',
      token: newToken,
      notification: { email: { sent: mailResult.sent, status: mailResult.status } }
    });
  } catch (err) {
    console.warn('Şifre güncelleme hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Şifre geçici olarak güncellenemedi.' });
  }
});

app.post('/api/auth/update-profile', authRateLimiter, requireAuth, async (req, res) => {
  const { fullName, phone, department, email, username, emailChatDigest, email_chat_digest } = req.body;
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
    if (email !== undefined) return res.status(409).json({ success: false, reason: 'E-posta adresi doğrulama kodu kullanılmadan değiştirilemez.' });
    if (username !== undefined) {
      const cleanUsername = normalizeUsername(username);
      if (!isValidUsername(cleanUsername)) return res.status(400).json({ success: false, reason: 'Geçerli bir kullanıcı adı giriniz.' });
      updates.username = cleanUsername;
    }
    if (emailChatDigest !== undefined || email_chat_digest !== undefined) {
      updates.email_chat_digest = emailChatDigest !== undefined ? Boolean(emailChatDigest) : Boolean(email_chat_digest);
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
      if (error) {
        if (String(error.message || '').includes('email_chat_digest')) {
          delete updates.email_chat_digest;
          if (Object.keys(updates).length > 0) {
            await supabase.from('app_users').update(updates).eq('id', userId);
          }
        } else {
          throw error;
        }
      }
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
app.post('/api/auth/change-email', authRateLimiter, requireAuth, (req, res) => {
  res.status(409).json({ success: false, reason: 'E-posta adresi yalnızca mevcut şifre ve 6 haneli doğrulama kodu ile güncellenebilir.' });
});

// ── RAPOR DEPOLAMA VE YÖNETİM ENDPOINTLERİ ──────────────────
const REPORT_STORE_PATH = path.join(__dirname, 'data', 'store.json');
const REPORT_STORE_TEMP_PATH = path.join(__dirname, 'data', 'store.json.tmp');

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
  const strId = String(id || '');
  let decId = strId;
  try { decId = decodeURIComponent(strId); } catch {}

  if (supabase) {
    const { data, error } = await supabase.from('reports').select('*').eq('id', strId).limit(1);
    if (error) throw error;
    if (data && data[0]) return data[0];
    if (decId !== strId) {
      const { data: d2, error: e2 } = await supabase.from('reports').select('*').eq('id', decId).limit(1);
      if (!e2 && d2 && d2[0]) return d2[0];
    }
    return null;
  }
  return readLocalReports().find(report => {
    const rId = reportId(report);
    return rId === strId || rId === decId;
  }) || null;
}

const SUMMARY_SELECT_COLUMNS = 'id, name, file_size, category, tags, is_favorite, is_pinned, sql_count, memo_count, dataset_count, page_count, has_script, created_at, updated_at, user_note, is_deleted, deleted_at, user_id, meta:data->meta, data->isPublic, data->is_public, data->inPool, data->in_pool, data->ownerName, data->ownerUsername, data->ownerDepartment, data->sharedAt, data->version, data->noteHtml, data->attachments, tableNames:data->tableNames, queryNames:data->queryNames, paramNames:data->paramNames, datasets:data->datasets';

async function loadVisibleReports(user, isDeleted, { summaryOnly = true } = {}) {
  if (supabase) {
    let rows = [];
    let from = 0;
    const step = 1000;
    const selectCols = summaryOnly ? SUMMARY_SELECT_COLUMNS : '*';

    while (true) {
      let query = supabase.from('reports').select(selectCols).eq('is_deleted', isDeleted);
      if (user.role !== 'admin') {
        query = isDeleted
          ? query.eq('user_id', user.id)
          : query.or(`user_id.eq.${user.id},data->>is_public.eq.true,data->>isPublic.eq.true,data->>in_pool.eq.true,data->>inPool.eq.true`);
      }
      const { data, error } = await query.order('updated_at', { ascending: false }).range(from, from + step - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < step) break;
      from += step;
    }
    return summaryOnly ? rows.map(reportRowToSummaryClient) : rows.map(reportRowToClient);
  }

  const rawList = readLocalReports()
    .filter(report => Boolean(report.isDeleted || report.is_deleted) === isDeleted && canReadReport(user, report))
    .sort((left, right) => new Date(right.loadedAt || right.updated_at || 0) - new Date(left.loadedAt || left.updated_at || 0));

  return summaryOnly ? rawList.map(reportRowToSummaryClient) : rawList.map(reportRowToClient);
}

app.get('/api/store/load', requireAuth, async (req, res) => {
  try {
    res.json(await loadVisibleReports(req.authUser, false, { summaryOnly: true }));
  } catch (error) {
    console.warn('Raporlar yüklenemedi:', safeLogStr(error.message));
    res.status(503).json({ success: false, reason: 'Rapor verileri geçici olarak yüklenemiyor.' });
  }
});

app.get('/api/store/trash', requireAuth, async (req, res) => {
  try {
    res.json(await loadVisibleReports(req.authUser, true, { summaryOnly: true }));
  } catch (error) {
    console.warn('Çöp kutusu yüklenemedi:', safeLogStr(error.message));
    res.status(503).json({ success: false, reason: 'Çöp kutusu geçici olarak yüklenemiyor.' });
  }
});

app.get('/api/reports/:id', requireAuth, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ success: false, reason: 'Rapor kimliği gereklidir.' });

  try {
    const existing = await getReportRecord(id);
    if (!existing) {
      return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
    }
    if (!canReadReport(req.authUser, existing)) {
      return res.status(403).json({ success: false, reason: 'Bu rapora erişim yetkiniz yok.' });
    }
    res.json({ success: true, report: reportRowToClient(existing) });
  } catch (error) {
    console.warn('Rapor detayı getirilemedi:', safeLogStr(error.message));
    res.status(503).json({ success: false, reason: 'Rapor detayı geçici olarak yüklenemiyor.' });
  }
});

app.put('/api/reports/:id', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const id = String(req.params.id || '');
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || String(req.body.id || '') !== id) {
    return res.status(400).json({ success: false, reason: 'Rapor kimliği istek adresiyle eşleşmelidir.' });
  }

  try {
    const existing = await getReportRecord(id);
    if (existing && !canManageReport(req.authUser, existing)) {
      return res.status(403).json({ success: false, reason: 'Başka bir kullanıcıya ait rapor güncellenemez.' });
    }

    const currentVersion = existing ? Math.max(1, Number(existing.version) || 1) : 0;
    let nextVersion;
    try {
      nextVersion = nextReportVersion(existing, req.body.version);
    } catch (versionError) {
      return res.status(409).json({
        success: false,
        code: versionError.code,
        reason: 'Rapor başka bir oturumda güncellendi. Yenileyip değişikliklerinizi tekrar uygulayın.',
        currentVersion: versionError.currentVersion
      });
    }
    const row = buildOwnedReportRow(req.body, req.authUser, { existing });
    row.version = nextVersion;
    row.data = { ...row.data, version: nextVersion };

    let saved;
    if (supabase) {
      const dbRow = toSupabaseReportRow(row);
      if (!existing) {
        const result = await supabase.from('reports').insert(dbRow).select('*').limit(1);
        if (result.error) {
          if (result.error.code === '23505') {
            return res.status(409).json({ success: false, code: 'REPORT_CONFLICT', reason: 'Rapor aynı anda başka bir oturumda oluşturuldu.' });
          }
          throw result.error;
        }
        saved = result.data?.[0];
      } else {
        let updateQuery = supabase.from('reports').update(dbRow).eq('id', id);
        if (existing?.hasVersionColumn) updateQuery = updateQuery.eq('version', currentVersion);
        const result = await updateQuery.select('*').limit(1);
        if (result.error) throw result.error;
        if (!result.data?.length) {
          return res.status(409).json({ success: false, code: 'REPORT_CONFLICT', reason: 'Rapor aynı anda başka bir oturumda güncellendi.' });
        }
        saved = result.data[0];
      }
    } else {
      const reports = readLocalReports();
      const index = reports.findIndex(report => reportId(report) === id);
      const clientReport = reportRowToClient(row);
      if (index === -1) reports.push(clientReport);
      else reports[index] = clientReport;
      writeLocalReports(reports);
      saved = row;
    }

    res.json({ success: true, report: reportRowToClient(saved) });
  } catch (error) {
    console.warn('Rapor kaydedilemedi:', safeLogStr(error.message));
    res.status(503).json({ success: false, reason: 'Rapor geçici olarak kaydedilemedi.' });
  }
});

// ── KULLANICI AYARLARI (SUPABASE & YEREL JSON ÇİFT KATMANLI DEPO) ──
const USER_SETTINGS_PATH = path.join(__dirname, 'data', 'user_settings.json');

function getUserSettingsFileMap() {
  try {
    if (fs.existsSync(USER_SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(USER_SETTINGS_PATH, 'utf8')) || {};
    }
  } catch {}
  return {};
}

function saveUserSettingsFileMap(map) {
  try {
    const dir = path.dirname(USER_SETTINGS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(USER_SETTINGS_PATH, JSON.stringify(map, null, 2), 'utf8');
  } catch {}
}

app.get('/api/settings', requireAuth, async (req, res) => {
  const userId = String(req.authUser.id);
  const localMap = getUserSettingsFileMap();
  let settings = localMap[userId] || null;

  if (supabase) {
    try {
      const { data, error } = await supabase.from('user_settings').select('*').eq('id', userId).limit(1);
      if (!error && data && data[0]) {
        settings = { ...data[0], customTags: data[0].custom_tags || [] };
        // Yerel önbelleğe de senkronize et
        localMap[userId] = settings;
        saveUserSettingsFileMap(localMap);
      }
    } catch (error) {
      console.warn('Supabase ayar yükleme uyarısı (yerel yedek kullanılacak):', safeLogStr(error.message));
    }
  }

  res.json({ success: true, settings: settings ? { ...settings, customTags: settings.custom_tags || settings.customTags || [] } : null });
});

app.patch('/api/settings', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const userId = String(req.authUser.id);
  const localMap = getUserSettingsFileMap();
  let current = localMap[userId] || null;

  if (!current && supabase) {
    try {
      const { data, error } = await supabase.from('user_settings').select('*').eq('id', userId).limit(1);
      if (!error && data && data[0]) {
        current = { ...data[0], customTags: data[0].custom_tags || [] };
      }
    } catch {}
  }
  current = current || {};

  try {
    const customTagsInput = req.body?.custom_tags ?? req.body?.customTags;
    const row = {
      id: userId,
      theme: boundedSetting(req.body?.theme ?? current.theme, 50, 'light'),
      preferences: plainObject(req.body?.preferences) ? req.body.preferences : (current.preferences || {}),
      recent_reports: Array.isArray(req.body?.recent_reports) ? req.body.recent_reports.slice(0, 100) : (current.recent_reports || []),
      custom_tags: Array.isArray(customTagsInput) ? customTagsInput.slice(0, 100).map(tag => boundedSetting(tag, 100)).filter(Boolean) : (current.custom_tags || []),
      updated_at: new Date().toISOString()
    };

    // 1. Yerel dosya deposuna kullanıcı bazlı kaydet
    localMap[userId] = row;
    saveUserSettingsFileMap(localMap);

    // 2. Supabase varsa buluta da yaz
    if (supabase) {
      try {
        await supabase.from('user_settings').upsert(row, { onConflict: 'id' });
      } catch (sbErr) {
        console.warn('Supabase ayar kaydetme uyarısı:', safeLogStr(sbErr.message));
      }
    }

    res.json({ success: true, settings: { ...row, customTags: row.custom_tags } });
  } catch (error) {
    console.warn('Kullanıcı ayarları kaydedilemedi:', safeLogStr(error.message));
    res.status(500).json({ success: false, reason: 'Kullanıcı ayarları kaydedilemedi.' });
  }
});

app.post('/api/store/save', apiWriteRateLimiter, requireAuth, async (req, res) => {
  res.status(410).json({
    success: false,
    code: 'SNAPSHOT_SYNC_REMOVED',
    reason: 'Toplu arşiv yazımı kaldırıldı. Raporları tekil endpoint üzerinden kaydedin.'
  });
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
    const isAdmin = req.authUser?.role === 'admin';
    if (supabase) {
      let query = supabase.from('reports').delete().eq('is_deleted', true);
      if (!isAdmin) {
        query = query.eq('user_id', String(req.authUser.id));
      }
      const { error } = await query;
      if (error) throw error;
    } else {
      writeLocalReports(readLocalReports().filter(report => {
        const isDel = Boolean(report.isDeleted || report.is_deleted);
        if (!isDel) return true;
        if (isAdmin) return false;
        return String(report.userId || report.user_id) !== String(req.authUser.id);
      }));
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
    let nextVersion;
    try {
      // Sürüm belirtilmemişse veya 0 ise mevcut sürümü baz al
      const requestedVer = req.body?.version ? Number(req.body.version) : (report.version || 1);
      nextVersion = nextReportVersion(report, requestedVer);
    } catch (versionError) {
      return res.status(409).json({ success: false, code: versionError.code, reason: 'Rapor başka bir oturumda güncellendi.', currentVersion: versionError.currentVersion });
    }
    let savedReport;
    if (supabase) {
      const current = reportRowToClient(report);
      const data = { ...current, isDeleted, is_deleted: isDeleted, deletedAt, deleted_at: deletedAt, version: nextVersion };
      let updateQuery = supabase.from('reports')
        .update({ is_deleted: isDeleted, deleted_at: deletedAt, data, updated_at: new Date().toISOString() })
        .eq('id', String(req.params.id));
      const result = await updateQuery.select('*').limit(1);
      if (result.error) throw result.error;
      if (!result.data?.length) return res.status(409).json({ success: false, code: 'REPORT_CONFLICT', reason: 'Rapor aynı anda başka bir oturumda güncellendi.' });
      savedReport = reportRowToClient(result.data[0]);
    } else {
      const reports = readLocalReports();
      const index = reports.findIndex(item => reportId(item) === String(req.params.id));
      if (index === -1) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
      reports[index] = { ...reports[index], isDeleted, is_deleted: isDeleted, deletedAt, deleted_at: deletedAt, version: nextVersion };
      writeLocalReports(reports);
      savedReport = reports[index];
    }
    res.json({ success: true, isDeleted, report: savedReport });
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
      const data = { ...current, isPublic, is_public: isPublic, inPool: isPublic, in_pool: isPublic, sharedAt, shared_at: sharedAt };
      const { error } = await supabase.from('reports').update({ data, updated_at: new Date().toISOString() }).eq('id', reportIdValue);
      if (error) throw error;
    } else {
      const reports = readLocalReports();
      const index = reports.findIndex(item => reportId(item) === reportIdValue);
      if (index === -1) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
      reports[index] = { ...reports[index], isPublic, is_public: isPublic, inPool: isPublic, in_pool: isPublic, sharedAt, shared_at: sharedAt };
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
        const data = { ...current, isPublic, is_public: isPublic, inPool: isPublic, in_pool: isPublic, sharedAt, shared_at: sharedAt };
        const { error } = await supabase.from('reports').update({ data, updated_at: new Date().toISOString() }).eq('id', String(report.id));
        if (error) throw error;
      }
    } else {
      const localReports = readLocalReports();
      const idSet = new Set(reportIds);
      localReports.forEach((report, index) => {
        if (idSet.has(reportId(report))) localReports[index] = { ...report, isPublic, is_public: isPublic, inPool: isPublic, in_pool: isPublic, sharedAt, shared_at: sharedAt };
      });
      writeLocalReports(localReports);
    }
    res.json({ success: true, count: reportIds.length, isPublic });
  } catch (error) {
    res.status(503).json({ success: false, reason: 'Ortak havuz durumu güncellenemedi.' });
  }
});

// ── RAPOR ZENGİN NOTU & DOSYA EKLERİ (RICH NOTES & ATTACHMENTS) ─
const ATTACHMENTS_DIR = path.join(__dirname, 'data', 'attachments');

app.patch('/api/reports/:id/note', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ success: false, reason: 'Rapor kimliği gereklidir.' });

  try {
    const existing = await getReportRecord(id);
    if (!existing) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
    if (!canEditReportNote(req.authUser, existing)) {
      return res.status(403).json({ success: false, reason: 'Bu rapora not ekleme yetkiniz bulunmamaktadır.' });
    }

    const { userNote, noteHtml, attachments } = req.body || {};
    const cleanNote = String(userNote || '').slice(0, 500000);
    const cleanHtml = String(noteHtml || '').slice(0, 500000);
    const cleanAttachments = Array.isArray(attachments) ? attachments.slice(0, 50) : (existing.data?.attachments || []);

    const now = new Date().toISOString();

    if (supabase) {
      const current = reportRowToClient(existing);
      const data = {
        ...current,
        userNote: cleanNote,
        user_note: cleanNote,
        noteHtml: cleanHtml,
        note_html: cleanHtml,
        attachments: cleanAttachments,
        noteAttachments: cleanAttachments
      };
      const updatePayload = {
        user_note: cleanNote,
        data,
        updated_at: now
      };
      try {
        const fullPayload = { ...updatePayload, note_html: cleanHtml, note_attachments: cleanAttachments };
        const res1 = await supabase.from('reports').update(fullPayload).eq('id', id).select('*').limit(1);
        if (res1.error) throw res1.error;
      } catch {
        const res2 = await supabase.from('reports').update(updatePayload).eq('id', id).select('*').limit(1);
        if (res2.error) throw res2.error;
      }
    } else {
      const reports = readLocalReports();
      const idx = reports.findIndex(r => reportId(r) === id);
      if (idx >= 0) {
        reports[idx].user_note = cleanNote;
        reports[idx].userNote = cleanNote;
        reports[idx].note_html = cleanHtml;
        reports[idx].noteHtml = cleanHtml;
        reports[idx].attachments = cleanAttachments;
        reports[idx].noteAttachments = cleanAttachments;
        reports[idx].updated_at = now;
        writeLocalReports(reports);
      }
    }

    recordAuditLog({
      userId: req.authUser.id,
      username: req.authUser.username,
      fullName: req.authUser.full_name,
      role: req.authUser.role,
      action: 'NOTE_UPDATE',
      target: existing.name || id,
      details: 'Rapor zengin notu ve ekleri güncellendi.',
      ip: req.ip
    });

    res.json({
      success: true,
      userNote: cleanNote,
      noteHtml: cleanHtml,
      attachments: cleanAttachments
    });
  } catch (err) {
    console.warn('Rapor notu kaydedilemedi:', safeLogStr(err.message));
    res.status(500).json({ success: false, reason: 'Rapor notu kaydedilemedi: ' + err.message });
  }
});

app.post('/api/reports/:id/attachments', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const reportIdParam = String(req.params.id || '').trim();
  if (!reportIdParam) return res.status(400).json({ success: false, reason: 'Rapor kimliği gereklidir.' });

  try {
    const report = await getReportRecord(reportIdParam);
    if (!report) return res.status(404).json({ success: false, reason: 'Rapor bulunamadı.' });
    if (!canEditReportNote(req.authUser, report)) {
      return res.status(403).json({ success: false, reason: 'Bu rapora ek yükleme yetkiniz yok.' });
    }

    const { filename, mimeType, base64Data } = req.body || {};
    if (!filename || !base64Data) {
      return res.status(400).json({ success: false, reason: 'Dosya adı ve içeriği gereklidir.' });
    }

    const baseName = path.basename(filename).replace(/[^a-zA-Z0-9.\-_ğüşıöçĞÜŞİÖÇ]/g, '_');
    const safeName = Date.now() + '_' + baseName;
    const targetDir = path.resolve(ATTACHMENTS_DIR, reportIdParam);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const buffer = Buffer.from(base64Data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(400).json({ success: false, reason: 'Dosya boyutu 15 MB sınırını aşamaz.' });
    }

    const targetFile = path.resolve(targetDir, safeName);
    if (!targetFile.startsWith(targetDir)) {
      return res.status(400).json({ success: false, reason: 'Geçersiz dosya adı.' });
    }
    fs.writeFileSync(targetFile, buffer);

    const attachmentItem = {
      id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: baseName,
      size: buffer.length,
      type: mimeType || 'application/octet-stream',
      url: `/api/reports/${encodeURIComponent(reportIdParam)}/attachments/${encodeURIComponent(safeName)}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.authUser.full_name || req.authUser.username
    };

    res.json({ success: true, attachment: attachmentItem });
  } catch (err) {
    console.warn('Ek yükleme hatası:', safeLogStr(err.message));
    res.status(500).json({ success: false, reason: 'Ek yüklenemedi: ' + err.message });
  }
});

app.get('/api/reports/:id/attachments/:filename', requireAuth, async (req, res) => {
  const reportIdParam = String(req.params.id || '').trim();
  const filename = path.basename(String(req.params.filename || '').trim());
  if (!reportIdParam || !filename) return res.status(400).send('Geçersiz dosya isteği.');

  try {
    const report = await getReportRecord(reportIdParam);
    if (!report || !canReadReport(req.authUser, report)) {
      return res.status(403).send('Bu eki görüntüleme yetkiniz yok.');
    }

    const targetDir = path.resolve(ATTACHMENTS_DIR, reportIdParam);
    const filePath = path.resolve(targetDir, filename);
    if (!filePath.startsWith(targetDir) || !fs.existsSync(filePath)) {
      return res.status(404).send('Ek dosya bulunamadı.');
    }

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).send('Dosya getirilemedi.');
  }
});

// ── ÇEVRİMİÇİ KULLANICI & VARLIK (PRESENCE) YÖNETİMİ ──────────
const activePresence = new Map(); // userId -> { userId, customStatus, lastSeen }

function recordUserPresence(user, customStatus = 'online') {
  if (!user || !user.id) return;
  const validStatus = ['online', 'busy', 'dnd', 'invisible'].includes(customStatus) ? customStatus : 'online';
  activePresence.set(String(user.id), {
    userId: String(user.id),
    lastSeen: Date.now(),
    customStatus: validStatus
  });
}

function removeUserPresence(userId) {
  if (!userId) return;
  activePresence.delete(String(userId));
}

async function getAllUsersWithPresence() {
  const now = Date.now();
  const threshold = 45 * 1000;
  const activeMap = new Map();
  for (const [id, data] of activePresence.entries()) {
    if (now - data.lastSeen <= threshold) {
      activeMap.set(String(id), data);
    } else {
      activePresence.delete(id);
    }
  }

  let allUsers = [];
  if (supabase) {
    try {
      const { data } = await supabase
        .from('app_users')
        .select('id, username, full_name, department, role, avatar, is_active, last_seen, last_login')
        .eq('is_active', true);
      if (data && data.length) allUsers = data;
    } catch {}
  }
  if (!allUsers.length) {
    allUsers = getLocalUsers().filter(u => u.is_active !== false);
  }

  return allUsers.map(u => {
    const strId = String(u.id);
    const active = activeMap.get(strId);
    const rawStatus = active ? (active.customStatus || 'online') : 'offline';
    const isOnline = Boolean(active) && rawStatus !== 'invisible';
    const status = isOnline ? rawStatus : 'offline';
    const lastSeenTime = active ? new Date(active.lastSeen).toISOString() : (u.last_seen || u.last_login || null);
    return {
      id: strId,
      username: u.username || '',
      fullName: u.full_name || u.fullName || u.username || '',
      department: u.department || '',
      role: u.role || 'user',
      avatar: u.avatar || (u.username ? u.username[0].toUpperCase() : 'U'),
      isOnline,
      status,
      lastSeen: lastSeenTime
    };
  }).sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return (a.fullName || a.username).localeCompare(b.fullName || b.username, 'tr');
  });
}

// ── GERÇEK ZAMANLI SOHBET & MESAJLAŞMA SİSTEMİ ──────────────────
const CHAT_STORE_PATH = path.join(__dirname, 'data', 'chat_messages.json');
let chatMessagesCache = null;

function getChatMessages() {
  if (chatMessagesCache !== null) return chatMessagesCache;
  try {
    if (fs.existsSync(CHAT_STORE_PATH)) {
      chatMessagesCache = JSON.parse(fs.readFileSync(CHAT_STORE_PATH, 'utf8'));
    } else {
      chatMessagesCache = [];
    }
  } catch {
    chatMessagesCache = [];
  }
  return chatMessagesCache;
}

function saveChatMessages() {
  try {
    const dir = path.dirname(CHAT_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (chatMessagesCache.length > 3000) {
      chatMessagesCache = chatMessagesCache.slice(-3000);
    }
    fs.writeFileSync(CHAT_STORE_PATH, JSON.stringify(chatMessagesCache, null, 2), 'utf8');
  } catch {}
}

function getUnreadCountsForUser(userId) {
  const msgs = getChatMessages();
  const counts = {};
  const lastInteraction = {};
  let total = 0;
  const strUser = String(userId);
  for (const m of msgs) {
    const isIncoming = String(m.receiverId) === strUser;
    const isOutgoing = String(m.senderId) === strUser;
    const time = new Date(m.createdAt || 0).getTime();

    if (isIncoming && !m.isRead) {
      const senderKey = String(m.senderId);
      counts[senderKey] = (counts[senderKey] || 0) + 1;
      total++;
    }
    if (isIncoming || isOutgoing) {
      const peerId = isIncoming ? String(m.senderId) : String(m.receiverId);
      if (peerId) {
        if (!lastInteraction[peerId] || time > lastInteraction[peerId]) {
          lastInteraction[peerId] = time;
        }
      }
    }
    if (m.roomId) {
      const rId = String(m.roomId);
      if (!lastInteraction[rId] || time > lastInteraction[rId]) {
        lastInteraction[rId] = time;
      }
    }
    if (m.groupId) {
      const gId = String(m.groupId);
      if (!lastInteraction[gId] || time > lastInteraction[gId]) {
        lastInteraction[gId] = time;
      }
    }
  }
  return { bySender: counts, total, lastInteraction };
}

app.post('/api/presence/heartbeat', requireAuth, async (req, res) => {
  try {
    const customStatus = req.body?.customStatus || 'online';
    recordUserPresence(req.authUser, customStatus);
    if (supabase) {
      supabase.from('app_users').update({ last_seen: new Date().toISOString(), is_online: customStatus !== 'invisible' }).eq('id', req.authUser.id).then(() => {}).catch(() => {});
    }
    const users = await getAllUsersWithPresence();
    const unread = getUnreadCountsForUser(req.authUser.id);
    res.json({ success: true, users, unreadCounts: unread });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Presence güncellenemedi.' });
  }
});

app.get('/api/presence/users', requireAuth, async (req, res) => {
  try {
    const users = await getAllUsersWithPresence();
    const unread = getUnreadCountsForUser(req.authUser.id);
    res.json({ success: true, users, unreadCounts: unread });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Kullanıcılar alınamadı.' });
  }
});

app.post('/api/presence/offline', async (req, res) => {
  try {
    const userId = req.body?.userId;
    if (userId) {
      removeUserPresence(userId);
      if (supabase) {
        supabase.from('app_users').update({ is_online: false, last_seen: new Date().toISOString() }).eq('id', String(userId)).then(() => {}).catch(() => {});
      }
    }
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

// ── OKUNMAMIŞ SOHBET MESAJLARI İÇİN E-POSTA BİLDİRİM YÖNETİCİSİ (DEBOUNCED & ANTI-SPAM) ──
const chatEmailTimers = new Map(); // `${senderId}_${receiverId}` -> { timer }
const chatEmailCooldowns = new Map(); // `${receiverId}` -> timestamp

function clearChatEmailTimer(senderId, receiverId) {
  const timerKey = `${senderId}_${receiverId}`;
  const existing = chatEmailTimers.get(timerKey);
  if (existing) {
    if (existing.timer) clearTimeout(existing.timer);
    chatEmailTimers.delete(timerKey);
  }
}

async function scheduleChatEmailDigest(senderUser, receiverId, messageSnippet) {
  if (!senderUser || !receiverId) return;
  const strReceiver = String(receiverId);
  const strSender = String(senderUser.id);
  if (strReceiver === strSender) return;

  try {
    const recipient = await loadUserById(strReceiver);
    if (!recipient || !recipient.email) return;
    if (recipient.email_chat_digest === false || recipient.emailChatDigest === false) return;

    // 15 dakikalık anti-spam soğuma kontrolü
    const lastSent = chatEmailCooldowns.get(strReceiver) || 0;
    if (Date.now() - lastSent < 15 * 60 * 1000) return;

    const timerKey = `${strSender}_${strReceiver}`;
    if (chatEmailTimers.has(timerKey)) return;

    const delayMs = process.env.CHAT_EMAIL_DELAY_MS ? parseInt(process.env.CHAT_EMAIL_DELAY_MS, 10) : 3 * 60 * 1000;

    const timer = setTimeout(async () => {
      chatEmailTimers.delete(timerKey);
      try {
        const all = getChatMessages();
        const unreads = all.filter(m => String(m.senderId) === strSender && String(m.receiverId) === strReceiver && !m.isRead);
        if (unreads.length === 0) return;

        const currentLastSent = chatEmailCooldowns.get(strReceiver) || 0;
        if (Date.now() - currentLastSent < 15 * 60 * 1000) return;

        chatEmailCooldowns.set(strReceiver, Date.now());

        const recName = recipient.full_name || recipient.username || 'Kullanıcı';
        const sndName = senderUser.full_name || senderUser.username || 'Ekip Arkadaşınız';
        const lastMsg = unreads[unreads.length - 1];
        const snippet = lastMsg.text || (lastMsg.attachment ? '📎 Görsel / Belge eki' : (lastMsg.voice ? '🎤 Sesli mesaj' : messageSnippet || 'Yeni ileti'));

        await mailer.sendUnreadMessageDigest({
          to: recipient.email,
          recipientName: recName,
          senderName: sndName,
          unreadCount: unreads.length,
          lastMessageSnippet: snippet
        });
      } catch (err) {
        console.warn('Okunmamış mesaj bildirim e-postası gönderilemedi:', err.message);
      }
    }, delayMs);

    if (timer.unref) timer.unref();
    chatEmailTimers.set(timerKey, { timer });
  } catch (err) {
    console.warn('E-posta bildirim planlaması yapılamadı:', err.message);
  }
}

// ── GRUP SOHBETLERİ YÖNETİMİ (Kullanıcı Çoklu Grup Sohbeti) ─────
const CHAT_GROUPS_STORE_PATH = path.join(__dirname, 'data', 'chat_groups.json');
let chatGroupsCache = null;

function getChatGroups() {
  if (chatGroupsCache !== null) return chatGroupsCache;
  try {
    if (fs.existsSync(CHAT_GROUPS_STORE_PATH)) {
      chatGroupsCache = JSON.parse(fs.readFileSync(CHAT_GROUPS_STORE_PATH, 'utf8'));
    } else {
      chatGroupsCache = [];
    }
  } catch {
    chatGroupsCache = [];
  }
  return chatGroupsCache;
}

function saveChatGroups() {
  try {
    const dir = path.dirname(CHAT_GROUPS_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CHAT_GROUPS_STORE_PATH, JSON.stringify(chatGroupsCache, null, 2), 'utf8');
  } catch {}
}

app.get('/api/chat/groups', requireAuth, async (req, res) => {
  try {
    const myId = String(req.authUser.id);
    const groups = getChatGroups();
    const myGroups = groups.filter(g => Array.isArray(g.memberUserIds) && g.memberUserIds.map(String).includes(myId));
    res.json({ success: true, groups: myGroups });
  } catch {
    res.status(500).json({ success: false, reason: 'Gruplar alınamadı.' });
  }
});

app.post('/api/chat/groups', requireAuth, async (req, res) => {
  try {
    const { name, icon, memberUserIds } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) return res.status(400).json({ success: false, reason: 'Grup adı belirtilmelidir.' });

    const myId = String(req.authUser.id);
    const membersSet = new Set((Array.isArray(memberUserIds) ? memberUserIds : []).map(String));
    membersSet.add(myId);

    if (membersSet.size < 2) {
      return res.status(400).json({ success: false, reason: 'Grup oluşturmak için en az bir kişi daha seçmelisiniz.' });
    }

    const groups = getChatGroups();
    const newGroup = {
      id: 'group_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: cleanName,
      icon: String(icon || '👥').trim() || '👥',
      memberUserIds: Array.from(membersSet),
      createdBy: myId,
      createdByName: req.authUser.full_name || req.authUser.username,
      createdAt: new Date().toISOString()
    };

    groups.unshift(newGroup);
    saveChatGroups();
    res.json({ success: true, group: newGroup });
  } catch {
    res.status(500).json({ success: false, reason: 'Grup oluşturulamadı.' });
  }
});

// MSN Nudge (Titreşim / Dürtme)
const nudgeCooldowns = new Map();

app.post('/api/chat/nudge', requireAuth, async (req, res) => {
  try {
    const { receiverId, groupId } = req.body || {};
    const myId = String(req.authUser.id);
    const targetKey = receiverId ? `${myId}_${receiverId}` : `${myId}_${groupId}`;

    const lastNudge = nudgeCooldowns.get(targetKey) || 0;
    if (Date.now() - lastNudge < 15 * 1000) {
      const waitSec = Math.ceil((15 * 1000 - (Date.now() - lastNudge)) / 1000);
      return res.status(429).json({ success: false, reason: `Lütfen tekrar titreşim göndermeden önce ${waitSec} saniye bekleyin.` });
    }

    nudgeCooldowns.set(targetKey, Date.now());

    const messages = getChatMessages();
    const senderName = req.authUser.full_name || req.authUser.username;
    const nudgeMsg = {
      id: 'nudge_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      senderId: myId,
      senderName,
      senderUsername: req.authUser.username,
      senderAvatar: req.authUser.avatar || (req.authUser.username ? req.authUser.username[0].toUpperCase() : 'U'),
      receiverId: receiverId ? String(receiverId) : null,
      groupId: groupId ? String(groupId) : null,
      roomId: null,
      text: `📳 ${senderName} bir titreşim gönderdi!`,
      attachment: null,
      voice: null,
      isNudge: true,
      reactions: {},
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString()
    };

    messages.push(nudgeMsg);
    saveChatMessages();

    res.json({ success: true, message: nudgeMsg });
  } catch {
    res.status(500).json({ success: false, reason: 'Titreşim gönderilemedi.' });
  }
});

// Chat: Mesaj Gönderme
app.post('/api/chat/send', requireAuth, async (req, res) => {
  try {
    const { receiverId, roomId, groupId, text, attachment, voice, isNudge } = req.body || {};
    if (!text && !attachment && !voice && !isNudge) {
      return res.status(400).json({ success: false, reason: 'Mesaj içeriği boş olamaz.' });
    }
    if (!receiverId && !roomId && !groupId) {
      return res.status(400).json({ success: false, reason: 'Alıcı, oda veya grup belirtilmelidir.' });
    }

    // Odalardan / Kanallardan yalnızca yönetici (Admin) paylaşım yapabilir kuralı
    if (roomId && req.authUser.role !== 'admin') {
      return res.status(403).json({ success: false, reason: 'Bu kurumsal kanala yalnızca sistem yöneticileri (Admin) duyuru ve mesaj gönderebilir.' });
    }

    const messages = getChatMessages();
    const newMsg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      senderId: String(req.authUser.id),
      senderName: req.authUser.full_name || req.authUser.username,
      senderUsername: req.authUser.username,
      senderAvatar: req.authUser.avatar || (req.authUser.username ? req.authUser.username[0].toUpperCase() : 'U'),
      receiverId: receiverId ? String(receiverId) : null,
      roomId: roomId ? String(roomId) : null,
      groupId: groupId ? String(groupId) : null,
      text: String(text || '').trim(),
      attachment: attachment || null,
      voice: voice || null,
      isNudge: Boolean(isNudge),
      reactions: {},
      isRead: false,
      readAt: null,
      createdAt: new Date().toISOString()
    };

    messages.push(newMsg);
    saveChatMessages();

    // 1-e-1 sohbette okunmayan mesajlar için gecikmeli e-posta bildirimini planla
    if (receiverId && !roomId && !groupId) {
      scheduleChatEmailDigest(req.authUser, receiverId, newMsg.text).catch(() => {});
    }

    // Supabase yedekleme (varsa)
    if (supabase) {
      supabase.from('chat_messages').insert({
        sender_id: req.authUser.id,
        receiver_id: receiverId || null,
        room_id: roomId || null,
        text: newMsg.text,
        attachment: newMsg.attachment,
        voice: newMsg.voice,
        reactions: newMsg.reactions
      }).then(() => {}).catch(() => {});
    }

    res.json({ success: true, message: newMsg });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Mesaj gönderilemedi.' });
  }
});

// Chat: Mesajları Listeleme
app.get('/api/chat/messages', requireAuth, async (req, res) => {
  try {
    const peerId = req.query.peerId ? String(req.query.peerId) : null;
    const roomId = req.query.roomId ? String(req.query.roomId) : null;
    const groupId = req.query.groupId ? String(req.query.groupId) : null;
    const since = req.query.since ? new Date(req.query.since).getTime() : 0;
    const myId = String(req.authUser.id);

    const all = getChatMessages();
    let changed = false;

    let matched = all.filter(m => {
      if (roomId) {
        return m.roomId === roomId;
      }
      if (groupId) {
        return m.groupId === groupId;
      }
      if (peerId) {
        const isMeToPeer = (String(m.senderId) === myId && String(m.receiverId) === peerId);
        const isPeerToMe = (String(m.senderId) === peerId && String(m.receiverId) === myId);
        return isMeToPeer || isPeerToMe;
      }
      return false;
    });

    if (since > 0) {
      matched = matched.filter(m => new Date(m.createdAt).getTime() > since);
    }

    const mediaOnly = req.query.mediaOnly === 'true';
    if (mediaOnly) {
      matched = matched.filter(m => !!m.attachment);
    }

    // Okundu işaretleme (Bana gelen okunmamış mesajları okundu yap)
    if (peerId) {
      clearChatEmailTimer(peerId, myId);
      matched.forEach(m => {
        if (String(m.senderId) === peerId && String(m.receiverId) === myId && !m.isRead) {
          m.isRead = true;
          m.readAt = new Date().toISOString();
          changed = true;
        }
      });
      if (changed) {
        saveChatMessages();
      }
    }

    res.json({ success: true, messages: matched.slice(-100) });
  } catch (err) {
    res.status(500).json({ success: false, reason: 'Mesajlar alınamadı.' });
  }
});

// Chat: Mesajları Okundu İşaretleme
app.post('/api/chat/mark-read', requireAuth, async (req, res) => {
  try {
    const peerId = req.body?.peerId ? String(req.body.peerId) : null;
    const myId = String(req.authUser.id);
    if (!peerId) return res.json({ success: true });

    clearChatEmailTimer(peerId, myId);

    const all = getChatMessages();
    let changed = false;
    all.forEach(m => {
      if (String(m.senderId) === peerId && String(m.receiverId) === myId && !m.isRead) {
        m.isRead = true;
        m.readAt = new Date().toISOString();
        changed = true;
      }
    });

    if (changed) saveChatMessages();
    res.json({ success: true });
  } catch {
    res.json({ success: true });
  }
});

// Chat: Reaksiyon Ekleme / Kaldırma
app.post('/api/chat/react', requireAuth, async (req, res) => {
  try {
    const { messageId, emoji } = req.body || {};
    if (!messageId || !emoji) return res.status(400).json({ success: false });

    const all = getChatMessages();
    const msg = all.find(m => m.id === messageId);
    if (!msg) return res.status(404).json({ success: false, reason: 'Mesaj bulunamadı.' });

    if (!msg.reactions) msg.reactions = {};
    const myId = String(req.authUser.id);
    const existing = msg.reactions[emoji] || [];

    if (existing.includes(myId)) {
      // Kaldır
      msg.reactions[emoji] = existing.filter(id => id !== myId);
      if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
    } else {
      // Ekle
      msg.reactions[emoji] = [...existing, myId];
    }

    saveChatMessages();
    res.json({ success: true, reactions: msg.reactions });
  } catch {
    res.status(500).json({ success: false, reason: 'Reaksiyon verilemedi.' });
  }
});

// Chat: Mesaj Silme (Geri Çekme)
app.delete('/api/chat/messages/:id', requireAuth, async (req, res) => {
  try {
    const all = getChatMessages();
    const idx = all.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, reason: 'Mesaj bulunamadı.' });
    const msg = all[idx];
    const myId = String(req.authUser.id);
    if (String(msg.senderId) !== myId && req.authUser.role !== 'admin') {
      return res.status(403).json({ success: false, reason: 'Yalnızca kendi mesajınızı silebilirsiniz.' });
    }
    all.splice(idx, 1);
    saveChatMessages();
    if (supabase) {
      supabase.from('chat_messages').delete().eq('id', req.params.id).then(() => {}).catch(() => {});
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, reason: 'Mesaj silinemedi.' });
  }
});

// Chat: Tüm Sohbeti Temizle / Sil (Conversation Delete)
app.delete('/api/chat/conversations/:id', requireAuth, async (req, res) => {
  try {
    const targetId = String(req.params.id || '');
    const type = req.query.type || 'peer'; // 'peer', 'room', 'group'
    const myId = String(req.authUser.id);
    const isAdmin = req.authUser.role === 'admin';

    const all = getChatMessages();
    let toDeleteIds = [];

    if (type === 'room') {
      if (!isAdmin) {
        return res.status(403).json({ success: false, reason: 'Yalnızca yöneticiler oda geçmişini silebilir.' });
      }
      toDeleteIds = all.filter(m => m.roomId === targetId).map(m => m.id);
    } else if (type === 'group') {
      if (!isAdmin) {
        return res.status(403).json({ success: false, reason: 'Yalnızca yöneticiler grup geçmişini silebilir.' });
      }
      toDeleteIds = all.filter(m => m.groupId === targetId).map(m => m.id);
    } else {
      // 1-e-1 Özel Sohbet (Peer / DM)
      toDeleteIds = all.filter(m => 
        (String(m.senderId) === myId && String(m.receiverId) === targetId) ||
        (String(m.senderId) === targetId && String(m.receiverId) === myId)
      ).map(m => m.id);
    }

    if (toDeleteIds.length > 0) {
      const deleteSet = new Set(toDeleteIds);
      chatMessagesCache = all.filter(m => !deleteSet.has(m.id));
      saveChatMessages();
      if (supabase) {
        supabase.from('chat_messages').delete().in('id', toDeleteIds).then(() => {}).catch(() => {});
      }
    }

    res.json({ success: true, count: toDeleteIds.length });
  } catch {
    res.status(500).json({ success: false, reason: 'Sohbet geçmişi silinemedi.' });
  }
});

// ── DEPARTMAN ODALARI YÖNETİMİ ──────────────────
const CHAT_ROOMS_STORE_PATH = path.join(__dirname, 'data', 'chat_rooms.json');
let chatRoomsCache = null;

function getChatRooms() {
  if (chatRoomsCache !== null) return chatRoomsCache;
  try {
    if (fs.existsSync(CHAT_ROOMS_STORE_PATH)) {
      chatRoomsCache = JSON.parse(fs.readFileSync(CHAT_ROOMS_STORE_PATH, 'utf8'));
    } else {
      chatRoomsCache = [
        { id: 'room_general', name: 'Genel Ekip Duyuruları', icon: '📢', description: 'Tüm birimler ortak iletişim ve duyuru kanalı', isAllUsers: true, memberUserIds: [] },
        { id: 'room_ops', name: 'Operasyon & Saha', icon: '⚙️', description: 'Raporlama ve saha operasyon koordinasyonu', isAllUsers: true, memberUserIds: [] },
        { id: 'room_finance', name: 'Muhasebe & Finans', icon: '📊', description: 'Mali tablolar ve mutabakat kanalı', isAllUsers: true, memberUserIds: [] }
      ];
      saveChatRooms();
    }
  } catch {
    chatRoomsCache = [];
  }
  return chatRoomsCache;
}

function saveChatRooms() {
  try {
    const dir = path.dirname(CHAT_ROOMS_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CHAT_ROOMS_STORE_PATH, JSON.stringify(chatRoomsCache, null, 2), 'utf8');
  } catch {}
}

app.get('/api/chat/rooms', requireAuth, async (req, res) => {
  try {
    const rooms = getChatRooms();
    const myId = String(req.authUser.id);
    const isAdmin = req.authUser.role === 'admin';
    const filtered = rooms.filter(r => {
      if (isAdmin || r.isAllUsers) return true;
      return Array.isArray(r.memberUserIds) && r.memberUserIds.map(String).includes(myId);
    });
    res.json({ success: true, rooms: filtered });
  } catch {
    res.status(500).json({ success: false, reason: 'Odalar alınamadı.' });
  }
});

app.post('/api/chat/rooms', requireAuth, async (req, res) => {
  try {
    if (req.authUser.role !== 'admin') {
      return res.status(403).json({ success: false, reason: 'Yalnızca yöneticiler oda oluşturabilir.' });
    }
    const { name, icon, description, isAllUsers, memberUserIds } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, reason: 'Oda adı zorunludur.' });
    }
    const rooms = getChatRooms();
    const id = 'room_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newRoom = {
      id,
      name: name.trim(),
      icon: (icon || '📢').trim(),
      description: (description || '').trim(),
      isAllUsers: Boolean(isAllUsers),
      memberUserIds: Array.isArray(memberUserIds) ? memberUserIds.map(String) : [],
      createdBy: String(req.authUser.id),
      createdAt: new Date().toISOString()
    };
    rooms.push(newRoom);
    saveChatRooms();
    if (supabase) {
      supabase.from('chat_rooms').insert({
        id: newRoom.id,
        name: newRoom.name,
        icon: newRoom.icon,
        description: newRoom.description,
        is_all_users: newRoom.isAllUsers,
        member_user_ids: newRoom.memberUserIds,
        created_by: req.authUser.id
      }).then(() => {}).catch(() => {});
    }
    res.json({ success: true, room: newRoom });
  } catch {
    res.status(500).json({ success: false, reason: 'Oda oluşturulamadı.' });
  }
});

app.put('/api/chat/rooms/:id', requireAuth, async (req, res) => {
  try {
    if (req.authUser.role !== 'admin') {
      return res.status(403).json({ success: false, reason: 'Yalnızca yöneticiler odayı düzenleyebilir.' });
    }
    const rooms = getChatRooms();
    const room = rooms.find(r => r.id === req.params.id);
    if (!room) return res.status(404).json({ success: false, reason: 'Oda bulunamadı.' });

    const { name, icon, description, isAllUsers, memberUserIds } = req.body || {};
    if (name) room.name = name.trim();
    if (icon) room.icon = icon.trim();
    if (description !== undefined) room.description = String(description).trim();
    if (isAllUsers !== undefined) room.isAllUsers = Boolean(isAllUsers);
    if (Array.isArray(memberUserIds)) room.memberUserIds = memberUserIds.map(String);

    saveChatRooms();
    if (supabase) {
      supabase.from('chat_rooms').update({
        name: room.name,
        icon: room.icon,
        description: room.description,
        is_all_users: room.isAllUsers,
        member_user_ids: room.memberUserIds,
        updated_at: new Date().toISOString()
      }).eq('id', room.id).then(() => {}).catch(() => {});
    }
    res.json({ success: true, room });
  } catch {
    res.status(500).json({ success: false, reason: 'Oda güncellenemedi.' });
  }
});

app.delete('/api/chat/rooms/:id', requireAuth, async (req, res) => {
  try {
    if (req.authUser.role !== 'admin') {
      return res.status(403).json({ success: false, reason: 'Yalnızca yöneticiler odayı silebilir.' });
    }
    const rooms = getChatRooms();
    const idx = rooms.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, reason: 'Oda bulunamadı.' });

    rooms.splice(idx, 1);
    saveChatRooms();
    if (supabase) {
      supabase.from('chat_rooms').delete().eq('id', req.params.id).then(() => {}).catch(() => {});
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, reason: 'Oda silinemedi.' });
  }
});

// ── KATEGORİ YÖNETİMİ (CATEGORIES CRUD API) ──────────────────
const CATEGORIES_STORE_PATH = path.join(__dirname, 'data', 'categories.json');

function readLocalCategories() {
  try {
    if (!fs.existsSync(CATEGORIES_STORE_PATH)) return [];
    return JSON.parse(fs.readFileSync(CATEGORIES_STORE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeLocalCategories(cats) {
  try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(CATEGORIES_STORE_PATH, JSON.stringify(cats, null, 2), 'utf8');
  } catch {}
}

app.get('/api/categories', requireAuth, async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      return res.json({ success: true, categories: data || [] });
    }
    res.json({ success: true, categories: readLocalCategories() });
  } catch (error) {
    res.status(503).json({ success: false, reason: 'Kategoriler alınamadı.' });
  }
});

app.post('/api/categories', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const cat = req.body;
  if (!cat || !cat.id) return res.status(400).json({ success: false, reason: 'Kategori ID gereklidir.' });
  const row = {
    id: String(cat.id).slice(0, 100),
    name: String(cat.name || 'Genel').slice(0, 150),
    color: String(cat.color || '#3b82f6').slice(0, 50),
    icon: String(cat.icon || 'folder').slice(0, 50),
    created_at: cat.created_at || new Date().toISOString()
  };
  try {
    if (supabase) {
      const { error } = await supabase.from('categories').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    } else {
      const cats = readLocalCategories();
      const idx = cats.findIndex(c => c.id === row.id);
      if (idx >= 0) cats[idx] = row; else cats.push(row);
      writeLocalCategories(cats);
    }
    res.json({ success: true, category: row });
  } catch (error) {
    res.status(503).json({ success: false, reason: 'Kategori kaydedilemedi.' });
  }
});

app.delete('/api/categories/:id', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const catId = String(req.params.id || '').trim();
  const SYSTEM_CATEGORY_IDS = new Set(['cat_genel', 'cat_fatura', 'cat_muhasebe', 'cat_stok', 'cat_rapor', 'genel', 'default', 'general']);
  if (SYSTEM_CATEGORY_IDS.has(catId.toLowerCase())) {
    return res.status(403).json({ success: false, reason: 'Sistem varsayılan kategorileri silinemez.' });
  }
  try {
    if (supabase) {
      const { error } = await supabase.from('categories').delete().eq('id', catId);
      if (error) throw error;
    } else {
      writeLocalCategories(readLocalCategories().filter(c => c.id !== catId));
    }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, reason: 'Kategori silinemedi.' });
  }
});

// ── SORGU KÜTÜPHANESİ (SNIPPETS CRUD API) ────────────────────
const SNIPPETS_STORE_PATH = path.join(__dirname, 'data', 'snippets.json');

function readLocalSnippets() {
  try {
    if (!fs.existsSync(SNIPPETS_STORE_PATH)) return [];
    return JSON.parse(fs.readFileSync(SNIPPETS_STORE_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function writeLocalSnippets(snippets) {
  try {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(SNIPPETS_STORE_PATH, JSON.stringify(snippets, null, 2), 'utf8');
  } catch {}
}

app.get('/api/snippets', requireAuth, async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase.from('snippets').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const formatted = (data || []).map(s => ({
        id: s.id,
        title: s.title,
        sql: s.sql,
        reportName: s.report_name,
        category: s.category,
        createdAt: s.created_at
      }));
      return res.json({ success: true, snippets: formatted });
    }
    res.json({ success: true, snippets: readLocalSnippets() });
  } catch (error) {
    res.status(503).json({ success: false, reason: 'Sorgular alınamadı.' });
  }
});

app.post('/api/snippets', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const snippet = req.body;
  if (!snippet) return res.status(400).json({ success: false, reason: 'Sorgu verisi gereklidir.' });
  const row = {
    id: String(snippet.id || Date.now()),
    title: String(snippet.title || 'SQL Sorgusu').slice(0, 200),
    sql: String(snippet.sql || ''),
    report_name: String(snippet.reportName || snippet.report_name || '—').slice(0, 300),
    category: String(snippet.category || 'Genel').slice(0, 100),
    created_at: snippet.createdAt || snippet.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  try {
    if (supabase) {
      const { error } = await supabase.from('snippets').upsert(row, { onConflict: 'id' });
      if (error) throw error;
    } else {
      const snippets = readLocalSnippets();
      const idx = snippets.findIndex(s => s.id === row.id);
      if (idx >= 0) snippets[idx] = row; else snippets.unshift(row);
      writeLocalSnippets(snippets);
    }
    res.json({ success: true, snippet: row });
  } catch (error) {
    res.status(503).json({ success: false, reason: 'Sorgu kaydedilemedi.' });
  }
});

app.delete('/api/snippets/:id', apiWriteRateLimiter, requireAuth, async (req, res) => {
  const snipId = String(req.params.id);
  try {
    if (supabase) {
      const { error } = await supabase.from('snippets').delete().eq('id', snipId);
      if (error) throw error;
    } else {
      writeLocalSnippets(readLocalSnippets().filter(s => s.id !== snipId));
    }
    res.json({ success: true });
  } catch (error) {
    res.status(503).json({ success: false, reason: 'Sorgu silinemedi.' });
  }
});

async function startServer() {
  try {
    await ensureAdminUser();
  } catch (err) {
    console.warn('Bootstrap admin başlatma uyarısı:', safeLogStr(err.message));
  }

  const server = app.listen(PORT, () => {
    const url = `http://localhost:${PORT}`;
    console.log(`\n======================================================`);
    console.log(` FrpOku Sunucusu Başarıyla Başlatıldı!`);
    console.log(` Web Adresi: ${url}`);
    console.log(`======================================================\n`);

    // Geliştirme ortamında tarayıcıyı otomatik aç
    if (process.env.AUTO_OPEN_BROWSER !== 'false') {
      const { exec } = require('child_process');
      const startCmd = process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
      exec(startCmd, () => {});
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[HATA] ${PORT} portu zaten başka bir FrpOku penceresi veya uygulama tarafından kullanılıyor!`);
      console.error(`Lütfen açık olan diğer Node.js / FrpOku pencerelerini kapatıp tekrar deneyin.\n`);
    } else {
      console.error('Sunucu başlatılamadı:', safeLogStr(err.message));
    }
    process.exit(1);
  });
}

startServer().catch(error => {
  console.error('Sunucu başlatılamadı:', safeLogStr(error.message));
  process.exit(1);
});


// ── 10.6. E-POSTA DEĞİŞİKLİĞİ İÇİN 6 HANELİ DOĞRULAMA KODU GÖNDERME ─────────
app.post('/api/auth/request-email-change', authRateLimiter, requireAuth, async (req, res) => {
  const { newEmail, currentPassword } = req.body;
  const cleanEmail = normalizeEmail(newEmail);
  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return res.status(400).json({ success: false, reason: 'Geçerli bir yeni e-posta adresi giriniz.' });
  }

  try {
    const user = await loadUserById(req.authUser.id);
    if (!user) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });

    if (!currentPassword) {
      return res.status(400).json({ success: false, reason: 'Güvenliğiniz için lütfen mevcut şifrenizi giriniz.' });
    }

    const passCheck = await verifyPasswordHash(currentPassword, user.password_hash);
    if (!passCheck.valid) {
      return res.status(401).json({ success: false, reason: 'Mevcut şifreniz hatalıdır.' });
    }

    if (user.email && normalizeEmail(user.email) === cleanEmail) {
      return res.status(400).json({ success: false, reason: 'Girdiğiniz adres zaten mevcut e-posta adresinizdir.' });
    }

    // Başka kullanıcıda kayıtlı mı kontrolü
    if (supabase) {
      const { data: existing, error } = await supabase.from('app_users').select('id').eq('email', cleanEmail).neq('id', user.id).limit(1);
      if (error) throw error;
      if (existing?.length) {
        return res.status(409).json({ success: false, reason: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.' });
      }
    } else {
      const local = getLocalUsers();
      if (local.some(u => u.id !== user.id && normalizeEmail(u.email) === cleanEmail)) {
        return res.status(409).json({ success: false, reason: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.' });
      }
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    pendingEmailVerifications.set(user.id, {
      userId: user.id,
      code,
      newEmail: cleanEmail,
      oldEmail: user.email,
      expiresAt
    });

    const mailResult = await mailer.sendEmailChangeCode({
      to: cleanEmail,
      fullName: user.full_name || user.username,
      code,
      expiresIn: '15'
    });

    if (!mailResult.sent) {
      pendingEmailVerifications.delete(user.id);
      await recordAuditLog({
        userId: user.id,
        username: user.username,
        role: user.role,
        action: 'EMAIL_CHANGE_CODE_FAILED',
        target: cleanEmail,
        details: `Doğrulama kodu gönderilemedi (Durum: ${mailResult.status})`,
        ip: req.ip
      });
      return res.status(503).json({
        success: false,
        reason: mailResult.error || mailResult.reason || 'Doğrulama kodu e-posta adresine gönderilemedi.',
        notification: { email: { sent: false, status: mailResult.status } }
      });
    }

    await recordAuditLog({
      userId: user.id,
      username: user.username,
      role: user.role,
      action: 'EMAIL_CHANGE_CODE_REQUESTED',
      target: cleanEmail,
      details: `6 haneli doğrulama kodu gönderildi (Durum: ${mailResult.status})`,
      ip: req.ip
    });

    res.json({
      success: true,
      message: `'${cleanEmail}' adresine 6 haneli güvenlik doğrulama kodu gönderildi.`,
      notification: { email: { sent: mailResult.sent, status: mailResult.status } }
    });
  } catch (err) {
    console.warn('E-posta kod talebi hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'E-posta doğrulama kodu gönderilemedi.' });
  }
});

// ── 10.7. 6 HANELİ KOD İLE E-POSTA DEĞİŞİKLİĞİNİ ONAYLAMA ──────────────────
app.post('/api/auth/confirm-email-change', authRateLimiter, requireAuth, async (req, res) => {
  const { code } = req.body;
  const userId = req.authUser.id;
  const pending = pendingEmailVerifications.get(userId);

  if (!pending || Date.now() > pending.expiresAt) {
    pendingEmailVerifications.delete(userId);
    return res.status(400).json({ success: false, reason: 'Doğrulama kodunun süresi dolmuş veya kod talep edilmemiş. Lütfen yeni kod isteyiniz.' });
  }

  if (String(code || '').trim() !== String(pending.code)) {
    return res.status(400).json({ success: false, reason: 'Girdiğiniz doğrulama kodu hatalıdır.' });
  }

  const { newEmail, oldEmail } = pending;
  try {
    if (supabase) {
      const existing = await supabase.from('app_users').select('id').eq('email', newEmail).neq('id', userId).limit(1);
      if (existing.error) throw existing.error;
      if (existing.data?.length) return res.status(409).json({ success: false, reason: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.' });
      const { error } = await supabase.from('app_users').update({ email: newEmail }).eq('id', userId);
      if (error) throw error;
    } else {
      const local = getLocalUsers();
      if (local.some(u => String(u.id) !== String(userId) && normalizeEmail(u.email) === newEmail)) {
        return res.status(409).json({ success: false, reason: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılmaktadır.' });
      }
      const idx = local.findIndex(u => u.id === userId);
      if (idx === -1) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
      local[idx].email = newEmail;
      saveLocalUsers(local);
    }
    pendingEmailVerifications.delete(userId);

    const noticeResult = await mailer.sendEmailChangedNotice({
      to: oldEmail && oldEmail !== newEmail ? oldEmail : '',
      fullName: req.authUser.full_name || req.authUser.username,
      newEmail,
      ip: req.ip
    });

    await recordAuditLog({
      userId,
      username: req.authUser.username,
      role: req.authUser.role,
      action: 'EMAIL_CHANGED',
      target: newEmail,
      details: `E-posta adresi '${oldEmail}' -> '${newEmail}' olarak doğrulandı ve güncellendi.`,
      ip: req.ip
    });

    res.json({
      success: true,
      email: newEmail,
      message: noticeResult.sent
        ? 'E-posta adresiniz güncellendi; eski adresinize güvenlik bildirimi gönderildi.'
        : 'E-posta adresiniz başarıyla güncellendi.',
      notification: { email: { sent: noticeResult.sent, status: noticeResult.status } }
    });
  } catch (err) {
    console.warn('E-posta onaylama hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'E-posta adresi güncellenirken sunucu hatası oluştu.' });
  }
});

// ── ADMİN: KULLANICIYI KALICI SİL ──────────────────────────────────────────
app.post('/api/admin/delete-user', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği belirtilmedi.' });
  if (String(userId) === String(req.adminUser.id)) {
    return res.status(400).json({ success: false, reason: 'Kendi yönetici hesabınızı silemezsiniz.' });
  }

  try {
    const userObj = await loadUserById(userId);
    if (!userObj) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });
    const targetUsername = userObj.username || String(userId);

    if (supabase) {
      const reportDelete = await supabase.from('reports').delete().eq('user_id', String(userId));
      if (reportDelete.error) console.warn('Kullanıcı raporları silme uyarısı:', reportDelete.error.message);
      const userDelete = await supabase.from('app_users').delete().eq('id', String(userId));
      if (userDelete.error) throw userDelete.error;
    } else {
      saveLocalUsers(getLocalUsers().filter(user => String(user.id) !== String(userId)));
      writeLocalReports(readLocalReports().filter(report => String(report.user_id) !== String(userId)));
    }

    await recordAuditLog({
      userId: req.adminUser.id,
      username: req.adminUser.username,
      role: 'admin',
      action: 'USER_DELETE',
      target: targetUsername,
      details: `@${targetUsername} kullanıcısı ve kişisel kayıtları sistemden silindi.`,
      ip: req.ip
    });

    res.json({ success: true, message: `@${targetUsername} kullanıcısı başarıyla silindi.` });
  } catch (err) {
    console.warn('Kullanıcı silme hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Kullanıcı silme işlemi tamamlanamadı.' });
  }
});

// ── ADMİN: HESAP DONDUR / AÇ (Freeze / Unfreeze) ───────────────────────────
app.post('/api/admin/freeze-user', adminRateLimiter, requireAdmin, async (req, res) => {
  const { userId, freeze = true } = req.body;
  if (!userId) return res.status(400).json({ success: false, reason: 'Kullanıcı kimliği gerekli.' });
  if (String(userId) === String(req.adminUser.id) && freeze) {
    return res.status(400).json({ success: false, reason: 'Kendi yönetici hesabınızı donduramazsınız.' });
  }

  try {
    const isFrozen = Boolean(freeze);
    const updatedUser = await updateUserById(userId, {
      is_frozen: isFrozen,
      is_active: !isFrozen
    });
    if (!updatedUser) return res.status(404).json({ success: false, reason: 'Kullanıcı bulunamadı.' });

    if (updatedUser.email) {
      mailer.sendAccountStatusChanged({
        to: updatedUser.email,
        fullName: updatedUser.full_name || updatedUser.username,
        username: updatedUser.username,
        action: isFrozen ? 'frozen' : 'activated'
      }).catch(() => {});
    }

    await recordAuditLog({
      userId: req.adminUser.id,
      username: req.adminUser.username,
      role: 'admin',
      action: isFrozen ? 'USER_FROZEN' : 'USER_UNFROZEN',
      target: updatedUser.username,
      details: `Hesap durumu: ${isFrozen ? 'donduruldu' : 'aktifleştirildi'}`,
      ip: req.ip
    });

    res.json({ success: true, is_frozen: isFrozen, is_active: !isFrozen });
  } catch (err) {
    console.warn('Hesap dondurma hatası:', safeLogStr(err.message));
    res.status(503).json({ success: false, reason: 'Hesap dondurma işlemi tamamlanamadı.' });
  }
});

// ── ADMİN: CANLI SİSTEM SAĞLIĞI & GECİKME MONİTÖRÜ ─────────────────────────
app.get('/api/admin/system-health', adminRateLimiter, requireAdmin, async (req, res) => {
  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envConfig = dotenv.parse(fs.readFileSync(envPath));
      for (const k in envConfig) {
        process.env[k] = envConfig[k];
      }
    }
  } catch (e) {}

  const start = Date.now();
  let dbConnected = false;
  let dbLatencyMs = 0;
  let totalUsers = 0;
  let pendingUsers = 0;
  let frozenUsers = 0;

  if (supabase) {
    try {
      const uRes = await supabase.from('app_users').select('id, is_active');
      dbLatencyMs = Date.now() - start;
      if (!uRes.error && Array.isArray(uRes.data)) {
        dbConnected = true;
        totalUsers = uRes.data.length;
        pendingUsers = uRes.data.filter(u => u.is_active === false).length;
        frozenUsers = 0;
      }
    } catch {
      dbConnected = false;
      dbLatencyMs = Date.now() - start;
    }
  } else {
    const users = getLocalUsers();
    totalUsers = users.length;
    pendingUsers = users.filter(u => u.is_active === false && !u.is_frozen).length;
    frozenUsers = users.filter(u => u.is_frozen === true).length;
  }

  const memoryUsage = process.memoryUsage();
  const uptimeSec = Math.floor(process.uptime());
  const memRssMb = (memoryUsage.rss / (1024 * 1024)).toFixed(1);

  res.json({
    success: true,
    health: {
      uptimeSeconds: uptimeSec,
      supabase: {
        connected: dbConnected,
        latencyMs: dbLatencyMs,
        mode: supabase ? 'cloud' : 'local'
      },
      system: {
        uptimeSec,
        memoryRssMb: memRssMb,
        nodeVersion: process.version
      },
      users: {
        total: totalUsers,
        pending: pendingUsers,
        frozen: frozenUsers
      },
      db: {
        provider: supabase ? 'Supabase Cloud (PostgreSQL)' : 'Local JSON Storage',
        status: dbConnected ? 'connected' : (supabase ? 'error' : 'local'),
        latencyMs: dbLatencyMs
      },
      mail: mailer.getStatus(),
      memory: {
        rssMb: memRssMb,
        heapUsedMb: (memoryUsage.heapUsed / (1024 * 1024)).toFixed(1)
      }
    }
  });
});

// ── ADMİN: SİSTEM & HAVUZ DURUM ÖZETİ E-POSTASI GÖNDERME ──────────────────
app.post('/api/admin/mail/send-digest', adminRateLimiter, requireAdmin, async (req, res) => {
  const requestedEmail = String(req.body?.email || '').trim().toLowerCase();
  const adminEmail = (requestedEmail && isValidEmail(requestedEmail))
    ? requestedEmail
    : (req.adminUser?.email || process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.SMTP_USER);

  if (!adminEmail) return res.status(400).json({ success: false, reason: 'Yönetici e-posta adresi bulunamadı.' });

  try {
    let users = [];
    let reports = [];
    if (supabase) {
      const uRes = await supabase.from('app_users').select('id, is_active, role');
      users = uRes.data || [];
      const rRes = await supabase.from('reports').select('id, is_public');
      reports = rRes.data || [];
    } else {
      users = getLocalUsers();
      reports = readLocalReports();
    }

    const stats = {
      totalUsers: users.length,
      pendingUsers: users.filter(u => u.is_active === false && !u.is_frozen).length,
      frozenUsers: users.filter(u => u.is_frozen === true).length,
      totalReports: reports.length,
      poolReports: reports.filter(r => r.is_public || r.in_pool || r.data?.isPublic).length
    };

    const mailResult = await mailer.sendSystemDigest({
      to: adminEmail,
      stats
    });

    await recordAuditLog({
      userId: req.adminUser.id,
      username: req.adminUser.username,
      role: 'admin',
      action: mailResult.sent ? 'MAIL_DIGEST_SENT' : 'MAIL_DIGEST_FAILED',
      target: adminEmail,
      details: `Sistem durum özeti: ${mailResult.status}${mailResult.error ? ' (' + mailResult.error + ')' : ''}`,
      ip: req.ip
    });

    res.status(mailResult.sent ? 200 : 503).json({
      success: mailResult.sent,
      status: mailResult.status,
      message: mailResult.sent ? 'Sistem özeti e-posta adresinize gönderildi.' : (mailResult.error || mailResult.reason || 'E-posta gönderilemedi (SMTP kapalı veya hatalı).'),
      reason: mailResult.sent ? undefined : (mailResult.error || mailResult.reason || 'E-posta gönderilemedi (SMTP kapalı veya hatalı).')
    });
  } catch (err) {
    res.status(503).json({ success: false, reason: err.message });
  }
});
