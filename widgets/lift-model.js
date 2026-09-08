/* Pure lift mechanics: floors and permutations are ordered bottom to top. */
(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.LiftModel = model;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  const waitingFloor = index => 10 * index + 5;
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  function validate(order, floor) {
    const n = order.length;
    if (!Number.isInteger(n) || n < 3 || n > 8 || new Set(order).size !== n || order.some(v => !Number.isInteger(v) || v < 1 || v > n)) throw new Error('Use each lift number once, with 3–8 lifts.');
    if (!Number.isInteger(floor) || floor < 1 || floor > 10 * n || floor % 10 === 5) throw new Error(`Choose a whole floor from 1 to ${10 * n}, excluding waiting floors (5, 15, …).`);
  }
  function nearest(state) {
    let index = 0;
    for (let i = 1; i < state.order.length; i++) {
      if (Math.abs(waitingFloor(i) - state.floor) < Math.abs(waitingFloor(index) - state.floor)) index = i;
    }
    return index; // Strict comparison deliberately breaks ties towards the lower floor.
  }
  function ride(state, destination) {
    validate(state.order, state.floor); validate(state.order, destination);
    const index = nearest(state), lift = state.order[index];
    const positions = state.order.map((id, i) => ({ id, floor: i === index ? destination : waitingFloor(i) }));
    positions.sort((a, b) => a.floor - b.floor);
    return { before: { order: [...state.order], floor: state.floor }, after: { order: positions.map(p => p.id), floor: destination }, lift, from: waitingFloor(index), destination };
  }
  function plan(initial, target, strategy = 'selection') {
    validate(initial.order, initial.floor); validate(target, initial.floor);
    if (target.length !== initial.order.length) throw new Error('The target must contain the same lifts.');
    if (!['selection', 'swaps'].includes(strategy)) throw new Error('Unknown strategy.');
    let state = { order: [...initial.order], floor: initial.floor };
    const steps = [], n = target.length;
    function add(destination, note, fixed) {
      if (same(state.order, target)) return;
      // If Leo is already at this setup floor, no ride is needed.
      if (destination === state.floor) return;
      const step = ride(state, destination); steps.push({ ...step, note, fixed }); state = step.after;
    }
    if (strategy === 'selection') {
      add(1, 'Start at the bottom of the building.', 0);
      for (let i = 0; i < n - 1 && !same(state.order, target); i++) {
        const b = waitingFloor(i), j = state.order.indexOf(target[i]), a = waitingFloor(j);
        if (j !== i) {
          add(a - 1, `Go and collect lift ${target[i]}.`, i);
          add(b - 1, `Place lift ${target[i]} in waiting position ${i + 1}.`, i);
        }
        add(b + 9, 'Move Leo up to the next unfinished position.', i + 1);
      }
    } else {
      for (let i = 0; i < n - 1 && !same(state.order, target); i++) {
        const j = state.order.indexOf(target[i]);
        if (j === i) continue;
        const c = nearest(state), a = waitingFloor(i), b = waitingFloor(j), f = waitingFloor(c);
        const destinations = c === i ? [b - 1, a - 1] : c === j ? [a + 1, b + 1] : c > j ? [a + 1, b + 9, a + 1, f + 1] : c < i ? [a - 1, b - 1, a - 9, f - 1] : [a + 1, b - 1, a + 1, f + 1];
        const label = `Swap lifts ${state.order[i]} and ${state.order[j]}`;
        destinations.forEach((floor, k) => add(floor, `${label} · ride ${k + 1}/${destinations.length}.`, i));
      }
    }
    if (!same(state.order, target)) throw new Error('The construction did not reach its target.');
    return steps;
  }
  const PRESETS = [
    { label: 'Book example 1', floor: 27, target: [1, 2, 5, 4, 3] },
    { label: 'Book example 2', floor: 27, target: [5, 2, 3, 4, 1] },
    { label: 'Book example 3', floor: 4, target: [1, 2, 5, 4, 3] },
    { label: 'Eight-lift shuffle', floor: 37, target: [6, 3, 8, 1, 7, 4, 2, 5] }
  ];
  return { waitingFloor, same, validate, nearest, ride, plan, PRESETS };
});
