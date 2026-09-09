(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.FaultlineModel = model;
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  const key = p => `${p.row},${p.col}`;
  const valid = (p, n) => Number.isInteger(p.row) && Number.isInteger(p.col) && p.row >= 1 && p.row <= n && p.col >= 1 && p.col <= p.row;
  const same = (a, b) => a.row === b.row && a.col === b.col;
  function vertices(n) {
    const result = [];
    for (let row = 1; row <= n; row++) for (let col = 1; col <= row; col++) result.push({ row, col });
    return result;
  }
  function neighbors(p, n) {
    return [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, 0], [1, 1]]
      .map(([dr, dc]) => ({ row: p.row + dr, col: p.col + dc })).filter(q => valid(q, n));
  }
  function distance(a, b) {
    const dq = (a.col - 1) - (b.col - 1);
    const dr = (a.row - a.col) - (b.row - b.col);
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
  }
  function edgeType(a, b) {
    if (a.row === b.row && Math.abs(a.col - b.col) === 1) return 'horizontal';
    if (Math.abs(a.row - b.row) !== 1) return null;
    if (a.col === b.col) return 'left';
    if (a.row - b.row === a.col - b.col) return 'right';
    return null;
  }
  function shortestPath(a, b, n) {
    if (!valid(a, n) || !valid(b, n)) throw new Error('Vertex outside triangle.');
    const result = [{ ...a }]; let current = { ...a };
    while (!same(current, b)) {
      const remaining = distance(current, b);
      const next = neighbors(current, n).filter(p => distance(p, b) === remaining - 1)
        .sort((u, v) => ['left', 'right', 'horizontal'].indexOf(edgeType(current, u)) - ['left', 'right', 'horizontal'].indexOf(edgeType(current, v)))[0];
      if (!next) throw new Error('No shortest continuation.');
      result.push(next); current = next;
    }
    return result;
  }
  function pathInfo(path) {
    const families = new Set(); let legal = path.length > 0;
    for (let i = 1; i < path.length; i++) { const type = edgeType(path[i - 1], path[i]); if (!type) legal = false; else families.add(type); }
    const direct = path.length > 1 ? distance(path[0], path.at(-1)) : 0;
    return { legal, families: [...families], moves: Math.max(0, path.length - 1), direct, shortest: legal && path.length - 1 === direct };
  }
  function rotate(p, n, turns = 1) {
    let a = n - p.row, b = p.col - 1, c = p.row - p.col;
    for (let i = 0; i < ((turns % 3) + 3) % 3; i++) [a, b, c] = [c, a, b];
    return { row: n - a, col: b + 1 };
  }
  function ring(center, d, n) { return vertices(n).filter(p => distance(center, p) === d); }
  function interior(center, d, n) { return vertices(n).filter(p => distance(center, p) < d); }
  function reading(path, sensor) { return Math.min(...path.map(point => distance(point, sensor))); }
  function corners(sensor, n) {
    return [{ row: sensor.row, col: sensor.col - sensor.d }, { row: sensor.row, col: sensor.col + sensor.d }]
      .filter(p => valid(p, n)).filter((p, i, list) => list.findIndex(q => same(p, q)) === i);
  }
  function randomSensorPath(sensor, n, random = Math.random) {
    if (!Number.isInteger(n) || n < 1 || n > 30 || !valid(sensor, n) || !Number.isInteger(sensor.d) || sensor.d < 0) {
      throw new Error('Invalid sensor or grid size.');
    }
    // Count downward continuations using only the hexagon constraint, not
    // the corner observation the reader is meant to discover. Weighting each
    // branch by its count samples uniformly from all valid complete paths.
    const memo = new Map();
    function count(point, touched) {
      const d = distance(point, sensor);
      if (d < sensor.d) return 0;
      touched ||= d === sensor.d;
      if (point.row === n) return Number(touched);
      const id = `${key(point)}:${touched}`;
      if (!memo.has(id)) memo.set(id,
        count({ row: point.row + 1, col: point.col }, touched) +
        count({ row: point.row + 1, col: point.col + 1 }, touched));
      return memo.get(id);
    }
    let current = { row: 1, col: 1 }, touched = false;
    if (!count(current, touched)) return [];
    const path = [current];
    while (current.row < n) {
      touched ||= distance(current, sensor) === sensor.d;
      const left = { row: current.row + 1, col: current.col };
      const right = { row: current.row + 1, col: current.col + 1 };
      const leftCount = count(left, touched), rightCount = count(right, touched);
      current = random() * (leftCount + rightCount) < leftCount ? left : right;
      path.push(current);
    }
    return path;
  }
  const canConnect = (a, b) => a.row <= b.row && b.col - a.col >= 0 && b.col - a.col <= b.row - a.row;
  function solveCorners(sensors, n, blocked = new Set()) {
    const ordered = [...sensors].sort((a, b) => a.row - b.row);
    const layers = ordered.map((sensor, layer) => ({ sensor, options: corners(sensor, n).map(point => ({ point, blocked: blocked.has(key(point)), reachable: false, parent: null, layer })) }));
    layers.forEach((entry, layer) => entry.options.forEach((option, index) => {
      if (option.blocked) return;
      if (layer === 0) { option.reachable = true; return; }
      const parent = layers[layer - 1].options.findIndex(previous => previous.reachable && !previous.blocked && canConnect(previous.point, option.point));
      if (parent >= 0) { option.reachable = true; option.parent = parent; }
    }));
    let optionIndex = layers.at(-1)?.options.findIndex(option => option.reachable) ?? -1;
    const chosen = [];
    if (optionIndex >= 0) for (let layer = layers.length - 1; layer >= 0; layer--) {
      const option = layers[layer].options[optionIndex]; chosen.unshift(option.point); optionIndex = option.parent;
    }
    const path = [];
    chosen.forEach((point, i) => {
      const part = i ? shortestPath(chosen[i - 1], point, n).slice(1) : [point]; path.push(...part);
    });
    return { layers, chosen, path, possible: chosen.length === layers.length };
  }
  return { key, valid, same, vertices, neighbors, distance, edgeType, shortestPath, pathInfo, rotate, ring, interior, reading, corners, randomSensorPath, canConnect, solveCorners };
});
