const assert = require('node:assert/strict'), M = require('../widgets/tree-speculation-model.js');
const keys = edges => edges.map(([a,b]) => [Math.min(a,b),Math.max(a,b)].join(':')).sort();
for (let n = 2; n <= 24; n++) for (let seed = 1; seed <= 12; seed++) {
  const tree = M.preset(['random','chain','star','balanced'][seed % 4], n, seed);
  for (const mode of ['binary','amortized','hybrid']) {
    const { events, limit } = M.reconstruct(tree, mode, 1 + seed % n), last = events.at(-1);
    assert.deepEqual(keys(last.edges), keys(tree.edges));
    assert.equal(last.pool.length, 0);
    assert(last.exits <= n - 1);
    assert.equal(new Set(last.closed).size, last.closed.length);
    if (mode === 'amortized') { assert(last.queries <= 2*n-2); assert.equal(last.yes, n-1); }
    const answers = events.filter(e => e.type === 'answer');
    assert.equal(answers.length, last.queries);
    for (const e of events) {
      assert(e.edges.every(edge => tree.edgeSet.has(keys([edge])[0])));
      assert(e.stack.every(u => !e.pool.includes(u)));
      assert(e.closed.every(u => !e.stack.includes(u)));
      if (e.type !== 'answer') continue;
      // Direct edge-list oracle, independent of ask().
      const { a, b, answer } = e.query;
      assert(a.every(u => !b.includes(u)));
      assert.equal(answer, tree.edges.some(([u,v]) => a.includes(u)&&b.includes(v)||a.includes(v)&&b.includes(u)));
    }
    if (mode === 'hybrid') assert(last.splits <= (n-limit)*Math.ceil(Math.log2(Math.max(1,n-limit))));
  }
}
const book=M.preset();
assert.equal(book.preorder.map(u=>book.labels[u]).join(''),'ABDHEIJCFKLG');
const tail=M.reconstruct(book,'amortized').events.filter(e=>e.type==='answer' && e.query.b[0]===6);
assert.deepEqual(tail.map(e=>[book.labels[e.query.a[0]],e.query.answer]),[['L',false],['F',false],['C',true]]);
for(const length of [2,4,5]) for(let seed=0;seed<9;seed++) {
  const c=M.chain(length,Array.from({length:12},(_,i)=>1+(i*3+seed)%length));
  for(let start=1;start<=c.total;start++) {
    const route=M.chainRoute(c,start); assert(route.length-1<=5);
    route.slice(1).forEach((v,i)=>assert(c.neighbors(route[i]).includes(v)));
    const state=M.observe(c,route); assert(state.solved);
    for(const [leaf,host] of state.known) assert.equal(host,c.hosts[leaf-length-1]);
  }
}
assert.throws(()=>M.parse('A B, C D, D E'));
assert.throws(()=>M.parse('A B, B C, C A'));
console.log('Tree Speculation: all reconstructions, query answers, amortized bounds, book L/F/C trace, and every chain starting position passed.');
