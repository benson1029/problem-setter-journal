(() => {
  const { rotate, sorted, bounds } = window.MechanicalGridModel;
  window.JournalWidgets = window.JournalWidgets || [];
  window.JournalWidgets.push({
    id: 'mechanical-grid', title: 'Mechanical Grid', pages: [37, 38, 39, 40], y: .506, offsetY: 64,
    mount(root) {
      root.innerHTML = `
        <p class="mg-intro">Drag across cells and release to rotate a rectangle. You can also tap two opposite corners, or select them with Tab and Enter.</p>
        <div class="mg-options">
          <label>Puzzle <select data-puzzle><option value="0">Book example 1 · 2 × 2</option><option value="1">Book example 2 · 2 × 2</option><option value="2">Explore · 2 × 3</option><option value="3">Explore · 2 × 4</option></select></label>
          <label>Goal <select data-goal><option value="exact">Match the target</option><option value="sorted">Book rule: rows & columns increasing</option></select></label>
        </div>
        <div class="mg-workspace"><section><h3>Your grid</h3><div class="mg-board" data-board aria-label="Select opposite corners of a rectangle"></div></section>
          <section class="mg-target-section"><h3 data-target-label>Target</h3><div class="mg-target" data-target aria-label="Target grid"></div></section></div>
        <p class="mg-rule" data-selection>Squares rotate 90° clockwise. Other rectangles rotate 180°.</p>
        <div class="mg-controls"><button type="button" data-undo>Undo</button><button type="button" data-reset>Reset</button><button type="button" data-shuffle>New shuffle</button><span data-count>0 moves</span></div>
        <p class="mg-status" data-status role="status" aria-live="polite"></p>`;
      const board = root.querySelector('[data-board]'), targetBoard = root.querySelector('[data-target]');
      const puzzle = root.querySelector('[data-puzzle]'), goal = root.querySelector('[data-goal]');
      const undo = root.querySelector('[data-undo]'), reset = root.querySelector('[data-reset]');
      const shuffle = root.querySelector('[data-shuffle]'), count = root.querySelector('[data-count]');
      const status = root.querySelector('[data-status]'), selectionText = root.querySelector('[data-selection]');
      let columns = 2, grid = [], initial = [], target = [], history = [], anchor = null, selection = null;
      let pointer = null, busy = false, disposed = false, animations = [];
      function update() {
        const won = goal.value === 'exact' ? grid.every((n, i) => n === target[i]) : sorted(grid, columns);
        count.textContent = `${history.length} move${history.length === 1 ? '' : 's'}`;
        undo.disabled = busy || !history.length;
        [puzzle, goal, reset, shuffle].forEach(el => { el.disabled = busy; });
        status.textContent = won ? `Solved in ${history.length} moves! Keep exploring or start again.` :
          (columns === 2 ? 'Try to finish within 4 moves.' : 'Explore freely — each selected rectangle is one move.');
        status.classList.toggle('is-solved', won);
        root.querySelector('[data-target-label]').textContent = goal.value === 'exact' ? 'Target' : 'One valid target';
      }
      function preview(a, b) {
        selection = bounds(a, b, columns);
        const {r0,r1,c0,c1} = selection;
        board.querySelectorAll('.mg-cell').forEach((cell, i) => {
          const selected = Math.floor(i / columns) >= r0 && Math.floor(i / columns) <= r1 && i % columns >= c0 && i % columns <= c1;
          cell.classList.toggle('is-selected', selected);
          cell.setAttribute('aria-pressed', String(selected));
        });
        const h = r1-r0+1, w = c1-c0+1;
        selectionText.textContent = h*w === 1 ? 'Choose the opposite corner (at least two cells).' : `${h} × ${w} selection · ${h === w ? '90°' : '180°'} clockwise`;
      }
      function draw() {
        board.replaceChildren(); targetBoard.replaceChildren();
        board.style.aspectRatio = `${columns} / 2`;
        targetBoard.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
        grid.forEach((n, i) => {
          const cell = document.createElement('button');
          cell.type = 'button'; cell.className = 'mg-cell'; cell.dataset.index = i;
          cell.textContent = n;
          cell.setAttribute('aria-label', `Row ${Math.floor(i/columns)+1}, column ${i%columns+1}: ${n}`);
          cell.setAttribute('aria-pressed', 'false');
          Object.assign(cell.style, {left: `${i%columns/columns*100}%`, top: `${Math.floor(i/columns)*50}%`, width: `${100/columns}%`, height: '50%'});
          board.append(cell);
        });
        target.forEach(n => { const cell = document.createElement('span'); cell.textContent = n; targetBoard.append(cell); });
        if (selection) preview(anchor, anchor);
        update();
      }
      async function turn(box) {
        if (busy || disposed) return;
        const {r0,r1,c0,c1} = box, h = r1-r0+1, w = c1-c0+1;
        if (h*w < 2) return;
        busy = true; anchor = null; selection = null; update();
        const after = rotate(grid, columns, box);
        const sheet = document.createElement('div'); sheet.className = 'mg-rotating';
        Object.assign(sheet.style, {left: `${c0/columns*100}%`, top: `${r0*50}%`, width: `${w/columns*100}%`, height: `${h*50}%`});
        for (let r=r0;r<=r1;r++) for (let c=c0;c<=c1;c++) {
          const original = board.querySelector(`[data-index="${r*columns+c}"]`);
          original.style.visibility = 'hidden';
          const tile = document.createElement('span'); tile.className = 'mg-cell'; tile.textContent = grid[r*columns+c];
          Object.assign(tile.style, {left: `${(c-c0)/w*100}%`, top: `${(r-r0)/h*100}%`, width: `${100/w}%`, height: `${100/h}%`});
          sheet.append(tile);
        }
        board.append(sheet);
        const angle = h === w ? 90 : 180;
        const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 520;
        animations = [sheet.animate([{transform:'rotate(0deg)'},{transform:`rotate(${angle}deg)`}], {duration, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards'})];
        // Counter-rotate the labels while the rigid selection turns.
        for (const tile of sheet.children) {
          const label = document.createElement('span'); label.textContent = tile.textContent; tile.replaceChildren(label);
          animations.push(label.animate([{transform:'rotate(0deg)'},{transform:`rotate(${-angle}deg)`}], {duration, easing:'cubic-bezier(.4,0,.2,1)', fill:'forwards'}));
        }
        await Promise.allSettled(animations.map(a => a.finished));
        if (disposed) return;
        history.push(grid.slice()); grid = after; busy = false; animations = [];
        selectionText.textContent = `${h} × ${w} rotated ${angle}° clockwise. Select another rectangle.`;
        draw();
      }
      function pick(index) {
        if (busy) return;
        if (anchor === null) { anchor=index; preview(index,index); }
        else if (index === anchor) { anchor=null; selection=null; draw(); }
        else { void turn(bounds(anchor,index,columns)); }
      }
      function hit(event) {
        const rect = board.getBoundingClientRect();
        const c = Math.max(0,Math.min(columns-1,Math.floor((event.clientX-rect.left)/rect.width*columns)));
        const r = Math.max(0,Math.min(1,Math.floor((event.clientY-rect.top)/rect.height*2)));
        return r*columns+c;
      }
      board.addEventListener('pointerdown', event => {
        if (busy || event.button !== 0) return;
        const cell = event.target.closest('[data-index]'); if (!cell) return;
        const index = Number(cell.dataset.index);
        pointer = {id:event.pointerId, start:index, end:index};
        board.setPointerCapture(event.pointerId); preview(index,index); event.preventDefault();
      });
      board.addEventListener('pointermove', event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        pointer.end=hit(event); preview(pointer.start,pointer.end);
      });
      board.addEventListener('pointerup', event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        const {start,end} = pointer; pointer=null; board.releasePointerCapture(event.pointerId);
        if (start !== end) void turn(bounds(start,end,columns)); else pick(end);
      });
      board.addEventListener('pointercancel', () => { pointer=null; anchor=null; selection=null; draw(); });
      board.addEventListener('click', event => {
        if (event.detail !== 0) return;
        const cell = event.target.closest('[data-index]'); if (cell) pick(Number(cell.dataset.index));
      });
      function start(random = false) {
        columns = [2,2,3,4][Number(puzzle.value)];
        target = Array.from({length:columns*2}, (_,i)=>i+1);
        grid = columns === 2 && !random ? [[3,2,4,1],[4,3,2,1]][Number(puzzle.value)].slice() : target.slice();
        if (random || columns > 2) {
          for(let i=0;i<12;i++) {
            const a=Math.floor(Math.random()*grid.length), b=Math.floor(Math.random()*grid.length);
            grid = rotate(grid,columns,bounds(a,b,columns));
          }
          if (sorted(grid,columns)) grid=rotate(grid,columns,{r0:0,r1:0,c0:0,c1:1});
        }
        initial=grid.slice(); history=[]; anchor=null; selection=null; draw();
        selectionText.textContent='Squares rotate 90° clockwise. Other rectangles rotate 180°.';
      }
      puzzle.addEventListener('change',()=>start()); goal.addEventListener('change',update);
      reset.addEventListener('click',()=>{ grid=initial.slice(); history=[]; anchor=null; selection=null; draw(); selectionText.textContent='Squares rotate 90° clockwise. Other rectangles rotate 180°.'; });
      shuffle.addEventListener('click',()=>start(true));
      undo.addEventListener('click',()=>{ if(history.length) { grid=history.pop(); anchor=null; selection=null; draw(); selectionText.textContent='Move undone. Select another rectangle.'; } });
      start();
      return () => { disposed=true; animations.forEach(a=>a.cancel()); };
    }
  });
})();
