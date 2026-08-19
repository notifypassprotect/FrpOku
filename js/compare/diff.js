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
        linesA.push({ num: ops[i].numA, text: ops[i].textA, type: 'same' });
        linesB.push({ num: ops[i].numB, text: ops[i].textB, type: 'same' });
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
            linesA.push({ num: d.numA, text: d.textA, type: 'del', pairedText: aItem.textB });
            linesB.push({ num: aItem.numB, text: aItem.textB, type: 'add', pairedText: d.textA });
          } else if (d) {
            linesA.push({ num: d.numA, text: d.textA, type: 'del' });
            linesB.push({ num: null, text: '', type: 'empty' });
          } else if (aItem) {
            linesA.push({ num: null, text: '', type: 'empty' });
            linesB.push({ num: aItem.numB, text: aItem.textB, type: 'add' });
          }
        }
      }
    }

    return { linesA, linesB };
  }

  function getDiffOps(a, b) {
    const m = a.length;
    const n = b.length;

    // LCS Dinamik Programlama Tablosu
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (a[i] === b[j]) {
          dp[i + 1][j + 1] = dp[i][j] + 1;
        } else {
          dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    let i = m, j = n;
    const rawOps = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
        rawOps.push({ type: 'same', numA: i, numB: j, textA: a[i - 1], textB: b[j - 1] });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        rawOps.push({ type: 'add', numB: j, textB: b[j - 1] });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        rawOps.push({ type: 'del', numA: i, textA: a[i - 1] });
        i--;
      }
    }

    return rawOps.reverse();
  }

  /**
   * İki satır metin arasında kelime/token bazlı detaylı fark çıkarır
   */
  function computeWordDiff(text1, text2) {
    const tokens1 = (text1 || '').match(/\w+|\s+|[^\w\s]+/g) || [];
    const tokens2 = (text2 || '').match(/\w+|\s+|[^\w\s]+/g) || [];

    const m = tokens1.length, n = tokens2.length;
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));

    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        if (tokens1[i] === tokens2[j]) dp[i + 1][j + 1] = dp[i][j] + 1;
        else dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    let i = m, j = n;
    const res1 = [], res2 = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && tokens1[i - 1] === tokens2[j - 1]) {
        res1.push({ text: tokens1[i - 1], type: 'same' });
        res2.push({ text: tokens2[j - 1], type: 'same' });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        res2.push({ text: tokens2[j - 1], type: 'add' });
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        res1.push({ text: tokens1[i - 1], type: 'del' });
        i--;
      }
    }

    return { wordsA: res1.reverse(), wordsB: res2.reverse() };
  }

  return { computeLineDiff, computeWordDiff };
})();

window.DiffEngine = DiffEngine;

