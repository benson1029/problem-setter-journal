(() => {
  'use strict';
  const term = (sign, length, rhs = false) => ({ sign, length, rhs });
  function fromSides(positive, negative) {
    return [...positive.map(n => term(1, n)), ...negative.map((n, i) => term(-1, n, i === negative.length - 1))];
  }
  const PRESETS = {
    large: { label: 'The 104-slot puzzle', terms: fromSides([4, ...Array(16).fill(2), 1, 1, 2], [...Array(16).fill(2), ...Array(32).fill(1)]) },
    book: { label: 'Book example', terms: fromSides([1, 1, 2], [2, 1]) },
    powers: { label: 'Powers of nine', terms: fromSides([4], Array(100).fill(1)) },
    impossible: { label: 'Can this be solved?', terms: fromSides(Array(12).fill(1), [1]) },
  };
  const product = digits => digits.reduce((a, b) => a * BigInt(b), 1n);
  function totals(terms, digits) {
    return terms.reduce((sums, t, i) => { if (digits[i].every(d => d !== null)) sums[t.sign === 1 ? 'positive' : 'negative'] += product(digits[i]); return sums; }, { positive: 0n, negative: 0n });
  }
  function solve(terms) {
    if (!Array.isArray(terms) || !terms.length || terms.some(t => ![1, -1].includes(t.sign) || !Number.isInteger(t.length) || t.length < 1 || t.length > 12)) throw new Error('Invalid puzzle.');
    const positive = terms.filter(t => t.sign === 1).length;
    const negative = terms.length - positive;
    if (!positive || !negative) throw new Error('Both signs are required.');
    const majoritySign = positive >= negative ? 1 : -1;
    const majority = terms.map((t, i) => t.sign === majoritySign ? i : -1).filter(i => i >= 0);
    const minority = terms.map((t, i) => t.sign !== majoritySign ? i : -1).filter(i => i >= 0);
    const x = BigInt(majority.length), upper = 9n * x;
    const capacity = minority.reduce((sum, i) => sum + 9n ** BigInt(terms[i].length), 0n);
    let value = BigInt(minority.length);
    let digits = terms.map(t => Array(t.length).fill(null));
    const frames = [];
    const push = (stage, message, change = null) => frames.push({ stage, message, value, digits: digits.map(row => [...row]), change });
    push('group', 'Move the right-hand digit to the left. Group positive and negative terms.');
    digits = terms.map(t => t.sign === majoritySign ? [null, ...Array(t.length - 1).fill(1)] : Array(t.length).fill(1));
    push('seed', `Start the ${minority.length} minority terms at 1. Match a sum between ${x} and ${upper}.`);
    if (capacity < x) {
      for (const i of minority) digits[i].fill(9);
      value = capacity;
      push('impossible', `Even all 9s reach only ${capacity}. The other side needs at least ${x}.`);
      return { terms, majority, minority, majoritySign, x, upper, capacity, frames, possible: false };
    }
    for (const i of minority) {
      for (let j = 0; j < digits[i].length && value < x; j++) {
        const previous = value;
        const before = product(digits[i]);
        digits[i][j] = 9;
        value += 8n * before;
        push('jump', value >= x ? 'Inside the target interval. Stop raising the minority sum.' : 'Replace one 1 with 9. The total grows by at most a factor of nine.', { term: i, digit: j, previous });
      }
      if (value >= x) break;
    }
    push('cross', 'Now match this sum using one digit per majority term. Other factors stay at 1.');
    // A balanced distribution is as constructive as the book's greedy option,
    // and keeps repeated terms compact in the visual display.
    const base = value / x, extra = value % x;
    majority.forEach((i, j) => {
      digits[i][0] = Number(base + (BigInt(j) < extra ? 1n : 0n));
      push('fill', `Fill majority term ${j + 1} of ${majority.length}.`, { term: i, digit: 0 });
    });
    push('done', 'Balanced. Every slot is a digit from 1 to 9.');
    return { terms, majority, minority, majoritySign, x, upper, capacity, frames, possible: true };
  }
  const model = { PRESETS, fromSides, solve, totals, product };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  if (typeof window !== 'undefined') window.DigitPuzzleModel = model;
})();
