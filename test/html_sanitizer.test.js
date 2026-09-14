const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeRichHtml, unsafeUrl } = require('../lib/html_sanitizer');

test('rich HTML sanitizer removes executable elements and event handlers', () => {
  const dirty = '<p onclick="alert(1)">Merhaba</p><script>alert(1)</script><iframe src="https://evil.example"></iframe>';
  const clean = sanitizeRichHtml(dirty);
  assert.equal(clean.includes('onclick'), false);
  assert.equal(clean.includes('<script'), false);
  assert.equal(clean.includes('<iframe'), false);
  assert.match(clean, /<p>Merhaba<\/p>/);
});

test('rich HTML sanitizer blocks encoded and plain script URLs', () => {
  const clean = sanitizeRichHtml('<a href="javascript:alert(1)">A</a><a href="jav&#x61;script:alert(2)">B</a>');
  assert.equal(clean.includes('javascript:'), false);
  assert.equal(clean.includes('&#x61;'), false);
});

test('rich HTML sanitizer preserves supported document formatting', () => {
  const clean = sanitizeRichHtml('<p style="color: #2563eb"><strong>Başlık</strong></p><table><tr><td>Veri</td></tr></table>');
  assert.match(clean, /style="color: #2563eb"/);
  assert.match(clean, /<strong>Başlık<\/strong>/);
  assert.match(clean, /<table>/);
});

test('unsafe URL detection handles control characters and HTML entities', () => {
  assert.equal(unsafeUrl('java\nscript:alert(1)'), true);
  assert.equal(unsafeUrl('jav&#97;script:alert(1)'), true);
  assert.equal(unsafeUrl('https://example.com'), false);
});
