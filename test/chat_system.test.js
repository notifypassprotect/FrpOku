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

test('auth_admin_modal.js içinde Odalar ve Kanallar sekmesi bulunur ve native alert/prompt bulunmaz', () => {
  const adminModal = fs.readFileSync(path.join(root, 'js', 'core', 'auth', 'auth_admin_modal.js'), 'utf8');
  assert.match(adminModal, /tabAdminRooms/);
  assert.match(adminModal, /renderRoomsTab/);
  assert.match(adminModal, /openRoomModal/);
  assert.doesNotMatch(adminModal, /\balert\(/);
  assert.doesNotMatch(adminModal, /\bprompt\(/);
});

