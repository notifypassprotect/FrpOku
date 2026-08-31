importScripts('./diff.js');

self.onmessage = event => {
  const { id, mode, textA, textB, textC } = event.data || {};
  try {
    const result = mode === 'three'
      ? DiffEngine.computeThreeWayDiff(textA, textB, textC)
      : DiffEngine.computeLineDiff(textA, textB);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error?.message || 'Karşılaştırma tamamlanamadı.' });
  }
};
