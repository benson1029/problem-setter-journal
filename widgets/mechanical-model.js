// Shared by the browser widget and the rule checks. Grid values are row-major.
(function (root) {
  function rotate(grid, columns, bounds) {
    const { r0, r1, c0, c1 } = bounds;
    const rows = grid.length / columns;
    if (![r0, r1, c0, c1].every(Number.isInteger) || r0 < 0 || c0 < 0 ||
        r1 >= rows || c1 >= columns || r0 > r1 || c0 > c1) throw new Error('Invalid selection');
    const height = r1 - r0 + 1, width = c1 - c0 + 1;
    const result = grid.slice();
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) {
      const nr = width === height ? c : height - 1 - r;
      const nc = width === height ? height - 1 - r : width - 1 - c;
      result[(r0 + nr) * columns + c0 + nc] = grid[(r0 + r) * columns + c0 + c];
    }
    return result;
  }
  function sorted(grid, columns) {
    return grid.every((value, i) =>
      (i % columns === 0 || grid[i - 1] < value) && (i < columns || grid[i - columns] < value));
  }
  function bounds(a, b, columns) {
    return { r0: Math.min(Math.floor(a / columns), Math.floor(b / columns)),
      r1: Math.max(Math.floor(a / columns), Math.floor(b / columns)),
      c0: Math.min(a % columns, b % columns), c1: Math.max(a % columns, b % columns) };
  }
  const model = { rotate, sorted, bounds };
  if (typeof module !== 'undefined') module.exports = model;
  else root.MechanicalGridModel = model;
})(globalThis);
