(() => {
  'use strict';
  const presets = [
    ['book', 'Book · 2 × 2', 2, 2, 2, 2],
    ['square', '3 × 3 · centre flag', 3, 3, 2, 2],
    ['wide', '3 × 4 · inner flag', 3, 4, 2, 3],
    ['centre', '5 × 5 · centre flag', 5, 5, 3, 3],
    ['rectangle', '6 × 10 · edge flag', 6, 10, 1, 6],
    ['chain', '1 × 20 · middle flag', 1, 20, 1, 10],
    ['vertical', '20 × 1 · middle flag', 20, 1, 10, 1],
    ['long', '1 × 60 · long chain', 1, 60, 1, 30],
  ];
  function validate(config) {
    const { rows, cols, target } = config;
    if (![rows, cols].every(n => Number.isInteger(n) && n >= 1 && n <= 200)) throw Error('Use 1–200 rows and columns.');
    if (rows * cols > 400) throw Error('Use at most 400 cells for this interactive grid.');
    if (!target || !target.every(Number.isInteger) || target[0] < 0 || target[0] >= rows || target[1] < 0 || target[1] >= cols) throw Error('Place the flag inside the grid.');
    return config;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { presets, validate };
  if (typeof window === 'undefined') return;
  function mount(container, initial, apply) {
    const form = document.createElement('form'); form.className = 'arctic-setup'; form.noValidate = true;
    form.innerHTML = `<label class="arctic-preset">Example<select data-arctic="preset">${presets.map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}<option value="custom">Custom</option></select></label>
      <label>Rows<input data-arctic="rows" type="number" min="1" max="200" required></label><label>Columns<input data-arctic="cols" type="number" min="1" max="200" required></label>
      <label>Flag row<input data-arctic="target-row" type="number" min="1" required></label><label>Flag column<input data-arctic="target-col" type="number" min="1" required></label><button type="submit">Apply</button>
      <small>Up to 400 cells · scroll larger grids</small><p class="arctic-setup-error" role="alert"></p>`;
    container.append(form); const q = name => form.querySelector(`[data-arctic="${name}"]`), abort = new AbortController();
    function set(config) {
      q('rows').value = config.rows; q('cols').value = config.cols;
      q('target-row').value = config.target[0] + 1; q('target-col').value = config.target[1] + 1;
      q('target-row').max = config.rows; q('target-col').max = config.cols;
      q('preset').value = presets.find(p => p[2] === config.rows && p[3] === config.cols && p[4] === config.target[0]+1 && p[5] === config.target[1]+1)?.[0] || 'custom';
      form.querySelector('.arctic-setup-error').textContent = '';
    }
    function submit() {
      try {
        const config = validate({rows:Number(q('rows').value),cols:Number(q('cols').value),target:[Number(q('target-row').value)-1,Number(q('target-col').value)-1]});
        set(config); apply(config);
      } catch(error) { form.querySelector('.arctic-setup-error').textContent = error.message; }
    }
    form.addEventListener('submit', e => { e.preventDefault(); submit(); }, {signal:abort.signal});
    q('preset').addEventListener('change', () => { const p=presets.find(p=>p[0]===q('preset').value); if(p){set({rows:p[2],cols:p[3],target:[p[4]-1,p[5]-1]});submit();} }, {signal:abort.signal});
    form.addEventListener('input', event => {if(event.target.tagName!=='INPUT')return;q('preset').value='custom';q('target-row').max=q('rows').value;q('target-col').max=q('cols').value;}, {signal:abort.signal});
    set(initial); return {set,destroy(){abort.abort();form.remove();}};
  }
  window.ArcticSetup = { presets, validate, mount };
})();
