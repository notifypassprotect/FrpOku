const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('006_chat_messages.sql doğru şema ve indeksleri tanımlar', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase', 'migrations', '006_chat_messages.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.chat_messages/i);
  assert.match(sql, /sender_id text/i);
  assert.match(sql, /receiver_id text/i);
  assert.match(sql, /reactions jsonb/i);
  assert.match(sql, /idx_chat_messages_unread/i);
});

test('server.js dosyasında sohbet API rotaları tanımlıdır', () => {
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(serverSource, /\/api\/chat\/send/);
  assert.match(serverSource, /\/api\/chat\/messages/);
  assert.match(serverSource, /\/api\/chat\/mark-read/);
  assert.match(serverSource, /\/api\/chat\/react/);
  assert.match(serverSource, /getUnreadCountsForUser/);
});

test('online_presence.js içinde gerçek sohbet API entegrasyonu ve ses bildirimi bulunur', () => {
  const presence = fs.readFileSync(path.join(root, 'js', 'core', 'online_presence.js'), 'utf8');
  assert.match(presence, /\/api\/chat\/send/);
  assert.match(presence, /\/api\/chat\/messages/);
  assert.match(presence, /playNotificationChime/);
  assert.match(presence, /frp-presence-unread-badge/);
  
  // CSP inline handler kontrolü
  const inlineEvent = /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i;
  assert.doesNotMatch(presence, inlineEvent);
});

test('image_annotator.js içinde crop, mosaic, rotate ve step rozet özellikleri mevcuttur', () => {
  const annotator = fs.readFileSync(path.join(root, 'js', 'list', 'image_annotator.js'), 'utf8');
  assert.match(annotator, /rotateCanvas/);
  assert.match(annotator, /pixelateRegion/);
  assert.match(annotator, /cropToRegion/);
  assert.match(annotator, /stampStepBadge/);
  
  const inlineEvent = /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i;
  assert.doesNotMatch(annotator, inlineEvent);
});

test('007_chat_rooms.sql doğru şema ve indeksleri tanımlar', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase', 'migrations', '007_chat_rooms.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.chat_rooms/i);
  assert.match(sql, /member_user_ids jsonb/i);
  assert.match(sql, /is_all_users boolean/i);
});

