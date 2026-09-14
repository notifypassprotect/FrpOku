require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { isValidEmail, isValidText, isValidUsername, normalizeEmail, normalizePhone, normalizeText, normalizeUsername } = require('./lib/input_validation');
const { createMailer } = require('./lib/mailer');
const { PASSWORD_MAX_LENGTH, hashPassword, verifyPassword: verifyPasswordHash } = require('./lib/passwords');
const { buildOwnedReportRow, canManageReport, canEditReportNote, canReadReport, nextReportVersion, reportId, reportRowToClient, reportRowToSummaryClient, toSupabaseReportRow } = require('./lib/report_access');
const { createSessionAuth } = require('./lib/session_auth');
const { createStagingAccessMiddleware } = require('./lib/staging_access');
const { validateEnvironment } = require('./lib/environment');
const { createJsonStore } = require('./lib/json_store');
const { protectInternalFiles, securityHeaders } = require('./server/middleware/security');
const { registerSystemRoutes } = require('./server/routes/system');
const { createAuthSecurity } = require('./server/services/auth_security');
const { boundedSetting, plainObject, safeLogStr } = require('./server/services/value_utils');
const { createUserService } = require('./server/services/user_service');
const { createAuditService } = require('./server/services/audit_service');
const { configureHttpMiddleware } = require('./server/middleware/http');
const { registerCatalogRoutes } = require('./server/routes/catalog');
const { startServer } = require('./server/bootstrap');
const { createPresenceService } = require('./server/services/presence_service');
const { createChatMessageService } = require('./server/services/chat_message_service');
const { createChatRoomService } = require('./server/services/chat_room_service');
const { registerPresenceRoutes } = require('./server/routes/presence');
const { registerChatRoomRoutes } = require('./server/routes/chat_rooms');
const { registerChatGroupRoutes } = require('./server/routes/chat_groups');
const { registerChatNudgeRoute } = require('./server/routes/chat_nudge');
const { registerChatSendRoute } = require('./server/routes/chat_send');
const { registerChatMessageListRoute } = require('./server/routes/chat_messages');
const { registerChatStateRoutes } = require('./server/routes/chat_state');
const { registerChatMutationRoutes } = require('./server/routes/chat_mutations');
const { createChatEmailService } = require('./server/services/chat_email_service');
const { registerAdminHealthRoute } = require('./server/routes/admin_health');
const { registerAdminMailRoutes } = require('./server/routes/admin_mail');
const { registerAdminUserRoutes } = require('./server/routes/admin_users');
const { registerAdminAccountRoutes } = require('./server/routes/admin_accounts');
const { registerAccountPasswordRoute } = require('./server/routes/account_password');
const { registerAccountProfileRoute } = require('./server/routes/account_profile');
const { registerAccountRegistrationRoute } = require('./server/routes/account_registration');
const { registerAccountEmailRoutes } = require('./server/routes/account_email');
const { registerAuditRoutes } = require('./server/routes/audit');
const { registerReportReadRoutes } = require('./server/routes/report_read');
const { registerReportLifecycleRoutes } = require('./server/routes/report_lifecycle');
const { registerReportPoolRoutes } = require('./server/routes/report_pool');
const { registerReportNoteRoutes } = require('./server/routes/report_notes');
const { registerReportWriteRoute } = require('./server/routes/report_write');
const { registerSettingsRoutes } = require('./server/routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;
const environment = validateEnvironment();
const APP_ENV = environment.appEnvironment;
const IS_DEPLOYED_ENVIRONMENT = environment.deployed;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVER_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || (!IS_DEPLOYED_ENVIRONMENT ? process.env.SUPABASE_KEY : '') || '';
const BROWSER_SUPABASE_ENABLED = environment.browserSupabaseEnabled;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVER_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVER_KEY);
}

const mailer = createMailer();

// ── Kullanıcı Veri Yönetimi & Yerel Yedekleme ─────────────────
const usersJsonPath = path.join(__dirname, 'data', 'users.json');
const usersStore = createJsonStore(usersJsonPath, { label: 'Yerel kullanıcı' });
const { ensureAdminUser, getLocalUsers, loadUserById, saveLocalUsers, updateUserById } = createUserService({
  env: process.env,
  hashPassword,
  safeLogStr,
  supabase,
  usersStore
});


