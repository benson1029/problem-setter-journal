(function () {
  'use strict';
  const LIMIT = 24;
  function valid(text) { return typeof text === 'string' && /^[0-9]{1,24}$/.test(text); }
  function positions(text) {
    if (!valid(text)) throw new Error('Use 1–24 decimal characters.');
    return Array.from(text.matchAll(/10/g), match => match.index);
  }
  function digits(text, joined = new Set()) {
    positions(text);
    const result = [];
    for (let i = 0; i < text.length; i++) {
      if (text.slice(i, i + 2) === '10' && joined.has(i)) { result.push(10); i++; }
      else result.push(Number(text[i]));
    }
    return result;
  }
  function value(tokens) { return tokens.reduce((sum, digit) => sum * 11n + BigInt(digit), 0n); }
  function range(text) {
    return { min: value(digits(text, new Set(positions(text)))), max: value(digits(text)) };
  }
  function relation(x, y) {
    const a = range(x), b = range(y);
    return a.min > b.max ? '>' : a.max < b.min ? '<' : '?';
  }
  const model = { valid, positions, digits, value, range, relation };
  if (typeof module !== 'undefined' && module.exports) module.exports = model;
  if (typeof window === 'undefined') return;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function mount(container) {
    const events = new AbortController();
    const on = (node, name, callback) => node.addEventListener(name, callback, { signal: events.signal });
    let numbers = ['81056', '80823'], joined = [new Set(), new Set()], revealed = false;
    const root = element('div', 'undecimal-widget');
    root.append(element('p', 'ud-intro', 'Alice writes the base-11 digit ten as “10”. But “10” can also mean two digits, one and zero. Tap each outlined pair to join or split it, then compare the possible readings.'));
    const presets = element('div', 'ud-controls');
    const makeButton = text => { const node = element('button', '', text); node.type = 'button'; return node; };
    [['Book example 1', ['81056', '80823']], ['Book example 2', ['1010', '55']]].forEach(([label, pair]) => {
      const button = makeButton(label); presets.append(button);
      on(button, 'click', () => load(pair));
    });
    root.append(presets);
    const form = element('form', 'ud-controls ud-inputs');
    const inputs = ['X', 'Y'].map((name, index) => {
      const label = element('label', '', name);
      const input = element('input'); input.type = 'text'; input.inputMode = 'numeric';
      input.maxLength = LIMIT; input.pattern = '[0-9]{1,24}'; input.required = true;
      input.value = numbers[index]; input.autocomplete = 'off'; input.spellcheck = false;
      input.setAttribute('aria-label', `${name}, Alice's number (1 to 24 digits)`);
      label.append(input); form.append(label); return input;
    });
    const apply = element('button', '', 'Explore'); apply.type = 'submit'; form.append(apply); root.append(form);
    root.append(element('p', 'ud-note', 'Custom examples: 1–24 characters, using 0–9. Every calculation below is exact.'));
    const cards = element('div', 'ud-cards');
    const panels = ['X', 'Y'].map(name => {
      const card = element('section', 'ud-card'); card.append(element('h3', '', `${name} · choose a reading`));
      const tokens = element('div', 'ud-tokens'); tokens.setAttribute('aria-label', `${name} digit grouping`);
      const representation = element('p', 'ud-representation');
      const decimal = element('p', 'ud-decimal'); decimal.setAttribute('aria-live', 'polite');
      const controls = element('div', 'ud-controls');
      const combine = makeButton('Join all'), split = makeButton('Split all'); controls.append(combine, split);
      card.append(tokens, representation, decimal, controls); cards.append(card);
      return { card, tokens, representation, decimal, combine, split };
    });
    root.append(cards);
    const comparison = element('p', 'ud-comparison'); comparison.setAttribute('role', 'status'); root.append(comparison);
    root.append(element('p', 'ud-note', 'This compares only your selected readings. Can you decide which number is larger for every possible reading?'));
    const reveal = makeButton('Reveal ranges and conclusion'); reveal.className = 'ud-reveal'; reveal.setAttribute('aria-expanded', 'false');
    const explanation = element('div', 'ud-explanation'); explanation.hidden = true; explanation.setAttribute('aria-live', 'polite');
    root.append(reveal, explanation); container.append(root);

    function load(pair) {
      numbers = pair.slice(); joined = [new Set(), new Set()]; revealed = false;
      inputs.forEach((input, i) => { input.value = numbers[i]; input.setCustomValidity(''); }); render();
    }
    function render() {
      panels.forEach((panel, index) => {
        const text = numbers[index], spots = positions(text), reading = digits(text, joined[index]);
        panel.tokens.replaceChildren();
        for (let i = 0; i < text.length; i++) {
          if (text.slice(i, i + 2) === '10') {
            const offset = i, isJoined = joined[index].has(i);
            const button = makeButton(isJoined ? '10' : '1 | 0'); button.className = 'ud-pair';
            button.dataset.offset = String(offset); button.setAttribute('aria-pressed', String(isJoined));
            button.setAttribute('aria-label', `${index ? 'Y' : 'X'}, characters ${i + 1} and ${i + 2}: ${isJoined ? 'one digit ten; activate to split' : 'two digits one and zero; activate to join'}`);
            panel.tokens.append(button); i++;
          } else panel.tokens.append(element('span', 'ud-digit', text[i]));
        }
        panel.representation.textContent = `[${reading.join(', ')}] in base 11`;
        panel.decimal.textContent = `= ${value(reading).toLocaleString('en-US')} in decimal`;
        panel.combine.disabled = !spots.length || spots.every(offset => joined[index].has(offset));
        panel.split.disabled = !joined[index].size;
      });
      const x = value(digits(numbers[0], joined[0])), y = value(digits(numbers[1], joined[1]));
      comparison.textContent = `For these readings: X ${x > y ? '>' : x < y ? '<' : '='} Y.`;
      explanation.hidden = !revealed; reveal.setAttribute('aria-expanded', String(revealed));
      reveal.textContent = revealed ? 'Hide ranges and conclusion' : 'Reveal ranges and conclusion';
      explanation.replaceChildren();
      if (revealed) {
        numbers.forEach((text, index) => {
          const limits = range(text);
          explanation.append(element('p', '', `${index ? 'Y' : 'X'}: minimum ${limits.min.toLocaleString('en-US')} · maximum ${limits.max.toLocaleString('en-US')}`));
        });
        const result = relation(...numbers);
        explanation.append(element('p', 'ud-verdict', result === '?' ? 'Neither X > Y nor Y > X is guaranteed.' : `X ${result} Y is guaranteed for every reading.`));
        explanation.append(element('p', '', 'Joining every “10” gives the minimum; splitting every pair gives the maximum. A strict comparison is guaranteed only when one minimum is greater than the other maximum. These endpoints do not imply that every value between them is possible.'));
      }
    }
    panels.forEach((panel, index) => {
      on(panel.tokens, 'click', event => {
        const button = event.target.closest('button[data-offset]'); if (!button) return;
        const offset = Number(button.dataset.offset);
        if (joined[index].has(offset)) joined[index].delete(offset); else joined[index].add(offset);
        render(); panel.tokens.querySelector(`[data-offset="${offset}"]`).focus();
      });
      on(panel.combine, 'click', () => { joined[index] = new Set(positions(numbers[index])); render(); });
      on(panel.split, 'click', () => { joined[index].clear(); render(); });
    });
    inputs.forEach(input => on(input, 'input', () => input.setCustomValidity(valid(input.value) ? '' : 'Enter 1–24 characters using only 0–9.')));
    on(form, 'submit', event => { event.preventDefault(); if (inputs.every(input => valid(input.value))) load(inputs.map(input => input.value)); });
    on(reveal, 'click', () => { revealed = !revealed; render(); });
    render();
    return () => { events.abort(); root.remove(); };
  }
  window.JournalWidgets = window.JournalWidgets || [];
  window.JournalWidgets.push({ id: 'ambiguous-undecimal', title: 'Ambiguous Undecimal System', pages: [17], y: 482 / 1331, offsetY: 64, mount });
})();
