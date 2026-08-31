// ============================================================
//  diff.js — Satır Hizalamalı ve Kelime Vurgulamalı Diff Algoritması
// ============================================================

const DiffEngine = (() => {

  /**
   * İki metni satır bazında kusursuz hiza (alignment) matrisine dönüştürür.
   * Sol (A) ve Sağ (B) dizilerinin uzunlukları birebir aynıdır.
   */
  function computeLineDiff(textA, textB) {
    const a = String(textA || '').split('\n');
    const b = String(textB || '').split('\n');

    const ops = getDiffOps(a, b);
    const linesA = [];
    const linesB = [];

    let i = 0;
    while (i < ops.length) {
      if (ops[i].type === 'same') {
        linesA.push({ num: ops[i].numA, aIndex: ops[i].numA - 1, bIndex: ops[i].numB - 1, text: ops[i].textA, type: 'same' });
        linesB.push({ num: ops[i].numB, aIndex: ops[i].numA - 1, bIndex: ops[i].numB - 1, text: ops[i].textB, type: 'same' });
        i++;
      } else {
        // Ardışık del ve add bloklarını topla
        const dels = [];
        const adds = [];
        while (i < ops.length && ops[i].type !== 'same') {
          if (ops[i].type === 'del') dels.push(ops[i]);
          else if (ops[i].type === 'add') adds.push(ops[i]);
          i++;
        }

        const maxLen = Math.max(dels.length, adds.length);
        for (let k = 0; k < maxLen; k++) {
          const d = dels[k];
          const aItem = adds[k];

          if (d && aItem) {
            linesA.push({ num: d.numA, aIndex: d.numA - 1, bIndex: aItem.numB - 1, text: d.textA, type: 'del', pairedText: aItem.textB });
            linesB.push({ num: aItem.numB, aIndex: d.numA - 1, bIndex: aItem.numB - 1, text: aItem.textB, type: 'add', pairedText: d.textA });
          } else if (d) {
            linesA.push({ num: d.numA, aIndex: d.numA - 1, bIndex: null, text: d.textA, type: 'del' });
            linesB.push({ num: null, aIndex: d.numA - 1, bIndex: null, text: '', type: 'empty' });
          } else if (aItem) {
            linesA.push({ num: null, aIndex: null, bIndex: aItem.numB - 1, text: '', type: 'empty' });
            linesB.push({ num: aItem.numB, aIndex: null, bIndex: aItem.numB - 1, text: aItem.textB, type: 'add' });
          }
        }
      }
    }

    return { linesA, linesB };
  }

  function applyLineTransfer(diff, fromPane, rowIndex, textA, textB) {
    const sourceRows = fromPane === 'A' ? diff.linesA : diff.linesB;
    const row = sourceRows[rowIndex];
    if (!row) return null;
    const targetLines = String(fromPane === 'A' ? textB : textA).split('\n');
    const targetKey = fromPane === 'A' ? 'bIndex' : 'aIndex';
    const targetIndex = row[targetKey];
    if (row.type === 'empty') {
      if (targetIndex === null || targetIndex === undefined) return null;
      targetLines.splice(targetIndex, 1);
      return targetLines.join('\n');
    }
    if (targetIndex !== null && targetIndex !== undefined) {
      targetLines[targetIndex] = row.text;
    } else {
      let insertAt = targetLines.length;
      for (let i = rowIndex + 1; i < sourceRows.length; i++) {
        const nextIndex = sourceRows[i][targetKey];
        if (nextIndex !== null && nextIndex !== undefined) { insertAt = nextIndex; break; }
      }
      targetLines.splice(insertAt, 0, row.text);
    }
    return targetLines.join('\n');
  }

  function computeThreeWayDiff(textA, textB, textC) {
    const diffAB = computeLineDiff(textA, textB);
    const diffAC = computeLineDiff(textA, textC);
    const baseLines = String(textA || '').split('\n');

    const indexPair = diff => {
      const baseRows = new Map();
      const inserts = new Map();
      let slot = 0;
      for (let i = 0; i < diff.linesA.length; i++) {
        const base = diff.linesA[i];
        const variant = diff.linesB[i];
        if (base.aIndex === null || base.aIndex === undefined) {
          if (!inserts.has(slot)) inserts.set(slot, []);
          inserts.get(slot).push({ variant, pairRowIndex: i });
        } else {
          baseRows.set(base.aIndex, { base, variant, pairRowIndex: i });
          slot = base.aIndex + 1;
        }
      }
      return { baseRows, inserts };
    };

    const ab = indexPair(diffAB);
    const ac = indexPair(diffAC);
    const linesA = [];
    const linesB = [];
    const linesC = [];
    const empty = extra => ({ num: null, aIndex: null, text: '', type: 'empty', ...extra });

    for (let slot = 0; slot <= baseLines.length; slot++) {
      const insertsB = ab.inserts.get(slot) || [];
      const insertsC = ac.inserts.get(slot) || [];
      const insertCount = Math.max(insertsB.length, insertsC.length);
      for (let i = 0; i < insertCount; i++) {
        const b = insertsB[i];
        const c = insertsC[i];
        linesA.push(empty({ pairRowIndex: b?.pairRowIndex ?? null }));
        linesB.push(b ? { ...b.variant, pairRowIndex: b.pairRowIndex } : empty({ pairRowIndex: null }));
        linesC.push(c ? { ...c.variant, pairRowIndex: c.pairRowIndex } : empty({ pairRowIndex: null }));
      }

      if (slot === baseLines.length) break;
      const b = ab.baseRows.get(slot);
      const c = ac.baseRows.get(slot);
      const unchanged = b?.variant.type === 'same' && c?.variant.type === 'same';
      linesA.push({
        num: slot + 1, aIndex: slot, text: baseLines[slot], type: unchanged ? 'same' : 'del',
        pairRowIndex: b?.pairRowIndex ?? null
      });
      linesB.push(b ? { ...b.variant, pairRowIndex: b.pairRowIndex } : empty({ aIndex: slot, pairRowIndex: null }));
      linesC.push(c ? { ...c.variant, pairRowIndex: c.pairRowIndex } : empty({ aIndex: slot, pairRowIndex: null }));
    }

    return { linesA, linesB, linesC, diffAB, diffAC };
  }

  function getDiffOps(a, b) {
    const n = a.length;
    const m = b.length;
    const max = n + m;
    const offset = max + 1;
    let frontier = new Int32Array(2 * max + 3);
    frontier.fill(-1);
    frontier[offset + 1] = 0;
    const trace = [];

    for (let distance = 0; distance <= max; distance++) {
      for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
        const index = offset + diagonal;
        let x;
        if (diagonal === -distance || (diagonal !== distance && frontier[index - 1] < frontier[index + 1])) {
          x = frontier[index + 1];
        } else {
          x = frontier[index - 1] + 1;
        }
        let y = x - diagonal;
        while (x < n && y < m && a[x] === b[y]) { x++; y++; }
        frontier[index] = x;
        if (x >= n && y >= m) {
          trace.push(new Int32Array(frontier));
          return backtrackMyers(trace, a, b, offset);
        }
      }
      trace.push(new Int32Array(frontier));
    }
    return [];
  }

  function backtrackMyers(trace, a, b, offset) {
    let x = a.length;
    let y = b.length;
    const operations = [];

    for (let distance = trace.length - 1; distance > 0; distance--) {
      const previous = trace[distance - 1];
      const diagonal = x - y;
      const index = offset + diagonal;
      const previousDiagonal = diagonal === -distance ||
        (diagonal !== distance && previous[index - 1] < previous[index + 1])
        ? diagonal + 1 : diagonal - 1;
      const previousX = previous[offset + previousDiagonal];
      const previousY = previousX - previousDiagonal;

      while (x > previousX && y > previousY) {
        operations.push({ type: 'same', numA: x, numB: y, textA: a[x - 1], textB: b[y - 1] });
        x--; y--;
      }
      if (x === previousX) {
        operations.push({ type: 'add', numB: previousY + 1, textB: b[previousY] });
      } else {
        operations.push({ type: 'del', numA: previousX + 1, textA: a[previousX] });
      }
      x = previousX;
      y = previousY;
    }

    while (x > 0 && y > 0) {
      operations.push({ type: 'same', numA: x, numB: y, textA: a[x - 1], textB: b[y - 1] });
      x--; y--;
    }
    while (x > 0) { operations.push({ type: 'del', numA: x, textA: a[x - 1] }); x--; }
    while (y > 0) { operations.push({ type: 'add', numB: y, textB: b[y - 1] }); y--; }
    return operations.reverse();
  }

  /**
   * İki satır metin arasında kelime/token bazlı detaylı fark çıkarır
   */
  function computeWordDiff(text1, text2) {
    const tokens1 = (text1 || '').match(/\w+|\s+|[^\w\s]+/g) || [];
    const tokens2 = (text2 || '').match(/\w+|\s+|[^\w\s]+/g) || [];
    const res1 = [], res2 = [];
    for (const operation of getDiffOps(tokens1, tokens2)) {
      if (operation.type === 'same') {
        res1.push({ text: operation.textA, type: 'same' });
        res2.push({ text: operation.textB, type: 'same' });
      } else if (operation.type === 'del') {
        res1.push({ text: operation.textA, type: 'del' });
      } else {
        res2.push({ text: operation.textB, type: 'add' });
      }
    }
    return { wordsA: res1, wordsB: res2 };
  }

  return { computeLineDiff, computeThreeWayDiff, computeWordDiff, applyLineTransfer };
})();

if (typeof window !== 'undefined') window.DiffEngine = DiffEngine;
if (typeof module === 'object' && module.exports) module.exports = DiffEngine;