// ── DENETİM GÜNLÜĞÜ (AUDIT LOGS) DEPOLAMA ────────────────────
const LOGS_FILE = path.join(__dirname, 'data', 'audit_logs.json');
const auditLogStore = createJsonStore(LOGS_FILE, { label: 'Denetim günlüğü', limit: 5000 });
const { getAuditLogs, recordAuditLog, saveAuditLogs } = createAuditService({ safeLogStr, store: auditLogStore, supabase });

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
const { generateCaptcha, generateEmergencyRecoveryKey, verifyCaptcha } = createAuthSecurity(SESSION_SECRET);

app.use(securityHeaders);
app.use(protectInternalFiles);

const { adminRateLimiter, apiWriteRateLimiter, authRateLimiter } = configureHttpMiddleware(app, {
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT || '15mb',
  stagingAccess: createStagingAccessMiddleware()
});

// Yalnızca tarayıcıya gerekli dosyaları yayınla; sunucu, test, migration ve
// deployment dosyaları statik olarak erişilebilir değildir.
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
registerSystemRoutes(app, {
  appEnvironment: APP_ENV,
  browserSupabaseEnabled: BROWSER_SUPABASE_ENABLED,
  publicRoot: __dirname,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  supabaseUrl: SUPABASE_URL
});

// ── 1. YENİ KULLANICI KAYDI (Admin Onayına Gönderme) ─────────
registerAccountRegistrationRoute(app, { PASSWORD_MAX_LENGTH, authRateLimiter, crypto, generateEmergencyRecoveryKey, getLocalUsers, hashPassword, isValidEmail, isValidText, isValidUsername, mailer, normalizeEmail, normalizePhone, normalizeText, normalizeUsername, safeLogStr, saveLocalUsers, supabase });

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
      const isEmail = ident.includes('@');
      const cleanEmail = normalizeEmail(ident);
      const cleanUser = normalizeUsername(ident);
      if (isEmail && isValidEmail(cleanEmail)) {
        const { data, error } = await supabase.from('app_users').select('*').eq('email', cleanEmail).limit(1);
        if (error) throw error;
        if (data && data.length) user = data[0];
      } else if (isValidUsername(cleanUser)) {
        const { data, error } = await supabase.from('app_users').select('*').eq('username', cleanUser).limit(1);
        if (error) throw error;
        if (data && data.length) user = data[0];
      }
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
      const isEmail = ident.includes('@');
      const cleanEmail = normalizeEmail(ident);
      const cleanUser = normalizeUsername(ident);
      if (isEmail && isValidEmail(cleanEmail)) {
        const { data, error } = await supabase.from('app_users').select('*').eq('email', cleanEmail).limit(1);
        if (error) throw error;
        if (data && data.length) user = data[0];
      } else if (isValidUsername(cleanUser)) {
        const { data, error } = await supabase.from('app_users').select('*').eq('username', cleanUser).limit(1);
        if (error) throw error;
        if (data && data.length) user = data[0];
      }
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

// ── 6. ADMİN: KULLANICIYI REDDET VEYA SİL ────────────────────
registerAdminUserRoutes(app, { adminRateLimiter, getLocalUsers, loadUserById, readLocalReports, recordAuditLog, requireAdmin, safeLogStr, saveLocalUsers, supabase, updateUserById, writeLocalReports });

registerAdminAccountRoutes(app, { PASSWORD_MAX_LENGTH, adminRateLimiter, getLocalUsers, hashPassword, isValidUsername, loginFailures, mailer, normalizeUsername, recordAuditLog, requireAdmin, safeLogStr, saveLocalUsers, supabase, updateUserById });

registerAccountPasswordRoute(app, { PASSWORD_MAX_LENGTH, authRateLimiter, hashPassword, loadUserById, mailer, requireAuth, safeLogStr, signToken, updateUserById, verifyPasswordHash });


registerAuditRoutes(app, { adminRateLimiter, apiWriteRateLimiter, getAuditLogs, recordAuditLog, requireAdmin, requireAuth, safeLogStr, supabase });

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

const SUMMARY_SELECT_COLUMNS = 'id, name, file_size, category, tags, is_favorite, is_pinned, sql_count, memo_count, dataset_count, page_count, has_script, created_at, updated_at, user_note, note_html, note_attachments, is_deleted, deleted_at, user_id, is_public, owner_name, owner_username, owner_department, shared_at, version, meta:data->meta, tableNames:data->tableNames, queryNames:data->queryNames, paramNames:data->paramNames, datasets:data->datasets';

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
          : query.or(`user_id.eq.${user.id},is_public.eq.true`);
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

