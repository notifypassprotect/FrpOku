(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FrpFileSafety = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function formatBytes(value) {
    const bytes = Math.max(0, Number(value) || 0);
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const amount = bytes / Math.pow(1024, index);
    return `${amount >= 10 || index === 0 ? Math.round(amount) : amount.toFixed(1)} ${units[index]}`;
  }

  function safeCsvCell(value) {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }

  function sanitizeZipSegment(value, fallback = 'Dosya') {
    const clean = String(value ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, '_')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\.\.+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^\.+|\.+$/g, '')
      .trim();
    return clean || fallback;
  }

  function safeZipPath(segments) {
    const rawList = (Array.isArray(segments) ? segments : [segments]).map(value => String(value ?? ''));
    if (rawList.some(value => /(^|[\\/])\.\.([\\/]|$)/.test(value) || /^[\\/]/.test(value) || /^[a-zA-Z]:/.test(value))) {
      throw new Error('Güvensiz ZIP dosya yolu.');
    }
    const list = rawList.map(value => sanitizeZipSegment(value));
    const path = list.join('/');
    if (!path || path.startsWith('/') || path.includes('\\') || /(^|\/)\.\.?(\/|$)/.test(path) || /^[a-zA-Z]:/.test(path)) {
      throw new Error('Güvensiz ZIP dosya yolu.');
    }
    return path;
  }

  function validateFastReportXml(text, Parser = typeof DOMParser !== 'undefined' ? DOMParser : null) {
    if (!String(text || '').trim()) return { valid: false, reason: 'Dosya içeriği boş.' };
    if (!Parser) return { valid: false, reason: 'XML ayrıştırıcısı kullanılamıyor.' };
    try {
      const xml = new Parser().parseFromString(String(text), 'application/xml');
      if (xml.querySelector('parsererror')) return { valid: false, reason: 'XML sözdizimi geçersiz.' };
      if (!xml.documentElement || String(xml.documentElement.nodeName).toLowerCase() !== 'tfrxreport') {
        return { valid: false, reason: 'Kök öğe TfrxReport değil.' };
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, reason: error.message || 'XML ayrıştırılamadı.' };
    }
  }

  return { formatBytes, safeCsvCell, sanitizeZipSegment, safeZipPath, validateFastReportXml };
});
