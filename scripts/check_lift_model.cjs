const assert = require('node:assert/strict');
const M = require('../widgets/lift-model.js');
function* permutations(a) {
  if (!a.length) { yield []; return; }
  for (let i = 0; i < a.length; i++) for (const rest of permutations(a.filter((_, j) => j !== i))) yield [a[i], ...rest];
}
let cases = 0;
for (const n of [3, 4, 5]) {
  const order = Array.from({ length: n }, (_, i) => i + 1);
  for (const target of permutations(order)) for (let floor = 1; floor <= 10 * n; floor++) {
    if (floor % 10 === 5) continue;
    for (const strategy of ['selection', 'swaps']) {
      const initial = { order, floor }, steps = M.plan(initial, target, strategy);
      assert(steps.length <= (strategy === 'selection' ? 3 : 4) * n);
      let state = initial;
      for (const step of steps) {
        assert.deepEqual(step.before, state);
        assert.deepEqual(M.ride(state, step.destination).after, step.after);
        assert.deepEqual([...step.after.order].sort((a, b) => a - b), order);
        state = step.after;
      }
      assert.deepEqual(state.order, target, `${n},${floor},${strategy},${target}`);
      cases++;
    }
  }
}
assert.equal(M.nearest({ order: [1, 2, 3], floor: 10 }), 0);
assert.equal(M.nearest({ order: [1, 2, 3], floor: 20 }), 1);
assert.deepEqual(M.ride({ order: [1, 2, 3], floor: 10 }, 26).after, { order: [2, 3, 1], floor: 26 });
assert.deepEqual(M.ride({ order: [1, 2, 3], floor: 16 }, 4).after, { order: [2, 1, 3], floor: 4 });
assert.deepEqual(M.ride({ order: [3, 1, 2], floor: 20 }, 26).after, { order: [3, 2, 1], floor: 26 });
// Explicit book-example trace, independent of the plan generator.
let bookState = { order: [1, 2, 3, 4, 5], floor: 27 };
bookState = M.ride(bookState, 44).after;
assert.deepEqual(bookState, { order: [1, 2, 4, 3, 5], floor: 44 });
bookState = M.ride(bookState, 24).after;
assert.deepEqual(bookState, { order: [1, 2, 5, 4, 3], floor: 24 });
assert.throws(() => M.ride({ order: [1, 2, 3], floor: 1 }, 15));
assert.throws(() => M.validate([1, 2, 2], 1));
// Non-identity states and larger buildings: deterministic shuffles.
for (let n = 6; n <= 8; n++) for (let k = 1; k <= 40; k++) {
  const order = Array.from({ length: n }, (_, i) => i + 1);
  const target = [...order];
  for (let i = n - 1; i; i--) { const j = (k * 17 + i * 7) % (i + 1); [order[i], order[j]] = [order[j], order[i]]; [target[i], target[(j + 1) % (i + 1)]] = [target[(j + 1) % (i + 1)], target[i]]; }
  for (const strategy of ['selection', 'swaps']) {
    const steps = M.plan({ order, floor: 10 * n - 1 }, target, strategy);
    assert.deepEqual(steps.at(-1)?.after.order || order, target);
    assert(steps.length <= (strategy === 'selection' ? 3 : 4) * n);
  }
}
console.log(`Lift model: ${cases} exhaustive constructions, larger shuffled states, nearest-floor ties and validation passed.`);
