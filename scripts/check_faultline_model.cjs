const assert = require('node:assert/strict');
const M = require('../widgets/faultline-model.js');

for (let n = 2; n <= 8; n++) {
  const points = M.vertices(n);
  for (const a of points) for (const b of points) {
    // Independent BFS distance check.
    const queue = [a], seen = new Map([[M.key(a), 0]]);
    while (queue.length) {
      const p = queue.shift(), d = seen.get(M.key(p));
      for (const next of M.neighbors(p, n)) if (!seen.has(M.key(next))) { seen.set(M.key(next), d + 1); queue.push(next); }
    }
    assert.equal(M.distance(a, b), seen.get(M.key(b)));
    const path = M.shortestPath(a, b, n), info = M.pathInfo(path);
    assert(info.shortest); assert(info.families.length <= 2);
    assert(M.same(path[0], a)); assert(M.same(path.at(-1), b));
    assert.equal(M.distance(M.rotate(a, n), M.rotate(b, n)), M.distance(a, b));
    assert.deepEqual(M.rotate(a, n, 3), a);
  }
}
const center = { row: 6, col: 3 }, d = 3, n = 11;
const ring = M.ring(center, d, n), inside = M.interior(center, d, n);
assert(ring.length > 0 && inside.length > 0);
assert(ring.every(p => M.distance(center, p) === d));
assert(inside.every(p => M.distance(center, p) < d));
assert(ring.every(p => M.reading([p], center) === d));

const sensors = [
  { row: 1, col: 1, d: 0 }, { row: 3, col: 2, d: 1 },
  { row: 7, col: 3, d: 2 }, { row: 10, col: 5, d: 3 }, { row: 13, col: 10, d: 0 },
];
const solved = M.solveCorners(sensors, 13);
assert(solved.possible); assert.equal(solved.chosen.length, sensors.length);
assert(sensors.every(sensor => M.reading(solved.path, sensor) === sensor.d));
assert(M.pathInfo(solved.path).shortest);
assert(!M.solveCorners(sensors, 13, new Set(['7,5'])).possible);

// Independent enumeration: test editable cases, including same-row sensors,
// zero readings, out-of-grid corners, and incompatible readings.
let seed = 7183;
const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
for (let size = 3; size <= 7; size++) {
  const routes = [];
  function enumerate(route) {
    const last = route.at(-1);
    if (last.row === size) { routes.push(route); return; }
    for (const col of [last.col, last.col + 1]) enumerate([...route, { row: last.row + 1, col }]);
  }
  enumerate([{ row: 1, col: 1 }]);
  for (const route of routes) for (const sensor of M.vertices(size)) {
    const reading = M.reading(route, sensor);
    assert(M.corners({ ...sensor, d: reading }, size).some(corner => M.same(corner, route[sensor.row - 1])));
  }
  for (const route of routes) {
    const allReadings = M.vertices(size).map(sensor => ({...sensor,d:M.reading(route,sensor)}));
    const recovered = M.solveCorners(allReadings,size);
    assert(recovered.possible);
    assert(allReadings.every(s => M.reading(recovered.path,s) === s.d));
  }
  for (let i = 0; i < 250; i++) {
    const end = random(size) + 1;
    const extra = Array.from({ length: 1 + random(5) }, () => {
      const row = 2 + random(size - 2); return { row, col: 1 + random(row), d: random(size) };
    });
    const input = [{ row: 1, col: 1, d: 0 }, ...extra, { row: size, col: end, d: 0 }];
    const feasible = routes.some(route => input.every(s => M.reading(route,s) === s.d));
    const result = M.solveCorners(input,size);
    assert.equal(result.possible, feasible, JSON.stringify(input));
    if (result.possible) {
      assert(input.every(s => M.reading(result.path,s) === s.d));
      assert(M.pathInfo(result.path).shortest);
    }
  }
}
const discoverySensor = { row: 7, col: 4, d: 2 }, samples = new Set(), sides = new Set(), ends = new Set();
for (let i = 0; i < 1000; i++) {
  const route = M.randomSensorPath(discoverySensor, 11, () => random(1 << 24) / (1 << 24));
  assert.deepEqual(route[0], {row:1,col:1}); assert.equal(route.at(-1).row, 11);
  assert.equal(route.length, 11); assert(M.pathInfo(route).shortest);
  assert(route.every(p => M.valid(p,11) && M.distance(p,discoverySensor) >= 2));
  assert.equal(M.reading(route, discoverySensor), 2);
  sides.add(route[6].col); ends.add(route.at(-1).col); samples.add(route.map(M.key).join(';'));
}
assert.deepEqual([...sides].sort(), [2,6]); assert(ends.size > 4); assert(samples.size > 100);
assert.deepEqual(M.randomSensorPath({row:1,col:1,d:1},5), []);
assert.equal(M.reading(M.randomSensorPath({row:3,col:2,d:0},5),{row:3,col:2}),0);
console.log('Faultline model: BFS geometry, 1,250 brute-force DP cases, and 1,000 random discovery paths passed.');
