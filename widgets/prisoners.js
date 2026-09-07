(() => {
  'use strict';

  const BOOK = [5, 4, 6, 8, 7, 3, 1, 2];
  function effective(contents, labels) { return labels.map(physical => contents[physical]); }
  function cycles(permutation) {
    const seen = new Set(), result = [];
    for (let start = 1; start <= permutation.length; start++) {
      if (seen.has(start)) continue;
      const cycle = [];
      for (let id = start; !seen.has(id); id = permutation[id - 1]) {
        cycle.push(id); seen.add(id);
      }
      result.push(cycle);
    }
    return result;
  }
  function swapLabels(labels, a, b) {
    const next = labels.slice();
    [next[a - 1], next[b - 1]] = [next[b - 1], next[a - 1]];
    return next;
  }
  function parsePermutation(text) {
    const tokens = text.trim().split(/[\s,]+/);
    if (tokens.length < 2 || tokens.length > 100 || tokens.some(token => !/^\d+$/.test(token))) return null;
    const values = tokens.map(Number);
    return new Set(values).size === values.length && values.every(value => value >= 1 && value <= values.length) ? values : null;
  }
  const model = { effective, cycles, swapLabels, parsePermutation };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  if (typeof window === 'undefined') return;

  function mount(container) {
    const events = new AbortController();
    const root = document.createElement('div'); root.className = 'pg-widget';
    root.innerHTML = `
      <p class="pg-intro">Follow locker numbers to find your prisoner’s ID. As the guard, you can announce swaps of <em>interpreted locker IDs</em> to split long cycles. The physical contents never move.</p>
      <details class="pg-setup"><summary>Choose a permutation</summary>
        <label>Contents of physical lockers 1, 2, … <textarea class="pg-input" rows="2" spellcheck="false" aria-label="Locker contents"></textarea></label>
        <div class="pg-controls"><button type="button" data-action="apply">Apply</button><button type="button" data-action="book">Book example</button><button type="button" data-action="long">One long cycle (8)</button><button type="button" data-action="full">One long cycle (100)</button></div>
        <p class="pg-note">Enter each integer from 1 to N exactly once, separated by spaces or commas (2–100 lockers).</p>
        <p class="pg-error" role="alert"></p>
      </details>
      <div class="pg-controls pg-options"><label>Prisoner <select class="pg-prisoner" aria-label="Prisoner ID"></select></label><label>Opening budget <input class="pg-budget" type="number" min="1" max="8" value="2"></label><button type="button" data-action="step">Open next locker</button><button type="button" data-action="restart">Restart walk</button></div>
      <p class="pg-walk-status" role="status" aria-live="polite"></p>
      <div class="pg-lockers" aria-label="Physical lockers, interpreted IDs, and fixed contents"></div>
      <p class="pg-note">Each card stays in its physical position. “ID” is the announced label; “inside” is the fixed contents. The outlined card is the next to open.</p>
      <ol class="pg-trace" aria-label="Opened lockers"></ol>
      <section class="pg-guard"><h3>Guard’s announcement</h3><div class="pg-controls"><label>Swap ID <select class="pg-swap-a" aria-label="First interpreted ID"></select></label><label>with ID <select class="pg-swap-b" aria-label="Second interpreted ID"></select></label><button type="button" data-action="swap">Announce swap</button><button type="button" data-action="undo">Undo swap</button><button type="button" data-action="reset">Reset labels</button></div><p class="pg-announcement" aria-live="polite"></p></section>
      <section class="pg-cycle-section"><h3>Cycles after relabelling</h3><p class="pg-cycle-status"></p><div class="pg-cycles"></div><p class="pg-note">Arrows follow interpreted ID → contents. A prisoner succeeds exactly when their cycle fits the budget. Swapping IDs in one cycle splits it; swapping across cycles merges them.</p></section>`;
    container.append(root);
    const find = selector => root.querySelector(selector);
    const input = find('.pg-input'), prisonerInput = find('.pg-prisoner'), budgetInput = find('.pg-budget');
    const aInput = find('.pg-swap-a'), bInput = find('.pg-swap-b');
    let contents = BOOK.slice(), labels = [], history = [], walk = [], prisoner = 1, budget = 2;
    function optionList(select, size, selected) {
      select.replaceChildren(...Array.from({ length: size }, (_, i) => new Option(String(i + 1), String(i + 1))));
      select.value = String(selected);
    }
    function reset(values, quota) {
      contents = values.slice(); labels = contents.map((_, i) => i); history = []; walk = []; prisoner = 1; budget = quota;
      input.value = contents.join(', '); budgetInput.max = String(contents.length); budgetInput.value = String(budget);
      optionList(prisonerInput, contents.length, 1); optionList(aInput, contents.length, 1); optionList(bInput, contents.length, 2);
      find('.pg-error').textContent = ''; render();
    }
    function node(tag, className, text) {
      const element = document.createElement(tag); element.className = className; element.textContent = text; return element;
    }
    function render() {
      const permutation = effective(contents, labels), groups = cycles(permutation);
      const found = walk.length > 0 && walk.at(-1).value === prisoner;
      const exhausted = walk.length >= budget, next = walk.length ? walk.at(-1).value : prisoner;
      const longest = Math.max(...groups.map(group => group.length));
      find('[data-action="step"]').disabled = found || exhausted;
      find('[data-action="undo"]').disabled = find('[data-action="reset"]').disabled = history.length === 0;
      find('.pg-walk-status').textContent = found
        ? `Prisoner ${prisoner} found their ID in ${walk.length} of ${budget} openings.`
        : exhausted ? `Budget used: prisoner ${prisoner} has not found their ID. Try splitting their cycle.`
          : `Prisoner ${prisoner}: ${walk.length} / ${budget} opened. Next: interpreted locker ${next} (physical locker ${labels[next - 1] + 1}).`;
      const lockers = find('.pg-lockers'); lockers.replaceChildren();
      contents.forEach((value, physical) => {
        const id = labels.indexOf(physical) + 1;
        const card = node('div', 'pg-locker', '');
        if (walk.some(opening => opening.physical === physical)) card.classList.add('pg-opened');
        if (!found && !exhausted && id === next) card.classList.add('pg-next');
        card.append(node('span', 'pg-physical', `Physical ${physical + 1}`), node('strong', 'pg-label', `ID ${id}`), node('span', 'pg-content', `inside: ${value}`));
        lockers.append(card);
      });
      find('.pg-trace').replaceChildren(...walk.map(opening => node('li', '', `Open ID ${opening.id} (physical ${opening.physical + 1}) → find ${opening.value}${opening.value === prisoner ? ' ✓' : ''}`)));
      find('.pg-announcement').textContent = history.length
        ? `${history.length} ${history.length === 1 ? 'swap' : 'swaps'} announced: ${history.map(entry => `${entry.a} ↔ ${entry.b}`).join('; ')}. Every swap restarts the demonstration walk.`
        : 'No swaps announced. Choose two interpreted IDs; all prisoners use the updated labels.';
      const cycleStatus = find('.pg-cycle-status');
      cycleStatus.textContent = `Longest cycle: ${longest}. Budget: ${budget}. ${longest <= budget ? 'All prisoners can succeed.' : 'Not all prisoners can succeed yet.'}`;
      cycleStatus.classList.toggle('pg-success', longest <= budget);
      find('.pg-cycles').replaceChildren(...groups.map(group => {
        const line = node('div', `pg-cycle ${group.length <= budget ? 'pg-safe' : 'pg-long'}`, '');
        line.append(node('strong', '', `${group.length <= budget ? 'Within budget' : 'Over budget'} · ${group.length}: `));
        line.append(node('span', '', [...group, group[0]].join(' → '))); return line;
      }));
    }
    root.addEventListener('click', event => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'apply') {
        const values = parsePermutation(input.value);
        if (!values) { find('.pg-error').textContent = 'Use each integer from 1 to N exactly once, with 2–100 entries.'; return; }
        reset(values, Math.max(1, Math.floor(values.length / 4))); return;
      }
      if (action === 'book') { reset(BOOK, 2); return; }
      if (action === 'long' || action === 'full') {
        const size = action === 'full' ? 100 : 8;
        reset(Array.from({ length: size }, (_, i) => (i + 1) % size + 1), size / 4); return;
      }
      if (action === 'step') {
        if (walk.length >= budget || walk.at(-1)?.value === prisoner) return;
        const id = walk.length ? walk.at(-1).value : prisoner, physical = labels[id - 1];
        walk.push({ id, physical, value: contents[physical] });
      } else if (action === 'restart') walk = [];
      else if (action === 'swap') {
        const a = Number(aInput.value), b = Number(bInput.value);
        if (a === b) { find('.pg-announcement').textContent = 'Choose two different IDs to swap.'; return; }
        history.push({ a, b }); labels = swapLabels(labels, a, b); walk = [];
      } else if (action === 'undo') {
        const previous = history.pop(); if (previous) labels = swapLabels(labels, previous.a, previous.b); walk = [];
      } else if (action === 'reset') { labels = contents.map((_, i) => i); history = []; walk = []; }
      render();
    }, { signal: events.signal });
    prisonerInput.addEventListener('change', () => { prisoner = Number(prisonerInput.value); walk = []; render(); }, { signal: events.signal });
    budgetInput.addEventListener('change', () => {
      budget = Math.min(contents.length, Math.max(1, Math.floor(Number(budgetInput.value)) || 1));
      budgetInput.value = String(budget); walk = []; render();
    }, { signal: events.signal });
    reset(BOOK, 2);
    return () => { events.abort(); root.remove(); };
  }
  window.JournalWidgets = window.JournalWidgets || [];
  window.JournalWidgets.push({ id: 'prisoners-gamble', title: 'Prisoners’ Gamble', pages: [90, 91, 92], y: 0.46, mount });
})();
