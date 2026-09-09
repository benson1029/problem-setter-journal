(() => {
  'use strict';
  const M = window.FaultlineModel;
  const NS = 'http://www.w3.org/2000/svg';
  const FAMILY = { horizontal: 'Horizontal', left: 'Left diagonal', right: 'Right diagonal' };
  const pointId = p => `${p.row},${p.col}`;
  function mount(container) {
    const root = document.createElement('section'); root.className = 'fl-widget';
    root.innerHTML = `
      <p class="fl-intro">Explore how shortest paths, sensor rings and corner choices reveal a faultline.</p>
      <div class="fl-tabs" role="tablist" aria-label="Faultline exploration">
        <button type="button" role="tab" aria-selected="true" aria-controls="fl-paths" data-fl-tab="paths">1 · Shortest paths</button>
        <button type="button" role="tab" aria-selected="false" aria-controls="fl-sensor" data-fl-tab="sensor">2 · Sensor ring</button>
        <button type="button" role="tab" aria-selected="false" aria-controls="fl-discover" data-fl-tab="discover">3 · Discover</button>
        <button type="button" role="tab" aria-selected="false" aria-controls="fl-corners" data-fl-tab="corners">4 · Corner DP</button>
      </div>
      <section id="fl-paths" class="fl-panel" role="tabpanel" data-fl-panel="paths">
        <div class="fl-controls"><label>Example<select data-fl="path-example"><option value="shortest">A shortest path</option><option value="detour">Three edge families</option><option value="reverse">Two families, still a detour</option><option value="empty">Draw your own</option></select></label><label>Rows<input type="number" min="3" max="13" value="8" data-fl="path-size"></label></div>
        <div class="fl-controls"><button type="button" data-fl="path-undo">Undo</button><button type="button" data-fl="clear-path">Clear</button><button type="button" data-fl="shortest">Shorten</button><button type="button" data-fl="rotate">↻ Rotate 120°</button></div>
        <svg data-fl="path-grid" viewBox="0 0 560 560" role="group" aria-label="Draw a route on the triangular grid"></svg>
        <div class="fl-family" aria-label="Edge families"><span data-family="left">╱ Left diagonal</span><span data-family="right">╲ Right diagonal</span><span data-family="horizontal">— Horizontal</span></div>
        <p class="fl-status" data-fl="path-status" role="status" aria-live="polite"></p>
        <p class="fl-help">Tap adjacent vertices to extend the route; tap the previous vertex to undo.</p>
        <details><summary>What makes a path shortest?</summary><p>Three edge families always give a detour. Two families alone are not enough: direction matters too. Compare your move count with the shortest distance between the endpoints.</p></details>
      </section>
      <section id="fl-sensor" class="fl-panel" role="tabpanel" data-fl-panel="sensor" hidden>
        <div class="fl-controls fl-sensor-controls"><label>Rows<input type="number" min="3" max="13" value="9" data-fl="sensor-size"></label><label>Reading <strong data-fl="reading-value">2</strong><input type="range" min="0" max="8" value="2" data-fl="reading" aria-label="Sensor reading"></label></div>
        <div class="fl-controls"><button type="button" data-fl="sensor-draw" aria-pressed="true">Draw faultline</button><button type="button" data-fl="sensor-move" aria-pressed="false">Move sensor</button><button type="button" data-fl="sensor-undo">Undo</button><button type="button" data-fl="sensor-clear">Clear</button></div>
        <svg data-fl="sensor-grid" viewBox="0 0 560 455" role="group" aria-label="Sensor distance ring on a triangular grid"></svg>
        <div class="fl-legend"><span><i class="is-sensor"></i>Sensor</span><span><i class="is-ring"></i>Exact reading</span><span><i class="is-inside"></i>Too close</span><span><i class="is-fault"></i>Your path</span></div>
        <div class="fl-checks" data-fl="sensor-checks"></div>
        <p class="fl-status" data-fl="sensor-status" role="status" aria-live="polite"></p>
        <p class="fl-help" data-fl="sensor-help"></p>
        <details><summary>Edit sensor coordinates</summary><div class="fl-controls"><label>Row<input type="number" min="1" value="5" data-fl="sensor-row"></label><label>Column<input type="number" min="1" value="3" data-fl="sensor-col"></label><button type="button" data-fl="sensor-apply">Place sensor</button><button type="button" data-fl="sensor-reset">Reset example</button></div><p role="alert" class="fl-error" data-fl="sensor-error"></p></details>
      </section>
      <section id="fl-discover" class="fl-panel" role="tabpanel" data-fl-panel="discover" hidden>
        <p class="fl-scope">Each shortest path touches the hexagon without entering its interior. What stays the same?</p>
        <div class="fl-controls fl-discovery-controls"><button type="button" class="fl-primary" data-fl="random-path">↻ Random path</button><label><input type="checkbox" data-fl="highlight-corners"> Highlight left / right corners</label></div>
        <svg data-fl="discovery-grid" class="fl-discovery-grid" viewBox="0 0 560 455" role="group" aria-label="A generated top-to-bottom path touching the hexagon"></svg>
        <div class="fl-legend"><span><i class="is-sensor"></i>Sensor</span><span><i class="is-ring"></i>Hexagon boundary</span><span><i class="is-path"></i>Generated path</span></div>
        <p class="fl-status" data-fl="discovery-status" role="status" aria-live="polite"></p>
        <p class="fl-help">Generate a few paths, then reveal the corners to compare.</p>
      </section>
      <section id="fl-corners" class="fl-panel" role="tabpanel" data-fl-panel="corners" hidden>
        <p class="fl-scope">Top-to-bottom paths: pick one reachable corner for each sensor.</p>
        <div class="fl-controls"><label>Example<select data-fl="corner-example"><option value="book">Book example · 13 rows</option><option value="small">Small example · 7 rows</option><option value="impossible">Conflicting readings</option><option value="custom" disabled>Your example</option></select></label><button type="button" data-fl="edit-case" aria-expanded="false" aria-controls="fl-case-editor">Edit example</button></div>
        <section id="fl-case-editor" data-fl="case-editor" class="fl-case-editor" aria-label="Edit sensor case" hidden><div class="fl-controls"><label>Rows<input type="number" min="3" max="16" data-fl="case-size"></label><label>Bottom column<input type="number" min="1" data-fl="case-end"></label></div><p>Top (1, 1) and the bottom endpoint both have reading 0.</p><div class="fl-editor-head"><span>Row</span><span>Column</span><span>Reading</span><span></span></div><div data-fl="sensor-rows"></div><div class="fl-controls"><button type="button" data-fl="add-sensor">+ Sensor</button><button type="button" class="fl-primary" data-fl="apply-case">Apply example</button><button type="button" data-fl="cancel-case">Cancel</button></div><p role="alert" class="fl-error" data-fl="case-error"></p></section>
        <div class="fl-controls"><button type="button" class="fl-primary" data-fl="corner-play">▶ Play DP</button><button type="button" data-fl="corner-step">Next sensor</button><button type="button" data-fl="corner-reset">Restart</button><label><input type="checkbox" data-fl="show-ring" checked> Sensor ring</label></div>
        <div class="fl-dp-layout"><svg data-fl="corner-grid" viewBox="0 0 560 455" role="group" aria-label="Corner choices and recovered faultline"></svg><aside class="fl-trace"><h3>Sensor → corner choices</h3><div data-fl="corner-trace"></div></aside></div>
        <div class="fl-legend"><span><i class="is-corner"></i>Corner choice</span><span><i class="is-reachable"></i>Reachable</span><span><i class="is-path"></i>Recovered path</span></div>
        <p class="fl-status" data-fl="corner-status" role="status" aria-live="polite"></p>
        <p class="fl-help">Select a sensor in the trace to inspect its ring and corners.</p>
        <details><summary>Why two corners? When does this apply?</summary><p>A shortest path from row 1 to the bottom visits one point per row. For a sensor (r, c) with reading d, it must pass through (r, c − d) or (r, c + d). Outside-grid corners cannot be used.</p><p>A downward move keeps the column or increases it by one. DP keeps every reachable choice and traces a route back from the bottom. If a faultline can start or stop midway, this corner-only test is insufficient.</p></details>
      </section>`;
    container.append(root);
    const q = name => root.querySelector(`[data-fl="${name}"]`);
    const events = new AbortController();
    const listen = (el, event, fn) => el.addEventListener(event, fn, { signal: events.signal });
    const coord = p => `(${p.row}, ${p.col})`;
    const gridEvents = new Map();
    let rotation = null, rotationEpoch = 0, disposed = false;
    const svgNode = (tag, attrs = {}, text) => { const el = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); if (text !== undefined) el.textContent = text; return el; };
    function xy(point, n) {
      // Equilateral and inscribed in a circle: a real 120° rotation maps
      // exactly onto M.rotate(), and fits inside the canvas throughout.
      const step = Math.sqrt(3) * 240 / (n - 1), dy = 360 / (n - 1);
      return { x: 280 + (point.col - (point.row + 1) / 2) * step, y: 40 + (point.row - 1) * dy };
    }
    function line(svg, a, b, n, className) {
      const p = xy(a, n), q = xy(b, n); svg.append(svgNode('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: className }));
    }
    function grid(svg, n, classFor, labelFor, click) {
      gridEvents.get(svg)?.abort(); const handlers = new AbortController(); gridEvents.set(svg, handlers);
      const listenNode = (el, event, fn) => el.addEventListener(event, fn, { signal: handlers.signal });
      const focused = svg.contains(document.activeElement) ? document.activeElement.dataset.point : null;
      svg.replaceChildren();
      const title = svgNode('title', {}, svg.getAttribute('aria-label')); svg.append(title);
      const world = svgNode('g', { class: 'fl-world' }); svg.append(world);
      M.vertices(n).forEach(p => {
        if (p.col < p.row) line(world, p, { row: p.row, col: p.col + 1 }, n, 'fl-grid-edge');
        if (p.row < n) {
          line(world, p, { row: p.row + 1, col: p.col }, n, 'fl-grid-edge');
          line(world, p, { row: p.row + 1, col: p.col + 1 }, n, 'fl-grid-edge');
        }
      });
      const marks = svgNode('g', { class: 'fl-marks' }); world.append(marks);
      const nodes = svgNode('g', { class: 'fl-nodes' }); world.append(nodes);
      const labels = svgNode('g', { class: 'fl-labels', 'aria-hidden': 'true' }); svg.append(labels);
      const coordinate = p => {
        labels.replaceChildren(); if (rotation) return;
        const pos = xy(p, n), scale = 560 / Math.max(240, svg.clientWidth || 560);
        labels.append(svgNode('text', { x: Math.max(32 * scale, Math.min(560 - 32 * scale, pos.x)), y: pos.y + 19 * scale, 'font-size': 12 * scale, 'text-anchor': 'middle', class: 'fl-coordinate' }, coord(p)));
      };
      M.vertices(n).forEach(p => {
        const pos = xy(p, n), group = svgNode('g', { class: `fl-node ${classFor?.(p) || ''}`, transform: `translate(${pos.x},${pos.y})`, 'data-point': pointId(p), role: 'button', tabindex: pointId(p) === (focused || '1,1') ? '0' : '-1', 'aria-label': coord(p) });
        group.append(svgNode('circle', { r: Math.min(22, Math.sqrt(3) * 240 / (n - 1) * .48), class: 'fl-hit' }), svgNode('circle', { r: 4.2, class: 'fl-dot' }));
        listenNode(group, 'pointerenter', () => coordinate(p));
        listenNode(group, 'focus', () => coordinate(p));
        listenNode(group, 'click', () => { if (!rotation) { click?.(p); const textLayer = svg.querySelector('.fl-labels'); if (textLayer && !textLayer.children.length) { const pos = xy(p,n), scale = 560 / Math.max(240,svg.clientWidth); textLayer.append(svgNode('text', { x: Math.max(32*scale,Math.min(560-32*scale,pos.x)), y:pos.y+19*scale, 'font-size':12*scale, 'text-anchor':'middle', class:'fl-coordinate' }, coord(p))); } } });
        listenNode(group, 'keydown', event => {
          if (rotation) return;
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); click?.(p); return; }
          const next = { ...p };
          if (event.key === 'ArrowLeft') next.col--; else if (event.key === 'ArrowRight') next.col++; else if (event.key === 'ArrowUp') { next.row--; next.col = Math.min(next.col,next.row); } else if (event.key === 'ArrowDown') next.row++; else return;
          event.preventDefault(); if (!M.valid(next,n)) return;
          nodes.querySelectorAll('[tabindex]').forEach(el => el.setAttribute('tabindex',el.dataset.point === pointId(next) ? '0':'-1'));
          nodes.querySelector(`[data-point="${pointId(next)}"]`)?.focus();
        });
        nodes.append(group);
      });
      if (focused) nodes.querySelector(`[data-point="${focused}"]`)?.focus({preventScroll:true});
      return marks;
    }

    // Shortest-path explorer.
    let pathN = 8, path = M.shortestPath({ row: 1, col: 1 }, { row: 7, col: 5 }, pathN);
    function renderPath(message = '') {
      const pathKeys = new Set(path.map(pointId)), neighbors = new Set(path.length ? M.neighbors(path.at(-1),pathN).map(pointId) : []);
      const marks = grid(q('path-grid'), pathN, p => pathKeys.has(pointId(p)) ? 'is-on-path' : neighbors.has(pointId(p)) ? 'is-next' : '', null, point => {
        if (!path.length) path = [point];
        else if (path.length > 1 && M.same(point, path.at(-2))) path.pop();
        else if (M.edgeType(path.at(-1), point)) path.push(point);
        else { renderPath('Choose a neighbouring vertex.'); return; }
        renderPath();
      });
      for (let i = 1; i < path.length; i++) line(marks, path[i - 1], path[i], pathN, `fl-route is-${M.edgeType(path[i - 1], path[i])}`);
      if (path.length) {
        const a = xy(path[0], pathN), b = xy(path.at(-1), pathN);
        marks.append(svgNode('circle', { cx: a.x, cy: a.y, r: 8, class: 'fl-endpoint' }), svgNode('circle', { cx: b.x, cy: b.y, r: 8, class: 'fl-endpoint' }));
      }
      const info = M.pathInfo(path);
      root.querySelectorAll('.fl-family span').forEach(el => el.classList.toggle('is-used', info.families.includes(el.dataset.family)));
      q('shortest').disabled = path.length < 2 || info.shortest;
      q('path-undo').disabled = !path.length;
      if (message) q('path-status').textContent = message;
      else if (!path.length) q('path-status').textContent = 'Choose a starting point, then trace along neighbours.';
      else if (info.shortest) q('path-status').innerHTML = `<strong>Shortest</strong> · ${info.moves} moves · ${info.families.map(type => FAMILY[type]).join(' + ') || 'one vertex'}`;
      else q('path-status').innerHTML = `<strong>Can be shortened</strong> · ${info.moves} moves drawn, but the endpoints are only ${info.direct} apart${info.families.length === 3 ? ' · all three edge families appear' : ''}.`;
      q('path-grid').setAttribute('aria-label', `Path with ${info.moves} moves. ${info.shortest ? 'It is shortest.' : `Endpoint distance is ${info.direct}.`}`);
      q('path-grid').dataset.path = path.map(pointId).join(';');
    }
    function cancelRotation() { rotationEpoch++; rotation?.cancel(); rotation = null; q('path-grid').removeAttribute('aria-busy'); q('rotate').disabled=false; q('path-example').disabled=false; q('path-size').disabled=false; }
    function loadPathExample() {
      cancelRotation(); const type=q('path-example').value;
      path = type==='empty' ? [] : type==='detour' ? [{row:1,col:1},{row:2,col:1},{row:2,col:2},{row:3,col:3}]
        : type==='reverse' ? [{row:3,col:1},{row:3,col:2},{row:2,col:1},{row:2,col:2}]
        : M.shortestPath({row:1,col:1},{row:pathN,col:Math.ceil(pathN*.65)},pathN); renderPath();
    }
    listen(q('path-example'),'change',loadPathExample);
    listen(q('path-size'),'change',()=>{const n=Number(q('path-size').value); if(!Number.isInteger(n)||n<3||n>13){q('path-size').reportValidity();return;} pathN=n;loadPathExample();});
    listen(q('path-undo'),'click',()=>{cancelRotation();path.pop();renderPath();});
    listen(q('clear-path'), 'click', () => { cancelRotation(); path = []; renderPath(); });
    listen(q('shortest'), 'click', () => { cancelRotation(); if (path.length > 1) { path = M.shortestPath(path[0], path.at(-1), pathN); renderPath(); } });
    listen(q('rotate'), 'click', async () => {
      if(rotation) return;
      const token=++rotationEpoch, world=q('path-grid').querySelector('.fl-world'); q('path-grid').querySelector('.fl-labels').replaceChildren();
      q('path-grid').setAttribute('aria-busy','true'); q('rotate').disabled=true; q('path-size').disabled=true; q('path-example').disabled=true;
      world.style.transformOrigin='280px 280px';
      rotation=world.animate([{transform:'rotate(0deg)'},{transform:'rotate(120deg)'}],{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?1:1000,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'});
      await rotation.finished.catch(()=>{}); if(token!==rotationEpoch||disposed) return;
      path=path.map(p=>M.rotate(p,pathN));cancelRotation();renderPath('Rotated 120°. Distances and shortest-path validity are preserved.');
    });

    // Single-sensor ring explorer.
    let sensorN = 9, sensor = { row: 5, col: 3 }, sensorD = 2, fault = [], sensorMode = 'draw';
    function shadeRing(svg, center, d, n) {
      const world=svg.querySelector('.fl-world'), clipId=`fl-clip-${svg.dataset.fl}`;
      const pts=list=>list.map(p=>{const pos=xy(p,n);return `${pos.x},${pos.y}`;}).join(' ');
      const clip=svgNode('clipPath',{id:clipId}); clip.append(svgNode('polygon',{points:pts([{row:1,col:1},{row:n,col:1},{row:n,col:n}])}));
      const layer=svgNode('g');layer.append(clip);
      if(d){ const r=center.row,c=center.col;layer.append(svgNode('polygon',{points:pts([{row:r-d,col:c-d},{row:r-d,col:c},{row:r,col:c+d},{row:r+d,col:c+d},{row:r+d,col:c},{row:r,col:c-d}]),class:'fl-ring-shape','clip-path':`url(#${clipId})`})); }
      else {const pos=xy(center,n);layer.append(svgNode('circle',{cx:pos.x,cy:pos.y,r:12,class:'fl-ring-shape'}));}
      world.prepend(layer);
    }
    function renderSensor() {
      const ring = M.ring(sensor, sensorD, sensorN), ringKeys = new Set(ring.map(pointId)), insideKeys = new Set(M.interior(sensor, sensorD, sensorN).map(pointId));
      const faultKeys=new Set(fault.map(pointId));
      const marks=grid(q('sensor-grid'), sensorN, p => {
        const id = pointId(p); return [M.same(p, sensor) ? 'is-sensor' : '', ringKeys.has(id) ? 'is-ring' : '', insideKeys.has(id) ? 'is-inside' : '', faultKeys.has(id) ? 'is-fault' : ''].filter(Boolean).join(' ');
      }, null, p => {
        if(sensorMode==='move') sensor=p;
        else if(!fault.length) fault.push(p);
        else if(fault.length>1&&M.same(p,fault.at(-2))) fault.pop();
        else if(M.same(p,fault.at(-1))) return;
        else if(M.edgeType(fault.at(-1),p)) fault.push(p);
        else {q('sensor-status').textContent='Choose a neighbouring point, or Clear to start a new faultline.';return;}
        renderSensor();
      });
      shadeRing(q('sensor-grid'),sensor,sensorD,sensorN);
      for(let i=1;i<fault.length;i++) line(marks,fault[i-1],fault[i],sensorN,'fl-recovered');
      q('reading-value').textContent = sensorD; q('reading').value = sensorD;
      q('sensor-row').value=sensor.row;q('sensor-col').value=sensor.col;q('sensor-undo').disabled=!fault.length;
      const distances=fault.map(p=>M.distance(p,sensor)), touches=distances.includes(sensorD), avoids=fault.length&&!distances.some(d=>d<sensorD), shortest=M.pathInfo(fault).shortest;
      q('sensor-checks').innerHTML=[['Touches ring',touches],['Avoids interior',avoids],['Shortest path',shortest]].map(([label,pass])=>`<span class="${fault.length?pass?'is-pass':'is-fail':''}">${fault.length?pass?'✓':'×':'—'} ${label}</span>`).join('');
      q('sensor-status').textContent=fault.length?`${touches&&avoids&&shortest?'✓ Valid faultline':'Not valid yet'} · actual reading ${Math.min(...distances)}, required ${sensorD}.`:`Sensor ${coord(sensor)} · draw a path or choose a single point. Required reading: ${sensorD}.`;
      q('sensor-help').textContent=sensorMode==='draw'?'Tap adjacent points to draw. A single point is a valid shortest path too.':'Tap any point to move the sensor. Your path stays in place.';
      q('sensor-grid').setAttribute('aria-label', `Sensor at ${sensor.row}, ${sensor.col}, reading ${sensorD}. ${ring.length} vertices on the distance ring.`);
    }
    listen(q('reading'), 'input', () => { sensorD = Number(q('reading').value); renderSensor(); });
    for(const mode of ['draw','move']) listen(q(`sensor-${mode}`),'click',()=>{sensorMode=mode;q('sensor-draw').setAttribute('aria-pressed',String(mode==='draw'));q('sensor-move').setAttribute('aria-pressed',String(mode==='move'));renderSensor();});
    listen(q('sensor-clear'),'click',()=>{fault=[];renderSensor();});
    listen(q('sensor-undo'),'click',()=>{fault.pop();renderSensor();});
    listen(q('sensor-size'),'change',()=>{const n=Number(q('sensor-size').value);if(!Number.isInteger(n)||n<3||n>13){q('sensor-size').reportValidity();return;}sensorN=n;sensor={row:Math.min(sensor.row,n),col:Math.min(sensor.col,n)};fault=[];sensorD=Math.min(sensorD,n-1);q('reading').max=n-1;renderSensor();});
    listen(q('sensor-apply'),'click',()=>{const p={row:Number(q('sensor-row').value),col:Number(q('sensor-col').value)};if(!M.valid(p,sensorN)){q('sensor-error').textContent=`Use 1 ≤ column ≤ row ≤ ${sensorN}.`;return;}q('sensor-error').textContent='';sensor=p;renderSensor();});
    listen(q('sensor-reset'), 'click', () => { sensorN=9;sensor = { row: 5, col: 3 }; sensorD = 2; fault = [];q('sensor-size').value=9;q('reading').max=8;q('sensor-error').textContent='';renderSensor(); });

    // Observation discovery: random paths are constrained by distances only.
    const discoveryN = 11, discoverySensor = { row: 7, col: 4, d: 2 };
    let discoveryPath = M.randomSensorPath(discoverySensor, discoveryN);
    function renderDiscovery() {
      const svg = q('discovery-grid'), highlight = q('highlight-corners').checked;
      const pathKeys = new Set(discoveryPath.map(pointId));
      const ringKeys = new Set(M.ring(discoverySensor, discoverySensor.d, discoveryN).map(pointId));
      const pair = M.corners(discoverySensor, discoveryN);
      const marks = grid(svg, discoveryN, p => [
        ringKeys.has(pointId(p)) ? 'is-ring' : '',
        pathKeys.has(pointId(p)) ? 'is-on-path' : '',
        M.same(p, discoverySensor) ? 'is-sensor' : '',
      ].filter(Boolean).join(' '));
      // This grid is for inspection only; tapping never changes the path.
      svg.querySelectorAll('.fl-node').forEach(node => node.setAttribute('role', 'img'));
      shadeRing(svg, discoverySensor, discoverySensor.d, discoveryN);
      for (let i = 1; i < discoveryPath.length; i++) line(marks, discoveryPath[i - 1], discoveryPath[i], discoveryN, 'fl-recovered');
      if (highlight) {
        const overlay = svgNode('g', { class: 'fl-discovery-corners', 'pointer-events': 'none' });
        for (const p of pair) {
          const pos = xy(p, discoveryN);
          overlay.append(svgNode('circle', { cx: pos.x, cy: pos.y, r: 13, class: 'fl-corner-halo' }));
        }
        svg.querySelector('.fl-world').append(overlay);
      }
      svg.dataset.path = discoveryPath.map(pointId).join(';');
      const side = M.same(discoveryPath[discoverySensor.row - 1], pair[0]) ? 'left' : 'right';
      q('discovery-status').textContent = highlight
        ? `This path visits the ${side} corner ${coord(pair[side === 'left' ? 0 : 1])}. Try another path.`
        : `✓ Top to bottom · ${discoveryN - 1} moves · sensor reading ${M.reading(discoveryPath, discoverySensor)}.`;
    }
    listen(q('random-path'), 'click', () => {
      const previous = discoveryPath.map(pointId).join(';');
      for (let attempt = 0; attempt < 8; attempt++) {
        discoveryPath = M.randomSensorPath(discoverySensor, discoveryN);
        if (discoveryPath.map(pointId).join(';') !== previous) break;
      }
      renderDiscovery();
    });
    listen(q('highlight-corners'), 'change', renderDiscovery);

    // Corner-choice reachability explorer.
    const CASES={book:{n:13,end:10,sensors:[{row:3,col:2,d:1},{row:7,col:3,d:2},{row:10,col:5,d:3}]},small:{n:7,end:5,sensors:[{row:3,col:2,d:1},{row:5,col:3,d:1}]},impossible:{n:7,end:2,sensors:[{row:3,col:2,d:1},{row:5,col:5,d:0}]}};
    let cornerN=13,sensors=[],progress = 0, timer = null, playing = false, selectedLayer=0;
    function stop() { playing = false; clearTimeout(timer); timer = null; q('corner-play').textContent = '▶ Play DP';q('corner-step').disabled=progress>=sensors.length; }
    function renderCorners() {
      const result = M.solveCorners(sensors, cornerN),active=result.layers[selectedLayer];
      const cornerKeys = new Set(active.options.map(option=>pointId(option.point)));
      const visibleReachable = new Set(result.layers.slice(0, progress).flatMap(layer => layer.options.filter(option => option.reachable).map(option => pointId(option.point))));
      const failed=new Set(result.layers.slice(0,progress).flatMap(layer=>layer.options.filter(option=>!option.reachable).map(option=>pointId(option.point))));
      const chosenKeys = new Set(progress >= sensors.length ? result.chosen.map(pointId) : []);
      const marks = grid(q('corner-grid'), cornerN, p => {
        const id = pointId(p); return [M.same(p,active.sensor) ? 'is-sensor-center' : '', cornerKeys.has(id) ? 'is-corner' : '', visibleReachable.has(id) ? 'is-reachable' : '', failed.has(id)&&!visibleReachable.has(id)?'is-unreachable':'', chosenKeys.has(id) ? 'is-chosen' : ''].filter(Boolean).join(' ');
      }, null, p => {
        const i=result.layers.findIndex(layer=>M.same(layer.sensor,p));if(i>=0){stop();selectedLayer=i;renderCorners();}
      });
      if(q('show-ring').checked) shadeRing(q('corner-grid'),active.sensor,active.sensor.d,cornerN);
      if(selectedLayer>0) for(const before of result.layers[selectedLayer-1].options) for(const after of active.options) if(M.canConnect(before.point,after.point)) line(marks,before.point,after.point,cornerN,before.reachable&&selectedLayer<progress?'fl-choice-link is-live':'fl-choice-link');
      if (progress >= sensors.length && result.possible) for (let i = 1; i < result.path.length; i++) line(marks, result.path[i - 1], result.path[i], cornerN, 'fl-recovered');
      q('corner-trace').innerHTML=result.layers.map((layer,i)=>`<button type="button" class="fl-trace-row${i===selectedLayer?' is-selected':''}" data-layer="${i}" aria-pressed="${i===selectedLayer}"><span>${i===0?'Start':i===sensors.length-1?'End':`Sensor ${i}`} ${coord(layer.sensor)} <b>d = ${layer.sensor.d}</b></span><span class="fl-options">${layer.options.length?layer.options.map(o=>`<span class="${i<progress?o.reachable?'is-pass':'is-fail':''}">${i<progress?o.reachable?'✓':'×':'○'} ${coord(o.point)}</span>`).join(''):'<span class="is-fail">No corner inside the grid</span>'}</span></button>`).join('');
      q('corner-step').disabled = playing || progress >= sensors.length;
      const verified=result.possible&&sensors.every(s=>M.reading(result.path,s)===s.d);
      q('corner-grid').dataset.progress=progress;q('corner-grid').dataset.solved=String(progress>=sensors.length&&verified);
      if (progress >= sensors.length) q('corner-status').textContent = verified ? `✓ Faultline recovered · ${result.path.length-1} moves · all ${sensors.length} readings verified.` : 'No valid top-to-bottom faultline for these readings. Inspect the first unreachable sensor in the trace.';
      else if(!progress) q('corner-status').textContent='Play or step through the sensors from top to bottom. Select any sensor to inspect its ring.';
      else {
        const layer = result.layers[progress-1], count = layer.options.filter(option => option.reachable).length;
        q('corner-status').textContent = `Processed ${progress}/${sensors.length} · ${count} reachable choice(s) at row ${layer.sensor.row}.`;
      }
      q('corner-grid').setAttribute('aria-label', `Processed ${progress} of ${sensors.length} sensors.`);
    }
    function cornerStep() { if (progress < sensors.length) { selectedLayer=progress; progress++; renderCorners(); } }
    function schedule() { if (!playing || progress >= sensors.length) { stop(); return; } timer = setTimeout(() => { cornerStep(); schedule(); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : 650); }
    listen(q('corner-step'), 'click', cornerStep);
    listen(q('corner-play'), 'click', () => { if (playing) stop(); else { if (progress >= sensors.length) progress = 0; playing = true; q('corner-play').textContent = 'Ⅱ Pause'; renderCorners(); schedule(); } });
    listen(q('corner-reset'), 'click', () => { stop(); progress = 0; selectedLayer=0;renderCorners(); });
    listen(q('show-ring'),'change',renderCorners);
    listen(q('corner-trace'),'click',event=>{const row=event.target.closest('[data-layer]');if(row){stop();selectedLayer=Number(row.dataset.layer);renderCorners();}});
    function editorRow(s={row:2,col:1,d:0}){
      const row=document.createElement('div');row.className='fl-editor-row';
      row.innerHTML=`<input type="number" min="2" value="${s.row}" data-field="row" aria-label="Sensor row"><input type="number" min="1" value="${s.col}" data-field="col" aria-label="Sensor column"><input type="number" min="0" value="${s.d}" data-field="d" aria-label="Sensor reading"><button type="button" data-remove aria-label="Remove sensor">×</button>`;
      q('sensor-rows').append(row);
    }
    function fillEditor(){q('case-size').value=cornerN;q('case-end').value=sensors.at(-1).col;q('sensor-rows').replaceChildren();sensors.slice(1,-1).forEach(editorRow);q('case-error').textContent='';}
    function closeEditor(){q('case-editor').hidden=true;q('edit-case').setAttribute('aria-expanded','false');}
    function loadCase(id){const data=CASES[id];cornerN=data.n;sensors=[{row:1,col:1,d:0},...data.sensors.map(s=>({...s})),{row:data.n,col:data.end,d:0}];stop();progress=0;selectedLayer=0;fillEditor();closeEditor();renderCorners();}
    listen(q('corner-example'),'change',()=>{if(CASES[q('corner-example').value])loadCase(q('corner-example').value);});
    listen(q('edit-case'),'click',()=>{stop();if(!q('case-editor').hidden){closeEditor();return;}fillEditor();q('case-editor').hidden=false;q('edit-case').setAttribute('aria-expanded','true');q('case-size').focus({preventScroll:true});});
    listen(q('cancel-case'),'click',()=>{closeEditor();q('edit-case').focus({preventScroll:true});});
    listen(q('case-editor'),'input',()=>{q('case-error').textContent='';});
    listen(q('add-sensor'),'click',()=>{if(q('sensor-rows').children.length>=12){q('case-error').textContent='Use at most 12 additional sensors.';return;}editorRow();});
    listen(q('sensor-rows'),'click',event=>{if(event.target.closest('[data-remove]')){event.target.closest('.fl-editor-row').remove();q('case-error').textContent='';}});
    listen(q('apply-case'),'click',()=>{
      const n=Number(q('case-size').value),end=Number(q('case-end').value),entries=[...q('sensor-rows').children].map(row=>Object.fromEntries([...row.querySelectorAll('input')].map(input=>[input.dataset.field,input.value.trim()===''?NaN:Number(input.value)])));
      if(!Number.isInteger(n)||n<3||n>16||!Number.isInteger(end)||end<1||end>n){q('case-error').textContent='Use 3–16 rows and a bottom column between 1 and the row count.';return;}
      if(entries.some(s=>!M.valid(s,n)||s.row<=1||s.row>=n||!Number.isInteger(s.d)||s.d<0||s.d>=n)){q('case-error').textContent=`Each sensor needs 2 ≤ row < ${n}, 1 ≤ column ≤ row, and a whole reading from 0 to ${n-1}.`;return;}
      if(new Set(entries.map(pointId)).size!==entries.length){q('case-error').textContent='Use distinct sensor positions.';return;}
      stop();cornerN=n;sensors=[{row:1,col:1,d:0},...entries,{row:n,col:end,d:0}];progress=0;selectedLayer=0;q('case-error').textContent='';closeEditor();q('corner-example').value='custom';renderCorners();q('edit-case').focus({preventScroll:true});
    });

    const tabs=[...root.querySelectorAll('[data-fl-tab]')];
    tabs.forEach((tab,index) => {
      tab.id=`fl-tab-${tab.dataset.flTab}`;
      tab.tabIndex=index===0?0:-1;
      root.querySelector(`[data-fl-panel="${tab.dataset.flTab}"]`).setAttribute('aria-labelledby',tab.id);
      listen(tab,'keydown',event=>{
        const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
        if(next===null)return;event.preventDefault();tabs[next].click();tabs[next].focus();
      });
      listen(tab, 'click', () => {
      stop(); cancelRotation(); const name = tab.dataset.flTab;
      tabs.forEach(button => {button.setAttribute('aria-selected', String(button === tab));button.tabIndex=button===tab?0:-1;});
      root.querySelectorAll('[data-fl-panel]').forEach(panel => panel.hidden = panel.dataset.flPanel !== name);
      if(name==='paths')renderPath();else if(name==='sensor')renderSensor();else if(name==='discover')renderDiscovery();else renderCorners();
    });});
    loadCase('book');renderPath();renderSensor();
    return () => { disposed=true;stop();cancelRotation();gridEvents.forEach(controller=>controller.abort()); events.abort(); root.remove(); };
  }
  (window.JournalWidgets = window.JournalWidgets || []).push({ id: 'faultline', title: 'Faultline of the Earthquake', pages: [53, 54, 55, 56, 57, 58, 59, 60, 61], badge: { page: 59, y: .58 }, mount });
})();
