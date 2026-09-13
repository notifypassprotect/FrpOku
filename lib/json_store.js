const fs = require('fs');
const path = require('path');

function createJsonStore(filePath, { fallback = [], limit = null, label = 'JSON' } = {}) {
  function cloneFallback() {
    return Array.isArray(fallback) ? [...fallback] : { ...fallback };
  }

  function read() {
    try {
      if (!fs.existsSync(filePath)) return cloneFallback();
      const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return value == null ? cloneFallback() : value;
    } catch (error) {
      console.warn(`${label} dosyası okunamadı:`, error.message);
      return cloneFallback();
    }
  }

  function write(value) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const output = Array.isArray(value) && Number.isInteger(limit) ? value.slice(0, limit) : value;
      const temporaryPath = `${filePath}.tmp`;
      fs.writeFileSync(temporaryPath, JSON.stringify(output, null, 2), 'utf8');
      fs.renameSync(temporaryPath, filePath);
      return true;
    } catch (error) {
      console.warn(`${label} dosyası yazılamadı:`, error.message);
      return false;
    }
  }

  return { read, write };
}

module.exports = { createJsonStore };
