const assert = require('node:assert/strict');
const M = require('../widgets/digit-model.js');
function verify(terms) {
  const plan = M.solve(terms);
  let previous;
  for (const frame of plan.frames) {
    frame.digits.flat().forEach(d => assert(d === null || Number.isInteger(d) && d >= 1 && d <= 9));
    if (frame.stage === 'jump') {
      assert(frame.value > previous.value && frame.value <= 9n * previous.value, 'Jump must be at most a factor of nine');
      const changed = frame.digits.flat().filter((d, i) => d !== previous.digits.flat()[i]);
      assert.deepEqual(changed, [9], 'Each jump must change exactly one digit');
    }
    if (['cross', 'fill', 'done'].includes(frame.stage)) assert(frame.value >= plan.x && frame.value <= plan.upper);
    previous = frame;
  }
  const final = plan.frames.at(-1);
  if (plan.possible) {
    assert(final.digits.flat().every(d => d !== null));
    const sums = M.totals(terms, final.digits);
    assert.equal(sums.positive, sums.negative);
  } else assert(plan.capacity < plan.x);
  return plan;
}
Object.values(M.PRESETS).forEach(p => verify(p.terms));
assert.equal(M.PRESETS.large.terms.reduce((n, t) => n + t.length, 0), 104);
assert.deepEqual(M.solve(M.PRESETS.powers.terms).frames.filter(f => ['seed', 'jump'].includes(f.stage)).map(f => f.value), [1n, 9n, 81n, 729n]);
for (let p = 1; p <= 8; p++) for (let n = 1; n <= 8; n++) for (let a = 1; a <= 3; a++) for (let b = 1; b <= 3; b++) verify(M.fromSides(Array(p).fill(a), [...Array(n - 1).fill(b), 1]));
// Independently enumerate digit assignments for every +/-/* pattern with five
// slots (last slot is the RHS). This also checks multiplication precedence.
let checked = 0;
for (let pattern = 0; pattern < 27; pattern++) {
  let code = pattern, sign = 1, length = 1, terms = [];
  for (let i = 0; i < 3; i++) {
    const op = code % 3; code = Math.floor(code / 3);
    if (op === 2) length++;
    else { terms.push({ sign, length }); sign = op === 0 ? 1 : -1; length = 1; }
  }
  terms.push({ sign, length }, { sign: -1, length: 1, rhs: true });
  function termValues(length) {
    let values = new Set([1]);
    for (let i = 0; i < length; i++) values = new Set([...values].flatMap(v => Array.from({ length: 9 }, (_, d) => v * (d + 1))));
    return values;
  }
  let sums = new Set([0]);
  for (const t of terms) sums = new Set([...sums].flatMap(s => [...termValues(t.length)].map(v => s + t.sign * v)));
  assert.equal(verify(terms).possible, sums.has(0)); checked++;
}
console.log(`Digit Puzzle: presets, 576 generated puzzles, and ${checked} independently enumerated operator patterns passed.`);
