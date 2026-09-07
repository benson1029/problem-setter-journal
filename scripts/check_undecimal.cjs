const assert = require('node:assert/strict');
const model = require('../widgets/undecimal.js');
assert.deepEqual(model.range('510'), { min: 65n, max: 616n });
assert.deepEqual(model.range('1010'), { min: 120n, max: 1342n });
assert.equal(model.value(model.digits('1010', new Set([0]))), 1221n);
assert.equal(model.value(model.digits('1010', new Set([2]))), 131n);
assert.equal(model.relation('81056', '80823'), '?');
assert.equal(model.relation('1010', '55'), '>');
assert.equal(model.relation('55', '1010'), '<');
assert.equal(model.relation('0', '000'), '?');
assert.equal(model.valid('1'.repeat(24)), true);
assert.equal(model.valid('1'.repeat(25)), false);
for (const bad of ['', 'A', '1.0', '-10', '1 0']) assert.equal(model.valid(bad), false);
// Independently enumerate every legal parse, including leading-zero strings.
function parses(text) {
  if (!text.length) return [[]];
  const result = parses(text.slice(1)).map(tail => [Number(text[0]), ...tail]);
  if (text.startsWith('10')) result.push(...parses(text.slice(2)).map(tail => [10, ...tail]));
  return result;
}
let checked = 0;
function check(text, depth) {
  if (text) {
    const all = parses(text).map(model.value);
    assert.deepEqual(model.range(text), { min: all.reduce((a, b) => a < b ? a : b), max: all.reduce((a, b) => a > b ? a : b) });
    assert.equal(model.positions(text).length ? 2 ** model.positions(text).length : 1, all.length);
    checked++;
  }
  if (depth) for (const digit of '019') check(text + digit, depth - 1);
}
check('', 7);
assert.ok(model.range('9'.repeat(24)).max > BigInt(Number.MAX_SAFE_INTEGER));
console.log(`Undecimal checks passed: examples, exact arithmetic, validation, and ${checked} exhaustive strings.`);
