const assert = require('node:assert/strict');
const M = require('../widgets/piston-model.js');
let seed = 4273;
const rand = n => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
function verify(state,id) {
  const original=JSON.stringify(state), p=M.plan(state,id), before=M.occupancy(state), after=M.occupancy(p.after);
  assert.equal(JSON.stringify(state),original);
  assert.equal(after.size,p.after.length,'No overlaps after movement');
  assert.equal(M.occupancy(p.extended).size,p.extended.length);
  const base=state.find(x=>x.id===id);
  if(base.type==='permanent') {
    let row=base.row+1;while(before.has(`${row},${base.col}`))row++;
    assert(after.has(`${row},${base.col}`));
    assert.equal(after.size,before.size+1);
    for(const key of before.keys())assert(after.has(key),'Only the first F changes');
    assert(p.after.find(x=>x.id===id).active);
    assert.throws(()=>M.plan(p.after,id));
  } else {
    // Independent fixed-point closure (rather than the model's recursive DFS).
    const first=`${base.row},${base.col+1}`, expected=new Set(before.has(first)?[first]:[]);
    let changed=true;
    while(changed) {
      changed=false;
      for(const key of [...expected]) {
        const [r,c]=key.split(',').map(Number);
        for(const neighbor of [`${r-1},${c}`,`${r+1},${c}`,`${r},${c+1}`])if(before.has(neighbor)&&!expected.has(neighbor)){expected.add(neighbor);changed=true;}
      }
    }
    assert.deepEqual(new Set(p.moved),new Set([...expected].map(key=>before.get(key).id)));
    assert.equal(after.size,before.size);
    for(const old of state) {
      const next=p.after.find(x=>x.id===old.id);
      assert.equal(next.row,old.row);assert.equal(next.col,old.col+(expected.has(M.key(old))?1:0));
    }
    assert(!p.after.find(x=>x.id===id).active);
    assert(!p.after.some(x=>x.owner===id));
  }
  return p.after;
}
for(let preset=0;preset<M.PRESETS.length;preset++) {
  let state=M.preset(preset);
  for(let op=0;op<30;op++) {
    const choices=state.filter(p=>p.type!=='head'&&!p.active&&p.col<=10);
    if(!choices.length)break;state=verify(state,choices[rand(choices.length)].id);
  }
}
for(let test=0;test<200;test++) {
  let state=[];
  for(let row=1;row<=7;row++)for(let col=1;col<=10;col++)if(rand(4)===0)state.push({id:`p${row}-${col}`,row,col,type:rand(2)?'temporary':'permanent',active:false});
  // Exercise both types even when low bits of the seeded generator correlate.
  state.forEach((p,i)=>p.type=i%2?'temporary':'permanent');
  for(let op=0;op<10;op++) {
    const choices=state.filter(p=>p.type!=='head'&&!p.active&&p.col<=10);
    if(!choices.length)break;state=verify(state,choices[rand(choices.length)].id);
  }
}
const branch=M.plan(M.preset(1),'p0');
assert(!branch.moved.includes('p8'),'West neighbour is not glued');
assert(branch.moved.includes('p3')&&branch.moved.includes('p7'),'North/south glue and east dependencies are followed');
assert(M.plan(M.preset(3),'p0').after.some(p=>p.col===11),'Off-screen columns remain part of the simulation');
console.log('Piston model: presets and 2,000 mixed pushes agree with independent occupancy/closure checks.');
