(() => {
  'use strict';
  const M = window.SeatingDP, fmt = d => d === Infinity ? '∞' : String(d);
  function mount(container) {
    const root = document.createElement('div'); root.className = 'sd-widget';
    const dialog = container.closest('dialog'); dialog?.classList.add('sd-dialog');
    root.innerHTML = `
      <div class="sd-tabs" role="tablist" aria-label="Introvert Seating solution">
        <button role="tab" data-sd="distances" aria-selected="true">1 · Compact distances</button>
        <button role="tab" data-sd="query" aria-selected="false">2 · Can Y get K?</button>
      </div>
      <p class="sd-intro" data-sd="intro"></p>
      <form class="sd-setup" data-sd="setup">
        <label>Seats N<input data-sd="n" type="number" min="1" max="512" value="64" required></label>
        <label>First seat<input data-sd="first" type="number" min="0" max="63" value="23" required></label>
        <label>Arrival X<input data-sd="x" type="number" min="1" max="64" value="12" required></label>
        <label>Target seat Y<input data-sd="y" type="number" min="0" max="63" value="42" required></label>
        <button type="submit">Build case</button>
        <label class="sd-preset">Example<select data-sd="preset"><option value="">Custom</option><option value="book">Book · 8 seats</option><option value="overlap">Overlapping states · 16</option><option value="large">Large room · 256</option><option value="largest">512 seats</option></select></label>
      </form>
      <p class="sd-error" data-sd="error" role="alert"></p>
      <div class="sd-controls">
        <button data-sd="reset" title="Restart this animation">↺</button>
        <button data-sd="back" aria-label="Previous step">←</button>
        <button class="sd-primary" data-sd="step">Step →</button>
        <button data-sd="play">▶ Play</button>
        <button data-sd="finish">Finish</button>
        <select data-sd="speed" aria-label="Animation speed"><option value="850">Slow</option><option value="450" selected>Normal</option><option value="120">Fast</option></select>
        <label class="sd-memo"><input type="checkbox" data-sd="memo" checked> Merge repeated states (DP)</label>
      </div>
      <div class="sd-status" data-sd="status" role="status" aria-live="polite"></div>
      <div class="sd-workspace">
        <section class="sd-state">
          <div class="sd-heading"><h3>Room overview</h3><span data-sd="room-label"></span></div>
          <div data-sd="room" class="sd-room"></div>
          <p class="sd-key"><i class="sd-first"></i> First <i class="sd-target"></i> Y <i class="sd-range"></i> Selected interval</p>
          <div class="sd-heading"><h3>Sorted distance array</h3><span data-sd="compression"></span></div>
          <div class="sd-histogram" data-sd="histogram"></div>
          <p class="sd-rank" data-sd="rank"></p>
          <div class="sd-inspector" data-sd="inspector"></div>
        </section>
        <section class="sd-tree-pane">
          <div class="sd-heading"><h3 data-sd="tree-title">Recursion tree</h3><span data-sd="metrics"></span></div>
          <div class="sd-tree" data-sd="tree" aria-label="Branching recursion tree"></div>
          <div class="sd-tree-key"><span><i class="sd-current-key"></i> Active path</span><span><i class="sd-done-key"></i> Returned</span><span><i class="sd-cache-key"></i> Cached</span><span>Drag to pan · click to inspect</span></div>
        </section>
      </div>
      <details class="sd-notes"><summary>What does this state mean?</summary><p data-sd="notes"></p></details>`;
    container.append(root);
    const q = name => root.querySelector(`[data-sd="${name}"]`), abort = new AbortController();
    const on = (el, name, fn) => el.addEventListener(name, fn, { signal: abort.signal });
    let n = 64, first = 23, x = 12, y = 42, mode = 'distances', trace, base, k, cursor = 0, selected = 0, timer = null, disposed = false;
    let visible = new Map(), counts = new Map(), histogramMarkup = '';
    const tree = new window.SeatingDPTree(q('tree'), id => { stop(); selected = id; render(); });
    function stop() { clearTimeout(timer); timer = null; q('play').textContent = '▶ Play'; }
    function build() {
      stop(); base = M.distanceTrace(n, first, true); k = M.kth(base.histogram, x);
      trace = mode === 'distances' ? M.distanceTrace(n, first, q('memo').checked) : M.queryTrace(n, first, y, k, q('memo').checked);
      cursor = 0; selected = 0; tree.reset();
      q('intro').textContent = mode === 'distances'
        ? 'Split intervals, collect distance × frequency, and reuse matching lengths.'
        : `Can arrival ${x} choose seat ${y}? Follow only intervals containing Y, and try both centers when tied.`;
      q('notes').textContent = mode === 'distances'
        ? 'Fix the first person. Each room end is then assigned its distance to that person. All remaining intervals have occupied seats on both sides. A closed interval of length L contributes ⌈L/2⌉ once, plus the distance arrays for lengths ⌊(L−1)/2⌋ and ⌈(L−1)/2⌉. Cache by L: the same distances apply at any position. Values here are distances when seats are taken, not their current distances. Seats are numbered 0 to N−1.'
        : 'K is the X-th value in the fixed, sorted distance array. For each closed interval [l,r], try its one or two centers and keep only the subinterval containing Y. If a center is Y, test its distance against K. Cache by (l,r,K); Y stays fixed for the whole run. Both center choices are explored even after a Yes, to reveal overlaps. No branch without Y is expanded. This tests one first seat, not the full outer search over every first seat.';
      render();
    }
    function rebuildState() {
      visible = new Map(); counts = new Map();
      for (const e of trace.events.slice(0, cursor)) {
        if (e.type === 'enter') visible.set(e.id, 'active');
        if (e.type === 'return') visible.set(e.id, 'done');
        if (e.type === 'reuse') visible.set(e.id, 'cached');
        if (e.values) for (const [d, count] of e.values) counts.set(d, (counts.get(d) || 0) + count);
      }
    }
    function narrative(e) {
      if (!e) return 'Ready. Step through the recursion, or press Play.';
      const node = trace.nodes[e.id], label = e.id === 0 ? 'the room' : `[${node.l}, ${node.r}]`;
      if (e.type === 'enter') return e.id === 0 ? `Fix the first person at seat ${first}.` : `Enter ${label}: ${node.r - node.l + 1} seats${mode === 'query' ? `; keep Y = ${y}, seek K = ${fmt(k)}` : ''}.`;
      if (e.type === 'add') return e.id === 0 ? 'Record ∞ for the first person and the distances of the room ends.' : `Choose center ${node.center}. Add one distance ${fmt(e.values[0][0])}; then split around it.`;
      if (e.type === 'reuse') return `Reuse state #${node.reuse + 1}${mode === 'distances' ? `: add its ${node.length} cached distances without splitting again.` : `: the same [l,r,K] already returned ${node.result ? 'Yes' : 'No'}.`}`;
      if (e.type === 'branch') return `Try center ${e.middle}. Keep the ${y < e.middle ? 'left' : 'right'} interval containing Y; discard the other side.`;
      if (e.type === 'test') return `Seat ${y} is chosen at distance ${fmt(node.distance)}. ${fmt(node.distance)} ${e.result ? '=' : '≠'} K (${fmt(k)}) → ${e.result ? 'Yes' : 'No'}.`;
      if (e.id === 0) return mode === 'distances' ? `Complete: ${n} distances stored in ${base.histogram.length} groups. Arrival ${x} needs K = ${fmt(k)}.` : `${node.result ? 'Yes' : 'No'} — with first seat ${first}, arrival ${x} ${node.result ? 'can' : 'cannot'} choose seat ${y}.`;
      return mode === 'distances' ? `Return ${label}: merge its center and child arrays. Cache ${node.length} distances by length ${node.length}.` : `Return ${label}: ${node.result ? 'Yes — at least one center choice works.' : 'No — neither center choice works.'}`;
    }
    function roomMarkup(l, r, local = false, node = null) {
      const span = r - l + 1, bins = Math.min(span, local ? 32 : 128), w = 640 / bins;
      const event = trace.events[cursor - 1];
      const markers = local && node?.id ? (event?.id === node.id && event.middle !== undefined ? [event.middle] : mode === 'distances' ? [node.center] : node.centers) : [];
      let svg = `<svg viewBox="0 0 640 ${local ? 68 : 50}" role="img" aria-label="Seats ${l} to ${r}${local ? ', magnified interval' : ', room overview'}">`;
      for (let i = 0; i < bins; i++) {
        const a = l + Math.floor(i * span / bins), b = l + Math.floor((i + 1) * span / bins) - 1;
        const target = a <= y && y <= b, initial = a <= first && first <= b;
        const inRange = node && a <= node.r && b >= node.l;
        const fill = target ? '#bc792b' : initial ? '#334b48' : inRange || local ? '#81b5a5' : '#dce7e2';
        const label = a === b ? `Seat ${a}` : `Seats ${a}–${b}`;
        svg += `<rect x="${i * w + .5}" y="3" width="${Math.max(.5, w - 1)}" height="25" rx="${Math.min(3, w / 4)}" fill="${fill}"><title>${label}${target ? ' · contains Y' : ''}${initial ? ' · contains first person' : ''}</title></rect>`;
        if (local && bins <= 16) svg += `<text x="${(i + .5) * w}" y="45" text-anchor="middle">${a === b ? a : `${a}–${b}`}</text>`;
      }
      for (const middle of markers) {
        const position = (middle - l + .5) / span * 640;
        svg += `<path d="M${position - 5} 0 L${position} 7 L${position + 5} 0Z" fill="#4771a2"/><line x1="${position}" x2="${position}" y1="7" y2="28" stroke="#4771a2" stroke-width="2"/><text x="${position}" y="63" text-anchor="middle" style="fill:#4771a2">C</text>`;
      }
      // Separate markers still distinguish Y and first when they share a bin.
      if (!local) {
        svg += `<text x="${Math.max(7, Math.min(628, (first + .5) / n * 640))}" y="44" text-anchor="middle">F</text>`;
        svg += `<text x="${Math.max(7, Math.min(628, (y + .5) / n * 640))}" y="44" text-anchor="middle" fill="#a3631c">Y</text>`;
      }
      return svg + '</svg>';
    }
    function inspect() {
      const node = trace.nodes[selected], known = visible.get(selected), complete = known === 'done' || known === 'cached';
      q('room-label').textContent = `0–${n - 1} · ${n > 128 ? 'grouped' : 'one tick / seat'}`;
      q('room').innerHTML = roomMarkup(0, n - 1, false, node);
      const length = node.r - node.l + 1;
      let details = selected === 0
        ? `First = ${first}. ${first > 0 ? `Left end: d = ${first}. ` : ''}${first < n - 1 ? `Right end: d = ${n - 1 - first}.` : ''}`
        : mode === 'distances'
          ? `L = ${length} → ${Math.floor((length - 1) / 2)} + center + ${Math.ceil((length - 1) / 2)}. Center contributes d = ${Math.ceil(length / 2)}.`
          : `State (${node.l}, ${node.r}, ${fmt(k)}) · Y = ${y}. Centers: ${node.centers.join(' or ')}; d = ${node.distance}.`;
      if (known === 'cached') details += ` Reuses #${node.reuse + 1}.`;
      if (selected !== 0) details += ` Occupied boundaries: ${node.l - 1} and ${node.r + 1}. C marks ${mode === 'distances' ? 'the chosen center' : 'the candidate centers'}.`;
      let result = '';
      if (complete) result = mode === 'distances' ? node.result.map(([d, count]) => `${fmt(d)} × ${count}`).join(' · ') : `Answer: ${node.result ? 'Yes' : 'No'}`;
      q('inspector').innerHTML = `<div class="sd-heading"><h3>State #${selected + 1} · [${node.l}, ${node.r}]</h3><span>${length} seats</span></div>${roomMarkup(node.l, node.r, true, node)}<p>${details}</p>${result ? `<div class="sd-local-result">${result}</div>` : '<div class="sd-local-result">Result not returned yet</div>'}${known === 'cached' ? `<button data-jump="${node.reuse}">↗ Inspect cached state #${node.reuse + 1}</button>` : ''}`;
    }
    function render(follow = false) {
      rebuildState();
      const current = trace.events[cursor - 1];
      q('status').textContent = narrative(current);
      q('status').classList.toggle('is-complete', cursor === trace.events.length);
      q('back').disabled = !cursor; q('step').disabled = q('play').disabled = q('finish').disabled = cursor === trace.events.length;
      q('tree-title').textContent = q('memo').checked ? 'Recursion with memoization' : 'Recursion without memoization';
      const hits = [...visible.values()].filter(s => s === 'cached').length;
      q('metrics').textContent = `${visible.size} calls · ${hits} reused`;
      const histogram = mode === 'query' ? base.histogram : [...counts].sort((a, b) => b[0] - a[0]);
      const assigned = histogram.reduce((sum, [, count]) => sum + count, 0);
      q('compression').textContent = `${assigned}/${n} values · ${histogram.length} groups`;
      let rank = 1;
      const nextHistogramMarkup = histogram.map(([d, count]) => {
        const start = rank; rank += count;
        const chosen = assigned === n && x >= start && x < rank;
        return `<div class="sd-group${chosen ? ' is-k' : ''}" title="Sorted positions ${start}–${rank - 1}"><strong>${fmt(d)}</strong><span>× ${count}</span><i style="--fill:${count / n * 100}%"></i></div>`;
      }).join('') || '<span class="sd-empty">Distances appear as calls contribute.</span>';
      // Inspecting another call must not fade/recreate the completed array.
      if (nextHistogramMarkup !== histogramMarkup) { q('histogram').innerHTML = nextHistogramMarkup; histogramMarkup = nextHistogramMarkup; }
      q('rank').textContent = assigned === n ? `Sorted position X = ${x} → K = ${fmt(k)}${mode === 'query' ? ' · test Y = ' + y : ''}` : 'Distance × frequency · the gold group contains the X-th value.';
      tree.render(trace.nodes, visible, selected, current?.id, (node, state, active) => {
        const id = node.id;
        const result = state === 'cached' ? `↗ Reuse #${node.reuse + 1}` : state === 'done' ? (mode === 'distances' ? `${node.result.reduce((s, [, c]) => s + c, 0)} values` : node.result ? 'Yes' : 'No') : active ? '● Active' : 'Waiting for children';
        return `<span class="sd-node-number">#${id + 1}${active ? ' · now' : ''}</span><strong>${id === 0 ? `First seat ${first}` : mode === 'distances' ? `Length ${node.length}` : `[${node.l}, ${node.r}]`}</strong><small>${id === 0 ? `${n} seats` : mode === 'distances' ? `[${node.l}, ${node.r}]` : `K = ${fmt(k)} · center ${node.via}`}</small><span class="sd-answer">${result}</span>`;
      }, follow);
      inspect();
    }
    function step() { if (disposed || cursor >= trace.events.length) { stop(); return; } selected = trace.events[cursor++].id; render(true); if (cursor === trace.events.length) stop(); }
    function tick() { step(); if (cursor < trace.events.length && !disposed) timer = setTimeout(tick, Number(q('speed').value)); }
    function applyForm() {
      if (!q('setup').reportValidity()) return;
      [n, first, x, y] = ['n', 'first', 'x', 'y'].map(key => Number(q(key).value));
      q('error').textContent = ''; build();
    }
    on(q('n'), 'input', () => { const value = Number(q('n').value); q('first').max = q('y').max = String(value - 1); q('x').max = String(value); });
    on(q('setup'), 'submit', e => { e.preventDefault(); applyForm(); });
    on(q('preset'), 'change', () => {
      const values = { book: [8, 5, 4, 2], overlap: [16, 0, 5, 6], large: [256, 0, 100, 85], largest: [512, 171, 200, 340] }[q('preset').value];
      if (!values) return;
      ['n', 'first', 'x', 'y'].forEach((key, i) => { q(key).value = values[i]; });
      q('first').max = q('y').max = String(values[0] - 1); q('x').max = String(values[0]); applyForm();
    });
    for (const tab of ['distances', 'query']) on(q(tab), 'click', () => {
      mode = tab; for (const name of ['distances', 'query']) q(name).setAttribute('aria-selected', String(name === tab)); build();
    });
    on(q('memo'), 'change', build);
    on(q('reset'), 'click', build);
    on(q('step'), 'click', () => { stop(); step(); });
    on(q('back'), 'click', () => { stop(); cursor = Math.max(0, cursor - 1); selected = trace.events[cursor - 1]?.id || 0; render(true); });
    on(q('finish'), 'click', () => { stop(); cursor = trace.events.length; selected = 0; render(); tree.fit(); });
    on(q('play'), 'click', () => { if (timer !== null) stop(); else { tree.resume(); q('play').textContent = 'Ⅱ Pause'; tick(); } });
    on(q('inspector'), 'click', e => { const button = e.target.closest('[data-jump]'); if (button) { stop(); selected = Number(button.dataset.jump); render(); tree.inspect(selected); } });
    build();
    return () => { disposed = true; stop(); tree.destroy(); abort.abort(); dialog?.classList.remove('sd-dialog'); root.remove(); };
  }
  (window.JournalWidgets = window.JournalWidgets || []).push({ id: 'introvert-seating-dp', title: 'Introvert Seating', pages: [83, 84, 85], badge: { page: 84, y: .55 }, mount });
})();
