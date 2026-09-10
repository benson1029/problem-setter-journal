// Persistent branching-tree nodes and a camera local to the tree viewport.
// Playback never scrolls the surrounding reader or removes a focused button.
(() => {
  'use strict';
  window.SeatingDPTree = function (host, select) {
    host.innerHTML = `<div class="sd-tree-tools"><label><input type="checkbox" data-tree="follow" checked> Follow active</label><button data-tree="active">Active node</button><button data-tree="fit">Fit tree</button><button data-tree="out" aria-label="Zoom tree out">−</button><output data-tree="zoom">100%</output><button data-tree="in" aria-label="Zoom tree in">+</button></div><div class="sd-tree-viewport" data-tree="viewport" aria-label="Branching recursion tree. Drag to pan."><div class="sd-tree-scene" data-tree="scene"><svg class="sd-edges" data-tree="edges" aria-hidden="true"></svg><div data-tree="nodes"></div></div><p class="sd-tree-empty" data-tree="empty">Step to create the root call.<br>Branches will grow here.</p></div>`;
    const q = key => host.querySelector(`[data-tree="${key}"]`), abort = new AbortController();
    const on = (el, event, fn) => el.addEventListener(event, fn, { signal: abort.signal });
    const elements = new Map(), edges = new Map(), positions = new Map();
    const card = { width: 142, height: 80, gap: 24, level: 130, margin: 28 };
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 1, height = 1, camera = { x: 0, y: 0, scale: 1 }, fitted = false, pan = null, currentId = 0;
    function applyCamera(animate = true) {
      q('scene').style.transitionDuration = animate && !reducedMotion ? '220ms' : '0ms';
      q('scene').style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
      q('zoom').textContent = `${Math.round(camera.scale * 100)}%`;
    }
    function fit(animate = true) {
      const box = q('viewport');
      camera.scale = Math.min(1, (box.clientWidth - 20) / width, (box.clientHeight - 20) / height);
      camera.x = (box.clientWidth - width * camera.scale) / 2;
      camera.y = (box.clientHeight - height * camera.scale) / 2;
      applyCamera(animate);
    }
    function center(id, animate = true, readable = false) {
      const point = positions.get(id); if (!point) return;
      if (readable) camera.scale = Math.max(.85, camera.scale);
      const box = q('viewport'), s = camera.scale;
      camera.x = box.clientWidth / 2 - (point.x + card.width / 2) * s;
      camera.y = box.clientHeight / 2 - (point.y + card.height / 2) * s;
      // Keep available parent/sibling context without wasting space at edges.
      camera.x = width * s <= box.clientWidth ? (box.clientWidth - width * s) / 2 : Math.max(box.clientWidth - width * s, Math.min(0, camera.x));
      camera.y = height * s <= box.clientHeight ? (box.clientHeight - height * s) / 2 : Math.max(box.clientHeight - height * s, Math.min(0, camera.y));
      applyCamera(animate);
    }
    function zoom(factor) {
      fitted = false; q('follow').checked = false;
      const box = q('viewport'), old = camera.scale, next = Math.max(.025, Math.min(1.6, old * factor));
      camera.x = box.clientWidth / 2 - (box.clientWidth / 2 - camera.x) / old * next;
      camera.y = box.clientHeight / 2 - (box.clientHeight / 2 - camera.y) / old * next;
      camera.scale = next; applyCamera();
    }
    function svgPath() { return document.createElementNS('http://www.w3.org/2000/svg', 'path'); }
    function render(nodes, visible, selected, active, content, follow = false) {
      currentId = active ?? 0;
      host.classList.toggle('is-following', follow && q('follow').checked && !fitted);
      const activePath = new Set();
      for (let id = active; id !== undefined && id !== null; id = nodes[id].parent) activePath.add(id);
      let leaf = 0, depth = 0;
      positions.clear();
      // Allocate a horizontal span to each visible subtree and center parents
      // between their children. Unvisited branches reserve no blank space.
      function layout(id) {
        const node = nodes[id], children = node.children.filter(child => visible.has(child));
        children.forEach(layout);
        const x = children.length ? (positions.get(children[0]).x + positions.get(children.at(-1)).x) / 2 : card.margin + leaf++ * (card.width + card.gap);
        positions.set(id, { x, y: card.margin + node.depth * card.level }); depth = Math.max(depth, node.depth);
      }
      if (visible.has(0)) layout(0);
      width = Math.max(card.width, leaf * (card.width + card.gap) - card.gap) + 2 * card.margin;
      height = depth * card.level + card.height + 2 * card.margin;
      q('scene').style.width = `${width}px`; q('scene').style.height = `${height}px`;
      q('edges').setAttribute('width', width); q('edges').setAttribute('height', height);
      q('empty').hidden = visible.size > 0;
      for (const [id, el] of elements) if (!visible.has(id)) { el.remove(); elements.delete(id); }
      for (const [id, el] of edges) if (!visible.has(id)) { el.remove(); edges.delete(id); }
      for (const [id, state] of visible) {
        const node = nodes[id], point = positions.get(id);
        let button = elements.get(id);
        if (!button) {
          button = document.createElement('button'); button.type = 'button'; button.dataset.node = id;
          q('nodes').append(button); elements.set(id, button);
        }
        button.className = `sd-node ${state}${selected === id ? ' is-selected' : ''}${active === id ? ' is-current' : ''}${activePath.has(id) ? ' on-path' : ''}`;
        button.setAttribute('aria-pressed', String(selected === id));
        if (active === id) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
        button.style.transform = `translate(${point.x}px, ${point.y}px)`;
        const markup = content(node, state, active === id);
        if (button.innerHTML !== markup) button.innerHTML = markup;
        if (node.parent !== null) {
          let path = edges.get(id);
          if (!path) { path = svgPath(); q('edges').append(path); edges.set(id, path); }
          const parent = positions.get(node.parent), x1 = parent.x + card.width / 2, y1 = parent.y + card.height, x2 = point.x + card.width / 2;
          path.setAttribute('d', `M${x1},${y1} C${x1},${y1 + 25} ${x2},${point.y - 25} ${x2},${point.y}`);
          path.setAttribute('class', `sd-edge${activePath.has(id) ? ' is-active' : state === 'done' || state === 'cached' ? ' is-done' : ''}`);
        }
      }
      // Only one cache-reference arc at a time, to avoid crossing every branch.
      q('edges').querySelector('.sd-cache-edge')?.remove();
      const selectedNode = nodes[selected];
      if (visible.get(selected) === 'cached' && positions.has(selectedNode.reuse)) {
        const from = positions.get(selected), to = positions.get(selectedNode.reuse), path = svgPath();
        const x1 = from.x + card.width / 2, x2 = to.x + card.width / 2;
        path.setAttribute('d', `M${x1},${from.y} Q${(x1 + x2) / 2},${Math.min(from.y, to.y) - 22} ${x2},${to.y}`);
        path.setAttribute('class', 'sd-cache-edge'); q('edges').append(path);
      }
      if (fitted) fit();
      // Put the newly active call on screen immediately, including large
      // returns/jumps. A camera tween could hide it for most of a fast step.
      else if (follow && q('follow').checked && active !== undefined) center(active, false, true);
      else if (visible.size <= 1) center(0, false);
    }
    on(q('fit'), 'click', () => { fitted = true; fit(); });
    on(q('active'), 'click', () => { fitted = false; q('follow').checked = true; center(currentId, true, true); });
    on(q('follow'), 'change', () => { if (q('follow').checked) { fitted = false; center(currentId, true, true); } });
    on(q('in'), 'click', () => zoom(1.25)); on(q('out'), 'click', () => zoom(.8));
    on(q('nodes'), 'click', e => { const button = e.target.closest('[data-node]'); if (button) select(Number(button.dataset.node)); });
    on(q('viewport'), 'pointerdown', e => {
      if (e.button !== 0 || e.target.closest('[data-node]')) return;
      pan = { id: e.pointerId, x: e.clientX, y: e.clientY, cameraX: camera.x, cameraY: camera.y };
      fitted = false; q('follow').checked = false; q('viewport').setPointerCapture(e.pointerId); e.preventDefault();
    });
    on(q('viewport'), 'pointermove', e => {
      if (!pan || pan.id !== e.pointerId) return;
      camera.x = pan.cameraX + e.clientX - pan.x; camera.y = pan.cameraY + e.clientY - pan.y; applyCamera(false);
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) on(q('viewport'), event, () => { pan = null; });
    const observer = new ResizeObserver(() => { if (fitted) fit(false); else if (q('follow').checked) center(currentId, false); }); observer.observe(q('viewport'));
    return {
      render,
      reset() { elements.clear(); edges.clear(); positions.clear(); q('nodes').replaceChildren(); q('edges').replaceChildren(); camera = { x: 0, y: 0, scale: 1 }; fitted = false; },
      fit() { fitted = true; fit(); },
      resume() { fitted = false; },
      inspect(id) { fitted = false; center(id, true, true); },
      destroy() { observer.disconnect(); abort.abort(); }
    };
  };
})();