registerReportReadRoutes(app, { canReadReport, getReportRecord, loadVisibleReports, reportRowToClient, requireAuth, safeLogStr });

registerReportLifecycleRoutes(app, { apiWriteRateLimiter, canManageReport, getReportRecord, nextReportVersion, readLocalReports, reportId, reportRowToClient, requireAuth, supabase, writeLocalReports });

registerReportPoolRoutes(app, { apiWriteRateLimiter, canManageReport, getReportRecord, readLocalReports, reportId, reportRowToClient, requireAuth, supabase, writeLocalReports });

registerReportWriteRoute(app, { apiWriteRateLimiter, buildOwnedReportRow, canManageReport, getReportRecord, nextReportVersion, readLocalReports, reportId, reportRowToClient, requireAuth, safeLogStr, supabase, toSupabaseReportRow, writeLocalReports });

registerSettingsRoutes(app, { apiWriteRateLimiter, boundedSetting, plainObject, requireAuth, safeLogStr, settingsPath: path.join(__dirname, 'data', 'user_settings.json'), supabase });

app.post('/api/store/save', apiWriteRateLimiter, requireAuth, async (req, res) => {
  res.status(410).json({
    success: false,
    code: 'SNAPSHOT_SYNC_REMOVED',
    reason: 'Toplu arşiv yazımı kaldırıldı. Raporları tekil endpoint üzerinden kaydedin.'
  });
});

registerReportNoteRoutes(app, { apiWriteRateLimiter, attachmentsDir: path.join(__dirname, 'data', 'attachments'), canEditReportNote, canReadReport, getReportRecord, readLocalReports, recordAuditLog, reportId, reportRowToClient, requireAuth, safeLogStr, supabase, writeLocalReports });

// ── ÇEVRİMİÇİ KULLANICI & VARLIK (PRESENCE) YÖNETİMİ ──────────
const USER_AVATARS_FILE = path.join(__dirname, 'data', 'user_avatars.json');
const avatarStore = createJsonStore(USER_AVATARS_FILE, { fallback: {}, label: 'Kullanıcı avatarı' });
const { getAllUsersWithPresence, getUserAvatars, recordUserPresence, removeUserPresence, saveUserAvatar } = createPresenceService({ avatarStore, getLocalUsers, supabase });

registerAccountProfileRoute(app, { authRateLimiter, getLocalUsers, isValidText, isValidUsername, normalizeEmail, normalizePhone, normalizeText, normalizeUsername, requireAuth, safeLogStr, saveLocalUsers, saveUserAvatar, supabase });

// ── GERÇEK ZAMANLI SOHBET & MESAJLAŞMA SİSTEMİ ──────────────────
const CHAT_STORE_PATH = path.join(__dirname, 'data', 'chat_messages.json');
const chatStore = createJsonStore(CHAT_STORE_PATH, { label: 'Sohbet mesajı', limit: 3000 });
const { chatPayloadSize, ensureChatMessagesHydrated, getChatMessages, getUnreadCountsForUser, persistChatMessage, replaceChatMessages, saveChatMessages } = createChatMessageService({ safeLogStr, store: chatStore, supabase });

function canAccessChatGroup(user, groupId) {
  const group = getChatGroups().find(item => String(item.id) === String(groupId));
  if (!group) return false;
  const userId = String(user.id);
  return user.role === 'admin' || (Array.isArray(group.memberUserIds) && group.memberUserIds.map(String).includes(userId));
}

function canAccessChatRoom(user, roomId) {
  const room = getChatRooms().find(item => String(item.id) === String(roomId));
  if (!room) return false;
  const userId = String(user.id);
  return user.role === 'admin' || room.isAllUsers === true || (Array.isArray(room.memberUserIds) && room.memberUserIds.map(String).includes(userId));
}

function canAccessChatMessage(user, message) {
  const userId = String(user.id);
  if (message.groupId) return canAccessChatGroup(user, message.groupId);
  if (message.roomId) return canAccessChatRoom(user, message.roomId);
  return String(message.senderId) === userId || String(message.receiverId) === userId;
}

registerPresenceRoutes(app, { ensureChatMessagesHydrated, getAllUsersWithPresence, getUnreadCountsForUser, recordUserPresence, removeUserPresence, requireAuth, supabase });

