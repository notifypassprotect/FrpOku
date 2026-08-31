const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(fullPath) : (entry.name.endsWith('.js') ? [fullPath] : []);
  });
}

test('CSP ile korunan liste ve karşılaştırma kaynaklarında inline event bulunmaz', () => {
  const files = [
    path.join(root, 'index.html'),
    path.join(root, 'compare.html'),
    path.join(root, 'detail.html'),
    path.join(root, 'dashboard.html'),
    ...javascriptFiles(path.join(root, 'js', 'list')),
    ...javascriptFiles(path.join(root, 'js', 'compare')),
    ...javascriptFiles(path.join(root, 'js', 'detail'))
  ];
  const inlineEvent = /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i;
  for (const file of files) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), inlineEvent, path.relative(root, file));
  }
});

test('nonce gerektirmeyen sayfalarda inline script bulunmaz', () => {
  const inlineScript = /<script(?![^>]*\bsrc=)/i;
  for (const fileName of ['index.html', 'compare.html', 'detail.html']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, fileName), 'utf8'), inlineScript, fileName);
  }
});

test('liste sayfası render engelleyici splash overlay içermez', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /id=["']splashScreen["']/i);
  assert.match(html, /js\/list\/list_page_bootstrap\.js\?v=5\.1/);
});

test('HTML sayfalarındaki yerel script ve stil dosyaları mevcuttur', () => {
  for (const fileName of ['index.html', 'compare.html', 'detail.html', 'dashboard.html']) {
    const html = fs.readFileSync(path.join(root, fileName), 'utf8');
    const resources = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)]
      .map(match => match[1].split('?')[0])
      .filter(resource => !/^(?:https?:)?\/\//i.test(resource) && resource !== '/runtime-config.js');
    for (const resource of resources) {
      assert.ok(fs.existsSync(path.join(root, resource.replace(/^\//, ''))), `${fileName}: ${resource}`);
    }
  }
});
