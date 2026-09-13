const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('server.js dosyasında /api/presence/offline rotası requireAuth ile korunur ve oturum kullanıcısını çevrimdışı yapar', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(
    serverCode,
    /app\.post\('\/api\/presence\/offline',\s*requireAuth/,
    '/api/presence/offline rotası requireAuth middleware ile korunmalıdır.'
  );
  assert.match(
    serverCode,
    /const userId = String\(req\.authUser\.id\);/,
    'Yalnızca oturum sahibi kullanıcı kendi varlık durumunu çevrimdışı yapabilmelidir.'
  );
});

test('server.js dosyasında auth kurtarma ve şifre sıfırlama rotalarında PostgREST filtre enjeksiyonu önlenmiştir', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.doesNotMatch(
    serverCode,
    /\.or\(`username\.eq\.\$\{ident\},email\.eq\.\$\{ident\}`\)/,
    'ident değişkeni doğrudan PostgREST .or() filtre dizgisine gömülmemelidir.'
  );
});

test('server.js rapor ekleri indirmede Content-Disposition: attachment ve X-Content-Type-Options: nosniff başlıkları uygular', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(
    serverCode,
    /res\.setHeader\('Content-Disposition',\s*`attachment; filename="\$\{encodeURIComponent\(filename\)\}"`\);/,
    'Ek dosyalar indirme başlığı ile sunulmalıdır.'
  );
  assert.match(
    serverCode,
    /res\.setHeader\('X-Content-Type-Options',\s*'nosniff'\);/,
    'MIME sniffing engellenmelidir.'
  );
  assert.match(
    serverCode,
    /if \(!targetDir\.startsWith\(ATTACHMENTS_DIR\)\)/,
    'Hedef dizin ATTACHMENTS_DIR sınırları içinde kalmalıdır.'
  );
});

test('server.js dosyasında JSON yazma işlemleri atomik (.tmp + rename) olarak gerçekleştirilir', () => {
  const serverCode = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(
    serverCode,
    /const tempFile = LOGS_FILE \+ '\.tmp';[\s\S]*?fs\.renameSync\(tempFile, LOGS_FILE\);/,
    'saveAuditLogs atomik yazma kullanmalıdır.'
  );
  assert.match(
    serverCode,
    /const tempFile = USER_SETTINGS_PATH \+ '\.tmp';[\s\S]*?fs\.renameSync\(tempFile, USER_SETTINGS_PATH\);/,
    'saveUserSettingsFileMap atomik yazma kullanmalıdır.'
  );
  assert.match(
    serverCode,
    /const tempFile = CHAT_STORE_PATH \+ '\.tmp';[\s\S]*?fs\.renameSync\(tempFile, CHAT_STORE_PATH\);/,
    'saveChatMessages atomik yazma kullanmalıdır.'
  );
});

test('online_presence.js resim lightbox ve medya galerisinde XSS koruması ve protokol doğrulaması barındırır', () => {
  const presenceCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'online_presence.js'), 'utf8');
  assert.match(
    presenceCode,
    /function isSafeImageUrl\(url\)/,
    'isSafeImageUrl fonksiyonu tanımlı olmalıdır.'
  );
  assert.ok(
    presenceCode.includes('safeSrc = (src && (src.startsWith(\'data:image/\') || /^https?:\\/\\//i.test(src))) ? escHtml(src) : \'\''),
    'Lightbox görsel kaynağı sanitize edilmelidir.'
  );
  assert.ok(
    presenceCode.includes('safeImgUrl = (m.attachment.dataUrl && (m.attachment.dataUrl.startsWith(\'data:image/\') || /^https?:\\/\\//i.test(m.attachment.dataUrl))) ? escHtml(m.attachment.dataUrl) : \'\''),
    'Medya galerisi görsel kaynağı sanitize edilmelidir.'
  );
});

test('profile_tab.js avatar önizlemesinde XSS koruması barındırır', () => {
  const profileTabCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'settings', 'tabs', 'profile_tab.js'), 'utf8');
  assert.match(
    profileTabCode,
    /const escSafe = \(val\) =>/,
    'escSafe fonksiyonu tanımlı olmalıdır.'
  );
  assert.match(
    profileTabCode,
    /\$\{escSafe\(avatarVal\)\}/,
    'avatarVal değeri güvenli biçimde escape edilmelidir.'
  );
});

test('store_main.js kalıcı istemci hatalarında (400, 401, 403, 404) raporu senkronizasyon kuyruğundan çıkarır', () => {
  const storeCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'store', 'store_main.js'), 'utf8');
  assert.match(
    storeCode,
    /else if \(error\?\.status === 400 \|\| error\?\.status === 401 \|\| error\?\.status === 403 \|\| error\?\.status === 404\)/,
    'Kalıcı istemci hataları özel olarak yakalanmalıdır.'
  );
});

test('compare.js queries alanı null/undefined olan raporlarda TypeError fırlatmaz', () => {
  const compareCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'compare', 'compare.js'), 'utf8');
  assert.match(
    compareCode,
    /\(fileA\?\.queries \|\| \[\]\)\.find\(q => q\.name === qName\)/,
    'fileA queries güvenli dizi fallback ile okunmalıdır.'
  );
  assert.match(
    compareCode,
    /\(fileB\?\.queries \|\| \[\]\)\.find\(q => q\.name === qName\)/,
    'fileB queries güvenli dizi fallback ile okunmalıdır.'
  );
});

test('syntax_check.js ve highlight.js yalın kolon adlarında eksik virgül (,) teşhisini doğru koyar', () => {
  // syntax_check.js test
  const syntaxCheckCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'analytics', 'syntax_check.js'), 'utf8');
  const windowStub = {};
  const fn = new Function('window', syntaxCheckCode + '; return window.FrpSyntaxCheck;');
  const syntaxChecker = fn(windowStub);

  const missingCommaSql = `
    SELECT
      id
      full_name
    FROM users
  `;
  const result = syntaxChecker.checkSqlStaticSyntax(missingCommaSql);
  assert.ok(
    result.errors.some(e => e.includes('virgül (,) eksik')),
    'SELECT id \\n full_name sorgusunda eksik virgül yakalanmalıdır.'
  );

  const validSql = `
    SELECT
      id,
      full_name
    FROM users
  `;
  const validResult = syntaxChecker.checkSqlStaticSyntax(validSql);
  assert.ok(
    !validResult.errors.some(e => e.includes('virgül (,) eksik')),
    'SELECT id, \\n full_name sorgusunda yanlış eksik virgül hatası üretilmemelidir.'
  );
});
