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
    ...javascriptFiles(path.join(root, 'js', 'list')),
    ...javascriptFiles(path.join(root, 'js', 'compare'))
  ];
  const inlineEvent = /\s+on(?:click|change|input|keydown|keyup|submit|load|error)\s*=/i;
  for (const file of files) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), inlineEvent, path.relative(root, file));
  }
});

test('liste ve karşılaştırma HTML dosyalarında inline script bulunmaz', () => {
  const inlineScript = /<script(?![^>]*\bsrc=)/i;
  for (const fileName of ['index.html', 'compare.html']) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, fileName), 'utf8'), inlineScript, fileName);
  }
});
