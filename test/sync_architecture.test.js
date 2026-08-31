const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('store değişiklikleri toplu snapshot yerine tekil rapor kuyruğuna gönderir', () => {
  const source = fs.readFileSync(path.join(root, 'js/store/store_main.js'), 'utf8');
  const writeBody = source.slice(source.indexOf('function _write('), source.indexOf('function _uuid('));
  assert.doesNotMatch(writeBody, /saveReports\s*\(/);
  assert.match(writeBody, /_queueReportSync/);
  const cloudSource = fs.readFileSync(path.join(root, 'js/core/supabase.js'), 'utf8');
  assert.doesNotMatch(cloudSource, /serverRequest\('\/api\/store\/save'/);
});

test('tekil rapor endpointi version koşullu güncelleme yapar', () => {
  const source = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(source, /app\.put\('\/api\/reports\/:id'/);
  assert.match(source, /\.eq\('version', currentVersion\)/);
  assert.match(source, /REPORT_CONFLICT/);
});

test('Supabase doğrudan yazmaları hata kontrolü olmadan await edilmez', () => {
  const source = fs.readFileSync(path.join(root, 'js/core/supabase.js'), 'utf8');
  const unchecked = source.split('\n').filter(line => /await sb\.from/.test(line) && !/(const \{|requireSuccess)/.test(line));
  assert.deepEqual(unchecked, []);
});
