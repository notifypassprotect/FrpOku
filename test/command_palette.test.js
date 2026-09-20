const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../js/core/palette.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../css/ui_polish.css'), 'utf8');

test('command palette is shared, accessible and class-styled across application pages', () => {
  for (const page of ['index.html', 'detail.html', 'compare.html', 'dashboard.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', page), 'utf8');
    assert.match(html, /js\/core\/palette\.js\?v=5\.7\.0/);
  }
  assert.match(source, /setAttribute\('role', 'dialog'\)/);
  assert.match(source, /setAttribute\('role', 'listbox'\)/);
  assert.match(source, /aria-activedescendant/);
  assert.match(source, /id = 'btnCommandPalette'/);
  assert.doesNotMatch(source, /style\.cssText/);
  assert.match(css, /\.frp-command-panel/);
  assert.match(css, /@media \(max-width: 700px\)/);
});

test('command palette renders extension labels as text instead of executable markup', () => {
  assert.match(source, /label\.textContent = cmd\.label/);
  assert.match(source, /desc\.textContent = cmd\.desc/);
  assert.match(source, /typeof cmd\.action === 'function'/);
});
