const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('report_designer.js renders full Delphi properties for TfrxMemoView and components', () => {
  const content = fs.readFileSync(path.join(ROOT, 'js/detail/report_designer.js'), 'utf8');

  // Must have data-comp-name
  assert.ok(content.includes('data-comp-name='), 'Components must have data-comp-name');

  // In renderObjectInspectorProperties, must not restrict to isBand only
  assert.ok(content.includes('// BANT, MEMO (TfrxMemoView), VE DİĞER BİLEŞENLERİN TÜM DELPHI ÖZELLİKLERİ'), 'Must include comment for memo properties');
  assert.ok(content.includes('Caption / Text'), 'Must list Caption / Text in properties');
  assert.ok(content.includes('selectedItem.memo = val'), 'Must synchronize text, caption, memo');
});

test('server.js and online_presence.js provide live typing and chat modernizations', () => {
  const serverContent = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.ok(serverContent.includes('/api/chat/typing'), 'Server must have /api/chat/typing endpoint');
  assert.ok(serverContent.includes('typingUsers'), 'Server must return typingUsers in messages');

  const presenceContent = fs.readFileSync(path.join(ROOT, 'js/core/online_presence.js'), 'utf8');
  assert.ok(presenceContent.includes('frp-typing-indicator'), 'Must have frp-typing-indicator');
  assert.ok(presenceContent.includes('frp-online-pulse'), 'Must have frp-online-pulse');
  assert.ok(presenceContent.includes('frp-chat-live-badge'), 'Must have live badge');
  assert.ok(presenceContent.includes('/api/chat/typing'), 'Client must emit typing pings');
  assert.ok(presenceContent.includes('playMessageSentSound'), 'Client must have message sent sound');

  const cssContent = fs.readFileSync(path.join(ROOT, 'css/online_presence.css'), 'utf8');
  assert.ok(cssContent.includes('.frp-typing-indicator'), 'CSS must style typing indicator');
  assert.ok(cssContent.includes('@keyframes dotBounce'), 'CSS must animate typing dots');
  assert.ok(cssContent.includes('@keyframes livePulse'), 'CSS must animate live pulse');
});

test('auth_portal.js left banner is clean and does not contain old feature pills', () => {
  const authContent = fs.readFileSync(path.join(ROOT, 'js/core/auth/auth_portal.js'), 'utf8');
  assert.ok(!authContent.includes('Çift Katmanlı Veri Güvenliği'), 'Old feature pill must be removed');
  assert.ok(!authContent.includes('Canlı Ekip İletişimi & Notlar'), 'Old feature pill must be removed');
  assert.ok(authContent.includes('FrpOku Enterprise'), 'Must keep FrpOku Enterprise title');
  assert.ok(authContent.includes('Kurumsal Rapor Yönetimi'), 'Must have clean minimal tag');
});