test('server.js içinde oda yönetimi, mesaj silme ve medya filtresi bulunur', () => {
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(serverSource, /\/api\/chat\/rooms/);
  assert.match(serverSource, /app\.delete\('\/api\/chat\/messages\/:id'/);
  assert.match(serverSource, /mediaOnly/);
});

test('online_presence.js içinde pencere hizalama, ses kaydı, DM stili ve medya galerisi bulunur', () => {
  const presence = fs.readFileSync(path.join(root, 'js', 'core', 'online_presence.js'), 'utf8');
  assert.match(presence, /realignChatWindows/);
  assert.match(presence, /MediaRecorder/);
  assert.match(presence, /btnMediaGallery/);
  assert.match(presence, /frp-chat-media-drawer/);
  assert.doesNotMatch(presence, /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i);
});

test('image_annotator.js içinde KVKK blur, redact bar, spotlight ve loupe özellikleri bulunur', () => {
  const annotator = fs.readFileSync(path.join(root, 'js', 'list', 'image_annotator.js'), 'utf8');
  assert.match(annotator, /toolBlur/);
  assert.match(annotator, /toolRedact/);
  assert.match(annotator, /toolSpotlight/);
  assert.match(annotator, /toolMagnifier/);
  assert.match(annotator, /blurRegion/);
  assert.doesNotMatch(annotator, /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i);
});

test('rich_note_editor.js içinde modern link modalı ve yüksek çözünürlüklü önizleme bulunur', () => {
  const editor = fs.readFileSync(path.join(root, 'js', 'list', 'rich_note_editor.js'), 'utf8');
  assert.match(editor, /showModernLinkModal/);
  assert.match(editor, /frpEditorLinkTooltip/);
  assert.match(editor, /openAttachmentPreview/);
  assert.doesNotMatch(editor, /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i);
});

test('Odalar ve Kanallar yönetimi Ayarlar sekmesine modüler olarak taşınmıştır ve native alert/prompt bulunmaz', () => {
  const roomsTab = fs.readFileSync(path.join(root, 'js', 'settings', 'tabs', 'rooms_tab.js'), 'utf8');
  const mailTab = fs.readFileSync(path.join(root, 'js', 'settings', 'tabs', 'mail_tab.js'), 'utf8');
  const settingsModal = fs.readFileSync(path.join(root, 'js', 'settings', 'settings_modal.js'), 'utf8');
  const adminModal = fs.readFileSync(path.join(root, 'js', 'core', 'auth', 'auth_admin_modal.js'), 'utf8');

  assert.match(roomsTab, /window\.FrpSettingsTabs\.rooms/);
  assert.match(roomsTab, /openRoomEditModal/);
  assert.match(mailTab, /window\.FrpSettingsTabs\.mail/);
  assert.match(settingsModal, /rooms/);
  assert.match(settingsModal, /mail/);
  assert.doesNotMatch(adminModal, /\balert\(/);
  assert.doesNotMatch(adminModal, /\bprompt\(/);
});

test('Permissions-Policy mikrofon erişimine izin verir ve Web Audio API desteklenir', () => {
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(serverSource, /microphone=\(self\)/);
  
  const presence = fs.readFileSync(path.join(root, 'js', 'core', 'online_presence.js'), 'utf8');
  assert.match(presence, /playMsnNudgeSound/);
  assert.match(presence, /AudioContext/);
});

test('server.js ve online_presence.js içinde Grup Sohbeti ve MSN Titretme bulunur', () => {
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(serverSource, /\/api\/chat\/groups/);
  assert.match(serverSource, /\/api\/chat\/nudge/);
  assert.match(serverSource, /nudgeCooldowns/);

  const presence = fs.readFileSync(path.join(root, 'js', 'core', 'online_presence.js'), 'utf8');
  assert.match(presence, /fetchChatGroups/);
  assert.match(presence, /openCreateGroupModal/);
  assert.match(presence, /msn-shaking/);
  assert.match(presence, /btnNudge/);
  assert.doesNotMatch(presence, /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i);
});

test('server.js ve mailer.js içinde 4 Acil Erişim Anahtarı ve kurtarma rotası bulunur', () => {
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(serverSource, /recovery_keys/);
  assert.match(serverSource, /\/api\/auth\/recover-with-key/);
  assert.match(serverSource, /generateEmergencyRecoveryKey/);

  const mailerSource = fs.readFileSync(path.join(root, 'lib', 'mailer.js'), 'utf8');
  assert.match(mailerSource, /sendEmergencyRecoveryKeys/);
  assert.match(mailerSource, /Acil Erişim & Kurtarma Anahtarlarınız/);
});

test('auth_portal.js modern split-screen, kurtarma anahtarı formu ve captcha doğrulaması içerir', () => {
  const portalSource = fs.readFileSync(path.join(root, 'js', 'core', 'auth', 'auth_portal.js'), 'utf8');
  assert.match(portalSource, /auth-split-wrapper/);
  assert.match(portalSource, /authRecoveryPanel/);
  assert.match(portalSource, /loginCaptchaContainer/);
  assert.match(portalSource, /regKeysNotice/);
  assert.doesNotMatch(portalSource, /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i);
  assert.doesNotMatch(portalSource, /\balert\(/);
});

test('rich_note_editor.js içinde canlı not istatistikleri ve gelişmiş PDF okuyucu bulunur', () => {
  const editor = fs.readFileSync(path.join(root, 'js', 'list', 'rich_note_editor.js'), 'utf8');
  assert.match(editor, /richNoteStatsBar/);
  assert.match(editor, /updateNoteStatistics/);
  assert.match(editor, /btnPdfNightMode/);
  assert.match(editor, /btnPdfFullscreen/);
  assert.doesNotMatch(editor, /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i);
});

test('image_annotator.js içinde Filigran, Çıkartmalar, Şekil Dolgusu ve İnce Ayar araçları mevcuttur', () => {
  const annotator = fs.readFileSync(path.join(root, 'js', 'list', 'image_annotator.js'), 'utf8');
  assert.match(annotator, /toolWatermark/);
  assert.match(annotator, /toolSticker/);
  assert.match(annotator, /selShapeFill/);
  assert.match(annotator, /selLineDash/);
  assert.match(annotator, /btnOpenAdjustModal/);
  assert.match(annotator, /showAdjustModal/);
  assert.doesNotMatch(annotator, /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i);
});

test('online_presence.js modern onay modali, anlasilir bildirim butonu, ses calici ve iletildi duzeltmesini icerir', () => {
  const presence = fs.readFileSync(path.join(root, 'js', 'core', 'online_presence.js'), 'utf8');
  // 'İtildi' yazım yanlışı giderildi mi?
  assert.doesNotMatch(presence, /['"]İtildi['"]/);
  assert.match(presence, /['"]İletildi['"]/);

  // Modern showConfirmDialog sohbet silme kontrolü
  assert.match(presence, /showConfirmDialog\s*\(/);
  assert.doesNotMatch(presence, /window\.confirm\s*\(/);

  // Bildirim açıklayıcı durum butonu
  assert.match(presence, /frp-presence-notif-btn/);
  assert.match(presence, /updateNotifBtnUI/);

  // Ses dosyası ve ses kaydı desteği
  assert.match(presence, /bindAudioPlayer/);
  assert.match(presence, /audioSrc/);

  // Grup WhatsApp detay & ayrılma/yönetici özellikleri
  assert.match(presence, /frp-group-info-drawer/);
  assert.match(presence, /\/api\/chat\/groups\/.*\/details/);
  assert.match(presence, /\/api\/chat\/groups\/.*\/leave/);

  // Titreme süresi
  assert.match(presence, /1200/);

  // CSP inline handler denetimi
  assert.doesNotMatch(presence, /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i);
});

test('server.js dosyasinda grup yonetimi, uyeyi cikarma, gruptan ayrilma ve profil avatar destegi bulunur', () => {
  const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(serverSource, /\/api\/chat\/groups\/:id\/details/);
  assert.match(serverSource, /\/api\/chat\/groups\/:id\/leave/);
  assert.match(serverSource, /app\.delete\('\/api\/chat\/groups\/:id\/members\/:userId'/);
  assert.match(serverSource, /updates\.avatar\s*=/);
});

test('profile_tab.js avatar kirpma, zoom, hazir yonetici avatarlari ve bas harflere sifirlama icerir', () => {
  const profileTab = fs.readFileSync(path.join(root, 'js', 'settings', 'tabs', 'profile_tab.js'), 'utf8');
  assert.match(profileTab, /btn-preset-avatar/);
  assert.match(profileTab, /profAvatarZoom/);
  assert.match(profileTab, /profAvatarCanvas/);
  assert.match(profileTab, /btnResetAvatarInitials/);
  assert.doesNotMatch(profileTab, /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i);
});


