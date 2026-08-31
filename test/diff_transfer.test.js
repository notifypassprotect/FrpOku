const test = require('node:test');
const assert = require('node:assert/strict');
const DiffEngine = require('../js/compare/diff');

test('diff satırları gerçek A/B indekslerini taşır', () => {
  const diff = DiffEngine.computeLineDiff('a\nb\nc', 'a\nx\nb\nc');
  const addedRow = diff.linesB.find(row => row.type === 'add');
  assert.equal(addedRow.aIndex, null);
  assert.equal(addedRow.bIndex, 1);
});

test('eklenen satırı hizalı gerçek konuma aktarır', () => {
  const textA = 'a\nb\nc';
  const textB = 'a\nx\nb\nc';
  const diff = DiffEngine.computeLineDiff(textA, textB);
  const rowIndex = diff.linesB.findIndex(row => row.type === 'add');
  assert.equal(DiffEngine.applyLineTransfer(diff, 'B', rowIndex, textA, textB), textB);
});

test('boş tarafı aktarmak hedefteki fazla satırı siler', () => {
  const textA = 'a\nb\nc';
  const textB = 'a\nx\nb\nc';
  const diff = DiffEngine.computeLineDiff(textA, textB);
  const rowIndex = diff.linesA.findIndex(row => row.type === 'empty');
  assert.equal(DiffEngine.applyLineTransfer(diff, 'A', rowIndex, textA, textB), textA);
});
