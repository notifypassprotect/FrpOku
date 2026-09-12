const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('006_chat_messages.sql doğru şema ve indeksleri tanımlar', () => {
  const sql = fs.readFileSync(path.join(root, 'supabase', 'migrations', '006_chat_messages.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.chat_messages/i);
  assert.match(sql, /sender_id uuid/i);
  assert.match(sql, /receiver_id uuid/i);
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

test('rich_note_editor.js içinde 16+ font ailesi, piksel boyutları ve callout kutuları bulunur', () => {
  const editor = fs.readFileSync(path.join(root, 'js', 'list', 'rich_note_editor.js'), 'utf8');
  assert.match(editor, /tbLineHeight/);
  assert.match(editor, /applyPixelFontSize/);
  assert.match(editor, /tbCallout/);
  assert.match(editor, /tbSub/);
  assert.match(editor, /tbSup/);
  
  const inlineEvent = /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i;
  assert.doesNotMatch(editor, inlineEvent);
});
