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
  const serverContent = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8') +
    fs.readFileSync(path.join(ROOT, 'server/routes/chat_state.js'), 'utf8') +
    fs.readFileSync(path.join(ROOT, 'server/routes/chat_messages.js'), 'utf8');
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

test('auth portal presents one restrained login form without a decorative banner', () => {
  const authContent = fs.readFileSync(path.join(ROOT, 'js/core/auth/auth_portal.js'), 'utf8');
  assert.ok(!authContent.includes('Çift Katmanlı Veri Güvenliği'), 'Old feature pill must be removed');
  assert.ok(!authContent.includes('Canlı Ekip İletişimi & Notlar'), 'Old feature pill must be removed');
  assert.ok(authContent.includes('auth-wordmark-icon'), 'Login form has a compact wordmark');
  assert.ok(authContent.includes('Hesabınıza giriş yapın'), 'Login form has a clear heading');
  assert.ok(!authContent.includes('auth-brand-pane'), 'Decorative banner is removed');
  assert.ok(!authContent.includes('auth-brand-preview'), 'Fake product preview is removed');
});

test('designer engine supports Barcodes, Picture hex decode, Rulers, Smart Guides, Lasso marquee, and Multi-Align toolbar', () => {
  const designerContent = fs.readFileSync(path.join(ROOT, 'js/detail/report_designer.js'), 'utf8');
  const parserContent = fs.readFileSync(path.join(ROOT, 'js/core/parser.js'), 'utf8');
  const designerCss = fs.readFileSync(path.join(ROOT, 'css/designer.css'), 'utf8');

  // Part 1A: Barcode Engine
  assert.ok(designerContent.includes('TfrxBarCodeView'), 'Must support TfrxBarCodeView');
  assert.ok(designerContent.includes('TfrxQRCodeView'), 'Must support TfrxQRCodeView');
  assert.ok(designerContent.includes('renderBarcodeSvg'), 'Must include vector SVG barcode generator');
  assert.ok(designerContent.includes('btnToolAddBarcode'), 'Must have barcode tool button in palette');

  // Part 1B: Picture Hex Decoder
  assert.ok(designerContent.includes('decodeDelphiPictureHex'), 'Designer must have decodeDelphiPictureHex helper');
  assert.ok(designerContent.includes('TfrxPictureView'), 'Designer must support TfrxPictureView');
  assert.ok(designerContent.includes('btnToolAddPicture'), 'Must have picture tool button in palette');

  // Part 1C: Canvas Rulers & Smart Alignment Guides
  assert.ok(designerContent.includes('renderRulerTopSvg'), 'Must render top mm/cm metric ruler');
  assert.ok(designerContent.includes('renderRulerLeftSvg'), 'Must render left mm/cm metric ruler');
  assert.ok(designerContent.includes('renderSmartGuides'), 'Must render Figma-style alignment guides');
  assert.ok(designerCss.includes('fr-smart-guide-line'), 'CSS must style smart alignment guides');

  // Part 1D: Multi-selection Lasso & Multi-Align Toolbar
  assert.ok(designerContent.includes('fr-multi-align-bar'), 'Must include Multi-Align Toolbar HTML');
  assert.ok(designerContent.includes('fr-lasso-marquee'), 'Must include Lasso Marquee drag selection');
  assert.ok(designerContent.includes('alignSelected'), 'Must implement alignSelected for left/center/right/top/middle/bottom/distribute');
  assert.ok(designerContent.includes('deleteMultiSelected'), 'Must implement deleteMultiSelected');
  assert.ok(designerCss.includes('.fr-multi-align-bar'), 'CSS must style multi-align bar');
  assert.ok(designerCss.includes('.fr-lasso-marquee'), 'CSS must style lasso marquee');
});