// ── OKUNMAMIŞ SOHBET MESAJLARI İÇİN E-POSTA BİLDİRİM YÖNETİCİSİ (DEBOUNCED & ANTI-SPAM) ──
const chatEmailDelay = Number.parseInt(process.env.CHAT_EMAIL_DELAY_MS || '', 10);
const { clearChatEmailTimer, scheduleChatEmailDigest } = createChatEmailService({
  delayMs: Number.isFinite(chatEmailDelay) ? chatEmailDelay : 180000,
  ensureChatMessagesHydrated,
  getChatMessages,
  loadUserById,
  mailer
});

// ── GRUP SOHBETLERİ YÖNETİMİ (Kullanıcı Çoklu Grup Sohbeti) ─────
const CHAT_GROUPS_STORE_PATH = path.join(__dirname, 'data', 'chat_groups.json');
const chatGroupsStore = createJsonStore(CHAT_GROUPS_STORE_PATH, { label: 'Sohbet grubu' });
let chatGroupsCache;

function getChatGroups() {
  if (chatGroupsCache) return chatGroupsCache;
  const groups = chatGroupsStore.read();
  chatGroupsCache = Array.isArray(groups) ? groups : [];
  return chatGroupsCache;
}

function saveChatGroups() {
  chatGroupsStore.write(getChatGroups());
}

registerChatGroupRoutes(app, { canAccessChatGroup, getAllUsersWithPresence, getChatGroups, requireAuth, saveChatGroups });

registerChatNudgeRoute(app, { canAccessChatGroup, ensureChatMessagesHydrated, getChatMessages, persistChatMessage, requireAuth, saveChatMessages });

// Chat: Mesaj Gönderme
registerChatSendRoute(app, { canAccessChatGroup, canAccessChatRoom, chatPayloadSize, ensureChatMessagesHydrated, getChatMessages, persistChatMessage, requireAuth, saveChatMessages, scheduleChatEmailDigest });

// Chat: Mesajları Listeleme
const activeChatTyping = new Map();
registerChatMessageListRoute(app, { activeChatTyping, canAccessChatGroup, canAccessChatRoom, ensureChatMessagesHydrated, getChatMessages, requireAuth });

// Chat: Canlı Yazıyor (Typing) Bildirimi
registerChatStateRoutes(app, { activeChatTyping, canAccessChatGroup, canAccessChatRoom, clearChatEmailTimer, ensureChatMessagesHydrated, getChatMessages, requireAuth, safeLogStr, saveChatMessages, supabase });

// Chat: Reaksiyon Ekleme / Kaldırma
registerChatMutationRoutes(app, { canAccessChatMessage, ensureChatMessagesHydrated, getChatMessages, replaceChatMessages, requireAuth, saveChatMessages, supabase });

// ── DEPARTMAN ODALARI YÖNETİMİ ──────────────────
const CHAT_ROOMS_STORE_PATH = path.join(__dirname, 'data', 'chat_rooms.json');
const chatRoomsStore = createJsonStore(CHAT_ROOMS_STORE_PATH, { label: 'Sohbet odası' });
const { chatRoomFromRow, getChatRooms, loadChatRooms, replaceChatRooms, saveChatRooms } = createChatRoomService({ store: chatRoomsStore, supabase });

registerChatRoomRoutes(app, { chatRoomFromRow, loadChatRooms, replaceChatRooms, requireAuth, saveChatRooms, supabase });

registerCatalogRoutes(app, { apiWriteRateLimiter, dataRoot: path.join(__dirname, 'data'), requireAuth, supabase });

registerAccountEmailRoutes(app, { authRateLimiter, crypto, getLocalUsers, isValidEmail, loadUserById, mailer, normalizeEmail, pendingEmailVerifications, recordAuditLog, requireAuth, safeLogStr, saveLocalUsers, supabase, verifyPasswordHash });

startServer(app, { ensureAdminUser, port: PORT, safeLogStr }).catch(error => {
  console.error('Sunucu başlatılamadı:', safeLogStr(error.message));
  process.exit(1);
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
registerAdminHealthRoute(app, { adminRateLimiter, getLocalUsers, mailer, requireAdmin, rootDirectory: __dirname, supabase });

// ── ADMİN: SİSTEM & HAVUZ DURUM ÖZETİ E-POSTASI GÖNDERME ──────────────────
registerAdminMailRoutes(app, { adminRateLimiter, getLocalUsers, isValidEmail, mailer, readLocalReports, recordAuditLog, requireAdmin, supabase });
