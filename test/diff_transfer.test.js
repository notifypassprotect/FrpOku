const test = require('node:test');
const assert = require('node:assert/strict');
const DiffEngine = require('../js/compare/diff');
global.DiffEngine = DiffEngine;
const DiffWorkerClient = require('../js/compare/diff_worker_client');

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

test('üçlü karşılaştırma B ve C satırlarını ortak A tabanında hizalar', () => {
  const diff = DiffEngine.computeThreeWayDiff('a\nb\nc', 'a\nx\nb\nc', 'a\nb\ny\nc');
  assert.equal(diff.linesA.length, diff.linesB.length);
  assert.equal(diff.linesA.length, diff.linesC.length);

  const xRow = diff.linesB.findIndex(row => row.text === 'x');
  const yRow = diff.linesC.findIndex(row => row.text === 'y');
  assert.equal(diff.linesA[xRow].type, 'empty');
  assert.equal(diff.linesC[xRow].type, 'empty');
  assert.equal(diff.linesA[yRow].type, 'empty');
  assert.equal(diff.linesB[yRow].type, 'empty');
  assert.ok(xRow < diff.linesA.findIndex(row => row.aIndex === 1));
  assert.ok(yRow < diff.linesA.findIndex(row => row.aIndex === 2));
});

test('küçük karşılaştırma Worker olmadan aynı motoru kullanır', async () => {
  const diff = await DiffWorkerClient.compute({ textA: 'a\nb', textB: 'a\nx\nb' });
  assert.equal(diff.linesB.find(row => row.type === 'add').text, 'x');
});

test('karşılaştırma toplam boyut sınırını aşınca kontrollü hata verir', async () => {
  await assert.rejects(
    DiffWorkerClient.compute({ textA: 'x'.repeat(DiffWorkerClient.MAX_INPUT_CHARS + 1), textB: '' }),
    error => error.code === 'DIFF_INPUT_TOO_LARGE'
  );
});
