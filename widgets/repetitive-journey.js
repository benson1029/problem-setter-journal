(() => {
  'use strict';

  const DIRECTIONS = ['U', 'R', 'D', 'L'];
  const DELTAS = { U: [-1, 0], R: [0, 1], D: [1, 0], L: [0, -1] };
  const SYMBOLS = { U: '↑', R: '→', D: '↓', L: '←' };
  const BOOK_GRID = ['DULD', 'RRUR', 'LRRU'];
  const PRESETS = {
    book: { label: 'Book example · 3 × 4', grid: BOOK_GRID },
    cycle: { label: 'A repeating cycle · 2 × 2', grid: ['RD', 'UL'] },
    drift: { label: 'A drifting path · 2 × 3', grid: ['RUU', 'UUU'] },
  };

  const normalizeGrid = grid => grid.map(row => typeof row === 'string' ? [...row] : [...row]);
  const cloneGrid = grid => normalizeGrid(grid);
  const mod = (value, size) => ((value % size) + size) % size;
  function validGrid(grid) {
    const rows = normalizeGrid(grid);
    return Array.isArray(rows) && rows.length >= 1 && rows.length <= 4 &&
      rows.every(row => Array.isArray(row) && row.length >= 1 && row.length <= 4 && row.every(d => DIRECTIONS.includes(d))) &&
      rows.every(row => row.length === rows[0].length);
  }
  function trace(grid, maxSteps = grid.length * grid[0].length + 1) {
    if (!validGrid(grid)) throw new Error('Grid must be 1–4 by 1–4 and contain arrows.');
    grid = normalizeGrid(grid);
    const rows = grid.length, cols = grid[0].length, visits = [], seen = new Map();
    let r = 0, c = 0, classification = null, repeat = null;
    for (let step = 0; step <= Math.max(0, maxSteps); step++) {
      const gr = mod(r, rows), gc = mod(c, cols), key = `${gr},${gc}`;
      const visit = { step, row: r, col: c, gridRow: gr, gridCol: gc, arrow: grid[gr][gc] };
      visits.push(visit);
      if (seen.has(key)) {
        const first = seen.get(key);
        repeat = { first, second: visit, deltaRow: r - first.row, deltaCol: c - first.col };
        classification = repeat.deltaRow === 0 && repeat.deltaCol === 0 ? 'repeating' : 'infinite';
        break;
      }
      seen.set(key, visit);
      const [dr, dc] = DELTAS[visit.arrow]; r += dr; c += dc;
    }
    return { visits, classification, repeat, rows, cols };
  }
  function nextGrid(grid, row, col) {
    const result = cloneGrid(grid);
    result[row][col] = DIRECTIONS[(DIRECTIONS.indexOf(result[row][col]) + 1) % DIRECTIONS.length];
    return result;
  }
  const model = { BOOK_GRID, PRESETS, trace, nextGrid, mod };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  if (typeof window === 'undefined') return;

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };

  function mount(container) {
    const events = new AbortController();
    const listen = (target, type, callback, options) => target.addEventListener(type, callback, { signal: events.signal, ...options });
    let grid = cloneGrid(BOOK_GRID), initialGrid = cloneGrid(BOOK_GRID), runState = null;
    let playing = false, playTimer = null, disposed = false;
    const root = node('section', 'repetitive-widget');
    root.innerHTML = `
      <p class="rj-instructions">Click an arrow to rotate it, then play the path to see its fate.</p>
      <div class="rj-toolbar">
        <label class="rj-preset-label">Example <select data-rj-preset aria-label="Journey example"></select></label>
        <button type="button" data-rj-action="step">Step</button>
        <button type="button" data-rj-action="play">Play</button>
        <button type="button" data-rj-action="reset">Reset</button>
      </div>
      <div class="rj-layout">
        <div class="rj-editor-panel">
          <div class="rj-editor-heading"><span>Arrow grid</span><span class="rj-edit-hint">click to cycle</span></div>
          <div class="rj-editor" role="grid" aria-label="Editable arrow grid"></div>
          <details class="rj-custom"><summary>Custom grid</summary>
            <div class="rj-dimensions"><label>Rows <select data-rj-rows aria-label="Custom grid rows"><option>1</option><option>2</option><option selected>3</option><option>4</option></select></label><label>Columns <select data-rj-cols aria-label="Custom grid columns"><option>1</option><option>2</option><option>3</option><option selected>4</option></select></label></div>
            <button type="button" data-rj-action="new-grid">Make grid</button>
          </details>
        </div>
        <div class="rj-map-panel">
          <div class="rj-map-caption"><span>Infinite tiling</span><span class="rj-origin-key">origin tile</span></div>
          <div class="rj-map-scroll"><div class="rj-map-surface"><div class="rj-map-grid"></div><svg class="rj-path" aria-hidden="true" preserveAspectRatio="none"><polyline></polyline><g class="rj-path-dots"></g></svg><div class="rj-origin-box" aria-hidden="true"></div></div></div>
        </div>
      </div>
      <p class="rj-status" role="status" aria-live="polite"></p>
      <details class="rj-trace"><summary>Coordinates <span data-rj-trace-count></span></summary><div class="rj-trace-scroll"><ol data-rj-trace-list></ol></div></details>`;
    container.append(root);
    const presetSelect = root.querySelector('[data-rj-preset]');
    Object.entries(PRESETS).forEach(([value, preset]) => {
      const option = node('option', '', preset.label);
      option.value = value;
      presetSelect.append(option);
    });
    const editor = root.querySelector('.rj-editor'), mapGrid = root.querySelector('.rj-map-grid');
    const mapSurface = root.querySelector('.rj-map-surface'), path = root.querySelector('.rj-path'), polyline = path.querySelector('polyline'), dots = path.querySelector('.rj-path-dots');
    const status = root.querySelector('.rj-status'), traceList = root.querySelector('[data-rj-trace-list]'), traceCount = root.querySelector('[data-rj-trace-count]');
    const action = name => root.querySelector(`[data-rj-action="${name}"]`);
    const rowsSelect = root.querySelector('[data-rj-rows]'), colsSelect = root.querySelector('[data-rj-cols]');
    function startState() { runState = { visits: [{ step: 0, row: 0, col: 0, gridRow: 0, gridCol: 0, arrow: grid[0][0] }], classification: null, repeat: null }; }
    function renderEditor() {
      editor.style.setProperty('--rj-editor-cols', grid[0].length);
      editor.replaceChildren();
      grid.forEach((row, r) => row.forEach((direction, c) => {
        const button = node('button', 'rj-arrow', SYMBOLS[direction]);
        button.type = 'button'; button.dataset.row = r; button.dataset.col = c; button.dataset.direction = direction;
        button.setAttribute('role', 'gridcell'); button.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}: ${directionName(direction)}. Click to rotate.`);
        listen(button, 'click', () => { grid = nextGrid(grid, r, c); initialGrid = cloneGrid(grid); stop(); startState(); renderEditor(); render(); status.textContent = `Arrow ${r + 1}, ${c + 1} changed.`; });
        editor.append(button);
      }));
    }
    function directionName(direction) { return { U: 'up', R: 'right', D: 'down', L: 'left' }[direction]; }
    function mapLayout() {
      const tileRows = 3, tileCols = 3, totalRows = tileRows * grid.length, totalCols = tileCols * grid[0].length;
      mapGrid.style.setProperty('--rj-map-cols', totalCols); mapGrid.style.setProperty('--rj-map-rows', totalRows);
      mapGrid.replaceChildren();
      for (let ar = -grid.length; ar < grid.length * 2; ar++) for (let ac = -grid[0].length; ac < grid[0].length * 2; ac++) {
        const gr = mod(ar, grid.length), gc = mod(ac, grid[0].length), cell = node('span', 'rj-map-cell', SYMBOLS[grid[gr][gc]]);
        if (ar >= 0 && ar < grid.length && ac >= 0 && ac < grid[0].length) cell.classList.add('rj-origin-cell');
        cell.dataset.row = ar; cell.dataset.col = ac; cell.setAttribute('aria-hidden', 'true'); mapGrid.append(cell);
      }
      mapSurface.style.setProperty('--rj-map-rows', totalRows); mapSurface.style.setProperty('--rj-map-cols', totalCols);
      path.setAttribute('viewBox', `0 0 ${totalCols} ${totalRows}`);
      const box = root.querySelector('.rj-origin-box'); box.style.left = `${grid[0].length * 100 / totalCols}%`; box.style.top = `${grid.length * 100 / totalRows}%`; box.style.width = `${grid[0].length * 100 / totalCols}%`; box.style.height = `${grid.length * 100 / totalRows}%`;
    }
    function renderMap() {
      mapLayout();
      const tileRows = 3, tileCols = 3, totalRows = tileRows * grid.length, totalCols = tileCols * grid[0].length;
      const points = runState.visits.map(visit => `${visit.col + grid[0].length * 1 + .5},${visit.row + grid.length * 1 + .5}`);
      polyline.setAttribute('points', points.join(' ')); dots.replaceChildren();
      runState.visits.slice(-1).forEach(visit => { const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('cx', visit.col + grid[0].length + .5); dot.setAttribute('cy', visit.row + grid.length + .5); dot.setAttribute('r', '.27'); dot.classList.add('rj-current-dot'); dots.append(dot); });
      if (runState.repeat) {
        const { first, second, deltaRow, deltaCol } = runState.repeat;
        const x = first.col + grid[0].length + .5, y = first.row + grid.length + .5;
        const xx = second.col + grid[0].length + .5, yy = second.row + grid.length + .5;
        const svg = (tag, attrs, text) => { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v)); if(text) el.textContent=text; dots.append(el); };
        svg('circle', {cx:x,cy:y,r:.42,class:'rj-first-ring'});
        if (deltaRow || deltaCol) {
          svg('line',{x1:x,y1:y,x2:xx,y2:yy,class:'rj-drift-line'});
          const angle=Math.atan2(yy-y,xx-x),length=.35;
          svg('path',{d:`M${xx-length*Math.cos(angle-.5)},${yy-length*Math.sin(angle-.5)} L${xx},${yy} L${xx-length*Math.cos(angle+.5)},${yy-length*Math.sin(angle+.5)}`,class:'rj-drift-line'});
        }
        svg('text',{x:x+.4,y:y-.35,class:'rj-visit-label'},`#${first.step}`);
        svg('text',{x:xx+.4,y:yy+.5,class:'rj-visit-label'},`#${second.step}`);
      }
      root.querySelectorAll('.rj-map-current').forEach(cell => cell.classList.remove('rj-map-current'));
      const current = runState.visits.at(-1); const cell = mapGrid.querySelector(`[data-row="${current.row}"][data-col="${current.col}"]`); cell?.classList.add('rj-map-current');
    }
    function renderTrace() {
      traceList.replaceChildren();
      runState.visits.forEach(visit => {
        const item = node('li', '', `#${visit.step}  actual (${visit.row}, ${visit.col}) · grid (${visit.gridRow + 1}, ${visit.gridCol + 1}) · ${SYMBOLS[visit.arrow]}`);
        if (runState.repeat && visit === runState.repeat.second) item.classList.add('rj-repeat-row');
        traceList.append(item);
      });
      traceCount.textContent = `(${runState.visits.length})`;
      if (runState.classification === 'repeating') status.textContent = `Repeating · returned to the same actual cell after ${runState.repeat.second.step - runState.repeat.first.step} moves.`;
      else if (runState.classification === 'infinite') status.textContent = `Infinite · grid cell revisited with drift (${runState.repeat.deltaRow}, ${runState.repeat.deltaCol}).`;
      else status.textContent = `${runState.visits.length - 1} moves · no classification yet.`;
      action('play').textContent = playing ? 'Pause' : 'Play'; action('step').disabled = !!runState.classification || playing;
    }
    function render() { renderMap(); renderTrace(); }
    function advance() {
      if (disposed || runState.classification) return false;
      const last = runState.visits.at(-1), [dr, dc] = DELTAS[last.arrow];
      const r = last.row + dr, c = last.col + dc, gr = mod(r, grid.length), gc = mod(c, grid[0].length), key = `${gr},${gc}`;
      const first = runState.visits.find(visit => `${visit.gridRow},${visit.gridCol}` === key);
      const visit = { step: last.step + 1, row: r, col: c, gridRow: gr, gridCol: gc, arrow: grid[gr][gc] };
      runState.visits.push(visit);
      if (first) { runState.repeat = { first, second: visit, deltaRow: r - first.row, deltaCol: c - first.col }; runState.classification = runState.repeat.deltaRow === 0 && runState.repeat.deltaCol === 0 ? 'repeating' : 'infinite'; playing = false; }
      render(); return true;
    }
    function stop() { playing = false; if (playTimer) { clearTimeout(playTimer); playTimer = null; } }
    function play() {
      if (playing || runState.classification) return;
      playing = true; renderTrace();
      const tick = () => { if (!playing || disposed || !advance()) { stop(); renderTrace(); return; } playTimer = setTimeout(tick, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 90); };
      tick();
    }
    function reset(nextGrid) { stop(); if (nextGrid) grid = cloneGrid(nextGrid); initialGrid = cloneGrid(grid); startState(); renderEditor(); render(); }
    listen(action('step'), 'click', advance);
    listen(action('play'), 'click', () => playing ? stop() || renderTrace() : play());
    listen(action('reset'), 'click', () => reset(initialGrid));
    listen(presetSelect, 'change', () => reset(PRESETS[presetSelect.value].grid));
    listen(action('new-grid'), 'click', () => reset(Array.from({ length: Number(rowsSelect.value) }, () => Array.from({ length: Number(colsSelect.value) }, () => 'R'))));
    startState(); renderEditor(); render();
    return () => { disposed = true; stop(); events.abort(); root.remove(); };
  }
  window.JournalWidgets = window.JournalWidgets || [];
  window.JournalWidgets.push({ id: 'repetitive-journey', title: 'Repetitive Journey', pages: [24, 25, 26, 27, 28], badge: { page: 28, y: .30 }, mount });
})();
