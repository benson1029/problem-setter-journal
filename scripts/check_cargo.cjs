const assert = require('node:assert/strict');
const { create, step, BOOK } = require('../widgets/cargo.js');
function reference(input) {
  const stacks = [[], ...input.map(stack => [...stack]), []], moves = [];
  for (let pass = 1; pass <= input.length; pass++) {
    for (let from = 1; from <= input.length; from++) {
      while (stacks[from].length) {
        const colour = stacks[from].pop(), to = from + (colour === 'R' ? -1 : 1);
        stacks[to].push(colour); moves.push({ number: moves.length + 1, pass, from, to, colour });
      }
    }
  }
  return { stacks, moves };
}
function verify(input) {
  const expected = reference(input); let state = create(input), limit = 145;
  const untouched = JSON.stringify(state);
  step(state); assert.equal(JSON.stringify(state), untouched, 'step does not mutate source');
  while (!state.done && --limit) state = step(state).state;
  assert.ok(state.done, 'bounded termination');
  assert.deepEqual(state.stacks, expected.stacks); assert.deepEqual(state.moves, expected.moves);
  assert.ok(state.stacks[0].every(colour => colour === 'R'));
  assert.ok(state.stacks.at(-1).every(colour => colour === 'B'));
  assert.ok(state.stacks.slice(1, -1).every(stack => !stack.length));
  const expectedCount = input.reduce((sum, stack, index) => sum + [...stack].reduce((s, c) => s + (c === 'R' ? index + 1 : input.length - index), 0), 0);
  assert.equal(state.moves.length, expectedCount);
  return state;
}
const book = verify(BOOK);
assert.equal(book.moves.filter(move => move.pass === 1).length, 27);
assert.equal(book.moves.length, 39);
assert.equal(book.moves[0].colour, 'B'); assert.equal(book.moves[0].from, 1); assert.equal(book.moves[0].to, 2);
const options = ['', 'R', 'B', 'RR', 'RB', 'BR', 'BB'];
let checked = 0;
for (const a of options) for (const b of options) for (const c of options) for (const d of options) { verify([a, b, c, d]); checked++; }
verify(['R'.repeat(12), 'B'.repeat(12)]);
assert.throws(() => create(['X', 'R']));
assert.throws(() => create(['R'.repeat(25), '']));
console.log(`Cargo model: book example and ${checked} exhaustive four-slot configurations passed.`);
