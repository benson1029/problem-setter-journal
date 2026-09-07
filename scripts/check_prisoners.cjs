const assert = require('node:assert/strict');
const { effective, cycles, swapLabels, parsePermutation } = require('../widgets/prisoners.js');
const book = [5, 4, 6, 8, 7, 3, 1, 2], labels = book.map((_, i) => i);
assert.deepEqual(cycles(book), [[1, 5, 7], [2, 4, 8], [3, 6]]);
assert.deepEqual(parsePermutation('5,4 6 8 7 3 1 2'), book);
for (const text of ['', '1', '1,1', '1,3', '1,a', '0,1', '1.0,2', '-1,2']) assert.equal(parsePermutation(text), null);
for (let a = 1; a <= 8; a++) for (let b = 1; b <= 8; b++) {
  const changed = swapLabels(labels, a, b), permutation = effective(book, changed);
  assert.deepEqual(effective(book, swapLabels(changed, a, b)), book);
  assert.deepEqual(book, [5, 4, 6, 8, 7, 3, 1, 2], 'physical contents never move');
  if (a !== b) {
    const together = cycles(book).some(cycle => cycle.includes(a) && cycle.includes(b));
    assert.equal(cycles(permutation).length, cycles(book).length + (together ? 1 : -1));
  }
}
// Three announcements split a 100-cycle into four 25-cycles.
const full = Array.from({ length: 100 }, (_, i) => (i + 1) % 100 + 1);
let fullLabels = full.map((_, i) => i);
for (const [a, b] of [[25, 100], [50, 100], [75, 100]]) fullLabels = swapLabels(fullLabels, a, b);
assert.deepEqual(cycles(effective(full, fullLabels)).map(cycle => cycle.length), [25, 25, 25, 25]);
console.log('Prisoners’ Gamble model checks passed.');
