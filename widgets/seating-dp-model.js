// The two recurrences in Introvert Seating, pp. 82–83. Source seats are 0-based.
(function (scope) {
  'use strict';
  const add = (into, values) => { for (const [d, count] of values) into.set(d, (into.get(d) || 0) + count); return into; };
  const sorted = map => [...map].sort((a, b) => b[0] - a[0]);
  const centers = (l, r) => [...new Set([Math.floor((l + r) / 2), Math.ceil((l + r) / 2)])];
  function validate(n, first) {
    if (!Number.isInteger(n) || n < 1 || n > 512 || !Number.isInteger(first) || first < 0 || first >= n) throw new Error('Use 1–512 seats and a first seat between 0 and N−1.');
  }
  function distanceTrace(n, first, memoize = true) {
    validate(n, first);
    const nodes = [], events = [], cache = new Map(), distances = Array(n);
    function visit(l, r, parent, depth) {
      const length = r - l + 1, id = nodes.length;
      const node = { id, l, r, length, parent, depth, key: String(length), children: [], center: Math.floor((l + r) / 2) };
      nodes.push(node); nodes[parent].children.push(id); events.push({ type: 'enter', id });
      if (memoize && cache.has(length)) {
        const saved = cache.get(length); node.reuse = saved.id; node.result = saved.result;
        events.push({ type: 'reuse', id, values: node.result }); return node.result;
      }
      const d = Math.ceil(length / 2), counts = new Map([[d, 1]]);
      events.push({ type: 'add', id, values: [[d, 1]] });
      const middle = node.center;
      if (l < middle) add(counts, visit(l, middle - 1, id, depth + 1));
      if (middle < r) add(counts, visit(middle + 1, r, id, depth + 1));
      node.result = sorted(counts); cache.set(length, node);
      events.push({ type: 'return', id }); return node.result;
    }
    nodes.push({ id: 0, l: 0, r: n - 1, parent: null, depth: 0, key: 'room', children: [], center: first });
    events.push({ type: 'enter', id: 0 });
    const initial = new Map([[Infinity, 1]]);
    if (first > 0) add(initial, [[first, 1]]);
    if (first < n - 1) add(initial, [[n - 1 - first, 1]]);
    events.push({ type: 'add', id: 0, values: sorted(initial) });
    const counts = new Map(initial);
    if (first > 1) add(counts, visit(1, first - 1, 0, 1));
    if (first < n - 2) add(counts, visit(first + 1, n - 2, 0, 1));
    nodes[0].result = sorted(counts); events.push({ type: 'return', id: 0 });
    // One canonical seat-to-distance mapping for inspection, independent of
    // memoized histogram calls. Tied centers can change this mapping, not counts.
    distances[first] = Infinity;
    if (first > 0) distances[0] = first;
    if (first < n - 1) distances[n - 1] = n - 1 - first;
    function fill(l, r) { if (l > r) return; const m = Math.floor((l + r) / 2); distances[m] = Math.ceil((r - l + 1) / 2); fill(l, m - 1); fill(m + 1, r); }
    fill(1, first - 1); fill(first + 1, n - 2);
    return { nodes, events, histogram: sorted(counts), distances, result: sorted(counts) };
  }
  function kth(histogram, x) {
    for (const [d, count] of histogram) { if (x <= count) return d; x -= count; }
    throw new Error('Arrival X is outside the room.');
  }
  function queryTrace(n, first, y, k, memoize = true) {
    validate(n, first);
    if (!Number.isInteger(y) || y < 0 || y >= n) throw new Error('Target Y must be a seat between 0 and N−1.');
    const nodes = [], events = [], cache = new Map();
    function visit(l, r, parent, depth, via) {
      const id = nodes.length, key = `${l},${r},${k}`;
      const node = { id, l, r, parent, depth, key, via, children: [], centers: centers(l, r), distance: Math.ceil((r - l + 1) / 2) };
      nodes.push(node); nodes[parent].children.push(id); events.push({ type: 'enter', id });
      if (memoize && cache.has(key)) {
        const saved = cache.get(key); node.reuse = saved.id; node.result = saved.result;
        events.push({ type: 'reuse', id }); return node.result;
      }
      let possible = false; node.choices = [];
      // Explore both centers even after finding a witness: this exposes the
      // repeated subproblems rather than hiding them behind OR short-circuiting.
      for (const middle of node.centers) {
        if (middle === y) {
          const result = node.distance === k; possible ||= result;
          node.choices.push({ middle, result }); events.push({ type: 'test', id, middle, result });
        } else {
          events.push({ type: 'branch', id, middle });
          const result = y < middle ? visit(l, middle - 1, id, depth + 1, middle) : visit(middle + 1, r, id, depth + 1, middle);
          possible ||= result; node.choices.push({ middle, result });
        }
      }
      node.result = possible; cache.set(key, node); events.push({ type: 'return', id }); return possible;
    }
    const root = { id: 0, l: 0, r: n - 1, parent: null, depth: 0, children: [], key: 'room', center: first };
    nodes.push(root); events.push({ type: 'enter', id: 0 });
    if (y === first || y === 0 || y === n - 1) {
      root.distance = y === first ? Infinity : Math.abs(y - first);
      root.result = root.distance === k; events.push({ type: 'test', id: 0, middle: y, result: root.result });
    } else root.result = y < first ? visit(1, first - 1, 0, 1, first) : visit(first + 1, n - 2, 0, 1, first);
    events.push({ type: 'return', id: 0 });
    return { nodes, events, result: root.result, k, y };
  }
  const api = { distanceTrace, queryTrace, kth };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.SeatingDP = api;
})(typeof window === 'undefined' ? globalThis : window);
