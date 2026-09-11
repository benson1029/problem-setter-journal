const assert=require('node:assert/strict'),M=require('../widgets/bob-extended-model.js');
const keys=edges=>edges.map(([a,b])=>M.edge(a,b)).sort();
function check(t,start){const route=M.route(t,start),truth=new Set(keys(t.edges));assert(route.length<=6);let observations=[];
  route.forEach((at,i)=>{if(i)assert(t.neighbors(route[i-1]).includes(at));if(!observations.some(o=>o.at===at))observations.push({at,neighbors:t.neighbors(at)});
    const s=M.decode(t.total,observations),canonical=t.order[0]<t.order[4]?t.order:[...t.order].reverse();
    assert(s.candidates.some(c=>c.order.join()===canonical.join()));assert.equal(s.group,M.group(t.order[0]));
    assert(s.edges.every(e=>truth.has(e)));assert(s.observed.every(e=>truth.has(e)));
    s.slots.forEach((id,j)=>{if(id!==null)assert.equal(id,canonical[j]);});
    assert.equal(M.location(observations.find(o=>o.at===at)).role,t.order.includes(at)?'chain':'leaf');
    for(const e of s.attachments)if(e.host!==null)assert.equal(e.host,t.hosts[e.id]);
    if(i===route.length-1){assert(s.solved);assert.deepEqual([...s.edges].sort(),[...truth].sort());}
  });
}
for(const total of [10,15,20,25,30])for(let seed=1;seed<=12;seed++){const t=M.generate(total,seed);for(let start=1;start<=total;start++)check(t,start);}
// Every noncentral permutation, including reversal, and empty endpoints.
for(let g=0;g<3;g++)for(const order of M.orders(g).flatMap(p=>[p,[...p].reverse()])){
  const hosts={};for(let id=1;id<=15;id++)if(!order.includes(id))hosts[id]=order[(id%3)+1];const t=M.create(15,order,hosts);
  for(let start=1;start<=15;start++)check(t,start);
  assert.equal(t.neighbors(order[0]).length,1);assert.equal(M.location({at:order[0],neighbors:t.neighbors(order[0])}).role,'chain');
}
assert.equal(M.decode(20,[]).candidates.length,48);assert(Object.values(M.decode(20,[]).roles).every(role=>role==='unknown'));
assert.equal(M.location().role,'unknown');
// Independent brute-force graph oracle, including all 5^5 leaf assignments.
// Compare the decoder's consensus, not merely its result on the true tree.
const sample=M.generate(10,77,'leaf'),obs=[{at:sample.start,neighbors:sample.neighbors(sample.start)}];
let count=0,common=null;const possibleOrders=new Set();
for(let g=0;g<2;g++)for(const order of M.orders(g)){
  const leaves=Array.from({length:10},(_,i)=>i+1).filter(id=>!order.includes(id));
  for(let mask=0;mask<3125;mask++){let value=mask;const edges=order.slice(1).map((id,i)=>[order[i],id]);for(const id of leaves){edges.push([id,order[value%5]]);value=Math.floor(value/5);}
    if(!obs.every(o=>{const neighbors=edges.flatMap(([a,b])=>a===o.at?[b]:b===o.at?[a]:[]);return neighbors.length===o.neighbors.length&&neighbors.every(id=>o.neighbors.includes(id));}))continue;
    const set=new Set(keys(edges));common=common?new Set([...common].filter(e=>set.has(e))):set;count++;possibleOrders.add(order.join());
  }
}
const decoded=M.decode(10,obs);assert(count>1);assert.deepEqual(new Set(decoded.candidates.map(c=>c.order.join())),possibleOrders);assert.deepEqual(new Set(decoded.edges),common);
assert.throws(()=>M.create(15,[6,7,9,8,10],{}));
console.log('Extended Bob: every start, all 24 outer permutations, empty endpoints, center U-turns, exact partial knowledge, five-move decoding and exhaustive 75,000-tree consensus oracle passed.');
