const test = require('node:test');
const assert = require('node:assert/strict');
const { formatBytes, safeCsvCell, sanitizeZipSegment, safeZipPath, validateFastReportXml } = require('../js/core/file_safety');

test('CSV formül başlangıçlarını metin olarak etkisizleştirir', () => {
  ['=1+1', '+cmd', '-2+3', '@SUM(A1)', '\tformula', '\rformula'].forEach(value => {
    assert.match(safeCsvCell(value), /^"'/);
  });
  assert.equal(safeCsvCell('normal'), '"normal"');
});

test('ZIP segmentlerinde traversal ve ayraçları temizler', () => {
  assert.equal(sanitizeZipSegment('../../Rapor'), '_Rapor');
  assert.equal(safeZipPath(['Kategori', 'alt/rapor.frp']), 'Kategori/alt_rapor.frp');
  assert.throws(() => safeZipPath(['Kategori', '../rapor.frp']), /Güvensiz/);
  assert.throws(() => safeZipPath('/'), /Güvensiz/);
});

test('dosya boyutunu ortak biçimde gösterir', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
});

test('yalnızca geçerli TfrxReport XML kökünü kabul eder', () => {
  class ValidParser {
    parseFromString() { return { querySelector: () => null, documentElement: { nodeName: 'TfrxReport' } }; }
  }
  class InvalidParser {
    parseFromString() { return { querySelector: () => ({}), documentElement: null }; }
  }
  assert.equal(validateFastReportXml('<TfrxReport/>', ValidParser).valid, true);
  assert.equal(validateFastReportXml('<not-xml', InvalidParser).valid, false);
});
