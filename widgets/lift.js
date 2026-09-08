(() => {
  'use strict';
  const M = window.LiftModel;
  const COLORS = ['#397f72', '#547eb0', '#b37842', '#8d6fa6', '#b26374', '#63854a', '#538c99', '#9b8640'];
  function mount(container) {
    const root = document.createElement('section'); root.className = 'lf-widget';
    root.innerHTML = `
      <p class="lf-intro">Ride the lifts to put them in the target order.</p>
      <div class="lf-toolbar"><label>Example<select data-lf="preset" aria-label="Lift example"></select></label><button type="button" data-lf="undo">Undo</button><button type="button" data-lf="reset">Reset</button></div>
      <div class="lf-controls"><div class="lf-mode" role="group" aria-label="Lift play mode"><button type="button" data-lf="explore" aria-pressed="true">Explore</button><button type="button" data-lf="watch" aria-pressed="false">Watch solution</button></div></div>
      <div class="lf-metrics"><div><span>Leo's floor</span><strong data-lf="floor"></strong></div><div><span>Nearest lift</span><strong data-lf="nearest"></strong></div><div><span>Rides taken</span><strong data-lf="count"></strong></div></div>
      <div class="lf-layout"><div class="lf-building"><div class="lf-building-head"><span>WAITING FLOORS</span><span>TARGET</span></div><svg data-lf="building" viewBox="0 0 400 390" role="img" aria-label="Vertical building: lifts and Leo, with target lifts at the right"></svg><ol class="lf-phases" aria-label="Ride stages"><li>Pick up</li><li>Travel</li><li>Return lifts</li></ol></div><aside class="lf-history"><header>Ride history <span data-lf="matches"></span></header><p data-lf="empty">Your first ride starts here.</p><ol data-lf="history" aria-label="Ride history"></ol></aside></div>
      <p class="lf-status" data-lf="status" role="status" aria-live="polite"></p>
      <div class="lf-manual"><label for="lf-destination">Destination floor</label><div><input id="lf-destination" data-lf="destination" type="number" min="1" step="1"><button type="button" class="lf-primary" data-lf="ride">Take a ride <span aria-hidden="true">↑↓</span></button></div><input data-lf="slider" type="range" min="1" step="1" aria-label="Destination floor slider"><p data-lf="hint"></p></div>
      <div class="lf-guide"><label>Show a construction<select data-lf="strategy" aria-label="Lift construction"><option value="selection">Place in order · ≤3N rides</option><option value="swaps">Swap pairs · ≤4N rides</option></select></label><div class="lf-playback"><button type="button" class="lf-primary" data-lf="play">▶ Play</button><button type="button" data-lf="step">Next ride</button><label>Speed<select data-lf="speed" aria-label="Lift animation speed"><option value="1">Normal</option><option value="0.5">Fast</option><option value="2">Slow</option></select></label></div><p data-lf="remaining"></p></div>
      <details class="lf-details"><summary>How it works</summary><p>Leo calls the nearest lift; ties choose the lower one. After each ride, all lifts return to their waiting floors in their new bottom-to-top order. Leo stays where he got off.</p><p>The <strong>target</strong> column shows which lift belongs at each waiting floor. Try your own rides, or watch the constructions from the book. Their bounds are guarantees, not shortest routes.</p></details>
      <details class="lf-details"><summary>Make a challenge</summary><div class="lf-custom"><label>Target lifts · bottom to top<input data-lf="target" value="5 2 3 4 1" inputmode="numeric" aria-label="Custom target lifts"></label><label>Leo starts on floor<input data-lf="start" type="number" value="27" min="1" step="1"></label><button type="button" data-lf="custom">Use challenge</button></div><p data-lf="error" role="status"></p></details>`;
    container.append(root);
    const q = name => root.querySelector(`[data-lf="${name}"]`);
    const manual = root.querySelector('.lf-manual'), guide = root.querySelector('.lf-guide');
    root.querySelector('.lf-controls').append(manual, guide); guide.hidden = true;
    const speedLabel = q('speed').parentElement; speedLabel.firstChild.textContent = ''; speedLabel.title = 'Animation speed';
    [...q('speed').options].forEach((option, i) => { option.textContent = ['1×', '2×', '½×'][i]; });
    root.querySelector('.lf-mode').append(speedLabel);
    const events = new AbortController();
    const on = (name, event, fn) => q(name).addEventListener(event, fn, { signal: events.signal });
    M.PRESETS.forEach((p, i) => q('preset').add(new Option(p.label, i)));
    const ns = 'http://www.w3.org/2000/svg';
    const node = (tag, attrs, text) => { const el = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); if (text !== undefined) el.textContent = text; return el; };
    let challenge, state, history = [], queue = [], busy = false, playing = false, epoch = 0, disposed = false;
    let cancelMotion = null, cars = [], rider, destinationLine, goalNodes = [], currentHistory = null;
    const y = floor => 359 - (floor - 1) / (state.order.length * 10 - 1) * 326;
    const x = id => 59 + (id - .5) * 240 / state.order.length;
    const move = (el, px, py) => el.setAttribute('transform', `translate(${px},${py})`);
    function makeBuilding() {
      const svg = q('building'); svg.replaceChildren(); cars = []; goalNodes = [];
      svg.append(node('rect', { x: 48, y: 14, width: 264, height: 364, rx: 12, class: 'lf-shell' }));
      for (let id = 1; id <= state.order.length; id++) svg.append(node('line', { x1: x(id), x2: x(id), y1: 23, y2: 368, class: 'lf-shaft' }));
      state.order.forEach((_, i) => {
        const py = y(M.waitingFloor(i));
        svg.append(node('line', { x1: 48, x2: 312, y1: py, y2: py, class: 'lf-floor-line' }));
        svg.append(node('text', { x: 33, y: py + 4, 'text-anchor': 'end', class: 'lf-floor-label' }, M.waitingFloor(i)));
        const goal = node('g', { transform: `translate(375,${py})` });
        goal.append(node('rect', { x: -14, y: -14, width: 28, height: 28, rx: 8 }));
        goal.append(node('text', { y: 5, 'text-anchor': 'middle' }, challenge.target[i]));
        svg.append(goal); goalNodes.push(goal);
      });
      destinationLine = node('path', { class: 'lf-destination-line' }); svg.append(destinationLine);
      for (let id = 1; id <= state.order.length; id++) {
        const car = node('g', { class: 'lf-car', 'data-lift': id });
        car.append(node('rect', { x: -13, y: -15, width: 26, height: 30, rx: 6, fill: COLORS[id - 1] }));
        car.append(node('path', { d: 'M-9 10 H9', class: 'lf-car-sill' }));
        car.append(node('text', { y: 4, 'text-anchor': 'middle' }, id));
        svg.append(car); cars[id] = car;
      }
      rider = node('g', { class: 'lf-rider' }); rider.append(node('title', {}, 'Leo'));
      rider.append(node('circle', { r: 10 })); rider.append(node('circle', { cy: -3, r: 2.4, class: 'lf-person' })); rider.append(node('path', { d: 'M-4 5 Q-4 0 0 0 Q4 0 4 5', class: 'lf-person' })); svg.append(rider);
      svg.append(node('text', { x: 333, y: 386, 'text-anchor': 'middle', class: 'lf-leo-label' }, 'LEO'));
    }
    function setPhase(phase = '') {
      root.dataset.phase = phase;
      root.querySelectorAll('.lf-phases li').forEach((el, i) => {
        const active = ['pickup', 'travel', 'return'][i] === phase;
        el.classList.toggle('is-current', active);
        if (active) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
      });
      if (currentHistory) { currentHistory.dataset.phase = phase; currentHistory.querySelector('small').textContent = { pickup: 'Picking up Leo', travel: 'Leo is on board', return: 'Returning to waiting floors' }[phase] || 'Complete'; }
    }
    function parked() {
      state.order.forEach((id, i) => move(cars[id], x(id), y(M.waitingFloor(i))));
      move(rider, 333, y(state.floor));
      cars.forEach((car, id) => { if (car) car.classList.toggle('is-nearest', id === state.order[M.nearest(state)]); });
      goalNodes.forEach((g, i) => { g.setAttribute('class', `lf-goal${state.order[i] === challenge.target[i] ? ' is-matched' : ''}`); });
      q('building').setAttribute('aria-label', `Leo at floor ${state.floor}. Lifts bottom to top: ${state.order.join(', ')}. Target: ${challenge.target.join(', ')}.`);
      root.dataset.order = state.order.join(',');
    }
    function controls() {
      const solved = M.same(state.order, challenge.target);
      root.dataset.solved = String(solved); root.dataset.busy = String(busy);
      q('floor').textContent = state.floor; q('nearest').textContent = `#${state.order[M.nearest(state)]}`; q('count').textContent = history.length;
      q('matches').textContent = `${state.order.filter((id, i) => id === challenge.target[i]).length}/${state.order.length} placed`;
      q('undo').disabled = busy || playing || !history.length;
      q('step').disabled = busy || playing || solved;
      q('play').disabled = (solved && !busy) || (busy && !playing); q('play').textContent = playing ? 'Ⅱ Pause' : '▶ Play';
      q('strategy').disabled = busy || playing;
      q('destination').disabled = busy || playing; q('slider').disabled = busy || playing;
      q('remaining').textContent = solved ? `Target reached in ${history.length} ride${history.length === 1 ? '' : 's'}.` : `${queue.length} guided ride${queue.length === 1 ? '' : 's'} remaining · N = ${state.order.length}`;
      destination();
    }
    function destination() {
      const floor = Number(q('destination').value), valid = Number.isInteger(floor) && floor >= 1 && floor <= state.order.length * 10 && floor % 10 !== 5 && floor !== state.floor;
      q('ride').disabled = busy || playing || !valid;
      q('hint').textContent = !Number.isInteger(floor) || floor < 1 || floor > state.order.length * 10 ? `Choose floor 1–${state.order.length * 10}.` : floor % 10 === 5 ? 'That is a waiting floor. Choose the floor above or below.' : floor === state.floor ? 'Choose a different floor to travel.' : `Lift #${state.order[M.nearest(state)]} will collect Leo${state.floor % 10 === 0 && state.floor < state.order.length * 10 ? ' (tie → lower lift)' : ''}.`;
      destinationLine.setAttribute('d', valid ? `M48 ${y(floor)} H312` : '');
      destinationLine.style.opacity = busy ? 0 : 1;
      if (valid) q('slider').value = floor;
    }
    function rebuildQueue() { queue = M.plan(state, challenge.target, q('strategy').value); }
    function historyItem(step, active = false) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="lf-history-number">${q('history').children.length + 1}</span><div><strong>Lift ${step.lift} <span>${step.destination > step.before.floor ? '↑' : '↓'} ${step.before.floor} → ${step.destination}</span></strong><small>Complete</small></div>`;
      li.classList.toggle('is-active', active); if (active) li.setAttribute('aria-current', 'step');
      q('history').append(li); q('empty').hidden = true;
      q('history').scrollTop = q('history').scrollHeight; return li;
    }
    function motion(items, duration) {
      return new Promise(resolve => {
        let frame = null, start = null, finished = false;
        const stop = () => { if (finished) return; finished = true; cancelAnimationFrame(frame); cancelMotion = null; resolve(false); };
        cancelMotion = stop;
        const tick = time => {
          if (finished) return;
          if (start === null) start = time;
          const t = Math.min(1, (time - start) / duration), eased = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
          items.forEach(({ el, px, a, b }) => move(el, px, y(a + (b - a) * eased)));
          if (t < 1) frame = requestAnimationFrame(tick); else { finished = true; cancelMotion = null; resolve(true); }
        };
        frame = requestAnimationFrame(tick);
      });
    }
    async function takeRide(destinationFloor, note = '', guided = false) {
      if (busy || disposed) return false;
      const token = epoch, step = M.ride(state, destinationFloor);
      busy = true; currentHistory = historyItem(step, true); controls();
      cars.forEach(car => car?.classList.remove('is-nearest')); cars[step.lift].classList.add('is-nearest');
      const speed = Number(q('speed').value), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = distance => reduced ? 45 : (420 + Math.abs(distance) / (state.order.length * 10) * 800) * speed;
      setPhase('pickup'); q('status').textContent = `Lift ${step.lift} comes from floor ${step.from} to collect Leo on ${state.floor}.`;
      await motion([{ el: cars[step.lift], px: x(step.lift), a: step.from, b: state.floor }], duration(step.from - state.floor));
      if (token !== epoch || disposed) return false;
      setPhase('travel'); q('status').textContent = `Leo rides ${destinationFloor > state.floor ? 'up' : 'down'} to floor ${destinationFloor}.`;
      await motion([{ el: cars[step.lift], px: x(step.lift), a: state.floor, b: destinationFloor }, { el: rider, px: x(step.lift) + 10, a: state.floor, b: destinationFloor }], duration(destinationFloor - state.floor));
      if (token !== epoch || disposed) return false;
      move(rider, 333, y(destinationFloor)); setPhase('return'); q('status').textContent = 'Lifts return to their waiting floors, keeping their new vertical order.';
      const items = step.after.order.map((id, i) => ({ el: cars[id], px: x(id), a: id === step.lift ? destinationFloor : M.waitingFloor(state.order.indexOf(id)), b: M.waitingFloor(i) }));
      await motion(items, duration(Math.max(...items.map(item => Math.abs(item.b - item.a)))));
      if (token !== epoch || disposed) return false;
      state = step.after; history.push(step); busy = false;
      currentHistory.classList.remove('is-active'); currentHistory.removeAttribute('aria-current'); setPhase(); currentHistory = null;
      parked(); if (guided) queue.shift(); else rebuildQueue(); controls();
      q('status').textContent = M.same(state.order, challenge.target) ? '✓ All lifts are in their target positions.' : note || `Leo is on floor ${state.floor}. Choose another destination.`;
      return true;
    }
    async function advance() {
      if (busy || !queue.length) return false;
      const step = queue[0]; return takeRide(step.destination, step.note, true);
    }
    async function play() {
      if (playing) { playing = false; controls(); return; }
      playing = true; controls(); const token = epoch;
      while (playing && queue.length && token === epoch && !disposed) { if (!await advance()) break; }
      if (token === epoch && !disposed) { playing = false; controls(); }
    }
    function cancel() { epoch++; playing = false; cancelMotion?.(); busy = false; currentHistory = null; }
    function reset(preset = challenge) {
      cancel(); challenge = { target: [...preset.target], floor: preset.floor };
      state = { order: challenge.target.map((_, i) => i + 1), floor: challenge.floor }; history = [];
      q('destination').max = state.order.length * 10; q('slider').max = state.order.length * 10;
      q('destination').value = challenge.floor === 1 ? state.order.length * 10 - 1 : 1;
      q('history').replaceChildren(); q('empty').hidden = false;
      q('target').value = challenge.target.join(' '); q('start').value = challenge.floor; q('error').textContent = '';
      makeBuilding(); parked(); setPhase(); rebuildQueue(); controls();
      q('status').textContent = M.same(state.order, challenge.target) ? '✓ These lifts already match the target.' : 'Choose a destination, or play a guided construction.';
    }
    on('ride', 'click', () => void takeRide(Number(q('destination').value)));
    for (const mode of ['explore', 'watch']) on(mode, 'click', () => {
      manual.hidden = mode !== 'explore'; guide.hidden = mode !== 'watch';
      q('explore').setAttribute('aria-pressed', String(mode === 'explore')); q('watch').setAttribute('aria-pressed', String(mode === 'watch'));
      if (mode === 'explore') { playing = false; controls(); }
    });
    on('destination', 'input', destination);
    on('slider', 'input', () => { let floor = Number(q('slider').value); if (floor % 10 === 5) floor += floor >= Number(q('destination').value) ? 1 : -1; q('destination').value = floor; destination(); });
    on('step', 'click', () => void advance()); on('play', 'click', () => void play());
    on('strategy', 'change', () => { rebuildQueue(); controls(); });
    on('reset', 'click', () => reset()); on('preset', 'change', () => { if (q('preset').value !== 'custom') reset(M.PRESETS[Number(q('preset').value)]); });
    on('undo', 'click', () => { const step = history.pop(); if (!step) return; state = step.before; q('history').lastElementChild.remove(); q('empty').hidden = history.length > 0; parked(); rebuildQueue(); controls(); q('status').textContent = 'Last ride undone.'; });
    on('custom', 'click', () => {
      try {
        const target = q('target').value.trim().split(/[\s,]+/).map(Number), floor = Number(q('start').value); M.validate(target, floor);
        if (!q('preset').querySelector('[value="custom"]')) q('preset').add(new Option('Your challenge', 'custom'));
        q('preset').value = 'custom'; reset({ target, floor });
      } catch (error) { q('error').textContent = error.message; }
    });
    reset(M.PRESETS[0]);
    return () => { disposed = true; cancel(); events.abort(); root.remove(); };
  }
  (window.JournalWidgets = window.JournalWidgets || []).push({ id: 'lift', title: 'Lift Problem', pages: [44, 45, 46, 47], badge: { page: 46, y: .60 }, mount });
})();
