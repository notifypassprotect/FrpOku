const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('inline handler argümanı HTML/JavaScript bağlamını kıramaz', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'dom.js'), 'utf8');
  const context = { window: {}, document: {} };
  vm.runInNewContext(source, context);

  const payload = `x');alert(1);//<img src=x onerror=alert(2)>`;
  const encoded = context.window.encodeInlineArg(payload);

  assert.equal(decodeURIComponent(encoded), payload);
  assert.equal(encoded.includes("'"), false);
  assert.equal(encoded.includes('<'), false);
  assert.equal(encoded.includes('>'), false);
  assert.equal(encoded.includes('"'), false);
});

test('HTML escape metin ve attribute özel karakterlerini dönüştürür', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'core', 'dom.js'), 'utf8');
  const context = { window: {}, document: {} };
  vm.runInNewContext(source, context);

  assert.equal(context.window.escHtml(`<a x="1" y='2'>&`), '&lt;a x=&quot;1&quot; y=&#39;2&#39;&gt;&amp;');
});
