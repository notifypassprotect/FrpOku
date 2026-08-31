const DiffWorkerClient = (() => {
  const WORKER_THRESHOLD_CHARS = 30000;
  const MAX_INPUT_CHARS = 2000000;
  const WORKER_TIMEOUT_MS = 30000;
  let active = null;
  let sequence = 0;

  function abortError() {
    const error = new Error('Karşılaştırma iptal edildi.');
    error.name = 'AbortError';
    return error;
  }

  function cancel() {
    if (!active) return;
    active.worker.terminate();
    clearTimeout(active.timeoutId);
    active.reject(abortError());
    active = null;
  }

  function compute({ mode = 'two', textA = '', textB = '', textC = '' } = {}) {
    const totalChars = String(textA).length + String(textB).length + String(textC).length;
    if (totalChars > MAX_INPUT_CHARS) {
      const error = new Error('Karşılaştırma toplam 2.000.000 karakter sınırını aşıyor.');
      error.code = 'DIFF_INPUT_TOO_LARGE';
      return Promise.reject(error);
    }
    cancel();
    if (typeof Worker === 'undefined' || totalChars < WORKER_THRESHOLD_CHARS) {
      return Promise.resolve(mode === 'three'
        ? DiffEngine.computeThreeWayDiff(textA, textB, textC)
        : DiffEngine.computeLineDiff(textA, textB));
    }

    cancel();
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const worker = new Worker('js/compare/diff_worker.js?v=4.4');
      const finish = callback => value => {
        if (!active || active.id !== id) return;
        clearTimeout(active.timeoutId);
        worker.terminate();
        active = null;
        callback(value);
      };
      const succeed = finish(resolve);
      const fail = finish(reject);
      const timeoutId = setTimeout(() => {
        const error = new Error('Karşılaştırma 30 saniyelik süre sınırını aştı.');
        error.code = 'DIFF_TIMEOUT';
        fail(error);
      }, WORKER_TIMEOUT_MS);

      active = { id, worker, timeoutId, reject };
      worker.onmessage = event => {
        if (event.data?.id !== id) return;
        if (event.data.error) fail(new Error(event.data.error));
        else succeed(event.data.result);
      };
      worker.onerror = () => fail(new Error('Karşılaştırma Worker işlemi başlatılamadı.'));
      worker.postMessage({ id, mode, textA, textB, textC });
    });
  }

  return { cancel, compute, MAX_INPUT_CHARS, WORKER_THRESHOLD_CHARS };
})();
if (typeof window !== 'undefined') window.DiffWorkerClient = DiffWorkerClient;
if (typeof module === 'object' && module.exports) module.exports = DiffWorkerClient;
