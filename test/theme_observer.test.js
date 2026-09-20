const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/core/themes.js'), 'utf8');

test('theme observer settles after DOM changes, toggles and new buttons', () => {
  let callback, pending = false, observing = false;
  const storage = new Map();
  const buttons = [];
  function addButton() {
    let text = '';
    const button = {
      get textContent() { return text; },
      set textContent(value) {
        text = value;
        // Browsers queue childList mutations even when textContent is unchanged.
        if (observing) pending = true;
      }
    };
    buttons.push(button);
    pending = true;
    return button;
  }
  function settle() {
    let deliveries = 0;
    while (pending && deliveries < 10) {
      pending = false;
      callback();
      deliveries++;
    }
    assert.equal(pending, false, 'observer must not keep scheduling itself');
    assert.ok(deliveries <= 2, 'one update and at most one follow-up delivery');
  }
  const element = { classList: { add() {}, remove() {} }, setAttribute() {} };
  const first = addButton();
  const window = { addEventListener() {}, dispatchEvent() {} };
  vm.runInNewContext(source, {
    window,
    document: {
      documentElement: element, body: element, readyState: 'complete',
      addEventListener() {},
      querySelectorAll(selector) { return selector === '#btnThemeToggle' ? buttons : []; }
    },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    CustomEvent: class {},
    MutationObserver: class {
      constructor(fn) { callback = fn; }
      observe() { observing = true; }
    }
  });
  settle();
  assert.equal(first.textContent, 'Koyu Mod');
  window.FrpThemes.setTheme('dark');
  settle();
  assert.equal(first.textContent, 'Aydınlık Mod');
  const added = addButton();
  settle();
  assert.equal(added.textContent, 'Aydınlık Mod');
  window.FrpThemes.setTheme('light');
  settle();
  assert.equal(added.textContent, 'Koyu Mod');
});

test('all application pages load the same current visual system', () => {
  for (const page of ['index.html', 'detail.html', 'compare.html', 'dashboard.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.match(html, /css\/ui_polish\.css\?v=5\.7\.0/, `${page} must load the current UI layer`);
  }
  const css = fs.readFileSync(path.join(__dirname, '../css/ui_polish.css'), 'utf8');
  assert.match(css, /--ui-shadow-panel:/);
  assert.match(css, /\/\* ── 2026 UYGULAMA GENELİ GÖRSEL SİSTEM/);
  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /@media \(max-width: 520px\)/);
});
