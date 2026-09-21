const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'detail.html'), 'utf8');
const source = fs.readFileSync(path.join(root, 'js/detail/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/ui_polish.css'), 'utf8');

test('detail workspace exposes a persistent accessible information panel control', () => {
  assert.match(html, /id="btnToggleDetailSidebar"[^>]+aria-controls="detailSidebar"[^>]+aria-expanded="true"/);
  assert.match(html, /id="detailSidebar"/);
  assert.match(source, /frp_detail_sidebar_collapsed/);
  assert.match(source, /matchMedia\('\(min-width: 861px\)'\)/);
  assert.match(css, /body\.detail-sidebar-collapsed #detailSidebar/);
  assert.doesNotMatch(html, /btnToggleCodeWrap/);
  assert.doesNotMatch(source, /frp_detail_code_wrap/);
});

test('detail toolbar stays compact and horizontally navigable', () => {
  assert.match(source, /class="code-toolbar-actions"/);
  assert.match(css, /\.code-toolbar-actions[\s\S]+overflow-x: auto/);
  assert.match(source, />Kütüphane<\/button>/);
  assert.match(source, />Sözdizimi<\/button>/);
  assert.match(source, />Geçmiş<\/button>/);
});

test('detail theme synchronization uses a single custom-event listener', () => {
  const listeners = source.match(/addEventListener\('frpoku:themeChanged'/g) || [];
  assert.equal(listeners.length, 1);
});

test('shared visual stylesheet cache version is aligned across pages', () => {
  for (const page of ['index.html', 'detail.html', 'compare.html', 'dashboard.html']) {
    const pageHtml = fs.readFileSync(path.join(root, page), 'utf8');
    assert.match(pageHtml, /css\/ui_polish\.css\?v=5\.9\.0/);
  }
  assert.match(html, /js\/detail\/app\.js\?v=5\.10\.0/);
});
