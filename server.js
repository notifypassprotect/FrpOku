require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { isValidEmail, isValidText, isValidUsername, normalizeEmail, normalizePhone, normalizeText, normalizeUsername } = require('./lib/input_validation');
const { sanitizeRichHtml } = require('./lib/html_sanitizer');
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
const { createReportService } = require('./server/services/report_service');
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
const { registerAdminUserOnboardingRoutes } = require('./server/routes/admin_user_onboarding');
const { registerAdminUserStatusRoutes } = require('./server/routes/admin_user_status');
const { registerAdminAccountRoutes } = require('./server/routes/admin_accounts');
const { registerAccountPasswordRoute } = require('./server/routes/account_password');
const { registerAccountProfileRoute } = require('./server/routes/account_profile');
const { registerAccountRegistrationRoute } = require('./server/routes/account_registration');
const { registerAccountLoginRoutes } = require('./server/routes/account_login');
const { registerAccountRecoveryRoutes } = require('./server/routes/account_recovery');
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
// deployment dosyaları statik olarak erişilebilir değildir. Sürüm parametreli
// statik kaynaklar dağıtım ortamında uzun süre önbellekte tutulabilir.
const staticAssetOptions = IS_DEPLOYED_ENVIRONMENT
  ? { etag: true, immutable: true, maxAge: '7d' }
  : { etag: true, maxAge: 0 };
app.use('/css', express.static(path.join(__dirname, 'css'), staticAssetOptions));
app.use('/js', express.static(path.join(__dirname, 'js'), staticAssetOptions));
app.use('/assets', express.static(path.join(__dirname, 'assets'), {
  ...staticAssetOptions,
  maxAge: IS_DEPLOYED_ENVIRONMENT ? '30d' : 0
}));
registerSystemRoutes(app, {
  appEnvironment: APP_ENV,
  browserSupabaseEnabled: BROWSER_SUPABASE_ENABLED,
  publicRoot: __dirname,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  supabaseUrl: SUPABASE_URL
});

// ── 1. YENİ KULLANICI KAYDI (Admin Onayına Gönderme) ─────────
registerAccountRegistrationRoute(app, { PASSWORD_MAX_LENGTH, authRateLimiter, crypto, generateEmergencyRecoveryKey, getLocalUsers, hashPassword, isValidEmail, isValidText, isValidUsername, mailer, normalizeEmail, normalizePhone, normalizeText, normalizeUsername, safeLogStr, saveLocalUsers, supabase });

registerAccountLoginRoutes(app, { PASSWORD_MAX_LENGTH, authRateLimiter, generateCaptcha, getLocalUsers, hashPassword, isValidEmail, loginFailures, safeLogStr, saveLocalUsers, signToken, supabase, verifyCaptcha, verifyPasswordHash });

registerAccountRecoveryRoutes(app, { PASSWORD_MAX_LENGTH, authRateLimiter, crypto, getLocalUsers, hashPassword, isValidEmail, isValidUsername, loginFailures, mailer, normalizeEmail, normalizeUsername, recordAuditLog, safeLogStr, signToken, supabase, updateUserById });

const { getReportRecord, loadVisibleReports, readLocalReports, writeLocalReports } = createReportService({ canReadReport, reportId, reportRowToClient, reportRowToSummaryClient, storePath: path.join(__dirname, 'data', 'store.json'), supabase });

registerAdminUserOnboardingRoutes(app, { adminRateLimiter, getLocalUsers, mailer, recordAuditLog, requireAdmin, safeLogStr, supabase, updateUserById });

// ── 6. ADMİN: KULLANICIYI REDDET VEYA SİL ────────────────────
registerAdminUserRoutes(app, { adminRateLimiter, getLocalUsers, loadUserById, readLocalReports, recordAuditLog, requireAdmin, safeLogStr, saveLocalUsers, supabase, updateUserById, writeLocalReports });

registerAdminAccountRoutes(app, { PASSWORD_MAX_LENGTH, adminRateLimiter, getLocalUsers, hashPassword, isValidUsername, loginFailures, mailer, normalizeUsername, recordAuditLog, requireAdmin, safeLogStr, saveLocalUsers, supabase, updateUserById });

registerAccountPasswordRoute(app, { PASSWORD_MAX_LENGTH, authRateLimiter, hashPassword, loadUserById, mailer, requireAuth, safeLogStr, signToken, updateUserById, verifyPasswordHash });


registerAuditRoutes(app, { adminRateLimiter, apiWriteRateLimiter, getAuditLogs, recordAuditLog, requireAdmin, requireAuth, safeLogStr, supabase });

registerReportReadRoutes(app, { canReadReport, getReportRecord, loadVisibleReports, reportRowToClient, requireAuth, safeLogStr });

