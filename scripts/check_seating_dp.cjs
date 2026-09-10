const assert = require('node:assert/strict');
const M = require('../widgets/seating-dp-model.js');

// Independent oracle: enumerate legal next seats by their nearest occupied
// neighbor, without using interval splitting or either DP recurrence.
function oracle(n, first) {
  const seen = Array.from({ length: n }, () => new Set());
  let histogram;
  function visit(history, distances) {
    if (history.length === n) {
      distances.forEach((d, seat) => seen[seat].add(d));
      const sorted = [...distances].sort((a, b) => b - a);
      if (histogram) assert.deepEqual(sorted, histogram, 'The distance multiset is invariant');
      else histogram = sorted;
      return;
    }
    const choices = Array.from({ length: n }, (_, i) => i).filter(i => !history.includes(i));
    const distance = seat => Math.min(...history.map(other => Math.abs(seat - other)));
    const best = Math.max(...choices.map(distance));
    for (const seat of choices.filter(seat => distance(seat) === best)) {
      const next = distances.slice(); next[seat] = best; visit([...history, seat], next);
    }
  }
  const distances = Array(n); distances[first] = Infinity; visit([first], distances);
  return { seen, histogram };
}
for (let n = 1; n <= 8; n++) for (let first = 0; first < n; first++) {
  const expected = oracle(n, first);
  for (const memo of [false, true]) {
    const actual = M.distanceTrace(n, first, memo);
    assert.deepEqual(actual.histogram.flatMap(([d, count]) => Array(count).fill(d)), expected.histogram);
    for (let x = 1; x <= n; x++) assert.equal(M.kth(actual.histogram, x), expected.histogram[x - 1]);
    const collected = new Map();
    for (const event of actual.events) for (const [d, count] of event.values || []) collected.set(d, (collected.get(d) || 0) + count);
    assert.deepEqual([...collected].sort((a, b) => b[0] - a[0]), actual.histogram, 'Animation counts every contribution once');
    for (let y = 0; y < n; y++) for (const k of [...new Set(expected.histogram), 99]) {
      assert.equal(M.queryTrace(n, first, y, k, memo).result, expected.seen[y].has(k), `N=${n}, first=${first}, Y=${y}, K=${k}, memo=${memo}`);
    }
  }
}
for (const n of [64, 200, 256, 512]) {
  const full = M.distanceTrace(n, 0, false), memo = M.distanceTrace(n, 0, true);
  assert.deepEqual(memo.histogram, full.histogram);
  assert(memo.nodes.length < full.nodes.length / 2);
  const y = Math.floor(n / 3), k = M.kth(full.histogram, Math.floor(n / 2));
  const query = M.queryTrace(n, 0, y, k, true), expanded = M.queryTrace(n, 0, y, k, false);
  assert.equal(query.result, expanded.result);
  assert(query.nodes.some(node => node.reuse !== undefined));
  for (const node of query.nodes) assert(node.l <= y && y <= node.r, 'Every explored interval contains Y');
}
console.log('Seating DP: exhaustive N=1–8 agrees for histograms and target queries; animation contributions, memoization and rooms through 512 seats passed.');
