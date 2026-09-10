(function (scope) {
  'use strict';
  const key = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
  function tree(labels, edges) {
    const n = labels.length;
    if (n < 2 || n > 24 || new Set(labels).size !== n || edges.length !== n - 1) throw new Error('Use a connected tree with 2–24 distinct labels and N−1 edges.');
    const adjacency = Array.from({ length: n }, () => []), edgeSet = new Set();
    for (const [a, b] of edges) {
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= n || b >= n || a === b || edgeSet.has(key(a, b))) throw new Error('Edges must join distinct existing labels, without duplicates.');
      adjacency[a].push(b); adjacency[b].push(a); edgeSet.add(key(a, b));
    }
    const preorder = [], seen = new Set();
    function dfs(u) { seen.add(u); preorder.push(u); for (const v of adjacency[u]) if (!seen.has(v)) dfs(v); }
    dfs(0); if (seen.size !== n) throw new Error('The edges must form one connected tree.');
    return { n, labels, edges, adjacency, edgeSet, preorder };
  }
  function preset(kind = 'book', n = 12, seed = 42) {
    if (kind === 'book') return tree('ABCDEFGHIJKL'.split(''), [[0,1],[0,2],[1,3],[1,4],[3,7],[4,8],[4,9],[2,5],[2,6],[5,10],[5,11]]);
    n = Math.max(2, Math.min(24, Math.trunc(n)));
    let s = seed >>> 0;
    const random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const ids = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 1; i--) { const j = 1 + Math.floor(random() * i); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    const edges = [];
    for (let i = 1; i < n; i++) edges.push([ids[kind === 'star' ? 0 : kind === 'chain' ? i - 1 : kind === 'balanced' ? Math.floor((i - 1) / 2) : Math.floor(random() * i)], ids[i]]);
    return tree(Array.from({ length: n }, (_, i) => String(i + 1)), edges);
  }
  function parse(text) {
    const pairs = text.trim().split(/[,;\n]+/).map(line => line.trim().split(/\s+/));
    if (pairs.some(pair => pair.length !== 2 || pair.some(label => !/^[a-zA-Z0-9]{1,5}$/.test(label)))) throw new Error('Write one edge per line, such as A B. Use short letters or numbers for labels.');
    const labels = [...new Set(pairs.flat())];
    return tree(labels, pairs.map(pair => pair.map(label => labels.indexOf(label))));
  }
  function ask(t, a, b) {
    if (!a.length || !b.length || a.some(u => b.includes(u))) throw new Error('Query sets must be nonempty and disjoint.');
    return a.some(u => b.some(v => t.edgeSet.has(key(u, v))));
  }
  function reconstruct(t, mode = 'binary', prefix = Math.ceil(t.n / 2)) {
    const limit = mode === 'amortized' ? t.n : mode === 'hybrid' ? Math.max(1, Math.min(t.n, prefix)) : 1;
    const state = { edges: [], pool: Array.from({ length: t.n - 1 }, (_, i) => i + 1), stack: [0], closed: [], position: 1, active: 0, candidates: [], query: null, phase: limit > 1 ? 'preorder' : 'binary', queries: 0, yes: 0, no: 0, exits: 0, splits: 0, prefixQueries: 0, binaryQueries: 0 };
    const events = [];
    const emit = (type, note) => events.push({ ...state, edges: state.edges.map(e => [...e]), pool: [...state.pool], stack: [...state.stack], closed: [...state.closed], candidates: [...state.candidates], query: state.query && { ...state.query, a: [...state.query.a], b: [...state.query.b] }, type, note });
    const labels = list => list.map(v => t.labels[v]).join(', ');
    emit('start', `Start a partial tree at ${t.labels[0]}. ${mode === 'binary' ? 'The preorder is not used.' : `Alice supplies ${limit} preorder labels.`}`);
    function query(a, b, kind) {
      state.query = { a, b, kind, answer: null }; state.active = a[0];
      emit('ask', `Ask whether {${labels(a)}} has an edge to {${labels(b)}}.`);
      const answer = ask(t, a, b); state.query = { a, b, kind, answer };
      state.queries++; if (answer) state.yes++; else state.no++;
      if (kind === 'split') state.splits++;
      if (state.phase === 'preorder') state.prefixQueries++; else state.binaryQueries++;
      emit('answer', `${answer ? 'Yes' : 'No'}. ${kind === 'parent' ? answer ? 'The next preorder entry is a child here.' : 'Exit this vertex; try its parent.' : kind === 'exists' ? answer ? 'At least one unmatched neighbor exists. Narrow the candidates.' : 'No unmatched neighbors remain here. Exit this vertex.' : answer ? 'Keep the tested half.' : 'Keep the other half; a neighbor is already known to exist.'}`);
      return answer;
    }
    function connect(u, v) {
      state.edges.push([u, v]); state.pool = state.pool.filter(w => w !== v); state.stack.push(v); state.active = v; state.candidates = []; state.query = null;
      emit('attach', `Recover ${t.labels[u]}—${t.labels[v]}. Move ${t.labels[v]} from the pool into the partial tree.`);
    }
    function exit() {
      const u = state.stack.pop(); state.closed.push(u); state.exits++; state.active = state.stack.at(-1); state.query = null; state.candidates = [];
      emit('exit', `Exit ${t.labels[u]} permanently. This vertex can never cost another exit query.`);
    }
    for (let i = 1; i < limit; i++) {
      const v = t.preorder[i]; state.position = i; state.candidates = [v];
      while (!query([state.stack.at(-1)], [v], 'parent')) exit();
      connect(state.stack.at(-1), v); state.position = i + 1;
    }
    if (mode === 'hybrid' && state.pool.length) { state.phase = 'binary'; state.query = null; emit('phase', 'The prefix ends. Keep its open DFS path; exited vertices are already finished. Search the remaining pool from this path.'); }
    while (state.pool.length) {
      state.phase = 'binary'; const u = state.stack.at(-1); state.candidates = [...state.pool];
      if (!query([u], [...state.pool], 'exists')) { exit(); continue; }
      let candidates = [...state.pool];
      while (candidates.length > 1) {
        state.candidates = [...candidates]; const half = candidates.slice(0, Math.ceil(candidates.length / 2));
        const answer = query([u], half, 'split'); candidates = answer ? half : candidates.slice(half.length);
        state.candidates = [...candidates]; emit('narrow', `${candidates.length} candidate${candidates.length === 1 ? '' : 's'} remain: ${labels(candidates)}.`);
      }
      connect(u, candidates[0]);
    }
    state.query = null; state.candidates = []; state.position = limit;
    emit('done', `Recovered all ${t.n - 1} edges in ${state.queries} queries. ${state.exits} vertices were exited; none was exited twice.`);
    return { events, limit };
  }
  function chain(length = 5, hosts = [1,2,3,4,5,3,1,4]) {
    if (![2,4,5].includes(length) || !hosts.length || hosts.some(v => !Number.isInteger(v) || v < 1 || v > length)) throw new Error('Choose a 2-, 4- or 5-vertex chain and valid leaf attachments.');
    const neighbors = u => u <= length ? [u > 1 ? u - 1 : null, u < length ? u + 1 : null, ...hosts.flatMap((h, i) => h === u ? [length + i + 1] : [])].filter(v => v !== null) : [hosts[u - length - 1]];
    return { length, hosts: [...hosts], total: length + hosts.length, neighbors };
  }
  function observe(c, path) {
    const visited = new Set(path.filter(u => u <= c.length)), known = new Map(), inferred = new Set();
    for (const u of path) for (const v of c.neighbors(u)) {
      if (u > c.length) known.set(u, v); if (v > c.length) known.set(v, u);
    }
    const unseen = Array.from({ length: c.length }, (_, i) => i + 1).filter(u => !visited.has(u));
    if (unseen.length === 1) for (let leaf = c.length + 1; leaf <= c.total; leaf++) if (!known.has(leaf)) { known.set(leaf, unseen[0]); inferred.add(leaf); }
    return { visited: [...visited], known: [...known], inferred: [...inferred], solved: known.size === c.hosts.length, moves: path.length - 1, current: path.at(-1) };
  }
  function chainRoute(c, start) {
    // Planning depends only on the public core chain and the initial local
    // neighborhood. Never use unseen leaf attachments to choose the walk.
    const initial = start <= c.length ? [start] : [start, c.neighbors(start)[0]];
    const queue = [initial], seen = new Set();
    while (queue.length) {
      const path = queue.shift(), u = path.at(-1), visited = [...new Set(path.filter(v => v <= c.length))];
      if (visited.length >= c.length - 1) return path;
      if (path.length > 5) continue;
      const signature = `${u}:${visited.sort((a,b) => a-b).join(',')}`;
      if (seen.has(signature)) continue; seen.add(signature);
      for (const v of c.neighbors(u).filter(v => v <= c.length)) queue.push([...path, v]);
    }
    throw new Error('No five-move decoding walk found.');
  }
  const api = { tree, preset, parse, ask, reconstruct, chain, observe, chainRoute };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else scope.TreeSpeculation = api;
})(typeof window === 'undefined' ? globalThis : window);