registerReportLifecycleRoutes(app, { apiWriteRateLimiter, canManageReport, getReportRecord, nextReportVersion, readLocalReports, reportId, reportRowToClient, requireAuth, supabase, writeLocalReports });

registerReportPoolRoutes(app, { apiWriteRateLimiter, canManageReport, getReportRecord, readLocalReports, reportId, reportRowToClient, requireAuth, supabase, writeLocalReports });

registerReportWriteRoute(app, { apiWriteRateLimiter, buildOwnedReportRow, canManageReport, getReportRecord, nextReportVersion, readLocalReports, reportId, reportRowToClient, requireAuth, safeLogStr, supabase, toSupabaseReportRow, writeLocalReports });

registerSettingsRoutes(app, { apiWriteRateLimiter, boundedSetting, plainObject, requireAuth, safeLogStr, settingsPath: path.join(__dirname, 'data', 'user_settings.json'), supabase });

registerReportNoteRoutes(app, { apiWriteRateLimiter, attachmentsDir: path.join(__dirname, 'data', 'attachments'), canEditReportNote, canReadReport, getReportRecord, readLocalReports, recordAuditLog, reportId, reportRowToClient, requireAuth, safeLogStr, sanitizeRichHtml, supabase, writeLocalReports });

// ── ÇEVRİMİÇİ KULLANICI & VARLIK (PRESENCE) YÖNETİMİ ──────────
const USER_AVATARS_FILE = path.join(__dirname, 'data', 'user_avatars.json');
const avatarStore = createJsonStore(USER_AVATARS_FILE, { fallback: {}, label: 'Kullanıcı avatarı' });
const { acquireReportLock, getActiveReportLocks, getAllUsersWithPresence, getReportLock, getUserAvatars, recordUserPresence, releaseReportLock, removeUserPresence, renewReportLock, saveUserAvatar } = createPresenceService({ avatarStore, getLocalUsers, supabase });

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

registerPresenceRoutes(app, { acquireReportLock, ensureChatMessagesHydrated, getActiveReportLocks, getAllUsersWithPresence, getReportLock, getUnreadCountsForUser, recordUserPresence, releaseReportLock, removeUserPresence, renewReportLock, requireAuth, supabase });

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

registerAdminUserStatusRoutes(app, { adminRateLimiter, getLocalUsers, loadUserById, mailer, readLocalReports, recordAuditLog, requireAdmin, safeLogStr, saveLocalUsers, supabase, updateUserById, writeLocalReports });

// ── ADMİN: CANLI SİSTEM SAĞLIĞI & GECİKME MONİTÖRÜ ─────────────────────────
registerAdminHealthRoute(app, { adminRateLimiter, getLocalUsers, mailer, requireAdmin, rootDirectory: __dirname, supabase });

// ── ADMİN: SİSTEM & HAVUZ DURUM ÖZETİ E-POSTASI GÖNDERME ──────────────────
registerAdminMailRoutes(app, { adminRateLimiter, getLocalUsers, isValidEmail, mailer, readLocalReports, recordAuditLog, requireAdmin, supabase });

// API isteklerinde makine-okur hata; sayfa isteklerinde sade ve erişilebilir
// bir geri dönüş sağla. Böylece yanlış adresler Express'in varsayılan metnine
// veya boş bir ekrana düşmez.
app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, reason: 'İstenen servis bulunamadı.' });
  }
  return res.status(404).type('html').send(`<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sayfa Bulunamadı — FrpOku</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7fb;color:#172033;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}.card{width:min(90vw,520px);padding:36px;border:1px solid #dbe3ef;border-radius:20px;background:#fff;box-shadow:0 18px 50px rgba(15,23,42,.1);text-align:center}.code{color:#2563eb;font-size:3rem;font-weight:800}h1{margin:.25rem 0 .5rem;font-size:1.5rem}p{color:#64748b}a{display:inline-block;margin-top:1rem;padding:.75rem 1rem;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700}</style></head>
<body><main class="card"><div class="code">404</div><h1>Sayfa bulunamadı</h1><p>Aradığınız adres kaldırılmış veya değiştirilmiş olabilir.</p><a href="/">Rapor listesine dön</a></main></body></html>`);
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('İstek işlenemedi:', safeLogStr(error?.message || error));
  res.setHeader('Cache-Control', 'no-store');
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ success: false, reason: 'İşlem sırasında beklenmeyen bir hata oluştu.' });
  }
  return res.status(500).type('html').send('<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sunucu Hatası — FrpOku</title></head><body><main><h1>İşlem tamamlanamadı</h1><p>Lütfen kısa bir süre sonra yeniden deneyin.</p><a href="/">Ana sayfaya dön</a></main></body></html>');
});

startServer(app, { ensureAdminUser, port: PORT, safeLogStr }).catch(error => {
  console.error('Sunucu başlatılamadı:', safeLogStr(error.message));
  process.exit(1);
});
