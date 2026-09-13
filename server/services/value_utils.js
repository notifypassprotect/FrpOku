function safeLogStr(value) {
  if (typeof value !== 'string') return String(value || '');
  return value.replace(/[\r\n\x00-\x1f\x7f]/g, '').slice(0, 150);
}

function boundedSetting(value, maxLength, fallback = '') {
  const text = String(value ?? fallback).trim();
  return text.slice(0, maxLength) || fallback;
}

function plainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

module.exports = { boundedSetting, plainObject, safeLogStr };
