(() => {
  'use strict';
  // Arrays hold cargoes bottom-to-top; popping therefore follows the book's
  // topmost-cargo rule. Slots 0 and n+1 are terminal and are never processed.
  const BOOK = ['RB', 'BRBR', 'R', 'RB', '', 'BRB'];
  const copy = state => ({ ...state, stacks: state.stacks.map(stack => [...stack]), moves: state.moves.map(move => ({ ...move })) });
  function normalize(state) {
    const n = state.stacks.length - 2;
    while (state.pass <= n) {
      while (state.slot <= n && !state.stacks[state.slot].length) state.slot++;
      if (state.slot <= n) return state;
      state.pass++; state.slot = 1;
    }
    state.done = true;
    return state;
  }
  function create(stacks) {
    if (stacks.length < 2 || stacks.length > 6 || stacks.some(stack => !/^[RB]*$/.test(stack)) || stacks.join('').length > 24) throw new Error('Use 2–6 stacks, only R/B, and at most 24 cargoes.');
    return normalize({ stacks: [[], ...stacks.map(stack => [...stack]), []], pass: 1, slot: 1, moves: [], done: false });
  }
  function step(state) {
    if (state.done) return null;
    const next = copy(state), from = next.slot, colour = next.stacks[from].pop();
    const to = from + (colour === 'R' ? -1 : 1);
    const move = { number: next.moves.length + 1, pass: next.pass, from, to, colour };
    next.stacks[to].push(colour); next.moves.push(move);
    normalize(next);
    return { state: next, move };
  }
  const model = { BOOK, create, step, copy };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  if (typeof window === 'undefined') return;

  function node(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text !== undefined) result.textContent = text;
    return result;
  }
  function mount(container) {
    const events = new AbortController();
    const listen = (target, type, callback) => target.addEventListener(type, callback, { signal: events.signal });
    let initial = [...BOOK], state = create(initial), history = [], running = false, busy = false, disposed = false, animation = null;
    const root = node('section', 'cargo-widget');
    root.innerHTML = `<p class="cargo-intro">Move the top cargo: <strong class="cargo-red-text">R goes left</strong>, <strong class="cargo-blue-text">B goes right</strong>. Drain slots 1 to n, in order; repeat for n passes. The two end slots collect cargoes.</p>
      <details class="cargo-editor"><summary>Edit the starting stacks</summary><p>One stack per field, <strong>bottom to top</strong> (for example, RB has blue on top). Leave empty slots blank. Maximum 24 cargoes.</p><label>Interior slots <select aria-label="Number of cargo slots"><option>2</option><option>3</option><option>4</option><option>5</option><option selected>6</option></select></label><div class="cargo-fields"></div><button type="button" data-action="apply">Apply stacks</button></details>
      <div class="cargo-toolbar"><button type="button" data-action="step">Step one move</button><button type="button" data-action="pass">Run this pass</button><button type="button" data-action="run">Run all</button><button type="button" data-action="pause" disabled>Pause</button><button type="button" data-action="undo" disabled>Undo</button><button type="button" data-action="reset">Reset</button><button type="button" data-action="book">Book example</button></div>
      <p class="cargo-status" role="status" aria-live="polite"></p><div class="cargo-board-scroll"><div class="cargo-board" aria-label="Cargo stacks"></div></div>
      <p class="cargo-note">The gold column is processed next. R/B letters identify colours. Each cargo lands on top of the destination stack.</p>
      <details class="cargo-algorithm"><summary>Show the algorithm</summary><pre>Repeat n times:
  For slot x = 1 to n:
    While slot x is non-empty:
      Move its top cargo:
        R → slot x − 1
        B → slot x + 1</pre></details>
      <div class="cargo-query"><label>Inspect move <input type="number" min="1" max="144" step="1" value="1" aria-label="Cargo move number"></label><button type="button" data-action="query">Look up</button><span class="cargo-answer" aria-live="polite"></span></div>
      <details class="cargo-log"><summary>Move log <span></span></summary><ol aria-label="Cargo move log"></ol></details>`;
    container.append(root);
    const action = name => root.querySelector(`[data-action="${name}"]`);
    const board = root.querySelector('.cargo-board'), status = root.querySelector('.cargo-status');
    const count = root.querySelector('select'), fields = root.querySelector('.cargo-fields');
    const answer = root.querySelector('.cargo-answer');
    function editor(stacks) {
      count.value = String(stacks.length); fields.replaceChildren();
      stacks.forEach((stack, index) => {
        const label = node('label', '', `Slot ${index + 1}`), input = node('input');
        input.type = 'text'; input.value = stack; input.maxLength = 24;
        input.setAttribute('aria-label', `Slot ${index + 1}, bottom to top`);
        input.autocomplete = 'off'; input.spellcheck = false; input.placeholder = 'empty';
        label.append(input); fields.append(label);
      });
    }
    function controls() {
      ['step', 'pass', 'run'].forEach(name => action(name).disabled = busy || running || state.done);
      ['reset', 'book', 'apply'].forEach(name => action(name).disabled = busy || running);
      action('undo').disabled = busy || running || !history.length;
      action('pause').disabled = !running;
      count.disabled = busy || running;
      fields.querySelectorAll('input').forEach(input => input.disabled = busy || running);
    }
    function render() {
      const total = state.stacks.reduce((sum, stack) => sum + stack.length, 0);
      const crateHeight = Math.max(15, Math.min(27, Math.floor(270 / Math.max(1, total))));
      board.style.setProperty('--cargo-count', state.stacks.length);
      board.style.setProperty('--cargo-height', `${crateHeight}px`);
      board.replaceChildren();
      // Keep the pile viewport tall enough for every cargo in the setup. The
      // maximum occupied stack changes as cargo moves, but the reserved space
      // must not, otherwise each animation causes the board to jump vertically.
      const reservedHeight = Math.max(3, total);
      state.stacks.forEach((stack, index) => {
        const column = node('div', `cargo-column${!state.done && state.slot === index ? ' cargo-active' : ''}`);
        const pile = node('div', 'cargo-pile'); pile.style.height = `${reservedHeight * (crateHeight + 3) + 12}px`;
        pile.dataset.slot = String(index);
        pile.setAttribute('aria-label', `Slot ${index}, bottom to top: ${stack.join(' ') || 'empty'}`);
        stack.forEach((colour, level) => {
          const crate = node('span', `cargo-crate cargo-${colour.toLowerCase()}`, colour);
          crate.style.bottom = `${level * (crateHeight + 3)}px`; pile.append(crate);
        });
        column.append(pile, node('span', 'cargo-slot-label', String(index)));
        column.append(node('span', 'cargo-end-label', index === 0 ? 'R end' : index === state.stacks.length - 1 ? 'B end' : ''));
        board.append(column);
      });
      const last = state.moves.at(-1);
      status.textContent = state.done
        ? `Finished ${state.stacks.length - 2} passes in ${state.moves.length} moves. All red cargoes are at the left end; all blue cargoes are at the right end.`
        : `${state.moves.length} moves · Next: pass ${state.pass} of ${state.stacks.length - 2}, slot ${state.slot}.${last ? ` Last: ${last.colour} from ${last.from} to ${last.to}.` : ''}`;
      const log = root.querySelector('.cargo-log ol'); log.replaceChildren();
      state.moves.forEach(move => log.append(node('li', `cargo-${move.colour.toLowerCase()}-log`, `${move.colour} · slot ${move.from} → ${move.to} (pass ${move.pass})`)));
      root.querySelector('.cargo-log summary span').textContent = `(${state.moves.length})`;
      controls();
    }
    async function oneMove() {
      if (busy || disposed || state.done) return;
      const result = step(state);
      busy = true; controls();
      const source = board.querySelector(`[data-slot="${result.move.from}"]`).lastElementChild;
      const target = board.querySelector(`[data-slot="${result.move.to}"]`);
      const a = source.getBoundingClientRect(), b = target.getBoundingClientRect();
      const height = parseFloat(board.style.getPropertyValue('--cargo-height'));
      const top = b.bottom - state.stacks[result.move.to].length * (height + 3) - height;
      const ghost = source.cloneNode(true);
      ghost.classList.add('cargo-flying');
      Object.assign(ghost.style, { position: 'fixed', left: `${a.left}px`, top: `${a.top}px`, bottom: 'auto', width: `${a.width}px`, height: `${a.height}px` });
      root.append(ghost); source.style.visibility = 'hidden';
      const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380;
      try {
        animation = ghost.animate([
          { transform: 'translate(0,0)' },
          { transform: `translate(${(b.left - a.left) / 2}px,${Math.min(-24, top - a.top - 24)}px)`, offset: .45 },
          { transform: `translate(${b.left - a.left}px,${top - a.top}px)` },
        ], { duration, easing: 'ease-in-out' });
        await animation.finished;
      } catch (_) { /* Closing the dialog cancels a pending animation. */ }
      ghost.remove(); animation = null;
      if (disposed) return;
      history.push(copy(state)); state = result.state; busy = false; answer.textContent = ''; render();
    }
    async function run(passOnly) {
      if (busy || running || state.done) return;
      running = true; const pass = state.pass; controls();
      // At most 24 cargoes * 6 slots: each move decreases its distance to
      // its terminal slot. The guard is defensive, not an alternate rule.
      let remaining = 144;
      while (running && !disposed && !state.done && remaining-- > 0 && (!passOnly || state.pass === pass)) await oneMove();
      running = false;
      if (!disposed) controls();
    }
    function reset(stacks) {
      initial = [...stacks]; state = create(initial); history = []; answer.textContent = ''; editor(initial); render();
    }
    listen(count, 'change', () => {
      const stacks = [...fields.querySelectorAll('input')].map(input => input.value);
      editor(Array.from({ length: Number(count.value) }, (_, index) => stacks[index] || ''));
    });
    listen(action('apply'), 'click', () => {
      const stacks = [...fields.querySelectorAll('input')].map(input => input.value.trim().toUpperCase());
      try { create(stacks); reset(stacks); } catch (error) { status.textContent = error.message; }
    });
    listen(action('step'), 'click', () => void oneMove());
    listen(action('pass'), 'click', () => void run(true));
    listen(action('run'), 'click', () => void run(false));
    listen(action('pause'), 'click', () => { running = false; controls(); });
    listen(action('undo'), 'click', () => { if (history.length && !busy) { state = history.pop(); answer.textContent = ''; render(); } });
    listen(action('reset'), 'click', () => reset(initial));
    listen(action('book'), 'click', () => reset(BOOK));
    listen(action('query'), 'click', () => {
      const requested = Number(root.querySelector('.cargo-query input').value);
      if (!Number.isInteger(requested) || requested < 1 || requested > 144) { answer.textContent = 'Enter a whole move number from 1 to 144.'; return; }
      let preview = create(initial);
      while (!preview.done && preview.moves.length < requested) preview = step(preview).state;
      const move = preview.moves[requested - 1];
      answer.textContent = move ? `Move ${requested}: ${move.colour === 'R' ? 'red' : 'blue'}, slot ${move.from} → ${move.to}, pass ${move.pass}.` : `Move number exceeded: this setup has ${preview.moves.length} moves.`;
    });
    editor(initial); render();
    return () => { disposed = true; running = false; animation?.cancel(); events.abort(); root.remove(); };
  }
  window.JournalWidgets = window.JournalWidgets || [];
  window.JournalWidgets.push({ id: 'cargo-sorting', title: 'Cargo Sorting', pages: [48], y: 907 / 1331, offsetY: 64, mount });
})();
