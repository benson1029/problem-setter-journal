(() => {
  'use strict';
  const M = window.DigitPuzzleModel;
  function mount(container) {
    const events = new AbortController();
    const listen = (el, name, fn) => el.addEventListener(name, fn, { signal: events.signal });
    const root = document.createElement('section'); root.className = 'dp-widget';
    root.innerHTML = `
      <p class="dp-intro">Fill every □ with a digit <strong>1–9</strong> to make the equation true.</p>
      <div class="dp-toolbar"><label>Example<select aria-label="Digit puzzle example" data-dp="preset"></select></label><button type="button" class="dp-primary" data-dp="play">Play solution</button><button type="button" data-dp="step">Step</button><button type="button" data-dp="reset">Reset</button></div>
      <div class="dp-overview"><span data-dp="slots"></span><span data-dp="counts"></span></div>
      <ol class="dp-stages" aria-label="Solution stages"><li>Group</li><li>Raise</li><li>Match</li><li>Verify</li></ol>
      <div class="dp-balance"><section class="dp-side" data-dp="positive"></section><div class="dp-equals" aria-hidden="true">=</div><section class="dp-side" data-dp="negative"></section></div>
      <section class="dp-chart"><div class="dp-chart-heading"><span>Minority sum <strong data-dp="value"></strong></span><span class="dp-range" data-dp="range"></span></div><svg viewBox="0 0 600 145" role="img" aria-label="Minority sum on a logarithmic base-nine scale" data-dp="axis"></svg><p class="dp-axis-caption">Each tick multiplies the value by 9.</p></section>
      <p class="dp-status" role="status" aria-live="polite" data-dp="status"></p>
      <div class="dp-options"><label>Speed<select aria-label="Solution playback speed" data-dp="speed"><option value="1">Normal</option><option value="0.5">Fast</option><option value="1.8">Slow</option></select></label><label><input type="checkbox" data-dp="proof"> Show proof labels</label></div>
      <p class="dp-proof" data-dp="proof-text" hidden></p>
      <details class="dp-expression"><summary>Full equation <span data-dp="verdict"></span></summary><div data-dp="expression"></div></details>
      <details class="dp-custom"><summary>Build a puzzle</summary><p class="dp-custom-intro">Add groups when terms on the same side need different numbers of factors.</p><div class="dp-custom-sides"><section class="dp-custom-side" data-dp="positive-groups"><header><strong>+ Positive terms</strong><span>left side</span></header><div class="dp-group-list"></div><button type="button" class="dp-add-group" data-dp="add-positive">+ Add a group</button></section><section class="dp-custom-side" data-dp="negative-groups"><header><strong>− Negative terms</strong><span>right side moved over</span></header><div class="dp-group-list"></div><button type="button" class="dp-add-group" data-dp="add-negative">+ Add a group</button><p class="dp-rhs-note">A one-factor digit from the right-hand side is included automatically.</p></section></div><div class="dp-custom-actions"><button type="button" class="dp-primary" data-dp="custom">Use this puzzle</button><span role="status" data-dp="error"></span></div></details>`;
    container.append(root);
    const q = name => root.querySelector(`[data-dp="${name}"]`);
    Object.entries(M.PRESETS).forEach(([id, preset]) => { const o = document.createElement('option'); o.value = id; o.textContent = preset.label; q('preset').append(o); });
    let plan, index = 0, playing = false, busy = false, disposed = false, epoch = 0, timer = null, animation = null;
    let marker, jumpLayer, scaleMax, chartWidth;
    const ns = 'http://www.w3.org/2000/svg';
    const svgNode = (tag, attrs, text) => { const el = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); if (text !== undefined) el.textContent = text; return el; };
    const log9 = n => Math.log(Number(n)) / Math.log(9);
    const position = value => 24 + Math.max(0, log9(value)) / scaleMax * (chartWidth - 48);
    function chart() {
      scaleMax = Math.max(2, Math.ceil(log9(plan.upper)));
      const svg = q('axis'); svg.replaceChildren();
      chartWidth = Math.max(240, Math.min(600, svg.clientWidth));
      svg.setAttribute('viewBox', `0 0 ${chartWidth} 145`);
      const left = position(plan.x), right = position(plan.upper);
      svg.append(svgNode('rect', { x: left, y: 24, width: right - left, height: 75, rx: 6, class: 'dp-target-band' }));
      svg.append(svgNode('text', { x: (left + right) / 2, y: 42, 'text-anchor': 'middle', class: 'dp-band-label' }, chartWidth < 400 ? 'TARGET' : 'TARGET INTERVAL'));
      svg.append(svgNode('path', { d: `M24 99 H${chartWidth - 24}`, class: 'dp-axis-line' }));
      for (let i = 0; i <= scaleMax; i++) {
        const x = 24 + i / scaleMax * (chartWidth - 48);
        svg.append(svgNode('path', { d: `M${x} 95 v9`, class: 'dp-axis-line' }));
        const label = svgNode('text', { x, y: 124, 'text-anchor': 'middle', class: 'dp-tick' }, '9');
        label.append(svgNode('tspan', { 'baseline-shift': 'super', 'font-size': 10 }, i)); svg.append(label);
      }
      jumpLayer = svgNode('g', { class: 'dp-jumps' }); svg.append(jumpLayer);
      marker = svgNode('g', {}); marker.append(svgNode('circle', { r: 7, class: 'dp-marker' })); svg.append(marker);
    }
    function digitMarkup(digit, changed) { return `<span class="dp-digit${digit === null ? ' is-blank' : ''}${changed ? ' is-changed' : ''}"${digit === null ? ' aria-label="empty digit"' : ''}>${digit === null ? '□' : digit}</span>`; }
    function factorMarkup(row, changed = -1) { return row.map((digit, i) => digitMarkup(digit, i === changed)).join('<span class="dp-times">×</span>'); }
    function side(sign, frame) {
      const ids = plan.terms.map((t, i) => t.sign === sign ? i : -1).filter(i => i >= 0);
      const majority = sign === plan.majoritySign;
      const groups = new Map();
      ids.forEach(i => {
        const active = frame.change?.term === i;
        const id = frame.digits[i].join(',') + (active ? ':active' : '');
        if (!groups.has(id)) groups.set(id, { i, count: 0, active });
        groups.get(id).count++;
      });
      const sums = M.totals(plan.terms, frame.digits);
      const known = ids.every(i => frame.digits[i].every(d => d !== null));
      const sum = sums[sign === 1 ? 'positive' : 'negative'];
      const cards = [...groups.values()].map(({ i, count, active }) => `<div class="dp-term${active ? ' is-active' : ''}">${count > 1 ? `<span class="dp-repeat">${count} ×</span>` : ''}<span class="dp-factors">${factorMarkup(frame.digits[i], active ? frame.change.digit : -1)}</span></div>`).join('');
      return `<header><span class="dp-sign">${sign === 1 ? '+' : '−'} terms</span><span class="dp-role">${majority ? 'Majority' : 'Minority'} · ${ids.length}</span></header><div class="dp-total">${known ? sum : sum ? `${sum} + ?` : '—'}</div><div class="dp-terms">${cards}</div>`;
    }
    function render() {
      const frame = plan.frames[index];
      root.dataset.stage = frame.stage;
      q('positive').innerHTML = side(1, frame); q('negative').innerHTML = side(-1, frame);
      q('positive').classList.toggle('is-minority', plan.majoritySign !== 1);
      q('negative').classList.toggle('is-minority', plan.majoritySign !== -1);
      q('value').textContent = frame.stage === 'group' ? '—' : frame.value;
      q('range').textContent = `Target: ${plan.x}–${plan.upper}`;
      marker.setAttribute('transform', `translate(${position(frame.value)},99)`);
      marker.style.visibility = frame.stage === 'group' ? 'hidden' : 'visible';
      const stageIndex = ['group'].includes(frame.stage) ? 0 : ['seed', 'jump'].includes(frame.stage) ? 1 : ['cross', 'fill'].includes(frame.stage) ? 2 : 3;
      root.querySelectorAll('.dp-stages li').forEach((el, i) => { el.classList.toggle('is-current', stageIndex === i); el.classList.toggle('is-complete', i < stageIndex); if (i === stageIndex) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
      q('status').textContent = frame.message;
      q('verdict').textContent = frame.stage === 'done' ? '✓ Verified' : frame.stage === 'impossible' ? 'Impossible' : '';
      q('expression').innerHTML = plan.terms.map((t, i) => `${t.rhs ? '<span class="dp-operator">=</span>' : i ? `<span class="dp-operator">${t.sign === 1 ? '+' : '−'}</span>` : ''}<span class="dp-expression-term">${factorMarkup(frame.digits[i])}</span>`).join('');
      q('proof-text').textContent = frame.stage === 'impossible' ? `Maximum minority sum ${plan.capacity} < minimum majority sum ${plan.x}. No digit assignment can close this gap.` : `x = ${plan.x}. Every sum in [x, 9x] is possible using x digits. Replacing a factor 1 by 9 changes V to V + 8t ≤ 9V. Each jump is at most one tick; it cannot skip the target interval.`;
      controls();
    }
    function controls() {
      const ended = index === plan.frames.length - 1;
      q('play').textContent = playing ? 'Pause' : ended ? 'Replay solution' : 'Play solution';
      q('step').disabled = busy || playing || ended;
    }
    function stop() { playing = false; clearTimeout(timer); timer = null; controls(); }
    function schedule() {
      if (!playing || disposed || timer !== null) return;
      const token = epoch;
      timer = setTimeout(async () => {
        timer = null; await advance();
        if (token !== epoch || disposed) return;
        if (playing && index < plan.frames.length - 1) schedule(); else stop();
      }, (plan.frames[index].stage === 'fill' ? 95 : 420) * Number(q('speed').value));
    }
    async function advance() {
      if (busy || index >= plan.frames.length - 1 || disposed) return;
      const token = epoch, previous = plan.frames[index];
      index++; busy = true; render();
      const frame = plan.frames[index];
      if (frame.stage === 'jump') {
        const a = position(previous.value), b = position(frame.value), height = Math.min(50, 20 + (b - a) * .2);
        jumpLayer.append(svgNode('path', { d: `M${a} 99 Q${(a + b) / 2} ${99 - height * 2} ${b} 99`, class: 'dp-jump-arc' }));
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const frames = Array.from({ length: 31 }, (_, i) => { const t = i / 30; return { transform: `translate(${a + (b - a) * t}px, ${99 - 4 * height * t * (1 - t)}px)` }; });
          animation = marker.animate(frames, { duration: 750 * Number(q('speed').value), easing: 'ease-in-out' });
          await animation.finished.catch(() => {});
        }
      }
      if (token !== epoch || disposed) return;
      animation = null; busy = false; controls();
    }
    function reset(terms = plan.terms) {
      epoch++; playing = false; clearTimeout(timer); timer = null; animation?.cancel(); animation = null; busy = false;
      plan = M.solve(terms); index = 0;
      q('slots').textContent = `${terms.reduce((sum, t) => sum + t.length, 0)} digit slots`;
      q('counts').textContent = `${terms.filter(t => t.sign === 1).length} positive · ${terms.filter(t => t.sign === -1).length} negative terms`;
      chart(); render();
    }
    listen(q('play'), 'click', () => {
      if (playing) { stop(); return; }
      if (index === plan.frames.length - 1) reset();
      playing = true; controls(); schedule();
    });
    listen(q('step'), 'click', () => void advance());
    listen(q('reset'), 'click', () => reset());
    listen(q('preset'), 'change', () => reset(M.PRESETS[q('preset').value].terms));
    listen(q('proof'), 'change', () => { q('proof-text').hidden = !q('proof').checked; });
    function addGroup(side, count = 1, length = 1) {
      const list = q(`${side}-groups`).querySelector('.dp-group-list');
      const row = document.createElement('div'); row.className = 'dp-term-group'; row.innerHTML = `<label><input class="dp-group-count" type="number" min="1" max="120" value="${count}" aria-label="Number of ${side} terms"> terms</label><label>× <input class="dp-group-length" type="number" min="1" max="6" value="${length}" aria-label="Factors in each ${side} term"> factors each</label><button type="button" class="dp-remove-group" aria-label="Remove this ${side} term group">×</button>`;
      list.append(row); refreshGroupButtons();
    }
    function refreshGroupButtons() {
      for (const side of ['positive', 'negative']) {
        const rows = q(`${side}-groups`).querySelectorAll('.dp-term-group');
        rows.forEach(row => row.querySelector('.dp-remove-group').disabled = rows.length === 1);
      }
    }
    function sideLengths(side) {
      const rows = [...q(`${side}-groups`).querySelectorAll('.dp-term-group')];
      const groups = rows.map(row => ({ count: Number(row.querySelector('.dp-group-count').value), length: Number(row.querySelector('.dp-group-length').value), controls: [...row.querySelectorAll('input')] }));
      if (!groups.length || groups.some(group => group.controls.some(input => !input.reportValidity()) || !Number.isInteger(group.count) || !Number.isInteger(group.length)) || groups.reduce((total, group) => total + group.count, 0) > 120) throw new Error(`${side[0].toUpperCase() + side.slice(1)} terms must total 1–120 whole terms.`);
      return groups.flatMap(group => Array(group.count).fill(group.length));
    }
    listen(q('add-positive'), 'click', () => addGroup('positive'));
    listen(q('add-negative'), 'click', () => addGroup('negative'));
    root.querySelector('.dp-custom-sides').addEventListener('click', event => {
      const remove = event.target.closest('.dp-remove-group'); if (!remove || remove.disabled) return;
      remove.closest('.dp-term-group').remove(); refreshGroupButtons();
    }, { signal: events.signal });
    listen(q('custom'), 'click', () => {
      try {
        const positive = sideLengths('positive'), negative = sideLengths('negative');
        q('error').textContent = ''; q('preset').selectedIndex = -1;
        reset(M.fromSides(positive, [...negative, 1]));
      } catch (error) { q('error').textContent = error.message || 'Enter whole numbers within the indicated limits.'; }
    });
    addGroup('positive', 12, 1); addGroup('negative', 4, 2);
    reset(M.PRESETS.large.terms);
    return () => { disposed = true; epoch++; clearTimeout(timer); animation?.cancel(); events.abort(); root.remove(); };
  }
  window.JournalWidgets = window.JournalWidgets || [];
  window.JournalWidgets.push({ id: 'digit-puzzle', title: 'Digit Puzzle', pages: [29, 30, 31, 32, 33, 34, 35, 36], badge: { page: 34, y: .30 }, mount });
})();
